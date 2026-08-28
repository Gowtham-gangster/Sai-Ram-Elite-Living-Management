/**
 * WhatsApp Provider Factory & Service Hub
 */

import { IWhatsAppProvider, ResidentReminderInput, WhatsAppSendResult } from './types';
import { MetaCloudApiProvider } from './metaCloudApi';

class MockWhatsAppProvider implements IWhatsAppProvider {
  async sendTemplateReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult> {
    const mockId = `wa_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      messageId: mockId,
      renderedText: `Mock message for ${input.residentName}`,
      recipientPhone: input.phone,
      timestamp: new Date(),
    };
  }

  async sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult> {
    return {
      success: true,
      messageId: `wa_mock_txt_${Date.now()}`,
      renderedText: text,
      recipientPhone: toPhone,
      timestamp: new Date(),
    };
  }
}

export class WhatsAppService {
  private static provider: IWhatsAppProvider = new MetaCloudApiProvider();

  /**
   * Allows injecting a custom provider (e.g. for testing)
   */
  public static setProvider(customProvider: IWhatsAppProvider) {
    this.provider = customProvider;
  }

  /**
   * Resets back to default Meta Cloud API provider
   */
  public static resetToDefaultProvider() {
    this.provider = new MetaCloudApiProvider();
  }

  /**
   * Sends an automated payment reminder to a resident
   */
  public static async sendPaymentReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult> {
    return this.provider.sendTemplateReminder(input);
  }

  /**
   * Sends a custom text message
   */
  public static async sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult> {
    return this.provider.sendCustomText(toPhone, text);
  }
}
