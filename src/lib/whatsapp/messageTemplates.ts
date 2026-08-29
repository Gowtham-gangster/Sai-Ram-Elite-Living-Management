/**
 * WhatsApp Payment Reminder Message Templates
 * SAIRAM ELITE LIVING MANAGEMENT
 */

import { ResidentReminderInput, ReminderStage, MetaTemplateComponent } from './types';
import { getWhatsAppConfig } from './config';

export interface BuildPaymentReminderMessageParams {
  resident: {
    fullName: string;
    phone?: string;
  };
  payment: {
    billingMonth: string; // e.g. "September 2026" or "2026-09"
    totalAmountDue: number;
    dueDate?: Date | string;
  };
  reminderStage: ReminderStage;
  sequence?: number;
  overdueDays?: number;
  paymentLink?: string;
  roomNumber?: string;
}

/**
 * Formats YYYY-MM into readable month e.g. "2026-09" -> "September 2026"
 */
export function formatBillingMonthDisplay(raw: string): string {
  if (!raw) return 'Current Month';
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }
  return raw;
}

/**
 * Determines which Meta WhatsApp template name to dispatch based on reminder stage
 */
export function getMetaTemplateName(stage: ReminderStage, sequence: number = 1): string {
  const config = getWhatsAppConfig();

  if (sequence === 1 || stage === 'FIRST_DUE_REMINDER') {
    return config.templates.firstDue;
  }
  if (sequence === 2 || stage === 'DUE_DATE_REMINDER') {
    return config.templates.dueDate;
  }
  if (sequence > 2 || stage === 'OVERDUE_REMINDER' || stage === 'RECURRING_REMINDER' || stage === 'SECOND_REMINDER') {
    return config.templates.overdue || config.templates.recurring;
  }

  return config.templates.firstDue;
}

/**
 * Constructs Meta Template Components with dynamic parameters
 * Supports standard Meta template parameters:
 * {{1}} = Resident Name
 * {{2}} = Amount Formatted (e.g. 8,000)
 * {{3}} = Billing Month (e.g. September 2026)
 * {{4}} = Due Date / Overdue Notice
 * {{5}} = Payment Portal Link (if configured)
 */
export function buildMetaTemplateComponents(input: ResidentReminderInput): MetaTemplateComponent[] {
  const residentName = input.residentName || 'Resident';
  const amountFormatted = Number(input.amountDue).toLocaleString('en-IN');
  const billingMonthFormatted = formatBillingMonthDisplay(input.billingMonth);
  const sequence = input.sequence || 1;
  const overdueDays = input.overdueDays || 0;

  let timingText = 'due in 2 days';
  if (sequence === 2 || input.reminderType === 'DUE_DATE_REMINDER') {
    timingText = 'due today';
  } else if (sequence > 2 || input.reminderType === 'OVERDUE_REMINDER') {
    timingText = overdueDays > 0 ? `${overdueDays} days overdue` : 'overdue';
  }

  const parameters: Array<{ type: 'text'; text: string }> = [
    { type: 'text', text: residentName },
    { type: 'text', text: amountFormatted },
    { type: 'text', text: billingMonthFormatted },
  ];

  // Optional parameter 4 (timing / due date)
  if (input.dueDateFormatted) {
    parameters.push({ type: 'text', text: input.dueDateFormatted });
  } else {
    parameters.push({ type: 'text', text: timingText });
  }

  // Optional parameter 5 (payment link)
  if (input.paymentLink) {
    parameters.push({ type: 'text', text: input.paymentLink });
  }

  return [
    {
      type: 'body',
      parameters,
    },
  ];
}

/**
 * Builds plain-text WhatsApp message body for fallback, mock simulation, and UI previews
 */
export function buildPaymentReminderMessage(params: BuildPaymentReminderMessageParams): string {
  const residentName = params.resident.fullName || 'Resident';
  const amountFormatted = Number(params.payment.totalAmountDue).toLocaleString('en-IN');
  const billingMonthFormatted = formatBillingMonthDisplay(params.payment.billingMonth);
  const sequence = params.sequence || 1;
  const overdueDays = params.overdueDays || 0;
  const paymentPortalNote = params.paymentLink
    ? `\nPay online: ${params.paymentLink}\n`
    : '';

  // 1. FIRST REMINDER: Sent 2 days before due date (Sequence 1)
  if (sequence === 1 || params.reminderStage === 'FIRST_DUE_REMINDER') {
    return (
      `Hello ${residentName},\n\n` +
      `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is due in 2 days.\n` +
      paymentPortalNote +
      `\nPlease complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }

  // 2. DUE-DATE REMINDER: Sent on the due date (Sequence 2)
  if (sequence === 2 || params.reminderStage === 'DUE_DATE_REMINDER') {
    return (
      `Hello ${residentName},\n\n` +
      `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is due today.\n` +
      paymentPortalNote +
      `\nPlease complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }

  // 3. OVERDUE REMINDERS: Sent after the due date (Sequence 3, 4, 5... / D+2, D+4, D+6...)
  const overdueNotice =
    overdueDays > 0
      ? `Your payment is ${overdueDays} days overdue. Please complete your payment at your earliest convenience.`
      : `Your payment is overdue. Please complete your payment at your earliest convenience.`;

  return (
    `Hello ${residentName},\n\n` +
    `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is still pending.\n\n` +
    `${overdueNotice}\n` +
    paymentPortalNote +
    `\nThank you,\n` +
    `SAIRAM ELITE LIVING`
  );
}

/**
 * Utility for rendering from ResidentReminderInput
 */
export function renderReminderTemplateText(input: ResidentReminderInput): string {
  return buildPaymentReminderMessage({
    resident: { fullName: input.residentName, phone: input.phone },
    payment: {
      billingMonth: input.billingMonth,
      totalAmountDue: input.amountDue,
      dueDate: input.dueDateFormatted,
    },
    reminderStage: input.reminderType,
    sequence: input.sequence,
    overdueDays: input.overdueDays,
    paymentLink: input.paymentLink,
    roomNumber: input.roomNumber,
  });
}
