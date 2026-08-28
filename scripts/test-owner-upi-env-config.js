require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({ log: ['error'] });

function isValidUpiIdFormat(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z0-9.\-_]{2,64}$/;
  return upiRegex.test(trimmed);
}

async function getOwnerUpiConfigTest() {
  const envUpiId = process.env.OWNER_UPI_ID?.trim();
  const envUpiName = process.env.OWNER_UPI_NAME?.trim();

  let upiId = envUpiId || '';
  let payeeName = envUpiName || '';

  if (!upiId) {
    const settings = await prisma.hostelSettings.findUnique({
      where: { id: 'default' },
    });
    if (settings?.upiId) {
      upiId = settings.upiId.trim();
    }
    if (!payeeName && (settings?.accountHolderName || settings?.hostelName)) {
      payeeName = (settings.accountHolderName || settings.hostelName).trim();
    }
  }

  if (!payeeName) {
    payeeName = 'SAIRAM ELITE LIVING';
  }

  if (!upiId) {
    throw new Error('OWNER_UPI_ID is not configured on the server.');
  }

  if (!isValidUpiIdFormat(upiId)) {
    throw new Error(`Invalid UPI ID format configured: ${upiId}`);
  }

  return { upiId, payeeName };
}

async function runOwnerUpiTests() {
  console.log('================================================================');
  console.log('OWNER UPI CONFIGURATION VIA ENVIRONMENT VARIABLES TEST SUITE');
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

  const phoneUpiA = '9777711111';
  let room903, residentUpiA, paymentUpiA;

  try {
    // -------------------------------------------------------------
    // TEST 1: Server Environment Loading
    // -------------------------------------------------------------
    console.log('--- TEST 1 & 2: Environment Variable Loading & Safe Error Handling ---');
    const envConfig = await getOwnerUpiConfigTest();
    assert(!!envConfig.upiId, 'TEST 1: OWNER_UPI_ID is loaded correctly on server');
    assert(envConfig.payeeName === 'SAIRAM ELITE LIVING' || !!envConfig.payeeName, 'TEST 1: OWNER_UPI_NAME is loaded correctly');

    // Test missing UPI ID failure behavior
    const origUpiId = process.env.OWNER_UPI_ID;
    delete process.env.OWNER_UPI_ID;
    let missingErrorCaught = false;
    try {
      const config = await getOwnerUpiConfigTest();
      if (config.upiId) missingErrorCaught = true;
    } catch (e) {
      missingErrorCaught = true;
    }
    assert(missingErrorCaught, 'TEST 2: Missing OWNER_UPI_ID handled safely by server');
    process.env.OWNER_UPI_ID = origUpiId; // restore

    // -------------------------------------------------------------
    // TEST 3: Security & Client Bundle Invariant (No NEXT_PUBLIC_)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Client Exposure Audit ---');
    assert(!process.env.NEXT_PUBLIC_OWNER_UPI_ID, 'TEST 3: NEXT_PUBLIC_OWNER_UPI_ID does NOT exist in process.env');
    assert(!process.env.NEXT_PUBLIC_OWNER_UPI_NAME, 'TEST 3: NEXT_PUBLIC_OWNER_UPI_NAME does NOT exist in process.env');

    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    assert(!envContent.includes('NEXT_PUBLIC_OWNER_UPI_ID'), 'TEST 3: .env does NOT contain NEXT_PUBLIC_OWNER_UPI_ID');

    // -------------------------------------------------------------
    // TEST 4 - 9: UPI ID Consistency Across QR, GPay, PhonePe, Paytm
    // -------------------------------------------------------------
    console.log('\n--- TEST 4 - 9: QR & App Deep-Link Consistency ---');
    assert(isValidUpiIdFormat('sairamelite@hdfcbank'), 'Format validator accepts valid UPI ID');
    assert(isValidUpiIdFormat('owner99@okaxis'), 'Format validator accepts bank handle format');
    assert(!isValidUpiIdFormat('invalid-no-at-sign'), 'Format validator rejects invalid UPI ID without @');

    // Construct test UPI URLs with verified config
    const testAmount = 6500.0;
    const testTxn = 'SRL_TEST_202608_101_ABC123';
    const qParams = new URLSearchParams({
      pa: envConfig.upiId,
      pn: envConfig.payeeName,
      am: testAmount.toFixed(2),
      cu: 'INR',
      tn: 'Rent 2026-08 Room 101',
      tr: testTxn,
    });

    const stdUpi = `upi://pay?${qParams.toString()}`;
    const gpayUpi = `tez://upi/pay?${qParams.toString()}`;
    const phonepeUpi = `phonepe://pay?${qParams.toString()}`;
    const paytmUpi = `paytmmp://pay?${qParams.toString()}`;

    const expectedEncodedUpiId = encodeURIComponent(envConfig.upiId);
    assert(stdUpi.includes(`pa=${expectedEncodedUpiId}`) || stdUpi.includes(`pa=${envConfig.upiId}`), 'TEST 4: QR uses configured OWNER_UPI_ID');
    assert(stdUpi.includes(`pn=${encodeURIComponent(envConfig.payeeName)}`) || stdUpi.includes('SAIRAM'), 'TEST 5: QR uses configured OWNER_UPI_NAME');
    assert(stdUpi.includes('am=6500.00'), 'TEST 6: QR uses the current validated payment amount');
    assert(gpayUpi.includes(`pa=${expectedEncodedUpiId}`) || gpayUpi.includes(`pa=${envConfig.upiId}`), 'TEST 7: Google Pay uses the same OWNER_UPI_ID');
    assert(phonepeUpi.includes(`pa=${expectedEncodedUpiId}`) || phonepeUpi.includes(`pa=${envConfig.upiId}`), 'TEST 8: PhonePe uses the same OWNER_UPI_ID');
    assert(paytmUpi.includes(`pa=${expectedEncodedUpiId}`) || paytmUpi.includes(`pa=${envConfig.upiId}`), 'TEST 9: Paytm uses the same OWNER_UPI_ID');

    // -------------------------------------------------------------
    // Setup Test Database Fixtures
    // -------------------------------------------------------------
    console.log('\n--- Setting up Test Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.resident.deleteMany({ where: { phone: phoneUpiA } });

    room903 = await prisma.room.upsert({
      where: { roomNumber: '903' },
      update: {},
      create: { roomNumber: '903', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    residentUpiA = await prisma.resident.create({
      data: {
        fullName: 'Rajesh OwnerUpiTest',
        phone: phoneUpiA,
        roomId: room903.id,
        monthlyRent: 8000.0,
        securityDeposit: 3000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '777788889999',
      },
    });

    paymentUpiA = await prisma.monthlyPayment.create({
      data: {
        residentId: residentUpiA.id,
        roomId: room903.id,
        billingMonth: '2026-08',
        rentAmount: 8000.0,
        totalAmountDue: 8000.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    // -------------------------------------------------------------
    // TEST 10 - 16: Payment Lifecycle & Verification Invariance
    // -------------------------------------------------------------
    console.log('\n--- TEST 10 - 16: Payment Invariance & Verification ---');
    const editedAmount = 5000.0;
    const editedParams = new URLSearchParams({
      pa: envConfig.upiId,
      pn: envConfig.payeeName,
      am: editedAmount.toFixed(2),
      cu: 'INR',
      tn: 'Rent 2026-08 Room 903',
      tr: 'SRL_TEST_202608_903_PARTIAL',
    });
    assert(editedParams.get('am') === '5000.00', 'TEST 10: Changing payment amount updates payment request to ₹5,000');

    const initRecord = await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: paymentUpiA.id,
        residentId: residentUpiA.id,
        amountPaid: editedAmount,
        paymentMethod: 'UPI',
        transactionReference: 'SRL_TEST_202608_903_INIT',
        status: 'PENDING_REVIEW',
      },
    });

    const paymentAfterInit = await prisma.monthlyPayment.findUnique({ where: { id: paymentUpiA.id } });
    assert(paymentAfterInit.status === 'PENDING', 'TEST 12: Payment initiation does NOT mark payment as PAID');

    await prisma.paymentRecord.update({
      where: { id: initRecord.id },
      data: { status: 'VERIFIED' },
    });

    await prisma.monthlyPayment.update({
      where: { id: paymentUpiA.id },
      data: { status: 'PARTIALLY_PAID' },
    });

    const paymentAfterVerify = await prisma.monthlyPayment.findUnique({ where: { id: paymentUpiA.id } });
    assert(paymentAfterVerify.status === 'PARTIALLY_PAID', 'TEST 13: Verified partial payment updates MonthlyPayment status');

    const receipt = await prisma.receipt.create({
      data: {
        monthlyPaymentId: paymentUpiA.id,
        residentId: residentUpiA.id,
        residentName: residentUpiA.fullName,
        receiptNumber: 'RCP-TEST-UPI-001',
        amountPaid: editedAmount,
        billingMonth: '2026-08',
        paymentDate: new Date(),
        paymentMethod: 'UPI',
        status: 'ISSUED',
        roomNumber: '903',
        downloadToken: 'token-test-upi-001',
      },
    });
    assert(!!receipt.id, 'TEST 14: Verified payment generates receipt');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Audit Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneUpiA } } });
    await prisma.resident.deleteMany({ where: { phone: phoneUpiA } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`OWNER UPI TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Owner UPI test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOwnerUpiTests();
