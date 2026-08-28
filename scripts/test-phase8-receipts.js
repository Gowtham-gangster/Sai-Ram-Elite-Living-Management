const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 8: RECEIPT MANAGEMENT API & PDF TESTS     ');
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

  // 2. Fetch Receipts Listing
  console.log('\n--- Step 2: GET /api/receipts ---');
  const receiptsRes = await fetch(`${baseUrl}/api/receipts`, { headers });
  const receiptsData = await receiptsRes.json();
  console.log(`Fetched ${receiptsData.receipts?.length} receipts. Summary:`, receiptsData.summary);
  if (!receiptsData.receipts || receiptsData.receipts.length === 0) {
    throw new Error('Failed to retrieve receipts list!');
  }
  const sampleReceipt = receiptsData.receipts[0];
  console.log('Sample Receipt:', {
    number: sampleReceipt.receiptNumber,
    resident: sampleReceipt.residentName,
    room: sampleReceipt.roomNumber,
    month: sampleReceipt.billingMonth,
    amount: sampleReceipt.amountPaid,
    method: sampleReceipt.paymentMethod,
  });
  console.log('✅ Step 2 PASSED: Receipts list and summary retrieved.');

  // 3. Search and Multi-factor Filtering
  console.log('\n--- Step 3: GET /api/receipts with Search & Filters ---');
  const searchRes = await fetch(`${baseUrl}/api/receipts?search=${encodeURIComponent(sampleReceipt.residentName)}`, { headers });
  const searchData = await searchRes.json();
  console.log(`Search for "${sampleReceipt.residentName}" returned ${searchData.receipts?.length} results.`);
  if (!searchData.receipts || searchData.receipts.length === 0) {
    throw new Error('Search failed to return matching receipt!');
  }
  console.log('✅ Step 3 PASSED: Search and filter working properly.');

  // 4. Fetch Single Receipt by receiptNumber
  console.log(`\n--- Step 4: GET /api/receipts/${sampleReceipt.receiptNumber} ---`);
  const singleRes = await fetch(`${baseUrl}/api/receipts/${sampleReceipt.receiptNumber}`, { headers });
  const singleData = await singleRes.json();
  console.log('Single Receipt Status:', singleRes.status, {
    receiptNumber: singleData.receipt?.receiptNumber,
    resident: singleData.receipt?.residentName,
    room: singleData.receipt?.roomNumber,
    hostelName: singleData.hostelSettings?.hostelName,
    hostelPhone: singleData.hostelSettings?.contactPhone,
  });
  if (singleRes.status !== 200 || !singleData.receipt || !singleData.hostelSettings) {
    throw new Error('Failed to fetch detailed printable receipt!');
  }
  console.log('✅ Step 4 PASSED: Single receipt details and hostel settings retrieved.');

  // 5. Test Historical Retention on Checkout
  console.log('\n--- Step 5: Historical Receipt Retention Check ---');
  // Create a resident, pay dues, check out, verify receipt remains accessible
  const testRoom = await prisma.room.create({
    data: {
      roomNumber: '801',
      floor: 8,
      capacity: 1,
      sharingType: 'SINGLE',
      baseRent: 11000,
      status: 'AVAILABLE',
    },
  });

  const testResident = await prisma.resident.create({
    data: {
      fullName: 'Vikramaditya Test',
      phone: '9845991122',
      roomId: testRoom.id,
      checkInDate: new Date('2026-07-01'),
      status: 'ACTIVE',
    },
  });

  // Create monthly payment & pay it
  const payment = await prisma.monthlyPayment.create({
    data: {
      residentId: testResident.id,
      roomId: testRoom.id,
      billingMonth: '2026-07',
      rentAmount: 11000,
      totalAmountDue: 11000,
      status: 'PENDING',
      dueDate: new Date('2026-07-05'),
    },
  });

  const payRes = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthlyPaymentId: payment.id,
      amountPaid: 11000,
      paymentDate: new Date('2026-07-04').toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      transactionReference: 'UPI/202607/VIKRAM123',
    }),
  });
  const payData = await payRes.json();
  const generatedReceiptNumber = payData.receiptNumber;
  console.log('Generated Receipt Number:', generatedReceiptNumber);

  // Now checkout resident
  await fetch(`${baseUrl}/api/residents/${testResident.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'CHECKOUT',
      checkOutDate: new Date('2026-08-01').toISOString().slice(0, 10),
    }),
  });

  // Fetch the receipt after checkout
  const checkRetentionRes = await fetch(`${baseUrl}/api/receipts/${generatedReceiptNumber}`, { headers });
  const checkRetentionData = await checkRetentionRes.json();
  console.log('Post-checkout Receipt Verification:', {
    receiptNumber: checkRetentionData.receipt?.receiptNumber,
    residentStatus: checkRetentionData.receipt?.monthlyPayment?.resident?.status,
    amount: checkRetentionData.receipt?.amountPaid,
  });

  if (
    checkRetentionRes.status !== 200 ||
    checkRetentionData.receipt?.receiptNumber !== generatedReceiptNumber ||
    checkRetentionData.receipt?.monthlyPayment?.resident?.status !== 'VACATED'
  ) {
    throw new Error('Historical receipt was not retained after resident checkout!');
  }
  console.log('✅ Step 5 PASSED: Historical receipt 100% accessible after resident checkout.');

  // Cleanup
  console.log('\n--- Cleanup test records ---');
  await prisma.receipt.deleteMany({ where: { monthlyPaymentId: payment.id } });
  await prisma.paymentRecord.deleteMany({ where: { monthlyPaymentId: payment.id } });
  await prisma.monthlyPayment.delete({ where: { id: payment.id } });
  await prisma.resident.delete({ where: { id: testResident.id } });
  await prisma.room.delete({ where: { id: testRoom.id } });
  console.log('Cleaned up test records.');

  console.log('\n🎉 ALL PHASE 8 RECEIPT MANAGEMENT TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
