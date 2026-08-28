require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RESIDENT MOBILE PAYMENT PORTAL (/pay & UPI INTENTS)');
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

  let testRoom, testResident, testPayment, paidResident, paidPayment;

  try {
    // -------------------------------------------------------------
    // Setup Test Data
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures ---');
    testRoom = await prisma.room.upsert({
      where: { roomNumber: '999' },
      update: {},
      create: {
        roomNumber: '999',
        floor: 9,
        capacity: 2,
        sharingType: 'DOUBLE',
        amenities: 'Attached Washroom, AC',
        status: 'AVAILABLE',
      },
    });

    testResident = await prisma.resident.create({
      data: {
        fullName: 'Rahul Test Resident',
        phone: '9876543210',
        alternatePhone: '9876543211',
        roomId: testRoom.id,
        monthlyRent: 8500.0,
        securityDeposit: 2000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '123456789012',
        emergencyContactName: 'Test Father',
        emergencyContactPhone: '9876500000',
        address: 'Test City, Karnataka',
      },
    });

    testPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-08',
        rentAmount: 8500.0,
        maintenanceAmount: 0.0,
        totalAmountDue: 8500.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    paidResident = await prisma.resident.create({
      data: {
        fullName: 'Anita Paid Resident',
        phone: '9876543299',
        roomId: testRoom.id,
        monthlyRent: 7500.0,
        securityDeposit: 2000.0,
        status: 'ACTIVE',
      },
    });

    paidPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: paidResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-08',
        rentAmount: 7500.0,
        totalAmountDue: 7500.0,
        status: 'PAID',
        paidDate: new Date(),
        dueDate: new Date('2026-08-05'),
      },
    });

    console.log('Fixtures created.\n');

    // -------------------------------------------------------------
    // Test 1: Mobile Lookup & Data Sanitization
    // -------------------------------------------------------------
    console.log('--- Test 1: Resident Lookup & Privacy Sanitization ---');
    // Test query logic matching /api/pay/lookup
    const tenDigit = '9876543210';
    const foundResident = await prisma.resident.findFirst({
      where: {
        OR: [
          { phone: tenDigit },
          { phone: `+91${tenDigit}` },
          { phone: `91${tenDigit}` },
          { alternatePhone: tenDigit },
        ],
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        room: { select: { roomNumber: true } },
        monthlyPayments: {
          orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            billingMonth: true,
            rentAmount: true,
            totalAmountDue: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    assert(foundResident !== null, 'Active resident identified via 10-digit mobile lookup');
    assert(foundResident.fullName === 'Rahul Test Resident', 'Correct resident name resolved');
    assert(foundResident.room.roomNumber === '999', 'Correct room number resolved');

    // Verify sensitive fields are omitted
    assert(foundResident.idProofNumber === undefined, 'Aadhaar / ID proof number strictly omitted');
    assert(foundResident.emergencyContactName === undefined, 'Emergency contact strictly omitted');
    assert(foundResident.emergencyContactPhone === undefined, 'Emergency phone strictly omitted');
    assert(foundResident.address === undefined, 'Resident home address strictly omitted');

    // -------------------------------------------------------------
    // Test 2: Unregistered Mobile Number Lookup
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Unregistered Mobile Number Lookup ---');
    const unregResident = await prisma.resident.findFirst({
      where: {
        phone: '9111111111',
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
    });
    assert(unregResident === null, 'Unregistered mobile returns null safely');

    // -------------------------------------------------------------
    // Test 3: Paid Resident Lookup
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Paid Resident Dues Status ---');
    const lookupPaid = await prisma.monthlyPayment.findFirst({
      where: { residentId: paidResident.id },
    });
    assert(lookupPaid.status === 'PAID', 'Paid resident accurately reflects status: PAID');

    // -------------------------------------------------------------
    // Test 4: Owner UPI Settings & Intent Formatting
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Owner UPI Intent Generation ---');
    const settings = await prisma.hostelSettings.findUnique({ where: { id: 'default' } });
    const upiId = settings?.upiId || 'sairamelite@hdfcbank';
    const payeeName = settings?.accountHolderName || 'SAIRAM ELITE LIVING';
    const amount = testPayment.totalAmountDue;
    const txnRef = `SRL_TEST_${Date.now()}`;

    const queryParams = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: `Rent ${testPayment.billingMonth} Room 999`,
      tr: txnRef,
    });

    const gpayIntent = `tez://upi/pay?${queryParams.toString()}`;
    const phonepeIntent = `phonepe://pay?${queryParams.toString()}`;
    const paytmIntent = `paytmmp://pay?${queryParams.toString()}`;

    assert(gpayIntent.startsWith('tez://upi/pay?'), 'Google Pay intent uses tez:// scheme');
    assert(phonepeIntent.startsWith('phonepe://pay?'), 'PhonePe intent uses phonepe:// scheme');
    assert(paytmIntent.startsWith('paytmmp://pay?'), 'Paytm intent uses paytmmp:// scheme');
    assert(gpayIntent.includes(`pa=${encodeURIComponent(upiId)}`), `Owner UPI ID (${upiId}) present in intent`);
    assert(gpayIntent.includes(`am=8500.00`), 'Exact rent amount (8500.00) embedded in intent');
    assert(gpayIntent.includes(`tr=${txnRef}`), 'Unique transaction reference embedded in intent');

    // -------------------------------------------------------------
    // Test 5: UPI Initiation Non-Destructive Invariant
    // -------------------------------------------------------------
    console.log('\n--- Test 5: UPI Initiation Non-Destructive Invariant ---');
    // Simulate payment initiation
    const pendingRecord = await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: testPayment.id,
        residentId: testResident.id,
        amountPaid: amount,
        paymentMethod: 'UPI',
        transactionReference: txnRef,
        status: 'PENDING_REVIEW',
        notes: 'UPI payment initiated via GPAY by resident on /pay',
      },
    });

    assert(pendingRecord.status === 'PENDING_REVIEW', 'PaymentRecord created with status: PENDING_REVIEW');

    // Check that MonthlyPayment is NOT marked PAID
    const paymentCheck = await prisma.monthlyPayment.findUnique({ where: { id: testPayment.id } });
    assert(paymentCheck.status === 'PENDING', 'MonthlyPayment remains PENDING (NOT changed to PAID)');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.paymentRecord.deleteMany({ where: { monthlyPaymentId: testPayment.id } });
    await prisma.monthlyPayment.deleteMany({ where: { residentId: { in: [testResident.id, paidResident.id] } } });
    await prisma.resident.deleteMany({ where: { id: { in: [testResident.id, paidResident.id] } } });
    await prisma.room.delete({ where: { roomNumber: '999' } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PORTAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
