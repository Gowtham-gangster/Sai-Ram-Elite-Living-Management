const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 6: MONTHLY PAYMENT MANAGEMENT API TESTS   ');
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

  // 2. Fetch Payments Listing & Summary
  console.log('\n--- Step 2: GET /api/payments ---');
  const paymentsRes = await fetch(`${baseUrl}/api/payments`, { headers });
  const paymentsData = await paymentsRes.json();
  console.log(`Fetched ${paymentsData.payments?.length} payments. Summary:`, paymentsData.summary);
  if (!paymentsData.payments || paymentsData.payments.length === 0) {
    throw new Error('Failed to fetch payment records!');
  }
  console.log('✅ Step 2 PASSED: Payments listing & KPI summary retrieved.');

  // 3. Test Batch Generate Monthly Dues
  console.log('\n--- Step 3: POST /api/payments/generate-dues (September 2026) ---');
  const genRes = await fetch(`${baseUrl}/api/payments/generate-dues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ billingMonth: '2026-09' }),
  });
  const genData = await genRes.json();
  console.log('Generate Dues Status:', genRes.status, 'Message:', genData.message);
  if (genRes.status !== 200) throw new Error('Failed to batch generate dues: ' + JSON.stringify(genData));

  // Test duplicate prevention for the same month
  const dupGenRes = await fetch(`${baseUrl}/api/payments/generate-dues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ billingMonth: '2026-09' }),
  });
  const dupGenData = await dupGenRes.json();
  console.log('Duplicate Batch Attempt Status:', dupGenRes.status, 'Message:', dupGenData.message);
  if (dupGenData.result?.generatedCount !== 0) throw new Error('Duplicate billing records were created!');
  console.log('✅ Step 3 PASSED: Batch generator created bills and strictly prevented duplicates.');

  // 4. Find one of the generated September payments
  const septPayments = await prisma.monthlyPayment.findMany({
    where: { billingMonth: '2026-09' },
    include: { resident: true, room: true },
  });
  const testPayment = septPayments[0];
  console.log('\nSelected Test Payment for Sep 2026:', {
    id: testPayment.id,
    resident: testPayment.resident.fullName,
    room: testPayment.room.roomNumber,
    amount: testPayment.totalAmountDue,
    status: testPayment.status,
  });

  // 5. Test Edit Bill Line Items (PUT /api/payments/[id])
  console.log('\n--- Step 4: PUT /api/payments/[id] (Edit Bill Line Items) ---');
  const editRes = await fetch(`${baseUrl}/api/payments/${testPayment.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      rentAmount: testPayment.rentAmount,
      maintenanceAmount: 600, // modified
      penaltyAmount: 100,     // added late fee
      discountAmount: 200,   // added discount
      dueDate: new Date('2026-09-07').toISOString().slice(0, 10),
      notes: 'Custom discount applied by admin.',
    }),
  });
  const editData = await editRes.json();
  console.log('Edit Bill Status:', editRes.status, 'New Total Due:', editData.payment?.totalAmountDue);
  const expectedTotal = testPayment.rentAmount + 600 + 100 - 200;
  if (editData.payment?.totalAmountDue !== expectedTotal) {
    throw new Error('Edited bill total calculation mismatch!');
  }
  console.log('✅ Step 4 PASSED: Bill line items edited and recalculated accurately.');

  // 6. Test Status Transitions (PATCH /api/payments/[id])
  console.log('\n--- Step 5: PATCH /api/payments/[id] (Mark OVERDUE) ---');
  const overdueRes = await fetch(`${baseUrl}/api/payments/${testPayment.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'OVERDUE', notes: 'Grace period expired.' }),
  });
  const overdueData = await overdueRes.json();
  console.log('Overdue Status Update:', overdueRes.status, 'Payment Status:', overdueData.payment?.status);
  if (overdueData.payment?.status !== 'OVERDUE') throw new Error('Failed to update status to OVERDUE!');

  console.log('\n--- Step 6: POST /api/payments (Record Paid & Issue Receipt) ---');
  const recordRes = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthlyPaymentId: testPayment.id,
      amountPaid: expectedTotal,
      paymentDate: new Date('2026-09-06').toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      transactionReference: 'UPI/20260906/8899771122',
      notes: 'Verified via bank app lookup.',
    }),
  });
  const recordData = await recordRes.json();
  console.log('Record Payment Status:', recordRes.status, {
    receiptNumber: recordData.receiptNumber,
    newStatus: recordData.newStatus,
  });
  if (recordRes.status !== 201 || !recordData.receiptNumber) {
    throw new Error('Failed to record payment and issue receipt!');
  }
  console.log('✅ Step 6 PASSED: Payment marked as PAID and official receipt generated.');

  // 7. Verify Get Single Payment Details
  console.log('\n--- Step 7: GET /api/payments/[id] ---');
  const getSingleRes = await fetch(`${baseUrl}/api/payments/${testPayment.id}`, { headers });
  const singleData = await getSingleRes.json();
  console.log('Fetched single payment:', {
    id: singleData.payment?.id,
    resident: singleData.payment?.resident?.fullName,
    status: singleData.payment?.status,
    receiptNo: singleData.payment?.receiptNumber,
    recordsCount: singleData.payment?.paymentRecords?.length,
  });
  if (singleData.payment?.status !== 'PAID' || singleData.payment?.paymentRecords?.length === 0) {
    throw new Error('Payment verification details missing!');
  }
  console.log('✅ Step 7 PASSED: Payment details & receipt verified.');

  console.log('\n🎉 ALL PHASE 6 MONTHLY PAYMENT MANAGEMENT TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
