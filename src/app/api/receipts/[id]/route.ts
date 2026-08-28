import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

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

    const receipt = await db.receipt.findFirst({
      where: {
        OR: [{ id: id }, { receiptNumber: id }],
      },
      include: {
        monthlyPayment: {
          include: {
            resident: true,
            room: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const hostelSettings = await db.hostelSettings.findUnique({
      where: { id: 'default' },
    });

    return NextResponse.json({ receipt, hostelSettings });
  } catch (error: any) {
    console.error('Error fetching receipt:', error);
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 });
  }
}
