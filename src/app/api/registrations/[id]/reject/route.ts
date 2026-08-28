import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason || body.reason;
    const adminName = body.adminName || 'Admin';

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: 'A rejection reason is required to reject a registration.' },
        { status: 400 }
      );
    }

    const registration = await prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    if (registration.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot reject an already approved registration. Please check out the resident instead.' },
        { status: 400 }
      );
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: adminName,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminName,
        action: 'REJECT_REGISTRATION',
        entityType: 'REGISTRATION',
        entityId: id,
        details: JSON.stringify({
          fullName: registration.fullName,
          rejectionReason: rejectionReason.trim(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Registration for ${registration.fullName} has been rejected.`,
      registration: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reject registration.' },
      { status: 500 }
    );
  }
}
