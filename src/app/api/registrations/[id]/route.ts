import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const registration = await prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    // Lookup requested room info & current occupancy
    let roomInfo: any = null;
    if (registration.requestedRoomNumber) {
      const room = await prisma.room.findFirst({
        where: {
          roomNumber: registration.requestedRoomNumber.trim(),
        },
        include: {
          residents: {
            where: {
              status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
            },
          },
        },
      });

      if (room) {
        const activeCount = room.residents.length;
        const availableSlots = Math.max(0, room.capacity - activeCount);
        roomInfo = {
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          capacity: room.capacity,
          sharingType: room.sharingType,
          currentOccupancy: activeCount,
          availableSlots,
          isFull: availableSlots === 0,
        };
      }
    }

    // Fetch audit logs related to this registration
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'REGISTRATION',
        entityId: registration.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      registration,
      roomInfo,
      auditLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch registration details.' },
      { status: 500 }
    );
  }
}
