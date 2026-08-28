/**
 * Server-Side Payment Reminder Engine
 * 
 * Implements automated, idempotent 2-stage WhatsApp payment reminders:
 * 1. On Payment Due Date: Sends FIRST_DUE_REMINDER if payment is UNPAID.
 * 2. 2 Days Later: Sends SECOND_REMINDER if payment remains UNPAID.
 * 3. If Paid at any point: Cancels reminders immediately.
 * 
 * Timezone: Strictly evaluated in Asia/Kolkata (IST).
 * Delivery: Meta WhatsApp Business Cloud API (server-side only, no payment links).
 */

import { db } from '@/lib/db';
import {
  WhatsAppService,
  ResidentReminderInput,
  normalizeWhatsAppPhoneNumber,
  formatBillingMonthDisplay,
} from '@/lib/whatsapp';

export interface ReminderRunSummary {
  scanned: number;
  firstRemindersSent: number;
  secondRemindersSent: number;
  paidCancelled: number;
  failedCount: number;
  skippedAlreadySent: number;
  skippedNotDue: number;
  details: Array<{
    paymentId: string;
    residentName: string;
    roomNumber: string;
    action: 'SENT_FIRST' | 'SENT_SECOND' | 'CANCELLED_PAID' | 'FAILED' | 'SKIPPED_NOT_DUE' | 'SKIPPED_ALREADY_SENT';
    reason?: string;
  }>;
}

/**
 * Returns YYYY-MM-DD in Asia/Kolkata timezone
 */
export function getKolkataDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats a Date into "05 Aug 2026" in Asia/Kolkata timezone
 */
export function formatKolkataDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Core Automation Engine to process payment reminders server-side
 */
