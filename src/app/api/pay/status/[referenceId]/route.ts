import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params;

    if (!referenceId || typeof referenceId !== 'string') {
      return NextResponse.json({ error: 'Valid reference ID required' }, { status: 400 });
    }

    const cleanRef = referenceId.trim();

    // Query MonthlyPayment by transactionReference or ID
    const payment = await prisma.monthlyPayment.findFirst({
      where: {
        OR: [
          { transactionReference: cleanRef },
          { id: cleanRef },
          { paymentRecords: { some: { transactionReference: cleanRef } } },
        ],
      },
      select: {
        id: true,
        transactionReference: true,
        billingMonth: true,
        totalAmountDue: true,
        rentAmount: true,
        status: true,
        paidDate: true,
        paymentMethod: true,
        receipts: {
          select: {
            receiptNumber: true,
            downloadToken: true,
            status: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        paymentRecords: {
          where: { status: 'VERIFIED' },
          select: { amountPaid: true },
        },
        resident: {
          select: {
            fullName: true,
            room: {
              select: {
                roomNumber: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { found: false, status: 'NOT_FOUND', error: 'Payment attempt not found.' },
        { status: 404 }
      );
    }

    const latestReceipt = payment.receipts?.[0];
    const totalVerifiedPaid = payment.paymentRecords.reduce((acc, r) => acc + r.amountPaid, 0);
    const totalDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
    const remainingBalance = Math.max(0, totalDue - totalVerifiedPaid);
    const isPaid = payment.status === 'PAID';
    const isPartiallyPaid = payment.status === 'PARTIALLY_PAID';

    return NextResponse.json({
      found: true,
      referenceId: payment.transactionReference || payment.id,
      status: payment.status,
      isPaid,
      isPartiallyPaid,
      isPending: payment.status === 'PENDING',
      billingMonth: payment.billingMonth,
      roomNumber: payment.resident.room?.roomNumber || 'N/A',
      residentName: payment.resident.fullName,
      totalAmountDue: totalDue,
      amountPaid: totalVerifiedPaid,
      remainingBalance,
      paidDate: payment.paidDate ? payment.paidDate.toISOString() : null,
      paymentMethod: payment.paymentMethod || 'UPI',
      receiptNumber: latestReceipt?.receiptNumber || null,
      downloadToken: latestReceipt?.downloadToken || null,
      receiptStatus: latestReceipt?.status || (isPaid || isPartiallyPaid ? 'READY' : null),
    });
  } catch (error: any) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error checking payment status.' },
      { status: 500 }
    );
  }
}
