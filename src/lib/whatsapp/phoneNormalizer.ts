/**
 * Robust Indian Mobile Phone Number Normalizer for WhatsApp Delivery
 */

export interface NormalizedPhone {
  isValid: boolean;
  e164: string; // e.g. "+918688535143"
  digitsOnly: string; // e.g. "918688535143" (required format for Meta WhatsApp API to field)
  error?: string;
}

export function normalizeWhatsAppPhoneNumber(raw: any): NormalizedPhone {
  if (!raw) {
    return {
      isValid: false,
      e164: '',
      digitsOnly: '',
      error: 'Phone number is empty or missing.',
    };
  }

  // Strip all non-digit characters except leading '+'
  const rawStr = String(raw).trim();
  let cleaned = rawStr.replace(/[^\d+]/g, '');

  // Strip leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 0 (e.g. "08688535143")
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, prepend India country code 91
  if (cleaned.length === 10) {
    // Standard 10 digit Indian mobile numbers start with 6, 7, 8, or 9
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      const digitsOnly = `91${cleaned}`;
      return {
        isValid: true,
        e164: `+${digitsOnly}`,
        digitsOnly,
      };
    } else {
      return {
        isValid: false,
        e164: '',
        digitsOnly: '',
        error: `Invalid Indian 10-digit mobile number format (must start with 6, 7, 8, or 9): ${rawStr}`,
      };
    }
  }

  // If 12 digits starting with 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const mobilePart = cleaned.substring(2);
    if (/^[6-9]\d{9}$/.test(mobilePart)) {
      return {
        isValid: true,
        e164: `+${cleaned}`,
        digitsOnly: cleaned,
      };
    } else {
      return {
        isValid: false,
        e164: '',
        digitsOnly: '',
        error: `Invalid Indian 10-digit mobile number in 91-prefix: ${rawStr}`,
      };
    }
  }

  return {
    isValid: false,
    e164: '',
    digitsOnly: '',
    error: `Unrecognized phone number format: ${rawStr}. Expected 10-digit Indian mobile number.`,
  };
}
