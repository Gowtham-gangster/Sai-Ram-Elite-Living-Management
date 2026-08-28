import crypto from 'crypto';
import { db } from '@/lib/db';
import { generateReceiptPdf } from './receiptPdf';
import { uploadReceiptPdfToDrive } from '@/lib/google/receiptDriveUploader';

export interface ReceiptGenerationResult {
  success: boolean;
  receiptId?: string;
  receiptNumber?: string;
  downloadToken?: string;
  googleDriveFileId?: string | null;
  status: string;
  error?: string;
}

/**
 * Generates a sequential and uniquely formatted Receipt Number: SEL-YYYY-XXXXXX
 */
export async function generateSequentialReceiptNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await db.receipt.count({
    where: {
      receiptNumber: {
        startsWith: `SEL-${currentYear}-`,
      },
    },
  });

  const nextSeq = String(count + 1).padStart(6, '0');
  const candidate = `SEL-${currentYear}-${nextSeq}`;

  // Double check collision
  const existing = await db.receipt.findUnique({
    where: { receiptNumber: candidate },
  });

  if (existing) {
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `SEL-${currentYear}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
  }

  return candidate;
}

/**
 * Generates an official PDF receipt, uploads it to Google Drive, and stores metadata in Supabase
 */
export async function generateAndUploadReceiptForPayment(
  monthlyPaymentId: string,
  customAmountPaid?: number,
  balanceRemaining?: number
): Promise<ReceiptGenerationResult> {
  try {
    // 1. Fetch full payment context
    const payment = await db.monthlyPayment.findUnique({
      where: { id: monthlyPaymentId },
      include: {
        resident: true,
        room: true,
      },
    });

    if (!payment) {
      throw new Error(`Monthly payment with ID "${monthlyPaymentId}" not found.`);
    }

    const effectiveAmountPaid = customAmountPaid !== undefined ? customAmountPaid : payment.totalAmountDue;

    // Idempotency Check: check if receipt already exists for this exact amount
    const existingReceipt = await db.receipt.findFirst({
      where: { monthlyPaymentId, amountPaid: effectiveAmountPaid },
    });

    if (existingReceipt && existingReceipt.status === 'READY') {
      return {
        success: true,
        receiptId: existingReceipt.id,
        receiptNumber: existingReceipt.receiptNumber,
        downloadToken: existingReceipt.downloadToken || undefined,
        googleDriveFileId: existingReceipt.googleDriveFileId,
        status: existingReceipt.status,
      };
    }

    const hostelSettings = await db.hostelSettings.findUnique({
      where: { id: 'default' },
    });

    // 2. Generate receipt number and secure token
    const receiptNumber = existingReceipt?.receiptNumber || (await generateSequentialReceiptNumber());
    const downloadToken = existingReceipt?.downloadToken || crypto.randomBytes(24).toString('hex');

    // 3. Generate A4 PDF Binary
    const pdfBytes = await generateReceiptPdf({
      receiptNumber,
      residentName: payment.resident?.fullName || 'Resident',
      roomNumber: payment.room?.roomNumber || '101',
      billingMonth: payment.billingMonth,
      amountPaid: effectiveAmountPaid,
      totalAmountDue: payment.totalAmountDue,
      balanceRemaining: balanceRemaining !== undefined ? balanceRemaining : 0,
      paymentDate: payment.paidDate || new Date(),
      paymentMethod: payment.paymentMethod || 'UPI',
      transactionReference: payment.transactionReference || payment.gatewayPaymentId,
      hostelName: hostelSettings?.hostelName || 'SAIRAM ELITE LIVING',
      hostelAddress: hostelSettings?.hostelAddress || 'Plot #42, ITPL Main Road, Whitefield, Bengaluru - 560066',
      contactPhone: hostelSettings?.contactPhone || '+91 86885 35143',
    });

    // 4. Upload to Google Drive
    let driveFileId: string | null = null;
    let driveUploadStatus = 'READY';

    try {
      const uploadResult = await uploadReceiptPdfToDrive({
        receiptNumber,
        residentName: payment.resident?.fullName || 'Resident',
        billingMonth: payment.billingMonth,
        pdfBytes,
      });
      driveFileId = uploadResult.fileId;
    } catch (driveErr: any) {
      console.error('Google Drive receipt upload failed (Payment remains processed):', driveErr);
      driveUploadStatus = 'GENERATION_PENDING';
    }

    // 5. Upsert Receipt record in database
    const savedReceipt = await db.receipt.upsert({
      where: { receiptNumber },
      update: {
        googleDriveFileId: driveFileId,
        status: driveUploadStatus,
        downloadToken,
        amountPaid: effectiveAmountPaid,
      },
      create: {
        receiptNumber,
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        residentName: payment.resident?.fullName || 'Resident',
        roomNumber: payment.room?.roomNumber || '101',
        billingMonth: payment.billingMonth,
        amountPaid: effectiveAmountPaid,
        paymentMethod: payment.paymentMethod || 'UPI',
        paymentDate: payment.paidDate || new Date(),
        generatedBy: 'SYSTEM (AUTOMATED)',
        googleDriveFileId: driveFileId,
        status: driveUploadStatus,
        downloadToken,
      },
    });

    // 7. Update MonthlyPayment with receipt reference
    await db.monthlyPayment.update({
      where: { id: payment.id },
      data: { receiptNumber },
    });

    return {
      success: true,
      receiptId: savedReceipt.id,
      receiptNumber: savedReceipt.receiptNumber,
      downloadToken: savedReceipt.downloadToken || undefined,
      googleDriveFileId: savedReceipt.googleDriveFileId,
      status: savedReceipt.status,
    };
  } catch (err: any) {
    console.error('Receipt generation error:', err);
    return {
      success: false,
      status: 'FAILED',
      error: err.message || 'Failed to generate receipt.',
    };
  }
}
