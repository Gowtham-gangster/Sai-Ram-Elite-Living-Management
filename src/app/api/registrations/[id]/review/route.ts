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

    const registration = await prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    if (registration.status === 'APPROVED' || registration.status === 'REJECTED') {
      return NextResponse.json(
        { error: `Cannot mark registration as Under Review from ${registration.status} state.` },
        { status: 400 }
      );
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status: 'UNDER_REVIEW',
        reviewedBy: adminName,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Registration for ${registration.fullName} marked as Under Review.`,
      registration: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update review status.' },
      { status: 500 }
    );
  }
}
