import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const requests = await prisma.roomChangeRequest.findMany({
      where: status !== 'ALL' ? { status: status.toUpperCase() } : {},
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch room change requests.' },
      { status: 500 }
    );
  }
}
