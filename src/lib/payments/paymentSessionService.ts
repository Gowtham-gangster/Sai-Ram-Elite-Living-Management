import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPaymentServerConfig } from './paymentConfig';
import { getPaymentProvider } from './provider';
import {
  CreateSessionInput,
  PaymentSessionDTO,
  SessionStatusResult,
} from './types';
import { assertPaymentEnabledForRoom } from './eligibility';

/**
 * Generates a clean, unique transaction reference safe for all UPI providers:
 * Format: SRL_YYYYMM_<short-unique-id>
 * - Unique
 * - Safe for UPI length limits (max 35 chars standard)
 * - Contains NO Aadhaar, phone numbers, or PII
 */
export function generateUniqueTransactionReference(billingMonth: string): string {
  const cleanMonth = billingMonth.replace(/[^0-9]/g, '').slice(0, 6) || '202608';
  const randomSalt = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
  const timeSlice = Date.now().toString(36).slice(-4).toUpperCase();       // 4 chars
  return `SRL_${cleanMonth}_${timeSlice}_${randomSalt}`;
}

/**
 * Payment Session Management Service
 * Single source of truth for unified QR & UPI Intent payment sessions.
 */
export class PaymentSessionService {
  /**
   * Creates a new PaymentSession or returns the active valid session if amount matches.
   * If amount is modified, cancels prior active sessions and creates a fresh session.
   */
  static async createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionDTO> {
    const config = await getPaymentServerConfig();
    const provider = getPaymentProvider(config.provider);

    const {
      monthlyPaymentId,
      residentId,
      amount,
      billingMonth,
      roomNumber,
      residentName,
      createdBy = 'RESIDENT',
    } = input;

    // Verify room payment eligibility
    const paymentRecord = await prisma.monthlyPayment.findUnique({
      where: { id: monthlyPaymentId },
      include: { room: true },
    });
    if (paymentRecord) {
      assertPaymentEnabledForRoom(paymentRecord.room);
    }

    // 1. Check if an active, non-expired session already exists for this MonthlyPayment with the EXACT same amount
    const now = new Date();
    const existingActiveSession = await prisma.paymentSession.findFirst({
      where: {
        monthlyPaymentId,
        residentId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If an active session exists and amount is identical, reuse it (preserves countdown and single transaction ref)
    if (existingActiveSession && Math.abs(existingActiveSession.amount - amount) < 0.01) {
      const remainingSeconds = Math.max(
        0,
        Math.floor((existingActiveSession.expiresAt.getTime() - Date.now()) / 1000)
      );

      const standardUpiUrl = existingActiveSession.qrPayload || '';
      const qrDataUrl = await provider.generateQrDataUrl(standardUpiUrl);

      return {
        paymentSessionId: existingActiveSession.id,
        transactionReference: existingActiveSession.transactionReference,
        monthlyPaymentId: existingActiveSession.monthlyPaymentId,
        residentId: existingActiveSession.residentId,
        residentName,
        roomNumber: existingActiveSession.roomNumber,
        billingMonth: existingActiveSession.billingMonth,
        amount: existingActiveSession.amount,
        status: existingActiveSession.status as any,
        paymentMethod: existingActiveSession.paymentMethod,
        provider: existingActiveSession.provider,
        qrPayload: standardUpiUrl,
        qrDataUrl,
        standardUpiUrl,
        appIntentUrl: standardUpiUrl,
        gpayUrl: standardUpiUrl,
        phonepeUrl: standardUpiUrl,
        paytmUrl: standardUpiUrl,
        createdAt: existingActiveSession.createdAt.toISOString(),
        expiresAt: existingActiveSession.expiresAt.toISOString(),
        timeoutSeconds: remainingSeconds,
        availablePaymentMethods: ['gpay', 'phonepe', 'paytm', 'generic_upi', 'qr_code'],
        payeeName: config.ownerUpi.payeeName,
        upiId: config.ownerUpi.upiId,
      };
    }

    // 2. If existing active session had a DIFFERENT amount, cancel it to invalidate the old session
    if (existingActiveSession) {
      await prisma.paymentSession.update({
        where: { id: existingActiveSession.id },
        data: { status: 'CANCELLED' },
      });
    }

    // 3. Generate New Unique Transaction Reference and Expiration
    const transactionReference = generateUniqueTransactionReference(billingMonth);
    const timeoutMinutes = config.timeoutMinutes;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    const transactionNote = `Rent ${billingMonth} Room ${roomNumber}`;

    // 4. Build standard canonical UPI URL derived strictly from session data
    const standardUpiUrl = provider.createIntentUrl({
      upiId: config.ownerUpi.upiId,
      payeeName: config.ownerUpi.payeeName,
      amount,
      transactionRef: transactionReference,
      note: transactionNote,
    });

    // 5. Generate high-resolution QR Data URL
    const qrDataUrl = await provider.generateQrDataUrl(standardUpiUrl);

    // 6. Persist PaymentSession record in DB
    const newSession = await prisma.paymentSession.create({
      data: {
        monthlyPaymentId,
        residentId,
        amount,
        billingMonth,
        roomNumber,
        transactionReference,
        status: 'ACTIVE',
        paymentMethod: 'UPI',
        provider: config.provider,
        verificationStatus: 'PENDING',
        qrPayload: standardUpiUrl,
        expiresAt,
        createdBy,
      },
    });

    // Optionally update MonthlyPayment transactionReference without marking PAID
    await prisma.monthlyPayment.update({
      where: { id: monthlyPaymentId },
      data: {
        transactionReference,
        paymentMethod: 'UPI',
      },
    });

    return {
      paymentSessionId: newSession.id,
      transactionReference,
      monthlyPaymentId,
      residentId,
      residentName,
      roomNumber,
      billingMonth,
      amount,
      status: 'ACTIVE',
      paymentMethod: 'UPI',
      provider: config.provider,
      qrPayload: standardUpiUrl,
      qrDataUrl,
      standardUpiUrl,
      appIntentUrl: standardUpiUrl,
      gpayUrl: standardUpiUrl,
      phonepeUrl: standardUpiUrl,
      paytmUrl: standardUpiUrl,
      createdAt: newSession.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      timeoutSeconds: timeoutMinutes * 60,
      availablePaymentMethods: ['gpay', 'phonepe', 'paytm', 'generic_upi', 'qr_code'],
      payeeName: config.ownerUpi.payeeName,
      upiId: config.ownerUpi.upiId,
    };
  }

  /**
   * Retrieves the current status of a payment session, evaluating authoritative server expiration
   */
  static async getSessionStatus(identifier: string): Promise<SessionStatusResult> {
    const cleanId = identifier.trim();

    // Lookup session by session ID, transaction reference, or monthlyPayment ID
    const session = await prisma.paymentSession.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { transactionReference: cleanId },
          { monthlyPaymentId: cleanId },
        ],
      },
      include: {
        monthlyPayment: {
          include: {
            receipts: {
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
                room: { select: { roomNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return {
        found: false,
        referenceId: cleanId,
        status: 'FAILED',
        isPaid: false,
        isPartiallyPaid: false,
        isPending: false,
        isExpired: false,
        amount: 0,
        error: 'Payment session not found.',
      };
    }

    const now = new Date();
    const isPastExpiry = session.expiresAt < now;
    let currentStatus = session.status;

    // Authoritative expiration transition: if still ACTIVE but expired, mark EXPIRED in DB
    if (session.status === 'ACTIVE' && isPastExpiry) {
      currentStatus = 'EXPIRED';
      await prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
    }

    const mp = session.monthlyPayment;
    const isPaid = mp.status === 'PAID';
    const isPartiallyPaid = mp.status === 'PARTIALLY_PAID';
    const latestReceipt = mp.receipts?.[0];
    const totalVerified = mp.paymentRecords.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalDue = Number(mp.totalAmountDue || mp.rentAmount || 0);
    const remainingBalance = Math.max(0, totalDue - totalVerified);

    return {
      found: true,
      sessionId: session.id,
      referenceId: session.transactionReference,
      status: isPaid ? 'PAID' : (currentStatus as any),
      isPaid,
      isPartiallyPaid,
      isPending: mp.status === 'PENDING' && currentStatus === 'ACTIVE',
      isExpired: currentStatus === 'EXPIRED',
      amount: session.amount,
      amountPaid: totalVerified,
      remainingBalance,
      billingMonth: session.billingMonth,
      roomNumber: session.roomNumber,
      residentName: mp.resident.fullName,
      paidDate: mp.paidDate ? mp.paidDate.toISOString() : null,
      paymentMethod: session.paymentMethod,
      receiptNumber: latestReceipt?.receiptNumber || null,
      downloadToken: latestReceipt?.downloadToken || null,
      receiptStatus: latestReceipt?.status || (isPaid ? 'READY' : null),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Cancels any active payment session for a given monthly payment
   */
  static async cancelActiveSessions(monthlyPaymentId: string): Promise<void> {
    await prisma.paymentSession.updateMany({
      where: {
        monthlyPaymentId,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
