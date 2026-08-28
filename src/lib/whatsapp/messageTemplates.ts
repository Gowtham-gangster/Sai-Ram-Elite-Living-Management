/**
 * WhatsApp Payment Reminder Message Templates
 * Strictly formatted text without fake URLs, UPI IDs, or payment links.
 */

import { ResidentReminderInput, ReminderStage } from './types';

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
  paymentLink?: string; // Optional for future phase (undefined for this phase)
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
 * Builds the plain text WhatsApp message body based on reminder stage
 */
export function buildPaymentReminderMessage(params: BuildPaymentReminderMessageParams): string {
  const residentName = params.resident.fullName || 'Resident';
  const amountFormatted = Number(params.payment.totalAmountDue).toLocaleString('en-IN');
  const billingMonthFormatted = formatBillingMonthDisplay(params.payment.billingMonth);

  if (params.reminderStage === 'FIRST_DUE_REMINDER') {
    return (
      `Hello ${residentName},\n\n` +
      `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is due today.\n\n` +
      `Please complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  } else {
    // SECOND_REMINDER
    return (
      `Hello ${residentName},\n\n` +
      `This is a reminder that your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is still pending.\n\n` +
      `Please complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }
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
    paymentLink: input.paymentLink,
  });
}
