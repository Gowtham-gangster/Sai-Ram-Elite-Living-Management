import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getResidentSession } from '@/lib/residentAuth';
import { PaymentSessionService } from '@/lib/payments/paymentSessionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paymentId, customAmount, preferredApp } = body;

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json(
        { error: 'Valid monthly payment ID is required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate resident
    const residentSession = await getResidentSession();

    // 2. Fetch Monthly Payment strictly from database
    const payment = await prisma.monthlyPayment.findUnique({
      where: { id: paymentId },
      include: {
        resident: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        room: {
          select: {
            roomNumber: true,
          },
        },
        paymentRecords: {
          where: { status: 'VERIFIED' },
          select: { amountPaid: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
    }

    // If resident session is present, ensure ownership match
    if (residentSession && residentSession.residentId !== payment.residentId) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to pay for this record.' },
        { status: 403 }
      );
    }

    if (payment.status === 'PAID') {
      return NextResponse.json(
        { error: 'This payment has already been marked as PAID in full.' },
        { status: 400 }
      );
    }

    // 3. Calculate remaining balance and validate requested amount
    const totalVerifiedPaid = payment.paymentRecords.reduce((acc, r) => acc + r.amountPaid, 0);
    const totalDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
    const remainingBalance = Math.max(0, totalDue - totalVerifiedPaid);

    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: 'There is no remaining balance due for this monthly payment.' },
        { status: 400 }
      );
    }

    let amount = remainingBalance;
    if (customAmount !== undefined && customAmount !== null) {
      const parsedAmount = Number(customAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: 'Please enter a valid payment amount greater than zero.' },
          { status: 400 }
        );
      }

      if (parsedAmount > remainingBalance) {
        return NextResponse.json(
          {
            error: `Payment amount (₹${parsedAmount.toLocaleString(
              'en-IN'
            )}) cannot exceed the remaining balance of ₹${remainingBalance.toLocaleString(
              'en-IN'
            )}.`,
          },
          { status: 400 }
        );
      }

      amount = parsedAmount;
    }

    // 4. Create or reuse active unified PaymentSession via PaymentSessionService
    const session = await PaymentSessionService.createPaymentSession({
      monthlyPaymentId: payment.id,
      residentId: payment.residentId,
      amount,
      billingMonth: payment.billingMonth,
      roomNumber: payment.room.roomNumber,
      residentName: payment.resident.fullName,
      preferredApp: preferredApp || 'generic',
      createdBy: residentSession ? 'RESIDENT' : 'WEB_PORTAL',
    });

    return NextResponse.json({
      success: true,
      ...session,
    });
  } catch (error: any) {
    console.error('Error in POST /api/payments/session:', error);
    return NextResponse.json(
      { error: 'Failed to create payment session. Please try again later.' },
      { status: 500 }
    );
  }
}
