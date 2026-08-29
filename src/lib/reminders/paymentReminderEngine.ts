/**
 * Server-Side Final Recurring WhatsApp Payment Reminder Engine
 * SAIRAM ELITE LIVING MANAGEMENT
 * 
 * BUSINESS REQUIREMENTS:
 * 1. Sequence 1 (D-2): Sent 2 calendar days before the monthly rent due date ("due in 2 days").
 * 2. Sequence 2 (D): Sent on the monthly rent due date ("due today").
 * 3. Sequence 3, 4, 5... (D+2, D+4, D+6...): Sent every 2 calendar days indefinitely after due date while unpaid ("still pending. Your payment is [N days] overdue.").
 * 4. Immediate Stop: The reminder cycle MUST STOP immediately once MonthlyPayment becomes PAID.
 * 5. Timezone: Strictly evaluated in Asia/Kolkata (IST).
 * 6. Rolling Schedule: Single next pending reminder created (no infinite database row explosion).
 * 7. Room Exclusion: Skipped and cancelled for payment-disabled rooms (e.g. Room 102).
 */

import { db } from '@/lib/db';
import {
  WhatsAppService,
  ResidentReminderInput,
  ReminderStage,
  normalizeWhatsAppPhoneNumber,
  formatBillingMonthDisplay,
} from '@/lib/whatsapp';
import { isPaymentManagedRoom } from '@/lib/payments/eligibility';

