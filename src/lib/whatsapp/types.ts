/**
 * SAIRAM ELITE LIVING - WhatsApp Provider Types
 */

export type ReminderStage =
  | 'FIRST_DUE_REMINDER'
  | 'DUE_DATE_REMINDER'
  | 'OVERDUE_REMINDER'
  | 'RECURRING_REMINDER'
  | 'SECOND_REMINDER';

export interface ResidentReminderInput {
  residentId: string;
  residentName: string;
  phone: string;
  roomNumber: string;
  billingMonth: string; // e.g. "September 2026"
  amountDue: number; // e.g. 8000
  dueDateFormatted: string; // e.g. "05 Sep 2026"
  reminderType: ReminderStage;
  sequence?: number; // 1=D-2, 2=D, 3=D+2, 4=D+4...
  overdueDays?: number; // 0, 2, 4, 6...
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
