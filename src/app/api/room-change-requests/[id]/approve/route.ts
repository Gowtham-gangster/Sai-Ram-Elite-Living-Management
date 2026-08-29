import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const adminName = body.adminName || 'Admin';

    const changeRequest = await prisma.roomChangeRequest.findUnique({
      where: { id },
      include: {
        resident: true,
        currentRoom: true,
        requestedRoom: {
          include: {
            residents: {
              where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
            },
          },
        },
      },
    });

    if (!changeRequest) {
      return NextResponse.json({ error: 'Room change request not found.' }, { status: 404 });
    }

    if (changeRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `This request has already been ${changeRequest.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const targetRoom = changeRequest.requestedRoom;
    const activeOccupants = targetRoom.residents.length;

    if (activeOccupants >= targetRoom.capacity) {
      return NextResponse.json(
        {
          error: `Cannot approve transfer: Target Room ${targetRoom.roomNumber} is full (${activeOccupants}/${targetRoom.capacity} occupied).`,
        },
        { status: 400 }
      );
    }

    // Execute room transfer transaction
    await prisma.$transaction(async (tx: any) => {
      // 1. Update resident room
      await tx.resident.update({
        where: { id: changeRequest.residentId },
        data: { roomId: targetRoom.id },
      });

      // 2. Mark request approved
      await tx.roomChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminName,
          reviewedAt: new Date(),
        },
      });

      // 3. Update room statuses if needed
      if (activeOccupants + 1 >= targetRoom.capacity) {
        await tx.room.update({
          where: { id: targetRoom.id },
          data: { status: 'FULL' },
        });
      }

      // 4. Create Notification
      await tx.notification.create({
        data: {
          type: 'SUCCESS',
          title: 'Room Change Approved',
          message: `${changeRequest.resident.fullName} successfully transferred to Room ${targetRoom.roomNumber}.`,
          linkUrl: `/residents/${changeRequest.residentId}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Room change approved: ${changeRequest.resident.fullName} transferred to Room ${targetRoom.roomNumber}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to approve room change.' },
      { status: 500 }
    );
  }
}
