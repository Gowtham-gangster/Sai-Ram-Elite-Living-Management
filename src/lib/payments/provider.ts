import crypto from 'crypto';
import {
  CreateSessionInput,
  PaymentServerConfig,
  PaymentVerificationPayload,
  UPIIntentParams,
  VerificationStatus,
} from './types';

/**
 * Payment Provider Abstraction Interface
 * Designed to allow future Adarsh Bank Merchant UPI / Payment Gateway integration
 * without altering the resident UI.
 */
export interface PaymentProvider {
  name: string;
  createIntentUrl(params: UPIIntentParams): string;
  generateQrDataUrl(payload: string): Promise<string>;
  verifyPayment(transactionReference: string): Promise<{
    status: VerificationStatus;
    isPaid: boolean;
    gatewayPaymentId?: string;
    amountReceived?: number;
    error?: string;
  }>;
  verifyWebhookSignature(rawBody: string, signatureHeader?: string | null): boolean;
  parseWebhookPayload(body: any): PaymentVerificationPayload | null;
}

/**
 * Personal UPI Fallback Provider Implementation
 * Standard canonical UPI URL (upi://pay?...) with high-resolution dynamic QR.
 * Verification returns PENDING / NOT_AVAILABLE as personal UPI does not provide automated bank callbacks.
 */
export class PersonalUPIFallbackProvider implements PaymentProvider {
  name = 'PERSONAL_UPI_FALLBACK';
  private webhookSecret: string;

  constructor(secret?: string) {
    this.webhookSecret =
      secret ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      'sairam-elite-living-payment-webhook-secret-2026-prod';
  }

  /**
   * Constructs the canonical standard UPI Intent URL
   * Prepares future merchant parameters (mc, url) without hardcoding or inventing dummy values.
   */
  createIntentUrl(params: UPIIntentParams): string {
    const { upiId, payeeName, amount, transactionRef, note, mcc, url } = params;

    const queryParams = new URLSearchParams();
    queryParams.set('pa', upiId);
    queryParams.set('pn', payeeName);
    queryParams.set('am', amount.toFixed(2));
    queryParams.set('cu', 'INR');
    queryParams.set('tn', note);
    queryParams.set('tr', transactionRef);

    if (mcc && mcc.trim()) {
      queryParams.set('mc', mcc.trim());
    }
    if (url && url.trim()) {
      queryParams.set('url', url.trim());
    }

    return `upi://pay?${queryParams.toString()}`;
  }

  /**
   * Generates a dynamic, high-resolution QR Data URL for any UPI payload
   */
  async generateQrDataUrl(payload: string): Promise<string> {
    try {
      const QRCode = (await import('qrcode')).default;
      return await QRCode.toDataURL(payload, {
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
      return '';
    }
  }

  /**
   * Provider verification: Personal UPI fallback does NOT pretend to offer authoritative bank API verification.
   * Returns PENDING / NOT_AVAILABLE.
   */
  async verifyPayment(_transactionReference: string): Promise<{
    status: VerificationStatus;
    isPaid: boolean;
    gatewayPaymentId?: string;
    amountReceived?: number;
    error?: string;
  }> {
    return {
      status: 'NOT_AVAILABLE',
      isPaid: false,
      error: 'Personal UPI fallback does not support automated direct bank query. Awaiting manual admin confirmation or webhook.',
    };
  }

  /**
   * Cryptographically verifies HMAC-SHA256 signature for incoming provider webhooks
   */
  verifyWebhookSignature(rawBody: string, signatureHeader?: string | null): boolean {
    if (!signatureHeader || !rawBody) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const signatureBuffer = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature.toLowerCase(), 'utf8');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (err) {
      console.error('Signature verification error:', err);
      return false;
    }
  }

  /**
   * Parses incoming webhook payload into standard PaymentVerificationPayload
   */
  parseWebhookPayload(body: any): PaymentVerificationPayload | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const referenceId =
      body.referenceId ||
      body.transactionReference ||
      body.orderId ||
      body.merchantTransactionId;

    const amountPaid = parseFloat(body.amount || body.amountPaid || body.totalAmount || 0);

    if (!referenceId || isNaN(amountPaid)) {
      return null;
    }

    return {
      referenceId: String(referenceId).trim(),
      gatewayPaymentId: body.paymentId || body.transactionId || body.gatewayPaymentId || undefined,
      gatewayOrderId: body.orderId || body.gatewayOrderId || undefined,
      gatewayProvider: body.provider || this.name,
      amountPaid,
      paymentDate: body.timestamp ? new Date(body.timestamp) : new Date(),
      paymentMethod: body.paymentMethod || 'UPI',
      rawPayload: body,
    };
  }
}

/**
 * Future Adarsh Bank Merchant Provider Interface Skeleton
 * Will be implemented once official documentation and credentials are provided by Adarsh Bank.
 * (DO NOT instantiate with fake credentials in production)
 */
export class AdarshBankMerchantProvider implements PaymentProvider {
  name = 'ADARSH_BANK_MERCHANT_UPI';

  createIntentUrl(params: UPIIntentParams): string {
    const queryParams = new URLSearchParams();
    queryParams.set('pa', params.upiId);
    queryParams.set('pn', params.payeeName);
    queryParams.set('am', params.amount.toFixed(2));
    queryParams.set('cu', 'INR');
    queryParams.set('tn', params.note);
    queryParams.set('tr', params.transactionRef);
    if (params.mcc) queryParams.set('mc', params.mcc);
    if (params.url) queryParams.set('url', params.url);
    return `upi://pay?${queryParams.toString()}`;
  }

  async generateQrDataUrl(payload: string): Promise<string> {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
  }

  async verifyPayment(_transactionReference: string): Promise<{
    status: VerificationStatus;
    isPaid: boolean;
    gatewayPaymentId?: string;
    amountReceived?: number;
    error?: string;
  }> {
    // Awaiting official Adarsh Bank API specs
    return {
      status: 'NOT_AVAILABLE',
      isPaid: false,
      error: 'Adarsh Bank merchant credentials not yet configured.',
    };
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader?: string | null): boolean {
    return false;
  }

  parseWebhookPayload(_body: any): PaymentVerificationPayload | null {
    return null;
  }
}

/**
 * Provider Registry / Factory
 * Resolves the active payment provider based on configuration.
 */
export function getPaymentProvider(providerName?: string): PaymentProvider {
  const selected = (providerName || process.env.PAYMENT_PROVIDER || 'PERSONAL_UPI_FALLBACK').toUpperCase();

  if (selected === 'ADARSH_BANK_MERCHANT_UPI') {
    return new AdarshBankMerchantProvider();
  }

  return new PersonalUPIFallbackProvider();
}

export const defaultPaymentProvider = new PersonalUPIFallbackProvider();
