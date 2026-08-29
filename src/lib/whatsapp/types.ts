/**
 * SAIRAM ELITE LIVING - WhatsApp Provider Types
 */

export type ReminderStage =
  | 'FIRST_DUE_REMINDER'
  | 'DUE_DATE_REMINDER'
  | 'OVERDUE_REMINDER'
  | 'RECURRING_REMINDER'
  | 'SECOND_REMINDER';

export type WhatsAppDeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export interface ResidentReminderInput {
  residentId: string;
  residentName: string;
  phone: string;
  roomNumber: string;
  billingMonth: string; // e.g. "September 2026" or "2026-09"
  amountDue: number; // e.g. 8000
  dueDateFormatted: string; // e.g. "05 Sep 2026"
  reminderType: ReminderStage;
  sequence?: number; // 1=D-2, 2=D, 3=D+2, 4=D+4...
  overdueDays?: number; // 0, 2, 4, 6...
  paymentLink?: string; // Resident payment portal URL
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  httpStatus?: number;
  renderedText: string;
  recipientPhone: string;
  timestamp: Date;
  deliveryStatus?: WhatsAppDeliveryStatus;
}

export interface MetaTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
  text?: string;
  [key: string]: any;
}

export interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters: MetaTemplateParameter[];
}

export interface MetaSendTemplatePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components: MetaTemplateComponent[];
  };
}

export interface MetaWebhookStatus {
  id: string; // message id (wamid.xxx)
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface IWhatsAppProvider {
  sendTemplateReminder(input: ResidentReminderInput): Promise<WhatsAppSendResult>;
  sendCustomText(toPhone: string, text: string): Promise<WhatsAppSendResult>;
  validateConfiguration(): { valid: boolean; missingKeys: string[] };
}
