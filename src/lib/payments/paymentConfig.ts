import { prisma } from '@/lib/prisma';
import { OwnerUpiConfig, PaymentServerConfig } from './types';

/**
 * Basic UPI ID format validator (e.g. username@bankhandle, min 2 chars before @, valid bank suffix)
 */
export function isValidUpiIdFormat(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z0-9.\-_]{2,64}$/;
  return upiRegex.test(trimmed);
}

/**
 * Safely fetches and validates owner UPI configuration strictly on the server.
 * Source of truth priority:
 * 1. Server Environment Variables (OWNER_UPI_ID, OWNER_UPI_NAME)
 * 2. Database HostelSettings (as fallback if configured)
 *
 * Throws an Error if no valid UPI ID is configured.
 */
export async function getOwnerUpiConfig(): Promise<OwnerUpiConfig> {
  // 1. Check server-side environment variables
  const envUpiId = process.env.OWNER_UPI_ID?.trim();
  const envUpiName = process.env.OWNER_UPI_NAME?.trim();

  let upiId = envUpiId || '';
  let payeeName = envUpiName || '';

  // 2. Fallback to Database HostelSettings if env is empty
  if (!upiId) {
    try {
      const settings = await prisma.hostelSettings.findUnique({
        where: { id: 'default' },
      });
      if (settings?.upiId) {
        upiId = settings.upiId.trim();
      }
      if (!payeeName && (settings?.accountHolderName || settings?.hostelName)) {
        payeeName = (settings.accountHolderName || settings.hostelName).trim();
      }
    } catch (err) {
      console.error('Error querying HostelSettings for UPI fallback:', err);
    }
  }

  // 3. Ensure payeeName has a sensible default
  if (!payeeName) {
    payeeName = 'SAIRAM ELITE LIVING';
  }

  // 4. Validate UPI ID
  if (!upiId) {
    throw new Error('OWNER_UPI_ID is not configured on the server.');
  }

  if (!isValidUpiIdFormat(upiId)) {
    throw new Error(`Invalid UPI ID format configured: ${upiId}`);
  }

  return {
    upiId,
    payeeName,
  };
}

/**
 * Centralized Server-Side Payment Configuration
 * Prepares support for future Adarsh Bank merchant parameters without requiring fake values.
 * Safe fallback to personal UPI is always guaranteed.
 */
export async function getPaymentServerConfig(): Promise<PaymentServerConfig> {
  const ownerUpi = await getOwnerUpiConfig();

  const provider = process.env.PAYMENT_PROVIDER?.trim() || 'PERSONAL_UPI_FALLBACK';
  
  const timeoutMinutesRaw = parseInt(process.env.PAYMENT_SESSION_TIMEOUT_MINUTES || '10', 10);
  const timeoutMinutes = isNaN(timeoutMinutesRaw) || timeoutMinutesRaw <= 0 ? 10 : timeoutMinutesRaw;

  const statusEnabled = process.env.PAYMENT_STATUS_ENABLED !== 'false';
  const intentEnabled = process.env.PAYMENT_INTENT_ENABLED !== 'false';
  const dynamicQrEnabled = process.env.PAYMENT_DYNAMIC_QR_ENABLED !== 'false';

  // Future merchant configuration values (will be active only if configured)
  const merchantUpiId = process.env.MERCHANT_UPI_ID?.trim();
  const merchantUpiName = process.env.MERCHANT_UPI_NAME?.trim();
  const merchantMcc = process.env.MERCHANT_MCC?.trim();
  const merchantId = process.env.MERCHANT_ID?.trim();
  const terminalId = process.env.TERMINAL_ID?.trim();
  const apiBaseUrl = process.env.PAYMENT_API_BASE_URL?.trim();
  const apiKey = process.env.PAYMENT_API_KEY?.trim();
  const apiSecret = process.env.PAYMENT_API_SECRET?.trim();
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();

  return {
    provider,
    timeoutMinutes,
    statusEnabled,
    intentEnabled,
    dynamicQrEnabled,
    ownerUpi,
    merchantConfig: {
      merchantUpiId,
      merchantUpiName,
      merchantMcc,
      merchantId,
      terminalId,
      apiBaseUrl,
      apiKey,
      apiSecret,
      webhookSecret,
    },
  };
}

/**
 * Retrieves server-side bank settlement credentials configured in .env
 */
export function getBankSettlementConfig() {
  return {
    bankName: process.env.BANK_NAME || 'ICICI Bank',
    accountHolderName: process.env.BANK_ACCOUNT_HOLDER || 'SAIRAM ELITE LIVING HOSPITALITY LLP',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '001122334455',
    ifscCode: process.env.BANK_IFSC_CODE || 'ICIC0000011',
    upiId: process.env.BANK_UPI_ID || process.env.OWNER_UPI_ID || 'sairamhostel@icici',
    paymentInstructions: process.env.BANK_PAYMENT_INSTRUCTIONS || 'Transfer rent by the 5th. Mention room number in remarks.',
  };
}

