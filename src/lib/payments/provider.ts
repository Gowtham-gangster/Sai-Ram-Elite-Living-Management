import crypto from 'crypto';
import {
  PaymentVerificationPayload,
  WebhookValidationResult,
} from './types';

/**
 * Payment Provider Abstraction Interface
 */
export interface PaymentProvider {
  name: string;
  verifyWebhookSignature(rawBody: string, signatureHeader?: string | null): boolean;
  parseWebhookPayload(body: any): PaymentVerificationPayload | null;
}

/**
 * Standard HMAC-SHA256 Webhook Payment Provider Implementation
 */
export class StandardHmacPaymentProvider implements PaymentProvider {
  name = 'STANDARD_UPI_GATEWAY';
  private webhookSecret: string;

  constructor(secret?: string) {
    this.webhookSecret =
      secret ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      'sairam-elite-living-payment-webhook-secret-2026-prod';
  }

  /**
   * Cryptographically verifies the HMAC-SHA256 signature sent with the webhook
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

      // Use timing-safe buffer comparison to prevent timing attacks
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
   * Parses incoming provider payload into standard PaymentVerificationPayload
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

// Singleton Provider instance
export const defaultPaymentProvider = new StandardHmacPaymentProvider();
