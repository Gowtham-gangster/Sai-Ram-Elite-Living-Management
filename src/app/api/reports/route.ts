import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

import { formatSharingType } from '@/lib/formatters';
import { maskAadhaar } from '@/lib/residentStats';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType') || 'ALL';
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const residentId = searchParams.get('residentId');
    const roomId = searchParams.get('roomId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const now = new Date();

    // 1. Fetch All Data for Unified Reports
    const [allRooms, allResidents, allPayments, allReceipts, hostelSettings] = await Promise.all([
      db.room.findMany({
        include: {
          residents: {
            where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
            select: { id: true, fullName: true, phone: true, checkInDate: true, status: true, monthlyRent: true },
          },
        },
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      }),
      db.resident.findMany({
        include: {
          room: { select: { roomNumber: true, floor: true, sharingType: true } },
          monthlyPayments: { orderBy: { billingMonth: 'desc' } },
        },
        orderBy: { checkInDate: 'desc' },
      }),
      db.monthlyPayment.findMany({
        include: {
          resident: { select: { id: true, fullName: true, phone: true, alternatePhone: true, status: true } },
          room: { select: { id: true, roomNumber: true, floor: true, sharingType: true } },
          receipts: true,
          paymentRecords: true,
        },
        orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
      }),
      db.receipt.findMany({
        orderBy: { paymentDate: 'desc' },
        include: {
          monthlyPayment: {
            include: { resident: true, room: true },
          },
        },
      }),
      db.hostelSettings.findUnique({ where: { id: 'default' } }),
    ]);

    // 1. RESIDENT REPORT
    const residentReport = allResidents.map((r) => ({
      residentId: r.id,
      fullName: r.fullName,
      phone: r.phone,
      alternatePhone: r.alternatePhone || 'N/A',
      email: r.email || 'N/A',
      roomNumber: r.room.roomNumber,
      floor: r.room.floor,
      sharingType: formatSharingType(r.room.sharingType),
      agreedMonthlyRent: r.monthlyRent || 0,
      securityDeposit: r.securityDeposit || 'N/A',
      checkInDate: r.checkInDate,
      expectedCheckoutDate: r.expectedCheckoutDate || null,
      checkOutDate: r.checkOutDate || null,
      idProofType: r.idProofType || 'N/A',
      idProofNumber: r.idProofNumber ? maskAadhaar(r.idProofNumber) : 'N/A',
      emergencyContactName: r.emergencyContactName || 'N/A',
      emergencyContactPhone: r.emergencyContactPhone || 'N/A',
      status: r.status,
    }));

    // 2. ROOM OCCUPANCY REPORT
    const roomOccupancyReport = allRooms.map((rm) => {
      const activeCount = rm.residents.length;
      const vacantSlots = Math.max(0, rm.capacity - activeCount);
      const occupancyRate = rm.capacity > 0 ? Math.round((activeCount / rm.capacity) * 100) : 0;
      const isPaymentManaged = rm.paymentEnabled !== false;
      const currentRealizedRevenue = isPaymentManaged
        ? rm.residents.reduce((sum, res) => sum + (res.monthlyRent || 0), 0)
        : 0;

      return {
        roomId: rm.id,
        roomNumber: rm.roomNumber,
        floor: rm.floor,
        sharingType: formatSharingType(rm.sharingType),
        capacity: rm.capacity,
        activeResidentsCount: activeCount,
        availableSlots: vacantSlots,
        occupancyRatePercentage: occupancyRate,
        currentRealizedRevenue,
        paymentEnabled: isPaymentManaged,
        paymentManagementStatus: isPaymentManaged ? 'Enabled' : 'Not Applicable',
        status: rm.status,
        residents: rm.residents.map((res) => res.fullName).join(', ') || 'None',
      };
    });

    // 3. MONTHLY PAYMENT REPORT
    const monthlyPaymentReport = allPayments.map((p) => ({
      paymentId: p.id,
      residentName: p.resident.fullName,
      phone: p.resident.phone,
      roomNumber: p.room.roomNumber,
      floor: p.room.floor,
      billingMonth: p.billingMonth,
      rentAmount: p.rentAmount,
      maintenanceAmount: p.maintenanceAmount || 0,
      penaltyAmount: p.penaltyAmount || 0,
      discountAmount: p.discountAmount || 0,
      totalAmountDue: p.totalAmountDue,
      status: p.status,
      dueDate: p.dueDate,
      paidDate: p.paidDate || null,
      paymentMethod: p.paymentMethod || 'N/A',
      receiptNumber: p.receiptNumber || 'N/A',
      transactionReference: p.transactionReference || 'N/A',
    }));

    // 4. PENDING PAYMENT REPORT
    const pendingPaymentReport = allPayments
      .filter((p) => (p.status === 'PENDING' || p.status === 'SUBMITTED') && (p.room as any)?.paymentEnabled !== false)
      .map((p) => {
        const daysPending = Math.max(0, Math.ceil((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
        return {
          paymentId: p.id,
          residentName: p.resident.fullName,
          phone: p.resident.phone,
          roomNumber: p.room.roomNumber,
          billingMonth: p.billingMonth,
          amountDue: p.totalAmountDue,
          dueDate: p.dueDate,
          daysPending,
          status: p.status,
        };
      });

    // 5. OVERDUE PAYMENT REPORT
    const overduePaymentReport = allPayments
      .filter((p) => (p.status === 'OVERDUE' || (p.status === 'PENDING' && new Date(p.dueDate) < now)) && (p.room as any)?.paymentEnabled !== false)
      .map((p) => {
        const daysOverdue = Math.max(1, Math.ceil((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)));

        return {
          paymentId: p.id,
          residentName: p.resident.fullName,
          phone: p.resident.phone,
          roomNumber: p.room.roomNumber,
          billingMonth: p.billingMonth,
          amountDue: p.totalAmountDue,
          dueDate: p.dueDate,
          daysOverdue,
          status: 'OVERDUE',
        };
      });

    // 6. COLLECTION REPORT
    const collectionReport = allReceipts.map((rc) => ({
      receiptId: rc.id,
      receiptNumber: rc.receiptNumber,
      residentName: rc.residentName,
      roomNumber: rc.roomNumber,
      billingMonth: rc.billingMonth,
      amountPaid: rc.amountPaid,
      paymentMethod: rc.paymentMethod,
      paymentDate: rc.paymentDate,
      generatedBy: rc.generatedBy,
      notes: rc.notes || 'N/A',
    }));

    // 7. CHECKOUT / VACATED REPORT
    const checkoutReport = allResidents
      .filter((r) => r.status === 'VACATED' || r.checkOutDate)
      .map((r) => {
        const checkIn = new Date(r.checkInDate);
        const checkOut = r.checkOutDate ? new Date(r.checkOutDate) : now;
        const stayDurationDays = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          residentId: r.id,
          fullName: r.fullName,
          phone: r.phone,
          roomNumber: r.room.roomNumber,
          floor: r.room.floor,
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          stayDurationDays,
          securityDeposit: r.securityDeposit || 'N/A',
          status: r.status,
          notes: r.notes || 'Normal checkout',
        };
      });

    // Summary Statistics
    const totalRooms = allRooms.length;
    const totalCapacity = allRooms.reduce((acc, r) => acc + r.capacity, 0);
    const totalActiveResidents = allResidents.filter((r) => r.status === 'ACTIVE' || r.status === 'NOTICE_PERIOD').length;
    const occupancyPercentage = totalCapacity > 0 ? Math.round((totalActiveResidents / totalCapacity) * 100) : 0;
    const totalBilledAllTime = allPayments.reduce((acc, p) => acc + p.totalAmountDue, 0);
    const totalCollectedAllTime = allPayments.filter((p) => p.status === 'PAID').reduce((acc, p) => acc + p.totalAmountDue, 0);
    const totalPendingCurrent = pendingPaymentReport.reduce((acc, p) => acc + p.amountDue, 0);
    const totalOverdueCurrent = overduePaymentReport.reduce((acc, p) => acc + p.amountDue, 0);

    return NextResponse.json({
      summary: {
        totalRooms,
        totalCapacity,
        totalActiveResidents,
        occupancyPercentage,
        totalBilledAllTime,
        totalCollectedAllTime,
        totalPendingCurrent,
        totalOverdueCurrent,
        totalCheckedOut: checkoutReport.length,
        totalReceiptsIssued: allReceipts.length,
      },
      reports: {
        residentReport,
        roomOccupancyReport,
        monthlyPaymentReport,
        pendingPaymentReport,
        overduePaymentReport,
        collectionReport,
        checkoutReport,
      },
    });
  } catch (error: any) {
    console.error('Error generating reports:', error);
    return NextResponse.json({ error: 'Failed to compile management reports' }, { status: 500 });
  }
}
