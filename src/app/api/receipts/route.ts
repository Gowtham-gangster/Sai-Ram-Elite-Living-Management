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
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { residentName: { contains: search, mode: 'insensitive' } },
        { roomNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const receipts = await db.receipt.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        receiptNumber: true,
        residentName: true,
        roomNumber: true,
        billingMonth: true,
        amountPaid: true,
        paymentMethod: true,
        paymentDate: true,
        googleDriveFileId: true,
        googleDriveFolderId: true,
        receiptFileName: true,
        driveUploadStatus: true,
        status: true,
        downloadToken: true,
        createdAt: true,
        notes: true,
        monthlyPayment: {
          select: {
            id: true,
            transactionReference: true,
            room: { select: { roomNumber: true, floor: true } },
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
