import { PaymentCompletionService } from './paymentCompletionService';
import { PaymentVerificationPayload, PaymentVerificationResult } from './types';

/**
 * Server-Side Payment Verification Engine
 * Delegates to centralized, transactional PaymentCompletionService.
 */
export async function processVerifiedPayment(
  payload: PaymentVerificationPayload
): Promise<PaymentVerificationResult> {
  return PaymentCompletionService.completeVerifiedPayment(payload);
}
