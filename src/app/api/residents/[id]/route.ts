import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  ResidentSchema,
  ChangeRoomSchema,
  NoticePeriodSchema,
  CheckOutResidentSchema,
} from '@/lib/validations';
import { createNotification } from '@/lib/notifications';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const resident = await db.resident.findUnique({
      where: { id },
      include: {
        room: true,
        monthlyPayments: {
          orderBy: { billingMonth: 'desc' },
          include: {
            receipts: true,
            paymentRecords: true,
          },
        },
        reminders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    return NextResponse.json({ resident });
  } catch (error: any) {
    console.error('Error fetching resident profile:', error);
    return NextResponse.json({ error: 'Failed to fetch resident profile' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ResidentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid resident input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if phone number is taken by another resident
    if (data.phone) {
      const existingPhone = await db.resident.findFirst({
        where: {
          phone: data.phone,
          NOT: { id },
        },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: `Phone number ${data.phone} is already assigned to another resident (${existingPhone.fullName}).` },
          { status: 409 }
        );
      }
    }

    const updatedResident = await db.resident.update({
      where: { id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        email: data.email || null,
        roomId: data.roomId,
        monthlyRent: data.monthlyRent,
        securityDeposit: data.securityDeposit !== undefined && data.securityDeposit !== null ? String(data.securityDeposit) : null,
        checkInDate: new Date(data.checkInDate),
        expectedCheckoutDate: data.expectedCheckoutDate ? new Date(data.expectedCheckoutDate) : null,
        checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : null,
        idProofType: data.idProofType || 'AADHAAR',
        idProofNumber: data.idProofNumber || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        address: data.address || null,
        status: data.status,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ success: true, resident: updatedResident });
  } catch (error: any) {
    console.error('Error updating resident:', error);
    return NextResponse.json({ error: 'Failed to update resident' }, { status: 500 });
  }
}

// Handler for specific lifecycle transitions: CHANGE_ROOM, START_NOTICE_PERIOD, CHECKOUT
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const resident = await db.resident.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    // 1. CHANGE ROOM ACTION
    if (action === 'CHANGE_ROOM') {
      const parsed = ChangeRoomSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid room transfer data', details: parsed.error.format() }, { status: 400 });
      }

      const { newRoomId, notes } = parsed.data;

      if (newRoomId === resident.roomId) {
        return NextResponse.json({ error: 'Resident is already in this room.' }, { status: 400 });
      }

      // Check target room capacity
      const targetRoom = await db.room.findUnique({
        where: { id: newRoomId },
        include: {
          residents: { where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } } },
        },
      });

      if (!targetRoom) {
        return NextResponse.json({ error: 'Target room not found.' }, { status: 404 });
      }

      if (targetRoom.status === 'MAINTENANCE') {
        return NextResponse.json({ error: `Room ${targetRoom.roomNumber} is under maintenance.` }, { status: 400 });
      }

      const targetCount = targetRoom.residents.length;
      if (targetCount >= targetRoom.capacity) {
        return NextResponse.json(
          { error: `Room ${targetRoom.roomNumber} is full (${targetCount}/${targetRoom.capacity} slots occupied).` },
          { status: 400 }
        );
      }

      const oldRoomNumber = resident.room.roomNumber;
      const oldRoomId = resident.roomId;

      // Transfer resident
      const updated = await db.resident.update({
        where: { id },
        data: {
          roomId: newRoomId,
          monthlyRent: resident.monthlyRent,
        },
      });

      // Update room statuses
      const oldRoomActive = await db.resident.count({
        where: { roomId: oldRoomId, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
      });
      if (oldRoomActive < resident.room.capacity) {
        await db.room.update({ where: { id: oldRoomId }, data: { status: 'AVAILABLE' } });
      }

      if (targetCount + 1 >= targetRoom.capacity) {
        await db.room.update({ where: { id: newRoomId }, data: { status: 'FULL' } });
      }

      // Notification
      await createNotification({
        title: 'Room Transfer Completed',
        message: `${resident.fullName} transferred from Room ${oldRoomNumber} to Room ${targetRoom.roomNumber}.`,
        type: 'INFO',
        linkUrl: '/admin/residents',
      });

      return NextResponse.json({
        success: true,
        message: `${resident.fullName} successfully transferred from Room ${oldRoomNumber} to Room ${targetRoom.roomNumber}.`,
        resident: updated,
      });
    }

    // 2. START NOTICE PERIOD ACTION
    if (action === 'START_NOTICE_PERIOD') {
      const parsed = NoticePeriodSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid notice period data', details: parsed.error.format() }, { status: 400 });
      }

      const { expectedCheckoutDate, notes } = parsed.data;

      const updated = await db.resident.update({
        where: { id },
        data: {
          status: 'NOTICE_PERIOD',
          expectedCheckoutDate: new Date(expectedCheckoutDate),
          notes: notes ? `${resident.notes || ''}\nNotice: ${notes}`.trim() : resident.notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${resident.fullName} is now marked under Notice Period (Expected Checkout: ${expectedCheckoutDate}).`,
        resident: updated,
      });
    }

    // 3. CHECK OUT RESIDENT ACTION (VACATE)
    if (action === 'CHECKOUT') {
      const parsed = CheckOutResidentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid checkout data', details: parsed.error.format() }, { status: 400 });
      }

      const { checkOutDate, notes } = parsed.data;

      const updated = await db.resident.update({
        where: { id },
        data: {
          status: 'VACATED',
          checkOutDate: new Date(checkOutDate),
          notes: notes ? `${resident.notes || ''}\nCheckout: ${notes}`.trim() : resident.notes,
        },
      });

      // Free up room capacity
      await db.room.update({
        where: { id: resident.roomId },
        data: { status: 'AVAILABLE' },
      });

      await createNotification({
        title: 'Resident Checked Out',
        message: `${resident.fullName} successfully checked out from Room ${resident.room.roomNumber}.`,
        type: 'WARNING',
        linkUrl: '/admin/residents',
      });

      return NextResponse.json({
        success: true,
        message: `${resident.fullName} successfully checked out from Room ${resident.room.roomNumber}. Historical records preserved.`,
        resident: updated,
      });
    }

    return NextResponse.json({ error: 'Invalid action provided' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in resident lifecycle action:', error);
    return NextResponse.json({ error: 'Failed to process resident action' }, { status: 500 });
  }
}

// DELETE Handler (Safe Checkout / Archive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const resident = await db.resident.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    // Instead of destroying payment histories, mark as VACATED
    const updated = await db.resident.update({
      where: { id },
      data: {
        status: 'VACATED',
        checkOutDate: new Date(),
      },
    });

    // Free up room capacity
    await db.room.update({
      where: { id: resident.roomId },
      data: { status: 'AVAILABLE' },
    });

    await createNotification({
      title: 'Resident Vacated',
      message: `${resident.fullName} marked as Vacated. Room ${resident.room.roomNumber} slot freed.`,
      type: 'WARNING',
      linkUrl: '/admin/residents',
    });

    return NextResponse.json({
      success: true,
      message: `${resident.fullName} marked as Vacated. Room ${resident.room.roomNumber} slot freed.`,
      resident: updated,
    });
  } catch (error: any) {
    console.error('Error vacating resident:', error);
    return NextResponse.json({ error: 'Failed to vacate resident' }, { status: 500 });
  }
}
