import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { RoomSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const floor = searchParams.get('floor');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (floor && floor !== 'ALL') where.floor = parseInt(floor, 10);
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.roomNumber = { contains: search, mode: 'insensitive' };
    }

    const rooms = await db.room.findMany({
      where,
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      include: {
        residents: {
          where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            checkInDate: true,
            monthlyRent: true,
            status: true,
          },
        },
      },
    });

    // Calculate live occupancy stats & dynamic monthly collection
    const enrichedRooms = rooms.map((room) => {
      const activeResidentsCount = room.residents.length;
      let calculatedStatus = room.status;
      if (room.status !== 'MAINTENANCE') {
        calculatedStatus = activeResidentsCount >= room.capacity ? 'FULL' : 'AVAILABLE';
      }

      const isPaymentManaged = room.paymentEnabled !== false;
      const monthlyCollection = isPaymentManaged
        ? room.residents.reduce((sum: number, r: any) => sum + (r.monthlyRent || 0), 0)
        : 0;

      let parsedAmenities: string[] = [];
      try {
        parsedAmenities = JSON.parse(room.amenities);
      } catch {
        parsedAmenities = [];
      }

      return {
        ...room,
        amenitiesList: parsedAmenities,
        occupancyCount: activeResidentsCount,
        availableSlots: Math.max(0, room.capacity - activeResidentsCount),
        occupancyRate: room.capacity > 0 ? Math.round((activeResidentsCount / room.capacity) * 100) : 0,
        computedStatus: calculatedStatus,
        monthlyCollection,
      };
    });

    return NextResponse.json({ rooms: enrichedRooms });
  } catch (error: any) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid room data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if room number already exists
    const existing = await db.room.findUnique({
      where: { roomNumber: data.roomNumber },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Room ${data.roomNumber} already exists.` },
        { status: 409 }
      );
    }

    const room = await db.room.create({
      data: {
        roomNumber: data.roomNumber,
        floor: data.floor,
        capacity: data.capacity,
        sharingType: data.sharingType,
        amenities: JSON.stringify(data.amenities || []),
        status: data.status,
        paymentEnabled: data.paymentEnabled !== undefined ? data.paymentEnabled : true,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ success: true, room }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
