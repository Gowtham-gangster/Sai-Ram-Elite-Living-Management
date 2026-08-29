import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { ResidentSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const roomId = searchParams.get('roomId');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (roomId && roomId !== 'ALL') where.roomId = roomId;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { alternatePhone: { contains: search } },
        { email: { contains: search } },
        { room: { roomNumber: { contains: search } } },
      ];
    }

    const residents = await db.resident.findMany({
      where,
      orderBy: { checkInDate: 'desc' },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            capacity: true,
            sharingType: true,
            status: true,
          },
        },
        monthlyPayments: {
          take: 3,
          orderBy: { billingMonth: 'desc' },
          select: {
            id: true,
            billingMonth: true,
            totalAmountDue: true,
            status: true,
            receiptNumber: true,
            dueDate: true,
            paidDate: true,
          },
        },
      },
    });

    return NextResponse.json({ residents });
  } catch (error: any) {
    console.error('Error fetching residents:', error);
    return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ResidentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid resident data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 1. Check duplicate phone number
    const existingResident = await db.resident.findUnique({
      where: { phone: data.phone },
    });

    if (existingResident) {
      return NextResponse.json(
        { error: `Resident with phone ${data.phone} is already registered (${existingResident.fullName}).` },
        { status: 409 }
      );
    }

    // 2. Check target room and its capacity
    const targetRoom = await db.room.findUnique({
      where: { id: data.roomId },
      include: {
        residents: {
          where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
        },
      },
    });

    if (!targetRoom) {
      return NextResponse.json({ error: 'Selected room not found.' }, { status: 404 });
    }

    if (targetRoom.status === 'MAINTENANCE') {
      return NextResponse.json(
        { error: `Room ${targetRoom.roomNumber} is currently under maintenance.` },
        { status: 400 }
      );
    }

    const currentCount = targetRoom.residents.length;
    if (currentCount >= targetRoom.capacity) {
      return NextResponse.json(
        {
          error: `Room ${targetRoom.roomNumber} is full (Capacity: ${targetRoom.capacity}, Occupied: ${currentCount}). Please select a room with available slots.`,
        },
        { status: 400 }
      );
    }

    const agreedMonthlyRent = data.monthlyRent > 0 ? data.monthlyRent : 0;
    const agreedDeposit =
      data.securityDeposit !== undefined && data.securityDeposit !== null && String(data.securityDeposit).trim() !== ''
        ? String(data.securityDeposit).trim()
        : null;

    // 3. Create resident
    const resident = await db.resident.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        email: data.email || null,
        roomId: data.roomId,
        monthlyRent: agreedMonthlyRent,
        securityDeposit: agreedDeposit,
        checkInDate: new Date(data.checkInDate),
        expectedCheckoutDate: data.expectedCheckoutDate ? new Date(data.expectedCheckoutDate) : null,
        checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : null,
        idProofType: data.idProofType || null,
        idProofNumber: data.idProofNumber || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        address: data.address || null,
        status: data.status || 'ACTIVE',
        notes: data.notes || null,
      },
    });

    // 4. Update room status if now at capacity
    if (currentCount + 1 >= targetRoom.capacity) {
      await db.room.update({
        where: { id: targetRoom.id },
        data: { status: 'FULL' },
      });
    }

    // 5. Automatically create the first month's payment bill for the current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const checkInDay = resident.checkInDate ? new Date(resident.checkInDate).getDate() : now.getDate();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, checkInDay)));

    await db.monthlyPayment.create({
      data: {
        residentId: resident.id,
        roomId: targetRoom.id,
        billingMonth: currentMonthStr,
        rentAmount: agreedMonthlyRent,
        maintenanceAmount: 500,
        penaltyAmount: 0,
        discountAmount: 0,
        totalAmountDue: agreedMonthlyRent + 500,
        status: 'PENDING',
        dueDate: dueDate,
      },
    });

    // Notification
    await createNotification({
      title: 'New Resident Admitted',
      message: `${resident.fullName} was admitted into Room ${targetRoom.roomNumber}.`,
      type: 'SUCCESS',
      linkUrl: '/admin/residents',
    });

    return NextResponse.json({ success: true, resident }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating resident:', error);
    return NextResponse.json({ error: 'Failed to onboard resident' }, { status: 500 });
  }
}
