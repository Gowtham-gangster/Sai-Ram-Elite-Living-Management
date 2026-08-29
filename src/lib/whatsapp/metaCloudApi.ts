/**
 * Production Meta WhatsApp Business Cloud API Client
 * Server-Side Only Service
 * SAIRAM ELITE LIVING MANAGEMENT
 */

import {
  IWhatsAppProvider,
  ResidentReminderInput,
  WhatsAppSendResult,
  MetaSendTemplatePayload,
} from './types';
import { normalizeWhatsAppPhoneNumber } from './phoneNormalizer';
import {
  renderReminderTemplateText,
  getMetaTemplateName,
  buildMetaTemplateComponents,
} from './messageTemplates';
import { getWhatsAppConfig } from './config';

export class MetaCloudApiProvider implements IWhatsAppProvider {
  /**
   * Validates required Meta Cloud API configuration
   */
  validateConfiguration(): { valid: boolean; missingKeys: string[] } {
    const config = getWhatsAppConfig();
    const missing: string[] = [];

    if (!config.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
    if (!config.accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');

    return {
      valid: missing.length === 0,
      missingKeys: missing,
    };
  }

  /**
   * Dispatches automated template payment reminder
   */
  async sendTemplateReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult> {
    const config = getWhatsAppConfig();
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
        deliveryStatus: 'FAILED',
      };
    }

    // Determine target recipient (in test mode, redirect if test recipient is configured)
    let targetPhone = normalized.digitsOnly;
    if (config.isTestMode && config.testRecipient) {
      const testNormalized = normalizeWhatsAppPhoneNumber(config.testRecipient);
      if (testNormalized.isValid) {
        targetPhone = testNormalized.digitsOnly;
      }
    }

    // 2. Check if live credentials are configured
    const { valid } = this.validateConfiguration();
    if (!valid) {
      // In development / local testing without Meta keys, simulate successful acceptance
      const simulatedId = `wa_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        success: true,
        messageId: simulatedId,
        renderedText,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
        deliveryStatus: 'SENT',
      };
    }

    // 3. Construct Meta Template Payload
    const templateName = getMetaTemplateName(input.reminderType, input.sequence);
    const components = buildMetaTemplateComponents(input);

    const payload: MetaSendTemplatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: config.languageCode,
        },
        components,
      },
    };

    return this.dispatchWithRetry(payload, normalized.e164, renderedText, config.maxRetries);
  }

  /**
   * Sends a custom text message (for admin test route / interactive sessions)
   */
  async sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult> {
    const config = getWhatsAppConfig();
    const normalized = normalizeWhatsAppPhoneNumber(toPhone);

    if (!normalized.isValid) {
      return {
        success: false,
        error: `Invalid phone number: ${normalized.error}`,
        renderedText: text,
        recipientPhone: toPhone,
        timestamp: new Date(),
        deliveryStatus: 'FAILED',
      };
    }

    let targetPhone = normalized.digitsOnly;
    if (config.isTestMode && config.testRecipient) {
      const testNormalized = normalizeWhatsAppPhoneNumber(config.testRecipient);
      if (testNormalized.isValid) {
        targetPhone = testNormalized.digitsOnly;
      }
    }

    const { valid } = this.validateConfiguration();
    if (!valid) {
      const simulatedId = `wa_mock_custom_${Date.now()}`;
      return {
        success: true,
        messageId: simulatedId,
        renderedText: text,
        recipientPhone: normalized.e164,
        timestamp: new Date(),
        deliveryStatus: 'SENT',
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetPhone,
      type: 'text',
      text: { body: text },
    };

    return this.dispatchWithRetry(payload, normalized.e164, text, config.maxRetries);
  }

  /**
   * Dispatches payload to Meta Graph API with timeout and transient error retries
   */
  private async dispatchWithRetry(
    payload: any,
    recipientE164: string,
    renderedText: string,
    retriesRemaining: number
  ): Promise<WhatsAppSendResult> {
    const config = getWhatsAppConfig();
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = data?.error;
        const errorMessage = errorDetail?.message || `Meta API returned HTTP ${response.status}`;
        const errorCode = errorDetail?.code;
        const errorSubcode = errorDetail?.error_subcode;

        // Determine if error is transient (e.g. rate limit 429 or server error 5xx)
        const isTransient = response.status === 429 || response.status >= 500;

        if (isTransient && retriesRemaining > 0) {
          // Exponential backoff wait (500ms, 1000ms)
          await new Promise((resolve) => setTimeout(resolve, (3 - retriesRemaining) * 500));
          return this.dispatchWithRetry(payload, recipientE164, renderedText, retriesRemaining - 1);
        }

        console.error(`[WhatsApp Meta API Error] Status: ${response.status} | Code: ${errorCode}/${errorSubcode} | Message: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
          httpStatus: response.status,
          renderedText,
          recipientPhone: recipientE164,
          timestamp: new Date(),
          deliveryStatus: 'FAILED',
        };
      }

      const messageId = data?.messages?.[0]?.id || `wam_${Date.now()}`;

      return {
        success: true,
        messageId,
        httpStatus: response.status,
        renderedText,
        recipientPhone: recipientE164,
        timestamp: new Date(),
        deliveryStatus: 'SENT',
      };
    } catch (err: any) {
      if (err.name === 'AbortError' && retriesRemaining > 0) {
        return this.dispatchWithRetry(payload, recipientE164, renderedText, retriesRemaining - 1);
      }

      console.error('[WhatsApp Network Exception]', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Network exception communicating with Meta WhatsApp Cloud API',
        renderedText,
        recipientPhone: recipientE164,
        timestamp: new Date(),
        deliveryStatus: 'FAILED',
      };
    }
  }
}
