/**
 * Payment Verification Architecture Types & Interfaces
 */

export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'FAILED' | 'CANCELLED';

export interface PaymentAttempt {
  referenceId: string;
  monthlyPaymentId: string;
  residentId: string;
  amount: number;
  billingMonth: string;
  createdAt: Date;
  status: PaymentStatus;
}

export interface PaymentVerificationPayload {
  referenceId: string; // e.g. "SRL_202608_101_..."
  gatewayPaymentId?: string; // Provider transaction/payment ID
  gatewayOrderId?: string; // Provider order ID
  gatewayProvider?: string; // e.g. "UPI_GATEWAY", "RAZORPAY", "PHONEPE_PG", "PAYTM_PG"
  amountPaid: number;
  paymentDate?: Date;
  paymentMethod?: string;
  signature?: string;
  rawPayload?: any;
}

export interface PaymentVerificationResult {
  success: boolean;
  isPaid: boolean;
  status: PaymentStatus;
  monthlyPaymentId?: string;
  residentId?: string;
  amountExpected?: number;
  amountReceived?: number;
  remainingBalance?: number;
  referenceId?: string;
  gatewayPaymentId?: string;
  receiptNumber?: string;
  downloadToken?: string;
  googleDriveFileId?: string | null;
  error?: string;
  isDuplicate?: boolean;
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  payload?: PaymentVerificationPayload;
}
