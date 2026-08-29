import { db } from '../db';
import { IPaymentRecordInput, IStatusTransitionResult, PaymentStatus } from './types';
import { createNotification } from '../notifications';
import { isPaymentManagedRoom, assertPaymentEnabledForRoom } from '../payments/eligibility';

/**
 * Generate unique human-readable receipt number
 * Format: REC-YYYYMM-XXXX
 */
export function generateReceiptNumber(billingMonth: string, phoneOrId: string): string {
  const cleanMonth = billingMonth.replace(/[^0-9]/g, '');
  const suffix = phoneOrId.slice(-4).toUpperCase();
  const randomSalt = Math.floor(1000 + Math.random() * 9000);
  return `REC-${cleanMonth}-${suffix}-${randomSalt}`;
}

/**
 * Record a manual payment against a monthly bill
 */
export async function recordPaymentTransaction(
  input: IPaymentRecordInput,
  adminUser?: { id: string; name: string }
): Promise<IStatusTransitionResult> {
  const monthlyPayment = await db.monthlyPayment.findUnique({
    where: { id: input.monthlyPaymentId },
    include: { resident: true, room: true },
  });

  if (!monthlyPayment) {
    throw new Error(`Monthly payment record not found: ${input.monthlyPaymentId}`);
  }

  assertPaymentEnabledForRoom(monthlyPayment.room);

  const previousStatus = monthlyPayment.status as PaymentStatus;
  const paymentDate = input.paymentDate || new Date();
  const adminName = adminUser?.name || input.verifiedByAdminName || 'Admin';

  // 1. Create Payment Record (Transaction)
  const paymentRecord = await db.paymentRecord.create({
    data: {
      monthlyPaymentId: monthlyPayment.id,
      residentId: monthlyPayment.residentId,
      amountPaid: input.amountPaid,
      paymentDate: paymentDate,
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference || null,
      proofAttachmentUrl: input.proofAttachmentUrl || null,
      status: 'VERIFIED',
      verifiedByAdminName: adminName,
      notes: input.notes || null,
    },
  });

  // 2. Generate Receipt & Upload to Google Drive
  let receiptNumber = generateReceiptNumber(monthlyPayment.billingMonth, monthlyPayment.resident.phone);
  try {
    const { generateAndUploadReceiptForPayment } = await import('@/lib/receipts/receiptEngine');
    const receiptResult = await generateAndUploadReceiptForPayment(monthlyPayment.id, input.amountPaid, 0);
    if (receiptResult?.receiptNumber) {
      receiptNumber = receiptResult.receiptNumber;
    }
  } catch (receiptErr) {
    console.error('Receipt generation error during payment recording:', receiptErr);
    // Fallback: create basic receipt if receiptEngine encounters any error
    const existing = await db.receipt.findFirst({ where: { monthlyPaymentId: monthlyPayment.id } });
    if (!existing) {
      await db.receipt.create({
        data: {
          receiptNumber: receiptNumber,
          monthlyPaymentId: monthlyPayment.id,
          residentName: monthlyPayment.resident.fullName,
          roomNumber: monthlyPayment.room.roomNumber,
          billingMonth: monthlyPayment.billingMonth,
          amountPaid: input.amountPaid,
          paymentMethod: input.paymentMethod,
          paymentDate: paymentDate,
          generatedBy: adminName,
          notes: input.notes || `Paid via ${input.paymentMethod}. Ref: ${input.transactionReference || 'N/A'}`,
        },
      });
    }
  }

  // 3. Update Monthly Payment Status to PAID
  await db.monthlyPayment.update({
    where: { id: monthlyPayment.id },
    data: {
      status: 'PAID',
      paidDate: paymentDate,
      paymentMethod: input.paymentMethod,
      receiptNumber: receiptNumber,
      transactionReference: input.transactionReference || monthlyPayment.transactionReference || undefined,
    },
  });

  // 4. Cancel All Pending Reminders for this Monthly Payment
  await db.paymentReminder.updateMany({
    where: {
      monthlyPaymentId: monthlyPayment.id,
      status: { in: ['PENDING', 'SCHEDULED'] },
    },
    data: {
      status: 'CANCELLED',
      failureReason: 'Payment completed as PAID',
    },
  });

  // 5. System Notification
  await createNotification({
    title: 'Payment Verified & Receipt Issued',
    message: `Payment of ₹${Number(input.amountPaid).toLocaleString('en-IN')} confirmed for ${monthlyPayment.resident.fullName} (Room ${monthlyPayment.room.roomNumber}).`,
    type: 'SUCCESS',
    linkUrl: '/admin/payments',
  });

  return {
    success: true,
    previousStatus,
    newStatus: 'PAID',
    monthlyPaymentId: monthlyPayment.id,
    receiptNumber: receiptNumber,
    message: `Payment of ₹${input.amountPaid.toLocaleString('en-IN')} recorded successfully. Receipt #${receiptNumber} generated.`,
  };
}