export async function processPaymentReminders(): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    scanned: 0,
    firstRemindersSent: 0,
    secondRemindersSent: 0,
    paidCancelled: 0,
    failedCount: 0,
    skippedAlreadySent: 0,
    skippedNotDue: 0,
    details: [],
  };

  const todayKolkataStr = getKolkataDateString(new Date());

  // 1. Fetch all monthly payment records for eligible active/notice residents
  const eligiblePayments = await db.monthlyPayment.findMany({
    where: {
      resident: {
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
    },
    include: {
      resident: true,
      room: true,
      reminders: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  summary.scanned = eligiblePayments.length;

  for (const payment of eligiblePayments) {
    try {
      const paymentDueDateKolkataStr = getKolkataDateString(payment.dueDate);
      const isPaid = payment.status === 'PAID';

      // A. IF PAYMENT IS PAID: Cancel any pending un-sent reminder records
      if (isPaid) {
        const pendingReminders = payment.reminders.filter((r) => r.status === 'PENDING');
        if (pendingReminders.length > 0) {
          await db.paymentReminder.updateMany({
            where: {
              monthlyPaymentId: payment.id,
              status: 'PENDING',
            },
            data: { status: 'CANCELLED', failureReason: 'Payment verified as PAID' },
          });
          summary.paidCancelled += pendingReminders.length;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'CANCELLED_PAID',
            reason: 'Payment already completed',
          });
        }
        continue;
      }

      // Payment is UNPAID (PENDING / OVERDUE / SUBMITTED)
      // Check if Due Date has arrived in Asia/Kolkata
      const isDueOrPast = todayKolkataStr >= paymentDueDateKolkataStr;

      if (!isDueOrPast) {
        summary.skippedNotDue++;
        summary.details.push({
          paymentId: payment.id,
          residentName: payment.resident.fullName,
          roomNumber: payment.room.roomNumber,
          action: 'SKIPPED_NOT_DUE',
          reason: `Due on ${paymentDueDateKolkataStr}, today is ${todayKolkataStr}`,
        });
        continue;
      }

      // Validate recipient phone number
      const phoneNorm = normalizeWhatsAppPhoneNumber(payment.resident.phone);

      // B. FIRST REMINDER CHECK (On or after Due Date)
      if (!payment.firstReminderSentAt) {
        // Check if a FIRST_DUE_REMINDER record already exists to guarantee idempotency
        const existingFirst = payment.reminders.find((r) => r.reminderType === 'FIRST_DUE_REMINDER');

        if (existingFirst && existingFirst.status === 'SENT') {
          // Sync local record if sent
          await db.monthlyPayment.update({
            where: { id: payment.id },
            data: { firstReminderSentAt: existingFirst.sentAt || new Date(), reminderStatus: 'FIRST_REMINDER_SENT' },
          });
          summary.skippedAlreadySent++;
          continue;
        }

        // Re-verify payment status from DB to ensure no stale state
        const freshPayment = await db.monthlyPayment.findUnique({
          where: { id: payment.id },
          select: { status: true, firstReminderSentAt: true },
        });

        if (!freshPayment || freshPayment.status === 'PAID' || freshPayment.firstReminderSentAt) {
          continue;
        }

        if (!phoneNorm.isValid) {
          await db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_reminderType: {
                monthlyPaymentId: payment.id,
                reminderType: 'FIRST_DUE_REMINDER',
              },
            },
            update: {
              status: 'FAILED',
              failureReason: phoneNorm.error || 'Invalid phone number format',
              attemptCount: { increment: 1 },
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType: 'FIRST_DUE_REMINDER',
              channel: 'WHATSAPP',
              scheduledFor: payment.dueDate,
              status: 'FAILED',
              failureReason: phoneNorm.error || 'Invalid phone number format',
              attemptCount: 1,
              messageText: `[Failed: ${phoneNorm.error}]`,
            },
          });

          summary.failedCount++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'FAILED',
            reason: phoneNorm.error,
          });
          continue;
        }

        const input: ResidentReminderInput = {
          residentId: payment.resident.id,
          residentName: payment.resident.fullName,
          phone: payment.resident.phone,
          roomNumber: payment.room.roomNumber,
          billingMonth: formatBillingMonthDisplay(payment.billingMonth),
          amountDue: payment.totalAmountDue,
          dueDateFormatted: formatKolkataDisplayDate(payment.dueDate),
          reminderType: 'FIRST_DUE_REMINDER',
        };

        const dispatchResult = await WhatsAppService.sendPaymentReminder(input);

        if (dispatchResult.success) {
          await db.$transaction([
            db.paymentReminder.upsert({
              where: {
                monthlyPaymentId_reminderType: {
                  monthlyPaymentId: payment.id,
                  reminderType: 'FIRST_DUE_REMINDER',
                },
              },
              update: {
                status: 'SENT',
                sentAt: dispatchResult.timestamp,
                providerMessageId: dispatchResult.messageId,
                messageText: dispatchResult.renderedText,
                failureReason: null,
              },
              create: {
                monthlyPaymentId: payment.id,
                residentId: payment.resident.id,
                reminderType: 'FIRST_DUE_REMINDER',
                channel: 'WHATSAPP',
                scheduledFor: payment.dueDate,
                sentAt: dispatchResult.timestamp,
                status: 'SENT',
                providerMessageId: dispatchResult.messageId,
                messageText: dispatchResult.renderedText,
              },
            }),
            db.monthlyPayment.update({
              where: { id: payment.id },
              data: {
                firstReminderSentAt: dispatchResult.timestamp,
                reminderStatus: 'FIRST_REMINDER_SENT',
              },
            }),
          ]);

          summary.firstRemindersSent++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'SENT_FIRST',
          });
        } else {
          await db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_reminderType: {
                monthlyPaymentId: payment.id,
                reminderType: 'FIRST_DUE_REMINDER',
              },
            },
            update: {
              status: 'FAILED',
              failureReason: dispatchResult.error,
              attemptCount: { increment: 1 },
              messageText: dispatchResult.renderedText,
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType: 'FIRST_DUE_REMINDER',
              channel: 'WHATSAPP',
              scheduledFor: payment.dueDate,
              status: 'FAILED',
              failureReason: dispatchResult.error,
              attemptCount: 1,
              messageText: dispatchResult.renderedText,
            },
          });

          summary.failedCount++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'FAILED',
            reason: dispatchResult.error,
          });
        }

        // First reminder processed; move to next payment
        continue;
      }

      // C. SECOND REMINDER CHECK (2 Days after First Reminder)
      if (payment.firstReminderSentAt && !payment.secondReminderSentAt) {
        // Calculate days elapsed in Asia/Kolkata since first reminder
        const firstReminderKolkataStr = getKolkataDateString(payment.firstReminderSentAt);
        
        const firstDate = new Date(firstReminderKolkataStr + 'T00:00:00Z');
        const currDate = new Date(todayKolkataStr + 'T00:00:00Z');
        const diffTimeMs = currDate.getTime() - firstDate.getTime();
        const diffDays = Math.floor(diffTimeMs / (1000 * 60 * 60 * 24));

        if (diffDays < 2) {
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'SKIPPED_NOT_DUE',
            reason: `Only ${diffDays} day(s) since first reminder on ${firstReminderKolkataStr}. Need 2 days.`,
          });
          continue;
        }

        // Re-verify payment status from DB to ensure no stale state
        const freshPayment = await db.monthlyPayment.findUnique({
          where: { id: payment.id },
          select: { status: true, secondReminderSentAt: true },
        });

        if (!freshPayment || freshPayment.status === 'PAID' || freshPayment.secondReminderSentAt) {
          continue;
        }

        if (!phoneNorm.isValid) {
          await db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_reminderType: {
                monthlyPaymentId: payment.id,
                reminderType: 'SECOND_REMINDER',
              },
            },
            update: {
              status: 'FAILED',
              failureReason: phoneNorm.error || 'Invalid phone number format',
              attemptCount: { increment: 1 },
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType: 'SECOND_REMINDER',
              channel: 'WHATSAPP',
              scheduledFor: new Date(),
              status: 'FAILED',
              failureReason: phoneNorm.error || 'Invalid phone number format',
              attemptCount: 1,
              messageText: `[Failed: ${phoneNorm.error}]`,
            },
          });

          summary.failedCount++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'FAILED',
            reason: phoneNorm.error,
          });
          continue;
        }

        const input: ResidentReminderInput = {
          residentId: payment.resident.id,
          residentName: payment.resident.fullName,
          phone: payment.resident.phone,
          roomNumber: payment.room.roomNumber,
          billingMonth: formatBillingMonthDisplay(payment.billingMonth),
          amountDue: payment.totalAmountDue,
          dueDateFormatted: formatKolkataDisplayDate(payment.dueDate),
          reminderType: 'SECOND_REMINDER',
        };

        const dispatchResult = await WhatsAppService.sendPaymentReminder(input);

        if (dispatchResult.success) {
          await db.$transaction([
            db.paymentReminder.upsert({
              where: {
                monthlyPaymentId_reminderType: {
                  monthlyPaymentId: payment.id,
                  reminderType: 'SECOND_REMINDER',
                },
              },
              update: {
                status: 'SENT',
                sentAt: dispatchResult.timestamp,
                providerMessageId: dispatchResult.messageId,
                messageText: dispatchResult.renderedText,
                failureReason: null,
              },
              create: {
                monthlyPaymentId: payment.id,
                residentId: payment.resident.id,
                reminderType: 'SECOND_REMINDER',
                channel: 'WHATSAPP',
                scheduledFor: new Date(),
                sentAt: dispatchResult.timestamp,
                status: 'SENT',
                providerMessageId: dispatchResult.messageId,
                messageText: dispatchResult.renderedText,
              },
            }),
            db.monthlyPayment.update({
              where: { id: payment.id },
              data: {
                secondReminderSentAt: dispatchResult.timestamp,
                reminderStatus: 'SECOND_REMINDER_SENT',
              },
            }),
          ]);

          summary.secondRemindersSent++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'SENT_SECOND',
          });
        } else {
          await db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_reminderType: {
                monthlyPaymentId: payment.id,
                reminderType: 'SECOND_REMINDER',
              },
            },
            update: {
              status: 'FAILED',
              failureReason: dispatchResult.error,
              attemptCount: { increment: 1 },
              messageText: dispatchResult.renderedText,
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType: 'SECOND_REMINDER',
              channel: 'WHATSAPP',
              scheduledFor: new Date(),
              status: 'FAILED',
              failureReason: dispatchResult.error,
              attemptCount: 1,
              messageText: dispatchResult.renderedText,
            },
          });

          summary.failedCount++;
          summary.details.push({
            paymentId: payment.id,
            residentName: payment.resident.fullName,
            roomNumber: payment.room.roomNumber,
            action: 'FAILED',
            reason: dispatchResult.error,
          });
        }

        continue;
      }

      // Already sent both reminders
      summary.skippedAlreadySent++;
    } catch (err: any) {
      console.error(`Error processing payment reminder for ${payment.resident?.fullName}:`, err);
      summary.failedCount++;
      summary.details.push({
        paymentId: payment.id,
        residentName: payment.resident?.fullName || 'Unknown',
        roomNumber: payment.room?.roomNumber || 'Unknown',
        action: 'FAILED',
        reason: err.message || 'Unexpected exception processing payment reminder',
      });
      // Continue to next payment in batch
    }
  }

  return summary;
}
