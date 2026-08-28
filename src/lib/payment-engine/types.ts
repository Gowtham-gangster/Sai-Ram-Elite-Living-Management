export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'OVERDUE' | 'REJECTED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

export interface IPaymentRecordInput {
  monthlyPaymentId: string;
  residentId: string;
  amountPaid: number;
  paymentDate?: Date;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  proofAttachmentUrl?: string;
  notes?: string;
  verifiedByAdminName?: string;
}

export interface IStatusTransitionResult {
  success: boolean;
  previousStatus: PaymentStatus;
  newStatus: PaymentStatus;
  monthlyPaymentId: string;
  receiptNumber?: string;
  message: string;
}

export interface IReceiptData {
  receiptNumber: string;
  monthlyPaymentId: string;
  residentName: string;
  roomNumber: string;
  billingMonth: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: Date;
  generatedBy: string;
  notes?: string;
}

/**
 * Extensible Payment Provider interface for future payment gateway automation (Razorpay, Cashfree, etc.)
 */
export interface IPaymentGatewayProvider {
  providerName: string;
  isAutomated: boolean;
  createPaymentOrder?(params: {
    monthlyPaymentId: string;
    amount: number;
    residentName: string;
    residentPhone: string;
    description: string;
  }): Promise<{ orderId: string; paymentUrl?: string }>;
  verifyWebhookSignature?(payload: string, signature: string): boolean;
}
