/**
 * Meta WhatsApp Business Cloud API Client
 * Server-Side Only Service
 */

import { IWhatsAppProvider, ResidentReminderInput, WhatsAppSendResult } from './types';
import { normalizeWhatsAppPhoneNumber } from './phoneNormalizer';
import { renderReminderTemplateText, formatBillingMonthDisplay } from './messageTemplates';

export class MetaCloudApiProvider implements IWhatsAppProvider {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;
  private businessPhoneNumber: string;
  private templateFirst: string;
  private templateSecond: string;
  private isTestMode: boolean;
  private testRecipient?: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.businessPhoneNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || '+918688535143';
    this.templateFirst = process.env.WHATSAPP_REMINDER_TEMPLATE_FIRST || 'first_payment_reminder';
    this.templateSecond = process.env.WHATSAPP_REMINDER_TEMPLATE_SECOND || 'second_payment_reminder';
    this.isTestMode = process.env.WHATSAPP_TEST_MODE === 'true';
    this.testRecipient = process.env.WHATSAPP_TEST_RECIPIENT;
  }

  /**
   * Dispatches automated template payment reminder
   */
  async sendTemplateReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult> {
    const renderedText = renderReminderTemplateText(input);

    // 1. Phone number normalization
    const normalized = normalizeWhatsAppPhoneNumber(input.phone);
    if (!normalized.isValid) {
      return {
        success: false,
        error: `Invalid resident phone number (${input.phone}): ${normalized.error}`,
        renderedText,
        recipientPhone: input.phone,
        timestamp: new Date(),
      };
    }

    // Determine target recipient (in test mode, override if test recipient configured)
    let targetPhone = normalized.digitsOnly;
    if (this.isTestMode && this.testRecipient) {
      const testNormalized = normalizeWhatsAppPhoneNumber(this.testRecipient);
      if (testNormalized.isValid) {
        targetPhone = testNormalized.digitsOnly;
        console.log(`[WhatsApp Test Mode] Redirecting message for ${input.residentName} (${normalized.e164}) to test recipient: ${testNormalized.e164}`);
      }
    }

    // 2. Check if live credentials are configured
    if (!this.phoneNumberId || !this.accessToken) {
      // In development / testing without live Meta keys, simulate successful acceptance
      const simulatedId = `wa_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[WhatsApp Meta Cloud API Mock Dispatch]`);
      console.log(`  • Sender Business No: ${this.businessPhoneNumber}`);
      console.log(`  • Recipient: ${normalized.e164} (Digits: ${targetPhone})`);
      console.log(`  • Stage: ${input.reminderType}`);
      console.log(`  • Message ID: ${simulatedId}`);
      console.log(`  • Content:\n${renderedText}\n`);

      return {
        success: true,
        messageId: simulatedId,
        renderedText,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    }

    // 3. Dispatch to Meta WhatsApp Cloud API
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const templateName = input.reminderType === 'FIRST_DUE_REMINDER' ? this.templateFirst : this.templateSecond;
    const amountFormatted = Number(input.amountDue).toLocaleString('en-IN');
    const billingMonthFormatted = formatBillingMonthDisplay(input.billingMonth);

    // Template payload structure with parameters: {{1}}=resident_name, {{2}}=amount, {{3}}=billing_month
    const templatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en',
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.residentName },
              { type: 'text', text: amountFormatted },
              { type: 'text', text: billingMonthFormatted },
            ],
          },
        ],
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || `Meta API returned HTTP ${response.status}`;
        console.error(`[WhatsApp Meta API Error] Status: ${response.status}, Error:`, data);
        return {
          success: false,
          error: errorMsg,
          httpStatus: response.status,
          renderedText,
          recipientPhone: normalized.e164,
          timestamp: new Date(),
        };
      }

      const messageId = data?.messages?.[0]?.id || `wam_${Date.now()}`;
      return {
        success: true,
        messageId,
        httpStatus: response.status,
        renderedText,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    } catch (err: any) {
      console.error('[WhatsApp Network Exception]', err);
      return {
        success: false,
        error: err.message || 'Network exception communicating with Meta WhatsApp Cloud API',
        renderedText,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sends custom text message
   */
  async sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult> {
    const normalized = normalizeWhatsAppPhoneNumber(toPhone);
    if (!normalized.isValid) {
      return {
        success: false,
        error: `Invalid phone number: ${normalized.error}`,
        renderedText: text,
        recipientPhone: toPhone,
        timestamp: new Date(),
      };
    }

    let targetPhone = normalized.digitsOnly;
    if (this.isTestMode && this.testRecipient) {
      const testNormalized = normalizeWhatsAppPhoneNumber(this.testRecipient);
      if (testNormalized.isValid) {
        targetPhone = testNormalized.digitsOnly;
      }
    }

    if (!this.phoneNumberId || !this.accessToken) {
      const simulatedId = `wa_mock_custom_${Date.now()}`;
      console.log(`[WhatsApp Mock Custom Text] To: ${normalized.e164} -> ID: ${simulatedId}`);
      return {
        success: true,
        messageId: simulatedId,
        renderedText: text,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetPhone,
      type: 'text',
      text: { body: text },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || `Meta API HTTP ${response.status}`,
          httpStatus: response.status,
          renderedText: text,
          recipientPhone: normalized.e164,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data?.messages?.[0]?.id || `wam_${Date.now()}`,
        httpStatus: response.status,
        renderedText: text,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network exception calling Meta WhatsApp API',
        renderedText: text,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
      };
    }
  }
}
