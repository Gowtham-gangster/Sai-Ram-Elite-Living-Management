/**
 * Payment Architecture Types & Interfaces
 * Prepared for future Adarsh Bank Merchant UPI & Payment Gateway Integration
 */

export type PaymentStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'FAILED'
  | 'CANCELLED';

export type SessionLifecycleStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'NOT_AVAILABLE';

export interface OwnerUpiConfig {
  upiId: string;
  payeeName: string;
}

export interface PaymentServerConfig {
  provider: string;
  timeoutMinutes: number;
  statusEnabled: boolean;
  intentEnabled: boolean;
  dynamicQrEnabled: boolean;
  ownerUpi: OwnerUpiConfig;
  merchantConfig?: {
    merchantUpiId?: string;
    merchantUpiName?: string;
    merchantMcc?: string;
    merchantId?: string;
    terminalId?: string;
    apiBaseUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
  };
}

export interface CreateSessionInput {
  monthlyPaymentId: string;
  residentId: string;
  amount: number;
  billingMonth: string;
  roomNumber: string;
  residentName: string;
  preferredApp?: string; // 'gpay' | 'phonepe' | 'paytm' | 'generic'
  createdBy?: string;    // 'RESIDENT' | 'ADMIN'
}

export interface PaymentSessionDTO {
  paymentSessionId: string;
  transactionReference: string;
  monthlyPaymentId: string;
  residentId: string;
  residentName: string;
  roomNumber: string;
  billingMonth: string;
  amount: number;
  status: SessionLifecycleStatus;
  paymentMethod: string;
  provider: string;
  qrPayload: string;
  qrDataUrl?: string;
  standardUpiUrl: string;
  appIntentUrl: string;
  gpayUrl: string;
  phonepeUrl: string;
  paytmUrl: string;
  createdAt: string;
  expiresAt: string;
  timeoutSeconds: number;
  availablePaymentMethods: string[];
  payeeName: string;
  upiId: string;
}

export interface SessionStatusResult {
  found: boolean;
  sessionId?: string;
  referenceId: string;
  status: SessionLifecycleStatus;
  isPaid: boolean;
  isPartiallyPaid: boolean;
  isPending: boolean;
  isExpired: boolean;
  amount: number;
  amountPaid?: number;
  remainingBalance?: number;
  billingMonth?: string;
  roomNumber?: string;
  residentName?: string;
  paidDate?: string | null;
  paymentMethod?: string;
  receiptNumber?: string | null;
  downloadToken?: string | null;
  receiptStatus?: string | null;
  expiresAt?: string;
  error?: string;
}

export interface UPIIntentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  note: string;
  mcc?: string;
  url?: string;
}

export interface PaymentVerificationPayload {
  referenceId: string; // e.g. "SRL_202608_..."
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  gatewayProvider?: string;
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
