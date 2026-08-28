require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runPaymentReminderTests() {
  console.log('================================================================');
  console.log('   PAYMENT REMINDER & SETTINGS CLEANUP AUTOMATED TEST SUITE     ');
  console.log('================================================================\n');

  // 1. Authenticate with admin credentials
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookieHeader = loginRes.headers.get('set-cookie');

  // 2. Verify Settings Cleanup (No Rent Due Rules & Penalties)
  console.log('--- 1. Testing Removal of Rent Due Rules & Penalties ---');
  const settingsFile = fs.readFileSync(
    path.join(__dirname, '../src/app/(protected)/settings/page.tsx'),
    'utf8'
  );
  if (
    settingsFile.includes('Rent Due Rules & Penalties') ||
    settingsFile.includes('Default Due Day') ||
    settingsFile.includes('Grace Period') ||
    settingsFile.includes('Late Fee / Day')
  ) {
    throw new Error('Found lingering Rent Due Rules in Settings page UI!');
  }
  console.log('✅ Settings UI: Rent Due Rules & Penalties completely removed.');

  const settings = await prisma.hostelSettings.findUnique({ where: { id: 'default' } });
  if (settings.defaultDueDayOfMonth !== undefined || settings.lateFeePerDay !== undefined) {
    throw new Error('HostelSettings database model still contains obsolete due-rule columns!');
  }
  console.log('✅ Database Schema: Rent due & penalty columns completely removed.');

  // 3. Setup Test Resident and Room
  console.log('\n--- 2. Setting Up Controlled Test Payment Data ---');
  let testRoom = await prisma.room.findFirst({ where: { roomNumber: '999T' } });
  if (!testRoom) {
    testRoom = await prisma.room.create({
      data: {
        roomNumber: '999T',
        floor: 9,
        capacity: 2,
        sharingType: 'DOUBLE',
        baseRent: 9000,
        securityDeposit: 2000,
        status: 'AVAILABLE',
      },
    });
  }

  let testResident = await prisma.resident.findFirst({ where: { phone: '9999900001' } });
  if (!testResident) {
    testResident = await prisma.resident.create({
      data: {
        fullName: 'Test Automation Resident',
        phone: '9999900001',
        roomId: testRoom.id,
        monthlyRent: 9000,
        securityDeposit: 2000,
        status: 'ACTIVE',
      },
    });
  }

  // Clean any previous test payment records
  await prisma.paymentReminder.deleteMany({ where: { residentId: testResident.id } });
  await prisma.monthlyPayment.deleteMany({ where: { residentId: testResident.id } });

  const triggerProcessEngine = async () => {
    const res = await fetch('http://localhost:3000/api/reminders/process', {
      method: 'POST',
      headers: { cookie: cookieHeader || '' },
    });
    if (!res.ok) {
      throw new Error(`Process engine returned status ${res.status}`);
    }
    return res.json();
  };

  // 4. Test Case 1: Future Due Date (No Reminder)
  console.log('\n--- 3. Testing Future Due Date ---');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const futurePayment = await prisma.monthlyPayment.create({
    data: {
      residentId: testResident.id,
      roomId: testRoom.id,
      billingMonth: '2026-09',
      rentAmount: 9000,
      totalAmountDue: 9000,
      status: 'PENDING',
      dueDate: futureDate,
    },
  });

  await triggerProcessEngine();
  let reminderCount = await prisma.paymentReminder.count({
    where: { monthlyPaymentId: futurePayment.id },
  });
  if (reminderCount > 0) {
    throw new Error('Reminder was sent for future due date!');
  }
  console.log('✅ Future Due Date: 0 reminders dispatched (PASS).');

  // 5. Test Case 2: Due Today & UNPAID (First Reminder Eligible)
  console.log('\n--- 4. Testing Due Today & Unpaid -> First Reminder ---');
  const todayDate = new Date();
  const duePayment = await prisma.monthlyPayment.create({
    data: {
      residentId: testResident.id,
      roomId: testRoom.id,
      billingMonth: '2026-08',
      rentAmount: 9000,
      totalAmountDue: 9000,
      status: 'PENDING',
      dueDate: todayDate,
    },
  });

  await triggerProcessEngine();
  const updatedDuePayment = await prisma.monthlyPayment.findUnique({
    where: { id: duePayment.id },
  });
  const firstReminder = await prisma.paymentReminder.findUnique({
    where: {
      monthlyPaymentId_reminderType: {
        monthlyPaymentId: duePayment.id,
        reminderType: 'FIRST_DUE_REMINDER',
      },
    },
  });

  if (!firstReminder || firstReminder.status !== 'SENT') {
    throw new Error('First reminder was not created/sent for due payment!');
  }
  if (!updatedDuePayment.firstReminderSentAt) {
    throw new Error('firstReminderSentAt was not recorded on MonthlyPayment!');
  }
  console.log(`✅ First Reminder Dispatched: Recorded at ${updatedDuePayment.firstReminderSentAt.toISOString()} (PASS).`);

  // 6. Test Case 3: Immediate Scheduler Re-run (Idempotency / No Duplicate First Reminder)
  console.log('\n--- 5. Testing Immediate Re-run Idempotency ---');
  await triggerProcessEngine();
  const firstRemindersTotal = await prisma.paymentReminder.count({
    where: {
      monthlyPaymentId: duePayment.id,
      reminderType: 'FIRST_DUE_REMINDER',
    },
  });
  if (firstRemindersTotal !== 1) {
    throw new Error(`Duplicate first reminder created! Found ${firstRemindersTotal}`);
  }
  console.log('✅ Idempotency Verified: 0 duplicate first reminders created (PASS).');

  // 7. Test Case 4: Less than 2 days since first reminder (No Second Reminder Yet)
  console.log('\n--- 6. Testing Follow-up Timeline (< 2 Days) ---');
  const secondReminderTooSoon = await prisma.paymentReminder.findUnique({
    where: {
      monthlyPaymentId_reminderType: {
        monthlyPaymentId: duePayment.id,
        reminderType: 'SECOND_REMINDER',
      },
    },
  });
  if (secondReminderTooSoon) {
    throw new Error('Second reminder was sent prematurely before 2 days elapsed!');
  }
  console.log('✅ Follow-up Timeline (< 2 Days): Second reminder correctly deferred (PASS).');

  // 8. Test Case 5: 2 Days Elapsed & Still UNPAID -> Second Reminder
  console.log('\n--- 7. Testing 2 Days Elapsed & Unpaid -> Second Reminder ---');
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await prisma.monthlyPayment.update({
    where: { id: duePayment.id },
    data: { firstReminderSentAt: twoDaysAgo },
  });

  await triggerProcessEngine();
  const secondReminder = await prisma.paymentReminder.findUnique({
    where: {
      monthlyPaymentId_reminderType: {
        monthlyPaymentId: duePayment.id,
        reminderType: 'SECOND_REMINDER',
      },
    },
  });
  const paymentAfterSecond = await prisma.monthlyPayment.findUnique({
    where: { id: duePayment.id },
  });

  if (!secondReminder || secondReminder.status !== 'SENT') {
    throw new Error('Second reminder was not sent after 2 days elapsed!');
  }
  if (!paymentAfterSecond.secondReminderSentAt) {
    throw new Error('secondReminderSentAt was not recorded on MonthlyPayment!');
  }
  console.log(`✅ Second Reminder Dispatched: Recorded at ${paymentAfterSecond.secondReminderSentAt.toISOString()} (PASS).`);

  // 9. Test Case 6: Immediate Re-run after Second Reminder (No Duplicates)
  console.log('\n--- 8. Testing Second Reminder Idempotency ---');
  await triggerProcessEngine();
  const secondRemindersTotal = await prisma.paymentReminder.count({
    where: {
      monthlyPaymentId: duePayment.id,
      reminderType: 'SECOND_REMINDER',
    },
  });
  if (secondRemindersTotal !== 1) {
    throw new Error(`Duplicate second reminder created! Found ${secondRemindersTotal}`);
  }
  console.log('✅ Idempotency Verified: 0 duplicate second reminders created (PASS).');

  // 10. Test Case 7: Payment Becomes PAID (Reminders Cancelled / Stopped)
  console.log('\n--- 9. Testing Paid Payment Cancellation ---');
  const paidTestPayment = await prisma.monthlyPayment.create({
    data: {
      residentId: testResident.id,
      roomId: testRoom.id,
      billingMonth: '2026-07',
      rentAmount: 9000,
      totalAmountDue: 9000,
      status: 'PAID',
      dueDate: twoDaysAgo,
      paidDate: new Date(),
    },
  });

  // Create mock pending reminder
  await prisma.paymentReminder.create({
    data: {
      residentId: testResident.id,
      monthlyPaymentId: paidTestPayment.id,
      reminderType: 'FIRST_DUE_REMINDER',
      channel: 'WHATSAPP',
      scheduledFor: twoDaysAgo,
      status: 'PENDING',
      messageText: 'Test pending reminder',
    },
  });

  await triggerProcessEngine();
  const cancelledReminder = await prisma.paymentReminder.findUnique({
    where: {
      monthlyPaymentId_reminderType: {
        monthlyPaymentId: paidTestPayment.id,
        reminderType: 'FIRST_DUE_REMINDER',
      },
    },
  });
  if (!cancelledReminder || cancelledReminder.status !== 'CANCELLED') {
    throw new Error('Pending reminder for paid payment was not cancelled!');
  }
  console.log('✅ Paid Status Check: Reminders for paid payments are immediately stopped & cancelled (PASS).');

  // 11. Clean up test records
  await prisma.paymentReminder.deleteMany({ where: { residentId: testResident.id } });
  await prisma.monthlyPayment.deleteMany({ where: { residentId: testResident.id } });
  await prisma.resident.deleteMany({ where: { id: testResident.id } });
  await prisma.room.deleteMany({ where: { id: testRoom.id } });

  console.log('\n================================================================');
  console.log('   🎉 ALL PAYMENT REMINDER & SETTINGS TESTS PASSED (100%)       ');
  console.log('================================================================\n');
}

runPaymentReminderTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
