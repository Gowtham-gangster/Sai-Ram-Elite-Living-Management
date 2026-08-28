import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { generateAndUploadReceiptForPayment } from '@/lib/receipts/receiptEngine';

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

    const payment = await db.monthlyPayment.findUnique({
      where: { id },
      include: { resident: true, room: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Cannot generate a receipt for an unverified or unpaid monthly payment.' },
        { status: 400 }
      );
    }

    // Execute idempotent receipt generation and Drive upload
    const result = await generateAndUploadReceiptForPayment(payment.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to upload receipt to Google Drive.' },
        { status: 500 }
      );
    }

    // Log admin audit
    await db.auditLog.create({
      data: {
        adminUserId: session.userId,
        adminName: session.name,
        action: 'RETRY_RECEIPT_UPLOAD',
        entityType: 'Receipt',
        entityId: result.receiptId || payment.id,
        details: JSON.stringify({
          receiptNumber: result.receiptNumber,
          googleDriveFileId: result.googleDriveFileId,
          status: result.status,
          retriedBy: session.name,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Receipt uploaded to Google Drive successfully.',
      receipt: result,
    });
  } catch (error: any) {
    console.error('Error retrying receipt upload:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during receipt retry.' },
      { status: 500 }
    );
  }
}
