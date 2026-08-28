/**
 * SAIRAM ELITE LIVING - WhatsApp Provider Types
 */

export type ReminderStage = 'FIRST_DUE_REMINDER' | 'SECOND_REMINDER';

export interface ResidentReminderInput {
  residentId: string;
  residentName: string;
  phone: string;
  roomNumber: string;
  billingMonth: string; // e.g. "September 2026"
  amountDue: number; // e.g. 8000
  dueDateFormatted: string; // e.g. "05 Sep 2026"
  reminderType: ReminderStage;
  paymentLink?: string; // Pluggable for future phase (undefined for now)
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  httpStatus?: number;
  renderedText: string;
  recipientPhone: string;
  timestamp: Date;
}

export interface IWhatsAppProvider {
  sendTemplateReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult>;
  sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult>;
}
