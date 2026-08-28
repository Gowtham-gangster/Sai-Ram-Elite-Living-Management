import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { RoomSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

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
    const room = await db.room.findUnique({
      where: { id },
      include: {
        residents: {
          orderBy: { checkInDate: 'desc' },
        },
        monthlyPayments: {
          take: 10,
          orderBy: { billingMonth: 'desc' },
          include: { resident: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    let parsedAmenities: string[] = [];
    try {
      parsedAmenities = JSON.parse(room.amenities);
    } catch {
      parsedAmenities = [];
    }

    return NextResponse.json({
      room: {
        ...room,
        amenitiesList: parsedAmenities,
      },
    });
  } catch (error: any) {
    console.error('Error fetching room:', error);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
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
    const parsed = RoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid room data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if new roomNumber conflicts with another room
    const existing = await db.room.findFirst({
      where: {
        roomNumber: data.roomNumber,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Another room with number ${data.roomNumber} already exists.` },
        { status: 409 }
      );
    }

    // Check if new capacity is smaller than current active residents
    const currentActiveResidentsCount = await db.resident.count({
      where: {
        roomId: id,
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
    });

    if (data.capacity < currentActiveResidentsCount) {
      return NextResponse.json(
        {
          error: `Cannot reduce room capacity to ${data.capacity}. Room currently has ${currentActiveResidentsCount} active resident(s).`,
        },
        { status: 400 }
      );
    }

    const updatedRoom = await db.room.update({
      where: { id },
      data: {
        roomNumber: data.roomNumber,
        floor: data.floor,
        capacity: data.capacity,
        sharingType: data.sharingType,
        amenities: JSON.stringify(data.amenities || []),
        status: data.status,
        notes: data.notes || null,
      },
    });

    await createAuditLog({
      adminUserId: session.userId,
      adminName: session.name,
      action: 'UPDATE_ROOM',
      entityType: 'ROOM',
      entityId: id,
      details: { roomNumber: updatedRoom.roomNumber, capacity: updatedRoom.capacity },
    });

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error: any) {
    console.error('Error updating room:', error);
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  }
}

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

    // Check if room has active residents
    const activeResidents = await db.resident.count({
      where: { roomId: id, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
    });

    if (activeResidents > 0) {
      return NextResponse.json(
        { error: `Cannot delete room. There are ${activeResidents} active resident(s) staying in this room.` },
        { status: 400 }
      );
    }

    const room = await db.room.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await db.room.delete({ where: { id } });

    await createAuditLog({
      adminUserId: session.userId,
      adminName: session.name,
      action: 'DELETE_ROOM',
      entityType: 'ROOM',
      entityId: id,
      details: { roomNumber: room.roomNumber },
    });

    return NextResponse.json({ success: true, message: `Room ${room.roomNumber} deleted successfully` });
  } catch (error: any) {
    console.error('Error deleting room:', error);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
