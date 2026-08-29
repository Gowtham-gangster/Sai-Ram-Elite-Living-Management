import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // 1. Fetch ALL Dashboard Sections in Parallel via Promise.all
    const [
      totalRegistrations,
      newRegistrations,
      underReviewRegistrations,
      approvedRegistrations,
      rejectedRegistrations,
      recentRegistrationsList,
      rooms,
      allResidents,
      allPayments,
      totalReceiptsCount,
    ] = await Promise.all([
      db.registration.count(),
      db.registration.count({ where: { status: 'NEW' } }),
      db.registration.count({ where: { status: 'UNDER_REVIEW' } }),
      db.registration.count({ where: { status: 'APPROVED' } }),
      db.registration.count({ where: { status: 'REJECTED' } }),
      db.registration.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          mobileNumber: true,
          requestedRoomNumber: true,
          occupation: true,
          occupationType: true,
          companyOrCollegeName: true,
          checkInDate: true,
          securityDeposit: true,
          status: true,
          createdAt: true,
          sourceSubmittedAt: true,
        },
      }),
      // Rooms & Live Occupancy (Pruned projection)
      db.room.findMany({
        select: {
          id: true,
          roomNumber: true,
          floor: true,
          capacity: true,
          sharingType: true,
          paymentEnabled: true,
          residents: {
            where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
            select: { id: true, fullName: true, phone: true, checkInDate: true, status: true, monthlyRent: true },
          },
        },
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      }),
      // Resident Records (Pruned projection)
      db.resident.findMany({
        select: {
          id: true,
          fullName: true,
          phone: true,
          monthlyRent: true,
          status: true,
          checkInDate: true,
          room: { select: { roomNumber: true, floor: true, paymentEnabled: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Monthly Payments & Receipts (Pruned projection)
      db.monthlyPayment.findMany({
        select: {
          id: true,
          status: true,
          totalAmountDue: true,
          billingMonth: true,
          paymentMethod: true,
          paidDate: true,
          receiptNumber: true,
          resident: { select: { fullName: true, phone: true } },
          room: { select: { roomNumber: true, paymentEnabled: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.receipt.count(),
    ]);

    const pendingRegistrations = newRegistrations + underReviewRegistrations;

    // 2. Compute Rooms & Live Occupancy
    const totalRooms = rooms.length;
    const totalRoomCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
    const totalActiveResidents = rooms.reduce((acc, r) => acc + r.residents.length, 0);
    const occupiedRooms = rooms.filter((r) => r.residents.length > 0).length;
    const availableRooms = rooms.filter((r) => r.residents.length < r.capacity).length;
    const availableCapacity = Math.max(0, totalRoomCapacity - totalActiveResidents);
    const occupancyPercentage =
      totalRoomCapacity > 0 ? Math.round((totalActiveResidents / totalRoomCapacity) * 100) : 0;

    // Floor breakdown
    const floorMap: Record<number, { floor: number; capacity: number; occupied: number; roomsCount: number }> = {};
    for (const r of rooms) {
      if (!floorMap[r.floor]) {
        floorMap[r.floor] = { floor: r.floor, capacity: 0, occupied: 0, roomsCount: 0 };
      }
      floorMap[r.floor].roomsCount += 1;
      floorMap[r.floor].capacity += r.capacity;
      floorMap[r.floor].occupied += r.residents.length;
    }
    const floorBreakdown = Object.values(floorMap);

    // Sharing type breakdown
    const sharingMap: Record<string, { sharingType: string; count: number; capacity: number; occupied: number }> = {};
    for (const r of rooms) {
      if (!sharingMap[r.sharingType]) {
        sharingMap[r.sharingType] = { sharingType: r.sharingType, count: 0, capacity: 0, occupied: 0 };
      }
      sharingMap[r.sharingType].count += 1;
      sharingMap[r.sharingType].capacity += r.capacity;
      sharingMap[r.sharingType].occupied += r.residents.length;
    }
    const sharingBreakdown = Object.values(sharingMap);

    // 3. Compute Resident Metrics
    const activeResidentsList = allResidents.filter(
      (r) => (r.status === 'ACTIVE' || r.status === 'NOTICE_PERIOD') && r.room?.paymentEnabled !== false
    );
    const expectedMonthlyCollection = activeResidentsList.reduce((acc, r) => acc + (r.monthlyRent || 0), 0);

    const newResidentsThisMonth = allResidents.filter((r) => {
      const checkIn = new Date(r.checkInDate);
      return checkIn >= startOfCurrentMonth && checkIn <= endOfCurrentMonth;
    }).length;

    const residentsInNoticePeriod = allResidents.filter((r) => r.status === 'NOTICE_PERIOD').length;

    // 4. Compute Payment Metrics
    const paidPaymentsList = allPayments.filter((p) => p.status === 'PAID');
    const paidPaymentsCount = paidPaymentsList.length;
    const totalPaymentsCollected = paidPaymentsList.reduce((acc, p) => acc + (p.totalAmountDue || 0), 0);

    const pendingPaymentsList = allPayments.filter(
      (p) => (p.status === 'PENDING' || p.status === 'SUBMITTED' || p.status === 'OVERDUE') && p.room?.paymentEnabled !== false
    );
    const pendingPaymentsCount = pendingPaymentsList.length;
    const outstandingAmount = pendingPaymentsList.reduce((acc, p) => acc + (p.totalAmountDue || 0), 0);

    return NextResponse.json({
      metrics: {
        // Registrations
        totalRegistrations,
        pendingRegistrations,
        newRegistrations,
        underReviewRegistrations,
        approvedRegistrations,
        rejectedRegistrations,

        // Residents
        activeResidents: totalActiveResidents,
        newResidentsThisMonth,
        residentsInNoticePeriod,
        expectedMonthlyCollection,

        // Rooms (Strictly Rooms - Zero Beds)
        totalRooms,
        totalRoomCapacity,
        occupiedRooms,
        availableRooms,
        availableCapacity,
        occupancyPercentage,

        // Payments & Receipts
        pendingPaymentsCount,
        paidPaymentsCount,
        outstandingAmount,
        totalPaymentsCollected,
        totalReceiptsCount,
        currentBillingMonth: currentMonthStr,
      },
      registrations: recentRegistrationsList,
      visualizations: {
        floorBreakdown,
        sharingBreakdown,
        recentResidents: allResidents.slice(0, 5).map((r) => ({
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          roomNumber: r.room.roomNumber,
          floor: r.room.floor,
          checkInDate: r.checkInDate,
          status: r.status,
          monthlyRent: r.monthlyRent || 0,
        })),
        recentPayments: allPayments.slice(0, 5).map((p) => ({
          id: p.id,
          residentName: p.resident.fullName,
          roomNumber: p.room.roomNumber,
          billingMonth: p.billingMonth,
          totalAmountDue: p.totalAmountDue,
          status: p.status,
          paymentMethod: p.paymentMethod,
          paidDate: p.paidDate,
          receiptNumber: p.receiptNumber,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Failed to calculate dashboard statistics' }, { status: 500 });
  }
}
