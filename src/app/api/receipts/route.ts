import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const month = searchParams.get('month');
    const residentId = searchParams.get('residentId');
    const roomId = searchParams.get('roomId');
    const paymentMethod = searchParams.get('paymentMethod');

    const where: any = {};
    if (month && month !== 'ALL') where.billingMonth = month;
    if (residentId && residentId !== 'ALL') where.residentId = residentId;
    if (paymentMethod && paymentMethod !== 'ALL') where.paymentMethod = paymentMethod;

    if (roomId && roomId !== 'ALL') {
      where.monthlyPayment = { roomId };
    }

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { residentName: { contains: search } },
        { roomNumber: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const receipts = await db.receipt.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        monthlyPayment: {
          include: {
            resident: true,
            room: true,
            paymentRecords: true,
          },
        },
      },
    });

    const totalCollected = receipts.reduce((acc, r) => acc + r.amountPaid, 0);

    return NextResponse.json({
      receipts,
      summary: {
        totalReceiptsCount: receipts.length,
        totalCollectedAmount: totalCollected,
      },
    });
  } catch (error: any) {
    console.error('Error fetching receipts:', error);
    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
  }
}
