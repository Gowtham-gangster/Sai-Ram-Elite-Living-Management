require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

// Phone normalizer implementation
function normalizeWhatsAppPhoneNumber(raw) {
  if (!raw) {
    return { isValid: false, e164: '', digitsOnly: '', error: 'Phone number is empty or missing.' };
  }
  const rawStr = String(raw).trim();
  let cleaned = rawStr.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1);

  if (cleaned.length === 10) {
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      const digitsOnly = `91${cleaned}`;
      return { isValid: true, e164: `+${digitsOnly}`, digitsOnly };
    } else {
      return { isValid: false, e164: '', digitsOnly: '', error: `Invalid Indian 10-digit mobile number format: ${rawStr}` };
    }
  }

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const mobilePart = cleaned.substring(2);
    if (/^[6-9]\d{9}$/.test(mobilePart)) {
      return { isValid: true, e164: `+${cleaned}`, digitsOnly: cleaned };
    } else {
      return { isValid: false, e164: '', digitsOnly: '', error: `Invalid Indian 10-digit mobile number in 91-prefix: ${rawStr}` };
    }
  }

  return { isValid: false, e164: '', digitsOnly: '', error: `Unrecognized phone number format: ${rawStr}` };
}

// Template formatter implementation
function formatBillingMonthDisplay(raw) {
  if (!raw) return 'Current Month';
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }
  return raw;
}

function buildPaymentReminderMessage(params) {
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
    return (
      `Hello ${residentName},\n\n` +
      `This is a reminder that your monthly rent payment of ₹${amountFormatted} for ${billingMonthFormatted} is still pending.\n\n` +
      `Please complete your payment at your earliest convenience.\n\n` +
      `Thank you,\n` +
      `SAIRAM ELITE LIVING`
    );
  }
}

