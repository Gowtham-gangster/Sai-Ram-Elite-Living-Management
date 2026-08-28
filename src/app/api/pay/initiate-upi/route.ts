import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOwnerUpiConfig } from '@/lib/payments/paymentConfig';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paymentId, upiApp, customAmount } = body;

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'Valid payment ID is required.' }, { status: 400 });
    }

    const validApps = ['gpay', 'phonepe', 'paytm'];
    const selectedApp = validApps.includes(upiApp) ? upiApp : 'gpay';

    // 1. Fetch Owner UPI Settings from central server configuration
    let upiConfig;
    try {
      upiConfig = await getOwnerUpiConfig();
    } catch (configError) {
      console.error('Owner UPI configuration missing or invalid:', configError);
      return NextResponse.json(
        { error: 'Payment configuration is currently unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const { upiId, payeeName } = upiConfig;

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
            error: `Payment amount (₹${parsedAmount.toLocaleString('en-IN')}) cannot exceed the remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}.`,
          },
          { status: 400 }
        );
      }

      amount = parsedAmount;
    }

    // 3. Generate Unique Transaction Reference ID
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txnRef = `SRL_${payment.billingMonth.replace('-', '')}_${payment.room.roomNumber}_${Date.now().toString(36).toUpperCase()}_${randomSuffix}`;
    const transactionNote = `Rent ${payment.billingMonth} Room ${payment.room.roomNumber}`;

    // 4. Construct Single Canonical Standard UPI URI
    const queryParams = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: transactionNote,
      tr: txnRef,
    });

    const queryString = queryParams.toString();
    const standardUpiUrl = `upi://pay?${queryString}`;

    // 5. Generate high-resolution QR Data URL using canonical UPI URI
    let qrDataUrl = '';
    try {
      const QRCode = (await import('qrcode')).default;
      qrDataUrl = await QRCode.toDataURL(standardUpiUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (qrErr) {
      console.error('Failed to generate QR Data URL:', qrErr);
    }

    // 6. Record Payment Initiation Record (PENDING_REVIEW - DOES NOT MARK PAID)
    await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        amountPaid: amount,
        paymentMethod: 'UPI',
        transactionReference: txnRef,
        status: 'PENDING_REVIEW',
        notes: `UPI payment initiated via ${selectedApp.toUpperCase()} by resident on /pay`,
      },
    });

    // Optionally update MonthlyPayment transactionReference without changing status to PAID
    await prisma.monthlyPayment.update({
      where: { id: payment.id },
      data: {
        transactionReference: txnRef,
        paymentMethod: 'UPI',
      },
    });

    return NextResponse.json({
      success: true,
      referenceId: txnRef,
      payeeName,
      upiId,
      amount,
      billingMonth: payment.billingMonth,
      roomNumber: payment.room.roomNumber,
      residentName: payment.resident.fullName,
      standardUpiUrl,
      upiUri: standardUpiUrl,
      appIntentUrl: standardUpiUrl,
      gpayUrl: standardUpiUrl,
      phonepeUrl: standardUpiUrl,
      paytmUrl: standardUpiUrl,
      qrDataUrl,
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
