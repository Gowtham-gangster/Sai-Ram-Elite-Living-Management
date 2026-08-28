import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { processVerifiedPayment } from '@/lib/payments/verification';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Find target monthly payment
    const payment = await db.monthlyPayment.findUnique({
      where: { id },
      include: {
        resident: true,
        room: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Monthly payment record not found.' }, { status: 404 });
    }

    const amountPaid = typeof body.amountPaid === 'number' && body.amountPaid > 0
      ? body.amountPaid
      : payment.totalAmountDue;

    const referenceId = body.transactionReference?.trim() ||
      payment.transactionReference ||
      `MANUAL_VERIFY_${Date.now().toString(36).toUpperCase()}`;

    const gatewayPaymentId = body.utrNumber?.trim() || referenceId;
    const paymentMethod = body.paymentMethod || 'UPI';

    // Execute authoritative transactional verification
    const result = await processVerifiedPayment({
      referenceId,
      gatewayPaymentId,
      amountPaid,
      paymentMethod,
      gatewayProvider: 'ADMIN_MANUAL_RECONCILIATION',
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Payment verification failed.' }, { status: 400 });
    }

    // Create Audit Log
    await createAuditLog({
      adminUserId: session.userId,
      adminName: session.name,
      action: 'ADMIN_VERIFY_PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment.id,
      details: {
        residentName: payment.resident.fullName,
        roomNumber: payment.room.roomNumber,
        billingMonth: payment.billingMonth,
        amountPaid,
        referenceId,
        receiptNumber: result.receiptNumber,
        isPaid: result.isPaid,
      },
    });

    return NextResponse.json({
      success: true,
      isPaid: result.isPaid,
      status: result.status,
      receiptNumber: result.receiptNumber,
      downloadToken: result.downloadToken,
      googleDriveFileId: result.googleDriveFileId,
      remainingBalance: result.remainingBalance,
      message: `Payment of ₹${amountPaid.toLocaleString('en-IN')} verified successfully.`,
    });
  } catch (error: any) {
    console.error('Error in /api/payments/[id]/verify:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during verification.' },
      { status: 500 }
    );
  }
}
