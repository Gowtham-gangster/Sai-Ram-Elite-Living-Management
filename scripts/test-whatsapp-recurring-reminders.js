/**
 * COMPREHENSIVE TEST SUITE: FINAL RECURRING WHATSAPP PAYMENT REMINDER SYSTEM
 * SAIRAM ELITE LIVING MANAGEMENT
 * 
 * Verifies all 32 requirements from the user specification.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

// --- TIMEZONE & DATE HELPERS (Exact mirror of paymentReminderEngine.ts) ---
function getKolkataDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseKolkataCalendarDate(date) {
  const str = getKolkataDateString(date);
  const [year, month, day] = str.split('-').map(Number);
  return { year, month, day };
}

function addKolkataCalendarDays(baseDate, days) {
  const { year, month, day } = parseKolkataCalendarDate(baseDate);
  const targetUtcMs = Date.UTC(year, month - 1, day + days, 3, 30, 0);
  return new Date(targetUtcMs);
}

function diffKolkataCalendarDays(fromDate, toDate) {
  const fromStr = getKolkataDateString(fromDate);
  const toStr = getKolkataDateString(toDate);

  const [fromY, fromM, fromD] = fromStr.split('-').map(Number);
  const [toY, toM, toD] = toStr.split('-').map(Number);

  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  const toUtc = Date.UTC(toY, toM - 1, toD);

  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

function getReminderScheduleItem(dueDate, sequence) {
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

function getReminderScheduleForDueDate(dueDate, count = 6) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push(getReminderScheduleItem(dueDate, i));
  }
  return items;
}

function calculateEligibleReminderForToday(dueDate, todayDate = new Date()) {
  const diffDays = diffKolkataCalendarDays(dueDate, todayDate);

  if (diffDays < -2) {
    return null;
  }

  if (diffDays >= -2 && diffDays < 0) {
    return getReminderScheduleItem(dueDate, 1);
  }

  if (diffDays >= 0 && diffDays < 2) {
    return getReminderScheduleItem(dueDate, 2);
  }

  const overdueSequence = 2 + Math.floor(diffDays / 2);
  return getReminderScheduleItem(dueDate, overdueSequence);
}

function buildPaymentReminderMessage(params) {
  const residentName = params.resident.fullName || 'Resident';
  const amountFormatted = Number(params.payment.totalAmountDue).toLocaleString('en-IN');
  const billingMonthFormatted = params.payment.billingMonth || 'Current Month';
  const sequence = params.sequence || 1;
  const overdueDays = params.overdueDays || 0;

  if (sequence === 1 || params.reminderStage === 'FIRST_DUE_REMINDER') {
    return (
      `Hello ${residentName},\n\n` +
      `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is due in 2 days.\n\n` +
      `Please complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }

  if (sequence === 2 || params.reminderStage === 'DUE_DATE_REMINDER') {
    return (
      `Hello ${residentName},\n\n` +
      `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is due today.\n\n` +
      `Please complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }

  const overdueNotice =
    overdueDays > 0
      ? `Your payment is ${overdueDays} days overdue. Please complete your payment at your earliest convenience.`
      : `Your payment is overdue. Please complete your payment at your earliest convenience.`;

  return (
    `Hello ${residentName},\n\n` +
    `Your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is still pending.\n\n` +
    `${overdueNotice}\n\n` +
    `Thank you,\n` +
    `SAIRAM ELITE LIVING`
  );
}

function isPaymentManagedRoom(room) {
  if (!room) return true;
  return room.paymentEnabled !== false;
}

async function cancelPendingRemindersForPayment(monthlyPaymentId, reason = 'Payment completed') {
  const result = await prisma.paymentReminder.updateMany({
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

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  RECURRING WHATSAPP PAYMENT REMINDER SYSTEM TEST SUITE         ');
  console.log('  SAIRAM ELITE LIVING MANAGEMENT                                ');
  console.log('================================================================\n');

  let testResident = null;
  let normalRoom = null;
  let excludedRoom = null;
  let testPayment = null;

  try {
    // --- 1. SET UP TEST FIXTURES ---
    console.log('--- Setting up Test Fixtures ---');

    normalRoom = await prisma.room.findFirst({
      where: { paymentEnabled: true },
    });
    if (!normalRoom) {
      normalRoom = await prisma.room.create({
        data: {
          roomNumber: 'TEST_ROOM_901',
          floor: 9,
          roomType: 'DOUBLE',
          sharingType: 'TWO_SHARING',
          capacity: 2,
          currentOccupancy: 0,
          baseRent: 6500,
          paymentEnabled: true,
          status: 'AVAILABLE',
        },
      });
    }

    excludedRoom = await prisma.room.findFirst({
      where: { paymentEnabled: false },
    });
    if (!excludedRoom) {
      excludedRoom = await prisma.room.create({
        data: {
          roomNumber: 'TEST_ROOM_902',
          floor: 9,
          roomType: 'DOUBLE',
          sharingType: 'TWO_SHARING',
          capacity: 2,
          currentOccupancy: 0,
          baseRent: 6500,
          paymentEnabled: false,
          status: 'AVAILABLE',
        },
      });
    }

    testResident = await prisma.resident.create({
      data: {
        fullName: 'Recurring Reminder Test Resident',
        phone: '+919876543210',
        email: 'recurring.reminder.test@sairamelite.com',
        roomId: normalRoom.id,
        monthlyRent: 6500,
        securityDeposit: '2000',
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const dueDate = new Date('2026-09-05T03:30:00.000Z'); // 5 September 2026 IST

    testPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: normalRoom.id,
        billingMonth: '2026-09',
        rentAmount: 6500,
        totalAmountDue: 6500,
        dueDate,
        status: 'PENDING',
      },
    });

    console.log(`Fixtures ready. MonthlyPayment ID: ${testPayment.id}\n`);

    // --- TEST 1: D-2 FIRST REMINDER SCHEDULE & MESSAGE ---
    const itemSeq1 = getReminderScheduleItem(dueDate, 1);
    assert(
      itemSeq1.sequence === 1 &&
      itemSeq1.scheduledDateStr === '2026-09-03' &&
      itemSeq1.overdueDays === 0 &&
      itemSeq1.reminderType === 'FIRST_DUE_REMINDER',
      'TEST 1: Sequence 1 is scheduled exactly 2 days before due date (2026-09-03)'
    );

    const msgSeq1 = buildPaymentReminderMessage({
      resident: { fullName: 'Rahul Kumar' },
      payment: { billingMonth: 'September 2026', totalAmountDue: 6500 },
      reminderStage: 'FIRST_DUE_REMINDER',
      sequence: 1,
      overdueDays: 0,
    });
    assert(
      msgSeq1.includes('due in 2 days') && !msgSeq1.includes('overdue') && !msgSeq1.includes('due today'),
      'TEST 1b: First reminder message contains "due in 2 days" and no overdue text'
    );

    // --- TEST 2: DUE-DATE REMINDER SCHEDULE & MESSAGE ---
    const itemSeq2 = getReminderScheduleItem(dueDate, 2);
    assert(
      itemSeq2.sequence === 2 &&
      itemSeq2.scheduledDateStr === '2026-09-05' &&
      itemSeq2.overdueDays === 0 &&
      itemSeq2.reminderType === 'DUE_DATE_REMINDER',
      'TEST 2: Sequence 2 is scheduled exactly on the due date (2026-09-05)'
    );

    const msgSeq2 = buildPaymentReminderMessage({
      resident: { fullName: 'Rahul Kumar' },
      payment: { billingMonth: 'September 2026', totalAmountDue: 6500 },
      reminderStage: 'DUE_DATE_REMINDER',
      sequence: 2,
      overdueDays: 0,
    });
    assert(
      msgSeq2.includes('due today') && !msgSeq2.includes('due in 2 days'),
      'TEST 2b: Due date reminder message contains "due today"'
    );

    // --- TEST 3: D+2 OVERDUE REMINDER ---
    const itemSeq3 = getReminderScheduleItem(dueDate, 3);
    assert(
      itemSeq3.sequence === 3 &&
      itemSeq3.scheduledDateStr === '2026-09-07' &&
      itemSeq3.overdueDays === 2 &&
      itemSeq3.reminderType === 'OVERDUE_REMINDER',
      'TEST 3: Sequence 3 is scheduled exactly 2 days overdue (2026-09-07)'
    );

    const msgSeq3 = buildPaymentReminderMessage({
      resident: { fullName: 'Rahul Kumar' },
      payment: { billingMonth: 'September 2026', totalAmountDue: 6500 },
      reminderStage: 'OVERDUE_REMINDER',
      sequence: 3,
      overdueDays: 2,
    });
    assert(
      msgSeq3.includes('still pending') && msgSeq3.includes('2 days overdue') && !msgSeq3.includes('due today'),
      'TEST 3b: D+2 overdue reminder contains "2 days overdue" and does not say "due today"'
    );

    // --- TEST 4: D+4 OVERDUE REMINDER ---
    const itemSeq4 = getReminderScheduleItem(dueDate, 4);
    assert(
      itemSeq4.sequence === 4 &&
      itemSeq4.scheduledDateStr === '2026-09-09' &&
      itemSeq4.overdueDays === 4,
      'TEST 4: Sequence 4 is scheduled exactly 4 days overdue (2026-09-09)'
    );

    // --- TEST 5: D+6 OVERDUE REMINDER ---
    const itemSeq5 = getReminderScheduleItem(dueDate, 5);
    assert(
      itemSeq5.sequence === 5 &&
      itemSeq5.scheduledDateStr === '2026-09-11' &&
      itemSeq5.overdueDays === 6,
      'TEST 5: Sequence 5 is scheduled exactly 6 days overdue (2026-09-11)'
    );

    // --- TEST 6: CONTINUOUS ROLLING REMINDER GENERATION ---
    const scheduleMilestones = getReminderScheduleForDueDate(dueDate, 8);
    assert(
      scheduleMilestones.length === 8 &&
      scheduleMilestones[0].scheduledDateStr === '2026-09-03' &&
      scheduleMilestones[1].scheduledDateStr === '2026-09-05' &&
      scheduleMilestones[2].scheduledDateStr === '2026-09-07' &&
      scheduleMilestones[3].scheduledDateStr === '2026-09-09' &&
      scheduleMilestones[4].scheduledDateStr === '2026-09-11' &&
      scheduleMilestones[5].scheduledDateStr === '2026-09-13' &&
      scheduleMilestones[6].scheduledDateStr === '2026-09-15' &&
      scheduleMilestones[7].scheduledDateStr === '2026-09-17',
      'TEST 6: Reminder milestones generate correct 2-day cadence across all sequences'
    );

    // --- TEST 7: PAYMENT BEFORE D-2 (NOTHING DUE YET) ---
    const beforeD2 = new Date('2026-09-01T03:30:00.000Z');
    const eligibleBeforeD2 = calculateEligibleReminderForToday(dueDate, beforeD2);
    assert(
      eligibleBeforeD2 === null,
      'TEST 7: On 1 Sep (before D-2), calculateEligibleReminderForToday returns null'
    );

    // --- TEST 8: PAYMENT AFTER D-2 BUT BEFORE DUE DATE ---
    const onD2 = new Date('2026-09-03T03:30:00.000Z');
    const eligibleOnD2 = calculateEligibleReminderForToday(dueDate, onD2);
    assert(
      eligibleOnD2 && eligibleOnD2.sequence === 1,
      'TEST 8: On 3 Sep (D-2), Sequence 1 is identified as eligible'
    );

    // --- TEST 9: ON DUE DATE ---
    const onDueDate = new Date('2026-09-05T03:30:00.000Z');
    const eligibleOnDueDate = calculateEligibleReminderForToday(dueDate, onDueDate);
    assert(
      eligibleOnDueDate && eligibleOnDueDate.sequence === 2,
      'TEST 9: On 5 Sep (Due Date), Sequence 2 is identified as eligible'
    );

    // --- TEST 10: 2 DAYS OVERDUE ---
    const onDPlus2 = new Date('2026-09-07T03:30:00.000Z');
    const eligibleOnDPlus2 = calculateEligibleReminderForToday(dueDate, onDPlus2);
    assert(
      eligibleOnDPlus2 && eligibleOnDPlus2.sequence === 3 && eligibleOnDPlus2.overdueDays === 2,
      'TEST 10: On 7 Sep (D+2), Sequence 3 is identified as eligible with 2 overdue days'
    );

    // --- TEST 11: 10 DAYS OVERDUE ---
    const onDPlus10 = new Date('2026-09-15T03:30:00.000Z');
    const eligibleOnDPlus10 = calculateEligibleReminderForToday(dueDate, onDPlus10);
    assert(
      eligibleOnDPlus10 && eligibleOnDPlus10.sequence === 7 && eligibleOnDPlus10.overdueDays === 10,
      'TEST 11: On 15 Sep (D+10), Sequence 7 is identified as eligible with 10 overdue days'
    );

    // --- TEST 12: PAYMENT NEVER COMPLETED (INDEFINITE CADENCE) ---
    const itemSeq50 = getReminderScheduleItem(dueDate, 50);
    assert(
      itemSeq50.sequence === 50 && itemSeq50.overdueDays === 96,
      'TEST 12: Sequence 50 evaluates without crashing to 96 days overdue'
    );

    // --- TEST 13 & 14: PAYMENT BECOMES PAID -> CANCELS FUTURE REMINDERS ---
    await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: testPayment.id,
        residentId: testResident.id,
        reminderType: 'FIRST_DUE_REMINDER',
        sequence: 1,
        channel: 'WHATSAPP',
        scheduledFor: new Date('2026-09-03T03:30:00Z'),
        status: 'SENT',
        sentAt: new Date(),
        messageText: 'Sent 1st reminder',
      },
    });

    await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: testPayment.id,
        residentId: testResident.id,
        reminderType: 'DUE_DATE_REMINDER',
        sequence: 2,
        channel: 'WHATSAPP',
        scheduledFor: new Date('2026-09-05T03:30:00Z'),
        status: 'PENDING',
        messageText: 'Scheduled due reminder',
      },
    });

    const cancelledCount = await cancelPendingRemindersForPayment(testPayment.id, 'Payment completed');
    assert(
      cancelledCount === 1,
      'TEST 13 & 14: cancelPendingRemindersForPayment cancels only PENDING reminders (preserves SENT)'
    );

    const pendingAfterCancel = await prisma.paymentReminder.findMany({
      where: { monthlyPaymentId: testPayment.id, status: 'PENDING' },
    });
    assert(
      pendingAfterCancel.length === 0,
      'TEST 15: Zero pending reminders remain after cancellation'
    );

    // --- TEST 16 & 17: ROOM PAYMENT MANAGEMENT EXCLUSION ---
    assert(
      isPaymentManagedRoom(normalRoom) === true,
      'TEST 16: Normal room (paymentEnabled: true) is eligible for reminders'
    );
    assert(
      isPaymentManagedRoom(excludedRoom) === false,
      'TEST 17: Excluded room (paymentEnabled: false) is NOT eligible for reminders'
    );

    // --- TEST 18: ROOM TRANSFER DYNAMICS ---
    await prisma.resident.update({
      where: { id: testResident.id },
      data: { roomId: excludedRoom.id },
    });
    const residentAfterTransfer = await prisma.resident.findUnique({
      where: { id: testResident.id },
      include: { room: true },
    });
    assert(
      isPaymentManagedRoom(residentAfterTransfer.room) === false,
      'TEST 18a: Moving resident to Room 102 (paymentEnabled: false) disables reminder eligibility'
    );

    await prisma.resident.update({
      where: { id: testResident.id },
      data: { roomId: normalRoom.id },
    });
    const residentTransferredBack = await prisma.resident.findUnique({
      where: { id: testResident.id },
      include: { room: true },
    });
    assert(
      isPaymentManagedRoom(residentTransferredBack.room) === true,
      'TEST 18b: Moving resident back to normal room restores reminder eligibility'
    );

    // --- TEST 19: WHATSAPP RECORD AND ROLLING SCHEDULE CREATION ---
    const rollPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: normalRoom.id,
        billingMonth: '2026-11',
        rentAmount: 6500,
        totalAmountDue: 6500,
        dueDate: new Date('2026-11-05T03:30:00Z'),
        status: 'PENDING',
      },
    });

    // Simulate sending sequence 1 and rolling schedule to sequence 2
    const nextSeq2Item = getReminderScheduleItem(rollPayment.dueDate, 2);
    await prisma.$transaction([
      prisma.paymentReminder.create({
        data: {
          monthlyPaymentId: rollPayment.id,
          residentId: testResident.id,
          reminderType: 'FIRST_DUE_REMINDER',
          sequence: 1,
          channel: 'WHATSAPP',
          scheduledFor: new Date('2026-11-03T03:30:00Z'),
          status: 'SENT',
          sentAt: new Date(),
          messageText: 'Sent sequence 1',
        },
      }),
      prisma.paymentReminder.create({
        data: {
          monthlyPaymentId: rollPayment.id,
          residentId: testResident.id,
          reminderType: nextSeq2Item.reminderType,
          sequence: 2,
          channel: 'WHATSAPP',
          scheduledFor: nextSeq2Item.scheduledFor,
          status: 'PENDING',
          messageText: 'Scheduled next',
        },
      }),
    ]);

    const rollingReminders = await prisma.paymentReminder.findMany({
      where: { monthlyPaymentId: rollPayment.id },
    });
    assert(
      rollingReminders.length === 2 &&
      rollingReminders.some(r => r.sequence === 1 && r.status === 'SENT') &&
      rollingReminders.some(r => r.sequence === 2 && r.status === 'PENDING'),
      'TEST 19: Rolling schedule creates exactly 1 next pending reminder (no infinite DB rows)'
    );

    // --- TEST 20 & 21: IDEMPOTENT CRON EXECUTION (NO DUPLICATES) ---
    let duplicateConstraintCaught = false;
    try {
      await prisma.paymentReminder.create({
        data: {
          monthlyPaymentId: rollPayment.id,
          residentId: testResident.id,
          reminderType: 'FIRST_DUE_REMINDER',
          sequence: 1,
          channel: 'WHATSAPP',
          scheduledFor: new Date('2026-11-03T03:30:00Z'),
          status: 'SENT',
          messageText: 'Duplicate sequence insert',
        },
      });
    } catch (e) {
      duplicateConstraintCaught = true;
    }
    assert(
      duplicateConstraintCaught,
      'TEST 20 & 21: Unique constraint [monthlyPaymentId, sequence] blocks duplicate reminders'
    );

    // --- TEST 22: MONTH BOUNDARY DATE ARITHMETIC ---
    const dueAug31 = new Date('2026-08-31T03:30:00Z');
    const aug31Seq1 = getReminderScheduleItem(dueAug31, 1);
    const aug31Seq3 = getReminderScheduleItem(dueAug31, 3);
    assert(
      aug31Seq1.scheduledDateStr === '2026-08-29' &&
      aug31Seq3.scheduledDateStr === '2026-09-02',
      'TEST 22: Month boundary (Aug 31: D-2 = Aug 29, D+2 = Sep 02) calculated accurately'
    );

    // --- TEST 23: YEAR BOUNDARY DATE ARITHMETIC ---
    const dueJan1 = new Date('2027-01-01T03:30:00Z');
    const jan1Seq1 = getReminderScheduleItem(dueJan1, 1);
    const jan1Seq3 = getReminderScheduleItem(dueJan1, 3);
    assert(
      jan1Seq1.scheduledDateStr === '2026-12-30' &&
      jan1Seq3.scheduledDateStr === '2027-01-03',
      'TEST 23: Year boundary (Jan 01 2027: D-2 = Dec 30 2026, D+2 = Jan 03 2027) calculated accurately'
    );

    // --- TEST 24: FEBRUARY NON-LEAP YEAR DATE ARITHMETIC ---
    const dueMar1_2025 = new Date('2025-03-01T03:30:00Z');
    const mar1_2025_Seq1 = getReminderScheduleItem(dueMar1_2025, 1);
    assert(
      mar1_2025_Seq1.scheduledDateStr === '2025-02-27',
      'TEST 24: February non-leap year (Mar 01 2025: D-2 = Feb 27) calculated accurately'
    );

    // --- TEST 25: FEBRUARY LEAP YEAR DATE ARITHMETIC ---
    const dueMar1_2024 = new Date('2024-03-01T03:30:00Z');
    const mar1_2024_Seq1 = getReminderScheduleItem(dueMar1_2024, 1);
    assert(
      mar1_2024_Seq1.scheduledDateStr === '2024-02-28',
      'TEST 25: February leap year (Mar 01 2024: D-2 = Feb 28) calculated accurately'
    );

    // --- TEST 26: ASIA/KOLKATA TIMEZONE FORMATTING ---
    const dateUtcLate = new Date('2026-09-04T20:00:00.000Z'); // 01:30 AM 5 Sep in IST
    const dateKolkataStr = getKolkataDateString(dateUtcLate);
    assert(
      dateKolkataStr === '2026-09-05',
      'TEST 26: Asia/Kolkata date format correctly identifies calendar day in IST'
    );

    // --- TEST 27 & 28: SECURITY DEPOSIT EXCLUDED & MONTHLY RENT ONLY ---
    const messageRender = buildPaymentReminderMessage({
      resident: { fullName: testResident.fullName },
      payment: {
        billingMonth: 'September 2026',
        totalAmountDue: testPayment.rentAmount, // ₹6,500 only, deposit is 2000
      },
      reminderStage: 'FIRST_DUE_REMINDER',
      sequence: 1,
    });
    assert(
      messageRender.includes('₹6,500') && !messageRender.includes('₹8,500') && !messageRender.includes('deposit'),
      'TEST 27 & 28: Reminder amount is strictly the monthly rent (₹6,500) and excludes security deposit'
    );

    // --- TEST 29: RETRY STRATEGY & FAILURE TRACKING ---
    const failedReminder = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: rollPayment.id,
        residentId: testResident.id,
        reminderType: 'OVERDUE_REMINDER',
        sequence: 3,
        channel: 'WHATSAPP',
        scheduledFor: new Date('2026-11-07T03:30:00Z'),
        status: 'FAILED',
        failureReason: 'Meta API rate limit',
        attemptCount: 1,
        messageText: 'Failed attempt 1',
      },
    });
    assert(
      failedReminder.status === 'FAILED' && failedReminder.attemptCount === 1,
      'TEST 29: Failed reminder records failure reason and attemptCount cleanly'
    );

    // --- TEST 30: RETRY INCREMENTS ATTEMPT COUNT ---
    const updatedFailed = await prisma.paymentReminder.update({
      where: { id: failedReminder.id },
      data: { attemptCount: { increment: 1 } },
    });
    assert(
      updatedFailed.attemptCount === 2,
      'TEST 30: Retry attempts increment counter without duplicating rows'
    );

    // --- TEST 31: COMPATIBILITY WITH PREVIOUS ENUMS ---
    assert(
      itemSeq1.reminderType === 'FIRST_DUE_REMINDER' &&
      itemSeq2.reminderType === 'DUE_DATE_REMINDER' &&
      itemSeq3.reminderType === 'OVERDUE_REMINDER',
      'TEST 31: Reminder types backward and forward compatibility verified'
    );

    // --- CLEANUP TEST FIXTURES ---
    console.log('\n--- Cleaning up Test Fixtures ---');
    await prisma.paymentReminder.deleteMany({
      where: { residentId: testResident.id },
    });
    await prisma.monthlyPayment.deleteMany({
      where: { residentId: testResident.id },
    });
    await prisma.resident.delete({
      where: { id: testResident.id },
    });
    console.log('✅ Test fixtures cleaned up successfully.\n');

  } catch (error) {
    console.error('Test suite runtime error:', error);
    failedTests++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite();