/**
 * Update payment status (e.g. SUBMITTED, REJECTED, OVERDUE, PENDING, PAID)
 */
export async function updatePaymentStatus(
  monthlyPaymentId: string,
  newStatus: PaymentStatus,
  notes?: string,
  adminUser?: { id: string; name: string }
): Promise<IStatusTransitionResult> {
  const monthlyPayment = await db.monthlyPayment.findUnique({
    where: { id: monthlyPaymentId },
    include: { resident: true, room: true },
  });

  if (!monthlyPayment) {
    throw new Error(`Monthly payment record not found: ${monthlyPaymentId}`);
  }

  const previousStatus = monthlyPayment.status as PaymentStatus;
  const isNowPaid = newStatus === 'PAID';

  await db.monthlyPayment.update({
    where: { id: monthlyPaymentId },
    data: {
      status: newStatus,
      paidDate: isNowPaid ? (monthlyPayment.paidDate || new Date()) : undefined,
      notes: notes ? `${monthlyPayment.notes || ''}\n[${new Date().toISOString().slice(0,10)}] Status updated to ${newStatus}: ${notes}`.trim() : monthlyPayment.notes,
    },
  });

  // If newly marked as PAID, cancel pending reminders and trigger receipt generation
  if (isNowPaid) {
    await db.paymentReminder.updateMany({
      where: {
        monthlyPaymentId: monthlyPayment.id,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      data: {
        status: 'CANCELLED',
        failureReason: 'Payment verified as PAID',
      },
    });

    try {
      const { generateAndUploadReceiptForPayment } = await import('@/lib/receipts/receiptEngine');
      await generateAndUploadReceiptForPayment(monthlyPayment.id, monthlyPayment.totalAmountDue, 0);
    } catch (receiptErr) {
      console.error('Receipt generation error during status update to PAID:', receiptErr);
    }
  }

  if (newStatus === 'PAID') {
    await createNotification({
      title: 'Payment Marked as Paid',
      message: `Monthly payment for ${monthlyPayment.resident.fullName} (Room ${monthlyPayment.room.roomNumber}) was marked as PAID.`,
      type: 'SUCCESS',
      linkUrl: '/admin/payments',
    });
  } else if (newStatus === 'OVERDUE') {
    await createNotification({
      title: 'Payment Marked Overdue',
      message: `Monthly payment for ${monthlyPayment.resident.fullName} (Room ${monthlyPayment.room.roomNumber}) was marked OVERDUE.`,
      type: 'ALERT',
      linkUrl: '/admin/payments',
    });
  }

  return {
    success: true,
    previousStatus,
    newStatus,
    monthlyPaymentId,
    message: `Status updated from ${previousStatus} to ${newStatus}`,
  };
}

/**
 * Batch generate monthly bills for all active residents for a given month
 */
export async function generateMonthlyBillsForActiveResidents(billingMonth: string, adminUser?: { id: string; name: string }) {
  const activeResidents = await db.resident.findMany({
    where: { status: 'ACTIVE' },
    include: { room: true },
  });

  const [year, month] = billingMonth.split('-').map(Number);
  const dueDate = new Date(year, month - 1, 5);

  let generatedCount = 0;
  let skippedCount = 0;

  for (const resident of activeResidents) {
    // Skip residents in rooms where payment management is disabled
    if (!isPaymentManagedRoom(resident.room)) {
      skippedCount++;
      continue;
    }

    const existing = await db.monthlyPayment.findFirst({
      where: {
        residentId: resident.id,
        billingMonth: billingMonth,
      },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const rentAmount = resident.monthlyRent || 0;
    const maintenanceAmount = 0;
    const totalDue = rentAmount + maintenanceAmount;

    await db.monthlyPayment.create({
      data: {
        residentId: resident.id,
        roomId: resident.roomId,
        billingMonth: billingMonth,
        rentAmount: rentAmount,
        maintenanceAmount: maintenanceAmount,
        penaltyAmount: 0,
        discountAmount: 0,
        totalAmountDue: totalDue,
        status: 'PENDING',
        dueDate: dueDate,
      },
    });

    generatedCount++;
  }

  await createNotification({
    title: 'Monthly Dues Generated',
    message: `Generated ${generatedCount} dues for billing month ${billingMonth} (${skippedCount} skipped).`,
    type: 'INFO',
    linkUrl: '/admin/payments',
  });

  return { billingMonth, generatedCount, skippedCount };
}