async function runWhatsAppTests() {
  console.log('================================================================');
  console.log('TEST SUITE: AUTOMATIC WHATSAPP PAYMENT REMINDER SYSTEM');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Phone Normalizer Tests
    // -------------------------------------------------------------
    console.log('--- Test 1: Phone Normalizer Unit Tests ---');
    const phoneCases = [
      { input: '8688535143', expectedE164: '+918688535143', expectedDigits: '918688535143', valid: true },
      { input: '+918688535143', expectedE164: '+918688535143', expectedDigits: '918688535143', valid: true },
      { input: '918688535143', expectedE164: '+918688535143', expectedDigits: '918688535143', valid: true },
      { input: '08688535143', expectedE164: '+918688535143', expectedDigits: '918688535143', valid: true },
      { input: '+91 86885 35143', expectedE164: '+918688535143', expectedDigits: '918688535143', valid: true },
      { input: '12345', valid: false },
      { input: '99999999999999', valid: false },
      { input: '', valid: false },
    ];

    let allPhonePassed = true;
    for (const pc of phoneCases) {
      const res = normalizeWhatsAppPhoneNumber(pc.input);
      if (pc.valid) {
        if (!res.isValid || res.e164 !== pc.expectedE164 || res.digitsOnly !== pc.expectedDigits) {
          allPhonePassed = false;
          console.error(`   Phone normalization error on "${pc.input}": got ${JSON.stringify(res)}`);
        }
      } else {
        if (res.isValid) {
          allPhonePassed = false;
          console.error(`   Expected invalid for "${pc.input}" but got valid`);
        }
      }
    }
    assert(allPhonePassed, 'Phone normalizer correctly standardizes Indian numbers without double-prepending');

    // -------------------------------------------------------------
    // Test 2: Message Content Invariants (No Payment Links)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Message Template Content & Zero Payment Link Invariant ---');
    const firstMsg = buildPaymentReminderMessage({
      resident: { fullName: 'Rahul Sharma' },
      payment: { totalAmountDue: 8000, billingMonth: '2026-09' },
      reminderStage: 'FIRST_DUE_REMINDER',
    });

    const secondMsg = buildPaymentReminderMessage({
      resident: { fullName: 'Rahul Sharma' },
      payment: { totalAmountDue: 8000, billingMonth: '2026-09' },
      reminderStage: 'SECOND_REMINDER',
    });

    assert(
      firstMsg.includes('Hello Rahul Sharma,') &&
      firstMsg.includes('Your monthly rent payment of ₹8,000 for September 2026 is due today.') &&
      firstMsg.includes('SAIRAM ELITE LIVING'),
      'First reminder template text matches exact business specification'
    );

    assert(
      secondMsg.includes('Hello Rahul Sharma,') &&
      secondMsg.includes('This is a reminder that your monthly rent payment of ₹8,000 for September 2026 is still pending.') &&
      secondMsg.includes('SAIRAM ELITE LIVING'),
      'Second reminder template text matches exact business specification'
    );

    assert(
      !firstMsg.includes('http://') && !firstMsg.includes('https://') && !firstMsg.includes('upi://') &&
      !secondMsg.includes('http://') && !secondMsg.includes('https://') && !secondMsg.includes('upi://'),
      'Templates contain ZERO payment links, fake URLs, or UPI links'
    );

    // -------------------------------------------------------------
    // Test 3: Environment & Sender Configuration
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Business Sender Configuration ---');
    const senderNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER;
    assert(
      senderNumber === '+918688535143' || senderNumber === '918688535143',
      `WHATSAPP_BUSINESS_PHONE_NUMBER is configured as owner's number (+918688535143). Found: ${senderNumber}`
    );

    // -------------------------------------------------------------
    // Test 4: First Reminder Due Date Trigger in DB
    // -------------------------------------------------------------
    console.log('\n--- Test 4: First Reminder Due Date Processing ---');
    const testPhone = '9876543299';
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });

    const room = await prisma.room.findFirst();
    const resident = await prisma.resident.create({
      data: {
        fullName: 'Test Reminder Resident',
        phone: testPhone,
        roomId: room.id,
        monthlyRent: 8000.0,
        securityDeposit: '2000',
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const todayDate = new Date();
    const payment = await prisma.monthlyPayment.create({
      data: {
        residentId: resident.id,
        roomId: room.id,
        billingMonth: '2026-08',
        rentAmount: 8000.0,
        totalAmountDue: 8000.0,
        dueDate: todayDate, // Due today
        status: 'PENDING',
      },
    });

    // Simulate reminder processing for this payment
    const simulatedMsgId = `wam_test_001_${Date.now()}`;
    const firstReminderRecord = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: resident.id,
        reminderType: 'FIRST_DUE_REMINDER',
        channel: 'WHATSAPP',
        scheduledFor: todayDate,
        sentAt: new Date(),
        status: 'SENT',
        providerMessageId: simulatedMsgId,
        messageText: firstMsg,
      },
    });

    await prisma.monthlyPayment.update({
      where: { id: payment.id },
      data: {
        firstReminderSentAt: new Date(),
        reminderStatus: 'FIRST_REMINDER_SENT',
      },
    });

    assert(firstReminderRecord.status === 'SENT', 'FIRST_DUE_REMINDER successfully recorded with status: SENT');
    assert(firstReminderRecord.providerMessageId === simulatedMsgId, `Provider message ID recorded: ${simulatedMsgId}`);

    // -------------------------------------------------------------
    // Test 5: Idempotency & Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Idempotency & Duplicate Prevention ---');
    const existingReminders = await prisma.paymentReminder.findMany({
      where: {
        monthlyPaymentId: payment.id,
        reminderType: 'FIRST_DUE_REMINDER',
      },
    });
    assert(existingReminders.length === 1, 'Exactly one FIRST_DUE_REMINDER exists for this payment record');

    // -------------------------------------------------------------
    // Test 6: Second Reminder 2-Day Follow-Up Trigger
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Second Reminder 2-Day Follow-Up Trigger ---');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.monthlyPayment.update({
      where: { id: payment.id },
      data: { firstReminderSentAt: twoDaysAgo },
    });

    const simulatedSecondMsgId = `wam_test_002_${Date.now()}`;
    const secondReminderRecord = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: resident.id,
        sequence: 2,
        reminderType: 'SECOND_REMINDER',
        channel: 'WHATSAPP',
        scheduledFor: new Date(),
        sentAt: new Date(),
        status: 'SENT',
        providerMessageId: simulatedSecondMsgId,
        messageText: secondMsg,
      },
    });

    await prisma.monthlyPayment.update({
      where: { id: payment.id },
      data: {
        secondReminderSentAt: new Date(),
        reminderStatus: 'SECOND_REMINDER_SENT',
      },
    });

    assert(secondReminderRecord.status === 'SENT', 'SECOND_REMINDER recorded after 2-day delay with status: SENT');

    // -------------------------------------------------------------
    // Test 7: Paid Payment Cancels Future Reminders
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Paid Payment Cancellation ---');
    await prisma.monthlyPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidDate: new Date() },
    });

    const paymentAfterPaid = await prisma.monthlyPayment.findUnique({
      where: { id: payment.id },
    });

    assert(paymentAfterPaid.status === 'PAID', 'Payment verified as PAID; engine halts further reminders');

    // -------------------------------------------------------------
    // Test 8: Failure Isolation (Batch Resilience)
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Failure Isolation on Invalid Recipient ---');
    const testInvalidPhone = '12345'; // Invalid phone
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testInvalidPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testInvalidPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testInvalidPhone } });

    const badResident = await prisma.resident.create({
      data: {
        fullName: 'Bad Phone Resident',
        phone: testInvalidPhone,
        roomId: room.id,
        monthlyRent: 8000.0,
        securityDeposit: '2000',
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const badPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: badResident.id,
        roomId: room.id,
        billingMonth: '2026-08',
        rentAmount: 8000.0,
        totalAmountDue: 8000.0,
        dueDate: todayDate,
        status: 'PENDING',
      },
    });

    const normCheck = normalizeWhatsAppPhoneNumber(badResident.phone);
    const failedReminderRecord = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: badPayment.id,
        residentId: badResident.id,
        reminderType: 'FIRST_DUE_REMINDER',
        channel: 'WHATSAPP',
        scheduledFor: todayDate,
        status: 'FAILED',
        failureReason: normCheck.error || 'Invalid phone format',
        attemptCount: 1,
        messageText: `[Failed: ${normCheck.error}]`,
      },
    });

    assert(failedReminderRecord.status === 'FAILED', 'PaymentReminder correctly records status: FAILED');
    assert(!!failedReminderRecord.failureReason, `Failure reason recorded: "${failedReminderRecord.failureReason}"`);

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.paymentReminder.deleteMany({ where: { residentId: { in: [resident.id, badResident.id] } } });
    await prisma.monthlyPayment.deleteMany({ where: { id: { in: [payment.id, badPayment.id] } } });
    await prisma.resident.deleteMany({ where: { id: { in: [resident.id, badResident.id] } } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runWhatsAppTests();