export interface ReminderRunSummary {
  scanned: number;
  remindersSent: number;
  firstRemindersSent: number;
  dueRemindersSent: number;
  overdueRemindersSent: number;
  secondRemindersSent: number; // Backward compatibility
  paidCancelled: number;
  failedCount: number;
  skippedAlreadySent: number;
  skippedNotDue: number;
  details: Array<{
    paymentId: string;
    residentName: string;
    roomNumber: string;
    sequence?: number;
    action:
      | 'SENT_FIRST'
      | 'SENT_DUE'
      | 'SENT_OVERDUE'
      | 'SENT_SECOND'
      | 'CANCELLED_PAID'
      | 'FAILED'
      | 'SKIPPED_NOT_DUE'
      | 'SKIPPED_ALREADY_SENT';
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
 * Formats a Date into "05 Sep 2026" in Asia/Kolkata timezone
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
 * Parses a Date into Asia/Kolkata calendar year, month, and day
 */
export function parseKolkataCalendarDate(date: Date): { year: number; month: number; day: number } {
  const str = getKolkataDateString(date);
  const [year, month, day] = str.split('-').map(Number);
  return { year, month, day };
}

/**
 * Adds integer calendar days in Asia/Kolkata timezone (handling leap years, month & year boundaries)
 */
export function addKolkataCalendarDays(baseDate: Date, days: number): Date {
  const { year, month, day } = parseKolkataCalendarDate(baseDate);
  // Construct date at 09:00 IST (03:30 UTC) on the target calendar date
  const targetUtcMs = Date.UTC(year, month - 1, day + days, 3, 30, 0);
  return new Date(targetUtcMs);
}

/**
 * Calculates exact calendar day difference (toDate - fromDate) in Asia/Kolkata
 */
export function diffKolkataCalendarDays(fromDate: Date, toDate: Date): number {
  const fromStr = getKolkataDateString(fromDate);
  const toStr = getKolkataDateString(toDate);

  const [fromY, fromM, fromD] = fromStr.split('-').map(Number);
  const [toY, toM, toD] = toStr.split('-').map(Number);

  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  const toUtc = Date.UTC(toY, toM - 1, toD);

  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export interface ReminderScheduleItem {
  sequence: number;
  scheduledFor: Date;
  scheduledDateStr: string;
  overdueDays: number;
  reminderType: ReminderStage;
  label: string;
}

/**
 * Generates exact schedule item for any sequence given a due date
 * - Sequence 1 (D-2): 2 days before due date
 * - Sequence 2 (D): Due date
 * - Sequence 3 (D+2): 2 days overdue
 * - Sequence 4 (D+4): 4 days overdue
 * - Sequence k (D + 2*(k-2)): 2*(k-2) days overdue
 */
export function getReminderScheduleItem(dueDate: Date, sequence: number): ReminderScheduleItem {
  const seq = Math.max(1, sequence);

  if (seq === 1) {
    const scheduledFor = addKolkataCalendarDays(dueDate, -2);
    return {
      sequence: 1,
      scheduledFor,
      scheduledDateStr: getKolkataDateString(scheduledFor),
      overdueDays: 0,
      reminderType: 'FIRST_DUE_REMINDER',
      label: '2 days before due date',
    };
  }

  if (seq === 2) {
    const scheduledFor = addKolkataCalendarDays(dueDate, 0);
    return {
      sequence: 2,
      scheduledFor,
      scheduledDateStr: getKolkataDateString(scheduledFor),
      overdueDays: 0,
      reminderType: 'DUE_DATE_REMINDER',
      label: 'Due date',
    };
  }

  const overdueDays = 2 * (seq - 2);
  const scheduledFor = addKolkataCalendarDays(dueDate, overdueDays);
  return {
    sequence: seq,
    scheduledFor,
    scheduledDateStr: getKolkataDateString(scheduledFor),
    overdueDays,
    reminderType: 'OVERDUE_REMINDER',
    label: `${overdueDays} days overdue`,
  };
}

/**
 * Generates an illustrative list of the first N reminder schedule milestones for a due date
 */
export function getReminderScheduleForDueDate(dueDate: Date, count: number = 6): ReminderScheduleItem[] {
  const items: ReminderScheduleItem[] = [];
  for (let i = 1; i <= count; i++) {
    items.push(getReminderScheduleItem(dueDate, i));
  }
  return items;
}

/**
 * Calculates which reminder sequence is eligible to be sent on today's date in Asia/Kolkata
 */
export function calculateEligibleReminderForToday(
  dueDate: Date,
  todayDate: Date = new Date()
): ReminderScheduleItem | null {
  const diffDays = diffKolkataCalendarDays(dueDate, todayDate);

  // Before D-2: Not yet due for any reminder
  if (diffDays < -2) {
    return null;
  }

  // Exactly D-2 or D-1: Sequence 1 (First reminder)
  if (diffDays >= -2 && diffDays < 0) {
    return getReminderScheduleItem(dueDate, 1);
  }

  // Exactly Due Date (diffDays === 0) or D+1: Sequence 2 (Due date reminder)
  if (diffDays >= 0 && diffDays < 2) {
    return getReminderScheduleItem(dueDate, 2);
  }

  // D+2 or beyond: Sequence 3, 4, 5... (Overdue reminders)
  const overdueSequence = 2 + Math.floor(diffDays / 2);
  return getReminderScheduleItem(dueDate, overdueSequence);
}

/**
 * Immediately cancels all pending reminders for a given MonthlyPayment
 */
export async function cancelPendingRemindersForPayment(
  monthlyPaymentId: string,
  reason: string = 'Payment completed'
): Promise<number> {
  const result = await db.paymentReminder.updateMany({
    where: {
      monthlyPaymentId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
      failureReason: reason,
    },
  });
  return result.count;
}

/**
 * Core Recurring Automation Engine: Processes all active monthly payment reminders server-side.
 */
export async function processPaymentReminders(): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    scanned: 0,
    remindersSent: 0,
    firstRemindersSent: 0,
    dueRemindersSent: 0,
    overdueRemindersSent: 0,
    secondRemindersSent: 0,
    paidCancelled: 0,
    failedCount: 0,
    skippedAlreadySent: 0,
    skippedNotDue: 0,
    details: [],
  };

  const today = new Date();
  const todayKolkataStr = getKolkataDateString(today);

  // 1. Fetch all monthly payment records for active / notice-period residents
  const eligiblePayments = await db.monthlyPayment.findMany({
    where: {
      resident: {
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
    },
    include: {
      resident: {
        include: { room: true },
      },
      room: true,
      reminders: {
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  summary.scanned = eligiblePayments.length;

  for (const payment of eligiblePayments) {
    try {
      // 1. IF PAYMENT IS PAID: Cancel all pending reminders and stop
      if (payment.status === 'PAID') {
        const cancelledCount = await cancelPendingRemindersForPayment(
          payment.id,
          'Payment verified as PAID'
        );
        if (cancelledCount > 0) {
          summary.paidCancelled += cancelledCount;
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

      // 2. CHECK ROOM PAYMENT MANAGEMENT EXCLUSION (e.g. Room 102)
      // Check current assigned room
      const currentRoom = payment.resident.room || payment.room;
      if (!isPaymentManagedRoom(currentRoom)) {
        const cancelledCount = await cancelPendingRemindersForPayment(
          payment.id,
          'Room excluded from payment management'
        );
        if (cancelledCount > 0) {
          summary.paidCancelled += cancelledCount;
        }
        summary.details.push({
          paymentId: payment.id,
          residentName: payment.resident.fullName,
          roomNumber: currentRoom ? currentRoom.roomNumber : payment.room.roomNumber,
          action: 'SKIPPED_NOT_DUE',
          reason: 'Room excluded from payment management',
        });
        continue;
      }

      // 3. RE-VERIFY FRESH PAYMENT & ROOM STATE FROM DATABASE
      const freshPayment = await db.monthlyPayment.findUnique({
        where: { id: payment.id },
        select: { status: true, roomId: true },
      });

      if (!freshPayment || freshPayment.status === 'PAID') {
        await cancelPendingRemindersForPayment(payment.id, 'Payment verified as PAID');
        continue;
      }

      // 4. CALCULATE ELIGIBLE REMINDER FOR TODAY IN ASIA/KOLKATA
      const eligibleReminder = calculateEligibleReminderForToday(payment.dueDate, today);

      if (!eligibleReminder) {
        const firstReminderItem = getReminderScheduleItem(payment.dueDate, 1);
        summary.skippedNotDue++;
        summary.details.push({
          paymentId: payment.id,
          residentName: payment.resident.fullName,
          roomNumber: payment.room.roomNumber,
          action: 'SKIPPED_NOT_DUE',
          reason: `First reminder (D-2) scheduled for ${firstReminderItem.scheduledDateStr}; today is ${todayKolkataStr}`,
        });
        continue;
      }

      const { sequence, overdueDays, reminderType, scheduledFor, scheduledDateStr } = eligibleReminder;

      // 5. CHECK IDEMPOTENCY: Has this exact sequence already been sent?
      const existingReminderForSeq = payment.reminders.find((r) => r.sequence === sequence);

      if (existingReminderForSeq && existingReminderForSeq.status === 'SENT') {
        summary.skippedAlreadySent++;
        summary.details.push({
          paymentId: payment.id,
          residentName: payment.resident.fullName,
          roomNumber: payment.room.roomNumber,
          sequence,
          action: 'SKIPPED_ALREADY_SENT',
          reason: `Sequence ${sequence} already sent on ${existingReminderForSeq.sentAt ? getKolkataDateString(existingReminderForSeq.sentAt) : scheduledDateStr}`,
        });
        continue;
      }

      // 6. VALIDATE RECIPIENT PHONE NUMBER
      const phoneNorm = normalizeWhatsAppPhoneNumber(payment.resident.phone);

      if (!phoneNorm.isValid) {
        await db.paymentReminder.upsert({
          where: {
            monthlyPaymentId_sequence: {
              monthlyPaymentId: payment.id,
              sequence,
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
            reminderType,
            sequence,
            overdueDays,
            channel: 'WHATSAPP',
            scheduledFor,
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
          sequence,
          action: 'FAILED',
          reason: phoneNorm.error,
        });
        continue;
      }

      // 7. PREPARE & DISPATCH WHATSAPP REMINDER
      const input: ResidentReminderInput = {
        residentId: payment.resident.id,
        residentName: payment.resident.fullName,
        phone: payment.resident.phone,
        roomNumber: payment.room.roomNumber,
        billingMonth: formatBillingMonthDisplay(payment.billingMonth),
        amountDue: payment.totalAmountDue,
        dueDateFormatted: formatKolkataDisplayDate(payment.dueDate),
        reminderType,
        sequence,
        overdueDays,
      };

      const dispatchResult = await WhatsAppService.sendPaymentReminder(input);

      if (dispatchResult.success) {
        // Calculate the NEXT rolling reminder (+2 calendar days)
        const nextScheduleItem = getReminderScheduleItem(payment.dueDate, sequence + 1);

        await db.$transaction([
          // Mark current sequence as SENT
          db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_sequence: {
                monthlyPaymentId: payment.id,
                sequence,
              },
            },
            update: {
              reminderType,
              overdueDays,
              status: 'SENT',
              sentAt: dispatchResult.timestamp,
              providerMessageId: dispatchResult.messageId,
              messageText: dispatchResult.renderedText,
              failureReason: null,
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType,
              sequence,
              overdueDays,
              channel: 'WHATSAPP',
              scheduledFor,
              sentAt: dispatchResult.timestamp,
              status: 'SENT',
              providerMessageId: dispatchResult.messageId,
              messageText: dispatchResult.renderedText,
            },
          }),

          // Pre-schedule the single NEXT pending reminder (+2 calendar days)
          db.paymentReminder.upsert({
            where: {
              monthlyPaymentId_sequence: {
                monthlyPaymentId: payment.id,
                sequence: nextScheduleItem.sequence,
              },
            },
            update: {
              scheduledFor: nextScheduleItem.scheduledFor,
              reminderType: nextScheduleItem.reminderType,
              overdueDays: nextScheduleItem.overdueDays,
              status: 'PENDING',
              failureReason: null,
            },
            create: {
              monthlyPaymentId: payment.id,
              residentId: payment.resident.id,
              reminderType: nextScheduleItem.reminderType,
              sequence: nextScheduleItem.sequence,
              overdueDays: nextScheduleItem.overdueDays,
              channel: 'WHATSAPP',
              scheduledFor: nextScheduleItem.scheduledFor,
              status: 'PENDING',
              messageText: `Scheduled ${nextScheduleItem.label}`,
            },
          }),

          // Update MonthlyPayment timeline tracking
          db.monthlyPayment.update({
            where: { id: payment.id },
            data: {
              lastReminderSentAt: dispatchResult.timestamp,
              firstReminderSentAt: sequence === 1 ? dispatchResult.timestamp : payment.firstReminderSentAt,
              secondReminderSentAt: sequence === 2 ? dispatchResult.timestamp : payment.secondReminderSentAt,
              reminderCount: { increment: 1 },
              reminderStatus:
                sequence === 1
                  ? 'FIRST_REMINDER_SENT'
                  : sequence === 2
                  ? 'DUE_REMINDER_SENT'
                  : 'RECURRING_REMINDER_SENT',
            },
          }),
        ]);

        summary.remindersSent++;
        if (sequence === 1) summary.firstRemindersSent++;
        else if (sequence === 2) {
          summary.dueRemindersSent++;
          summary.secondRemindersSent++;
        } else summary.overdueRemindersSent++;

        const actionType =
          sequence === 1 ? 'SENT_FIRST' : sequence === 2 ? 'SENT_DUE' : 'SENT_OVERDUE';

        summary.details.push({
          paymentId: payment.id,
          residentName: payment.resident.fullName,
          roomNumber: payment.room.roomNumber,
          sequence,
          action: actionType,
          reason: `Successfully delivered ${eligibleReminder.label}`,
        });
      } else {
        // Record failure without crashing and without pre-scheduling next reminder
        await db.paymentReminder.upsert({
          where: {
            monthlyPaymentId_sequence: {
              monthlyPaymentId: payment.id,
              sequence,
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
            reminderType,
            sequence,
            overdueDays,
            channel: 'WHATSAPP',
            scheduledFor,
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
          sequence,
          action: 'FAILED',
          reason: dispatchResult.error,
        });
      }
    } catch (err: any) {
      console.error(`Error processing reminder for payment ${payment.id}:`, err);
      summary.failedCount++;
      summary.details.push({
        paymentId: payment.id,
        residentName: payment.resident?.fullName || 'Unknown',
        roomNumber: payment.room?.roomNumber || 'Unknown',
        action: 'FAILED',
        reason: err.message,
      });
    }
  }

  return summary;
}
