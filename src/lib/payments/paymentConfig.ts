import { prisma } from '@/lib/prisma';

export interface OwnerUpiConfig {
  upiId: string;
  payeeName: string;
}

/**
 * Basic UPI ID format validator (e.g. username@bankhandle, min 3 chars before @, valid bank suffix)
 */
export function isValidUpiIdFormat(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  // Valid UPI IDs must have an '@', reasonable length (3 to 256), and valid characters
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
