/**
 * WhatsApp Notification Service Abstraction
 * 
 * Provides an extensible interface for dispatching payment reminders and system notices
 * via WhatsApp. The actual WhatsApp Business API / Twilio / Meta Cloud provider can be
 * plugged in without modifying core billing or reminder scheduling logic.
 */

export type ReminderStage = 'FIRST_DUE_REMINDER' | 'SECOND_REMINDER';

export interface ReminderPayload {
  residentId: string;
  residentName: string;
  phone: string;
  roomNumber: string;
  billingMonth: string; // e.g. "August 2026"
  amountDue: number; // e.g. 8500
  dueDateFormatted: string; // e.g. "05 Aug 2026"
  reminderType: ReminderStage;
}

export interface NotificationResult {
  success: boolean;
  providerMessageId?: string;
  failureReason?: string;
  dispatchedAt: Date;
  renderedMessage: string;
}

export interface IWhatsAppProvider {
  sendMessage(toPhone: string, messageText: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * Standard Dev / Mock WhatsApp Provider
 * Logs cleanly and simulates live message dispatch until live Cloud API credentials are configured.
 */
class MockWhatsAppProvider implements IWhatsAppProvider {
  async sendMessage(toPhone: string, messageText: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Generate deterministic provider ID
    const mockId = `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // In dev / production without external keys, log message payload safely
    console.log(`[WhatsApp Provider] Sending to ${toPhone} -> Message ID: ${mockId}`);
    
    return {
      success: true,
      messageId: mockId,
    };
  }
}

export class WhatsAppNotificationService {
  private static provider: IWhatsAppProvider = new MockWhatsAppProvider();

  /**
   * Allows injecting a real WhatsApp provider (e.g., Meta Cloud API, Gupshup, Twilio) later
   */
  public static setProvider(customProvider: IWhatsAppProvider) {
    this.provider = customProvider;
  }

  /**
   * Generates standard message template text
   */
  public static renderTemplate(payload: ReminderPayload): string {
    const formattedAmount = `₹${Number(payload.amountDue).toLocaleString('en-IN')}`;

    if (payload.reminderType === 'FIRST_DUE_REMINDER') {
      return (
        `Hello ${payload.residentName},\n\n` +
        `Your monthly rent payment of ${formattedAmount} for ${payload.billingMonth} (Room ${payload.roomNumber}) is due.\n\n` +
        `Due date:\n` +
        `${payload.dueDateFormatted}\n\n` +
        `Please complete your payment.\n\n` +
        `Thank you,\n` +
        `SAIRAM ELITE LIVING`
      );
    } else {
      return (
        `Hello ${payload.residentName},\n\n` +
        `This is a reminder that your monthly rent payment of ${formattedAmount} for ${payload.billingMonth} (Room ${payload.roomNumber}) is still pending.\n\n` +
        `Due date:\n` +
        `${payload.dueDateFormatted}\n\n` +
        `Please complete your payment.\n\n` +
        `Thank you,\n` +
        `SAIRAM ELITE LIVING`
      );
    }
  }

  /**
   * Dispatches WhatsApp payment reminder
   */
  public static async sendPaymentReminder(payload: ReminderPayload): Promise<NotificationResult> {
    const renderedMessage = this.renderTemplate(payload);

    try {
      const response = await this.provider.sendMessage(payload.phone, renderedMessage);

      if (response.success) {
        return {
          success: true,
          providerMessageId: response.messageId,
          dispatchedAt: new Date(),
          renderedMessage,
        };
      } else {
        return {
          success: false,
          failureReason: response.error || 'Provider rejected message dispatch',
          dispatchedAt: new Date(),
          renderedMessage,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        failureReason: err.message || 'Network failure communicating with WhatsApp provider',
        dispatchedAt: new Date(),
        renderedMessage,
      };
    }
  }
}
