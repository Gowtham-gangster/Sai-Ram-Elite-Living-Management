import { prisma } from '@/lib/prisma';
import { PaymentVerificationPayload, PaymentVerificationResult } from './types';

/**
 * Centralized Authoritative Payment Completion Service
 * Idempotently settles verified payments across webhooks, gateway verification, and reconciliation.
 */
export class PaymentCompletionService {
  /**
   * Completes and settles an authoritatively verified payment transactionally.
   * Safe for 1x, 10x, or 100x duplicate deliveries.
   */
  static async completeVerifiedPayment(
    payload: PaymentVerificationPayload
  ): Promise<PaymentVerificationResult> {
    const { referenceId, amountPaid, gatewayPaymentId, gatewayProvider, paymentMethod } = payload;

    if (!referenceId) {
      return {
        success: false,
        isPaid: false,
        status: 'FAILED',
        error: 'Transaction reference is missing.',
      };
    }

    // 1. Locate matching MonthlyPayment and PaymentSession
    const payment = await prisma.monthlyPayment.findFirst({
      where: {
        OR: [
          { transactionReference: referenceId },
          { id: referenceId },
          { paymentRecords: { some: { transactionReference: referenceId } } },
          { paymentSessions: { some: { transactionReference: referenceId } } },
        ],
      },
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
      },
    });

    if (!payment) {
      return {
        success: false,
        isPaid: false,
        status: 'FAILED',
        error: `No monthly payment found matching reference: ${referenceId}`,
      };
    }

    // 2. Idempotency Check: check if this transaction was already recorded as VERIFIED
    const existingVerifiedRecord = await prisma.paymentRecord.findFirst({
      where: {
        monthlyPaymentId: payment.id,
        transactionReference: gatewayPaymentId || referenceId,
        status: 'VERIFIED',
      },
    });

    if (existingVerifiedRecord) {
      const existingReceipt = await prisma.receipt.findFirst({
        where: { monthlyPaymentId: payment.id },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        isPaid: payment.status === 'PAID',
        status: payment.status as any,
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        amountExpected: payment.totalAmountDue,
        amountReceived: existingVerifiedRecord.amountPaid,
        referenceId,
        gatewayPaymentId,
        receiptNumber: existingReceipt?.receiptNumber || undefined,
        downloadToken: existingReceipt?.downloadToken || undefined,
        googleDriveFileId: existingReceipt?.googleDriveFileId || undefined,
        isDuplicate: true,
      };
    }

    // 3. Compute verified payments and remaining balance
    const verifiedRecords = await prisma.paymentRecord.findMany({
      where: { monthlyPaymentId: payment.id, status: 'VERIFIED' },
      select: { amountPaid: true },
    });
    const priorPaid = verifiedRecords.reduce((acc, r) => acc + r.amountPaid, 0);
    const totalPaidAfterThis = priorPaid + amountPaid;
    const totalDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
    const remainingBalance = Math.max(0, totalDue - totalPaidAfterThis);
    const isFullSettlement = remainingBalance <= 0.01;
    const paymentStatus = isFullSettlement ? 'PAID' : 'PARTIALLY_PAID';

    // 4. Transactional Verification & State Update
    const paidDate = payload.paymentDate || new Date();

    await prisma.$transaction(async (tx) => {
      // A. Update MonthlyPayment
      await tx.monthlyPayment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          paidDate: isFullSettlement ? paidDate : undefined,
          paymentMethod: paymentMethod || 'UPI',
          gatewayProvider: gatewayProvider || 'UPI_GATEWAY',
          gatewayPaymentId: gatewayPaymentId || undefined,
          transactionReference: referenceId,
        },
      });

      // B. Create Verified Payment Record
      await tx.paymentRecord.create({
        data: {
          monthlyPaymentId: payment.id,
          residentId: payment.residentId,
          amountPaid,
          paymentMethod: paymentMethod || 'UPI',
          transactionReference: gatewayPaymentId || referenceId,
          status: 'VERIFIED',
          verifiedByAdminName: `SYSTEM_VERIFIED (${gatewayProvider || 'UPI_GATEWAY'})`,
          notes: `Authoritative verified payment for ${payment.billingMonth} (Ref: ${referenceId}) - ${
            isFullSettlement ? 'Full Settlement' : `Partial (Balance: ₹${remainingBalance})`
          }`,
        },
      });

      // C. Update matching PaymentSession to PAID
      await tx.paymentSession.updateMany({
        where: {
          OR: [
            { transactionReference: referenceId },
            { monthlyPaymentId: payment.id, status: 'ACTIVE' },
          ],
        },
        data: {
          status: 'PAID',
          verificationStatus: 'VERIFIED',
          verifiedAt: paidDate,
          providerTransactionId: gatewayPaymentId || undefined,
        },
      });

      // D. Cancel reminders ONLY upon full settlement
      if (isFullSettlement) {
        await tx.paymentReminder.updateMany({
          where: {
            monthlyPaymentId: payment.id,
            status: { in: ['PENDING', 'SCHEDULED'] },
          },
          data: {
            status: 'CANCELLED',
          },
        });
      }

      // E. Create in-app Management Notification
      await tx.notification.create({
        data: {
          type: 'SUCCESS',
          title: isFullSettlement ? 'Rent Payment Verified' : 'Partial Rent Payment Verified',
          message: `Verified rent payment of ₹${amountPaid.toLocaleString('en-IN')} received from ${
            payment.resident.fullName
          } (Room ${payment.room.roomNumber}) for ${payment.billingMonth}.${
            isFullSettlement ? '' : ` Remaining Balance: ₹${remainingBalance.toLocaleString('en-IN')}.`
          }`,
          linkUrl: `/payments`,
        },
      });
    });

    // 5. Trigger Automatic PDF Receipt Generation & Drive Upload
    let receiptResult;
    try {
      const { generateAndUploadReceiptForPayment } = await import('@/lib/receipts/receiptEngine');
      receiptResult = await generateAndUploadReceiptForPayment(
        payment.id,
        amountPaid,
        remainingBalance
      );
    } catch (receiptErr) {
      console.error('Automatic receipt trigger error (Payment remains settled):', receiptErr);
    }

    return {
      success: true,
      isPaid: isFullSettlement,
      status: paymentStatus,
      monthlyPaymentId: payment.id,
      residentId: payment.residentId,
      amountExpected: totalDue,
      amountReceived: amountPaid,
      remainingBalance,
      referenceId,
      gatewayPaymentId,
      receiptNumber: receiptResult?.receiptNumber,
      downloadToken: receiptResult?.downloadToken,
      googleDriveFileId: receiptResult?.googleDriveFileId,
    };
  }
}
