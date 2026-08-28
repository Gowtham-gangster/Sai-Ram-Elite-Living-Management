const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 9: PAYMENT REMINDER INFRASTRUCTURE TESTS  ');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Admin Login
  console.log('--- Step 1: Admin Login ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status, 'Cookie Set:', Boolean(cookie));
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

  // 2. Fetch Reminders & Candidates Listing
  console.log('\n--- Step 2: GET /api/reminders ---');
  const remindersRes = await fetch(`${baseUrl}/api/reminders`, { headers });
  const remindersData = await remindersRes.json();
  console.log('Reminders API Status:', remindersRes.status, 'Summary:', remindersData.summary);
  console.log(`Candidates needing reminders: ${remindersData.candidates?.length}`);
  if (remindersRes.status !== 200 || !remindersData.summary) {
    throw new Error('Failed to fetch reminders and candidates data!');
  }
  console.log('✅ Step 2 PASSED: Reminders list, candidate detector, and summary retrieved.');

  // 3. Fetch and Edit Reminder Templates
  console.log('\n--- Step 3: GET & PUT /api/reminders/templates ---');
  const templatesRes = await fetch(`${baseUrl}/api/reminders/templates`, { headers });
  const templatesData = await templatesRes.json();
  console.log(`Fetched ${templatesData.templates?.length} templates:`, templatesData.templates?.map(t => t.reminderType));
  if (!templatesData.templates || templatesData.templates.length === 0) {
    throw new Error('Failed to retrieve default reminder templates!');
  }

  // Edit UPCOMING_DUE template
  const updateTplRes = await fetch(`${baseUrl}/api/reminders/templates`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      reminderType: 'UPCOMING_DUE',
      title: 'Upcoming Rent Due Reminder',
      templateBody: 'Dear {{resident_name}}, your rent of ₹{{amount_due}} for Room {{room_number}} is due on {{due_date}}. UPI: {{upi_id}}.',
      channel: 'WHATSAPP',
      daysOffset: -3,
      isActive: true,
    }),
  });
  const updateTplData = await updateTplRes.json();
  console.log('Update Template Status:', updateTplRes.status, 'Template:', updateTplData.template?.title);
  if (updateTplRes.status !== 200) throw new Error('Failed to update reminder template!');
  console.log('✅ Step 3 PASSED: Templates verified and updated.');

  // 4. Create / Dispatch Reminder with Dynamic Placeholders
  console.log('\n--- Step 4: POST /api/reminders (Dynamic Placeholders & Dispatch) ---');
  // Get an active resident with pending payment
  const activeResident = await prisma.resident.findFirst({
    where: { status: 'ACTIVE' },
    include: { room: true, monthlyPayments: true },
  });

  const dispatchRes = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      residentId: activeResident.id,
      monthlyPaymentId: activeResident.monthlyPayments[0]?.id || null,
      reminderType: 'UPCOMING_DUE',
      channel: 'WHATSAPP',
    }),
  });
  const dispatchData = await dispatchRes.json();
  console.log('Dispatch Status:', dispatchRes.status, 'Message:', dispatchData.message);
  console.log('Formatted Message Text:', dispatchData.reminder?.messageText);
  if (dispatchRes.status !== 201 || !dispatchData.reminder?.messageText.includes(activeResident.fullName)) {
    throw new Error('Reminder message did not substitute dynamic resident placeholders properly!');
  }
  const testReminderId = dispatchData.reminder.id;
  console.log('✅ Step 4 PASSED: Reminder formatted and dispatched with dynamic parameters.');

  // 5. Test Status Transitions: Mark Failed, Retry, Cancel
  console.log('\n--- Step 5: PATCH /api/reminders/[id] (Lifecycle actions) ---');
  // Mark Failed
  const failRes = await fetch(`${baseUrl}/api/reminders/${testReminderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'MARK_FAILED', failureReason: 'Network unreachable' }),
  });
  const failData = await failRes.json();
  console.log('Mark Failed Status:', failRes.status, 'New Status:', failData.reminder?.status);
  if (failData.reminder?.status !== 'FAILED') throw new Error('Failed to update status to FAILED!');

  // Retry
  const retryRes = await fetch(`${baseUrl}/api/reminders/${testReminderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'RETRY' }),
  });
  const retryData = await retryRes.json();
  console.log('Retry Status:', retryRes.status, 'New Status:', retryData.reminder?.status, 'Attempt Count:', retryData.reminder?.attemptCount);
  if (retryData.reminder?.status !== 'SENT' || retryData.reminder?.attemptCount < 2) {
    throw new Error('Retry action did not increment attempt count or set status to SENT!');
  }

  // Cancel
  const cancelRes = await fetch(`${baseUrl}/api/reminders/${testReminderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'CANCEL' }),
  });
  const cancelData = await cancelRes.json();
  console.log('Cancel Status:', cancelRes.status, 'New Status:', cancelData.reminder?.status);
  if (cancelData.reminder?.status !== 'CANCELLED') throw new Error('Cancel action failed!');
  console.log('✅ Step 5 PASSED: Reminder lifecycle actions (Failed, Retry, Cancel) fully verified.');

  // Cleanup test reminder
  console.log('\n--- Cleanup test reminder ---');
  await prisma.paymentReminder.delete({ where: { id: testReminderId } });
  console.log('Cleaned up test reminder record.');

  console.log('\n🎉 ALL PHASE 9 PAYMENT REMINDER INFRASTRUCTURE TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
