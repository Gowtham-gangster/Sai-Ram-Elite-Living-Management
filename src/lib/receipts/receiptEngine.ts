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
  googleDriveFolderId?: string | null;
  receiptFileName?: string | null;
  status: string;
  driveUploadStatus?: string;
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
 * Generates an official PDF receipt, uploads it to Google Drive under the authoritative Month-Year folder,
 * and stores full audit metadata in the database.
 * 
 * Guaranteed Idempotent: If the receipt has already been uploaded with a Google Drive file ID, returns existing.
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

    // 2. Idempotency Check: check if receipt already exists
    const existingReceipt = await db.receipt.findFirst({
      where: { monthlyPaymentId, amountPaid: effectiveAmountPaid },
    });

    // If receipt already exists AND has a valid Google Drive file ID, return existing immediately
    if (existingReceipt && existingReceipt.googleDriveFileId && existingReceipt.status === 'READY') {
      return {
        success: true,
        receiptId: existingReceipt.id,
        receiptNumber: existingReceipt.receiptNumber,
        downloadToken: existingReceipt.downloadToken || undefined,
        googleDriveFileId: existingReceipt.googleDriveFileId,
        googleDriveFolderId: existingReceipt.googleDriveFolderId,
        receiptFileName: existingReceipt.receiptFileName,
        status: existingReceipt.status,
        driveUploadStatus: existingReceipt.driveUploadStatus || 'SUCCESS',
      };
    }

    const hostelSettings = await db.hostelSettings.findUnique({
      where: { id: 'default' },
    });

    // 3. Generate receipt number and secure token
    const receiptNumber = existingReceipt?.receiptNumber || (await generateSequentialReceiptNumber());
    const downloadToken = existingReceipt?.downloadToken || crypto.randomBytes(24).toString('hex');
    const paymentRef = payment.transactionReference || payment.gatewayPaymentId || receiptNumber;

    // 4. Generate A4 PDF Binary
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
      transactionReference: paymentRef,
      hostelName: hostelSettings?.hostelName || 'SAIRAM ELITE LIVING',
      hostelAddress:
        hostelSettings?.hostelAddress ||
        'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment, Gandi Maisamma, Hyderabad, Telangana – 500043',
      contactPhone: hostelSettings?.contactPhone || '+91 8977339133, 918688535143',
    });

    // 5. Upload to Google Drive under Month-Year subfolder
    let driveFileId: string | null = existingReceipt?.googleDriveFileId || null;
    let driveFolderId: string | null = existingReceipt?.googleDriveFolderId || null;
    let driveFileName: string | null = existingReceipt?.receiptFileName || null;
    let driveUploadStatus: string = 'SUCCESS';
    let driveUploadedAt: Date | null = existingReceipt?.driveUploadedAt || null;

    if (!driveFileId) {
      try {
        const uploadResult = await uploadReceiptPdfToDrive({
          receiptNumber,
          residentName: payment.resident?.fullName || 'Resident',
          roomNumber: payment.room?.roomNumber || '101',
          billingMonth: payment.billingMonth,
          paymentReference: paymentRef,
          pdfBytes,
        });

        driveFileId = uploadResult.fileId;
        driveFolderId = uploadResult.folderId;
        driveFileName = uploadResult.fileName;
        driveUploadStatus = 'SUCCESS';
        driveUploadedAt = new Date();
      } catch (driveErr: any) {
        console.error('Google Drive receipt upload error (Payment remains PAID):', driveErr.message);
        driveUploadStatus = 'FAILED';
      }
    }

    // 6. Upsert Receipt record in database
    const savedReceipt = await db.receipt.upsert({
      where: { receiptNumber },
      update: {
        googleDriveFileId: driveFileId,
        googleDriveFolderId: driveFolderId,
        receiptFileName: driveFileName,
        driveUploadStatus,
        driveUploadedAt,
        status: 'READY',
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
        googleDriveFolderId: driveFolderId,
        receiptFileName: driveFileName,
        driveUploadStatus,
        driveUploadedAt,
        status: 'READY',
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
      googleDriveFolderId: savedReceipt.googleDriveFolderId,
      receiptFileName: savedReceipt.receiptFileName,
      status: savedReceipt.status,
      driveUploadStatus: savedReceipt.driveUploadStatus || 'SUCCESS',
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
