import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason || 'Declined by Administrator';
    const adminName = body.adminName || 'Admin';

    const changeRequest = await prisma.roomChangeRequest.findUnique({
      where: { id },
      include: {
        resident: true,
        currentRoom: true,
        requestedRoom: true,
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

    const updated = await prisma.roomChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        reviewedBy: adminName,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Room change request for ${changeRequest.resident.fullName} rejected. Resident remains in Room ${changeRequest.currentRoom.roomNumber}.`,
      request: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reject room change.' },
      { status: 500 }
    );
  }
}
