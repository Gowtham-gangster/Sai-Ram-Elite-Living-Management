/**
 * Meta WhatsApp Cloud API Configuration
 * SAIRAM ELITE LIVING MANAGEMENT
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken: string;
  apiVersion: string;
  businessPhoneNumber: string;
  templates: {
    firstDue: string;
    dueDate: string;
    overdue: string;
    recurring: string;
    secondDue: string;
  };
  languageCode: string;
  appUrl: string;
  isTestMode: boolean;
  testRecipient?: string;
  maxRetries: number;
  timeoutMs: number;
  concurrencyLimit: number;
}

/**
 * Loads and validates WhatsApp environment configuration
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://sairamhostel.com'
  ).replace(/\/$/, '');

  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    businessPhoneNumber: process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || '+918688535143',
    templates: {
      firstDue: process.env.WHATSAPP_TEMPLATE_DUE_2_DAYS || process.env.WHATSAPP_REMINDER_TEMPLATE_FIRST || 'first_payment_reminder',
      dueDate: process.env.WHATSAPP_TEMPLATE_DUE_TODAY || 'due_date_payment_reminder',
      overdue: process.env.WHATSAPP_TEMPLATE_OVERDUE || 'overdue_payment_reminder',
      recurring: process.env.WHATSAPP_TEMPLATE_RECURRING || process.env.WHATSAPP_REMINDER_TEMPLATE_SECOND || 'second_payment_reminder',
      secondDue: process.env.WHATSAPP_REMINDER_TEMPLATE_SECOND || 'second_payment_reminder',
    },
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
    appUrl,
    isTestMode: process.env.WHATSAPP_TEST_MODE === 'true',
    testRecipient: process.env.WHATSAPP_TEST_RECIPIENT,
    maxRetries: 2,
    timeoutMs: 10000, // 10 seconds timeout
    concurrencyLimit: 5, // Process max 5 WhatsApp dispatches concurrently
  };
}

/**
 * Helper to check if production Meta WhatsApp credentials are fully configured
 */
export function isWhatsAppConfigured(): boolean {
  const cfg = getWhatsAppConfig();
  return Boolean(cfg.phoneNumberId && cfg.accessToken);
}
