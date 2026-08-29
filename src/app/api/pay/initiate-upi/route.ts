import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentSessionService } from '@/lib/payments/paymentSessionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paymentId, upiApp, customAmount } = body;

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'Valid payment ID is required.' }, { status: 400 });
    }

    const validApps = ['gpay', 'phonepe', 'paytm'];
    const selectedApp = validApps.includes(upiApp) ? upiApp : 'gpay';

    // 1. Fetch Monthly Payment strictly from database
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

    if (payment.status === 'PAID') {
      return NextResponse.json(
        { error: 'This payment has already been marked as PAID.' },
        { status: 400 }
      );
    }

    // Calculate total verified amount paid so far and remaining balance
    const totalAlreadyPaid = payment.paymentRecords.reduce((acc, r) => acc + r.amountPaid, 0);
    const totalBillDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
    const remainingBalance = Math.max(0, totalBillDue - totalAlreadyPaid);

    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: 'This monthly payment has already been settled in full.' },
        { status: 400 }
      );
    }

    let amount = remainingBalance;

    if (customAmount !== undefined && customAmount !== null) {
      const parsedAmount = Number(customAmount);
      if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: 'Please enter a valid payment amount greater than zero.' },
          { status: 400 }
        );
      }

      if (parsedAmount > remainingBalance + 0.01) {
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

    // 2. Delegate to unified PaymentSessionService (handles 10-min expiration, idempotency, unique reference, dynamic QR & Intent)
    const session = await PaymentSessionService.createPaymentSession({
      monthlyPaymentId: payment.id,
      residentId: payment.residentId,
      amount,
      billingMonth: payment.billingMonth,
      roomNumber: payment.room.roomNumber,
      residentName: payment.resident.fullName,
      preferredApp: selectedApp,
      createdBy: 'RESIDENT',
    });

    // 3. Record Payment Initiation Record (PENDING_REVIEW - DOES NOT MARK PAID)
    await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        amountPaid: amount,
        paymentMethod: 'UPI',
        transactionReference: session.transactionReference,
        status: 'PENDING_REVIEW',
        notes: `UPI payment initiated via ${selectedApp.toUpperCase()} by resident on /pay (Session: ${session.paymentSessionId})`,
      },
    });

    return NextResponse.json({
      success: true,
      referenceId: session.transactionReference,
      paymentSessionId: session.paymentSessionId,
      payeeName: session.payeeName,
      upiId: session.upiId,
      amount: session.amount,
      billingMonth: payment.billingMonth,
      roomNumber: payment.room.roomNumber,
      residentName: payment.resident.fullName,
      standardUpiUrl: session.standardUpiUrl,
      upiUri: session.standardUpiUrl,
      appIntentUrl: session.appIntentUrl,
      gpayUrl: session.gpayUrl,
      phonepeUrl: session.phonepeUrl,
      paytmUrl: session.paytmUrl,
      qrDataUrl: session.qrDataUrl,
      expiresAt: session.expiresAt,
      timeoutSeconds: session.timeoutSeconds,
      selectedApp,
    });
  } catch (error: any) {
    console.error('Error in /api/pay/initiate-upi:', error);
    return NextResponse.json(
      { error: 'Failed to initiate UPI payment session.' },
      { status: 500 }
    );
  }
}
