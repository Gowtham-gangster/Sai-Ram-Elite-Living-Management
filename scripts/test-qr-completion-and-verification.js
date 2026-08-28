require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

async function runQrCompletionAndVerificationTests() {
  console.log('================================================================');
  console.log('QR UPI PAYMENT COMPLETION & VERIFICATION TEST SUITE');
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

  const phoneQ = '9777766666';
  let room905, residentQ, paymentQ, reminder1, reminder2;

  try {
    // -------------------------------------------------------------
    // Setup Test Database Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up Test Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.resident.deleteMany({ where: { phone: phoneQ } });

    room905 = await prisma.room.upsert({
      where: { roomNumber: '905' },
      update: {},
      create: { roomNumber: '905', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    residentQ = await prisma.resident.create({
      data: {
        fullName: 'Sameer QrTest',
        phone: phoneQ,
        roomId: room905.id,
        monthlyRent: 8500.0,
        securityDeposit: 3000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '777788889999',
      },
    });

    paymentQ = await prisma.monthlyPayment.create({
      data: {
        residentId: residentQ.id,
        roomId: room905.id,
        billingMonth: '2026-08',
        rentAmount: 8500.0,
        totalAmountDue: 8500.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    reminder1 = await prisma.paymentReminder.create({
      data: {
        residentId: residentQ.id,
        monthlyPaymentId: paymentQ.id,
        reminderType: 'FIRST_DUE_REMINDER',
        status: 'PENDING',
        scheduledFor: new Date('2026-08-05'),
        messageText: 'First payment reminder for Room 905',
      },
    });

    reminder2 = await prisma.paymentReminder.create({
      data: {
        residentId: residentQ.id,
        monthlyPaymentId: paymentQ.id,
        reminderType: 'SECOND_REMINDER',
        status: 'PENDING',
        scheduledFor: new Date('2026-08-07'),
        messageText: 'Second payment reminder for Room 905',
      },
    });

    const txnRef = `SRL_202608_905_${Date.now().toString(36).toUpperCase()}_TEST`;
    console.log(`Fixtures ready. Test Transaction Ref: ${txnRef}\n`);

    // -------------------------------------------------------------
    // TEST 14: Unverified QR payment remains PENDING
    // -------------------------------------------------------------
    console.log('--- TEST: Unverified QR Payment Invariance ---');
    await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: paymentQ.id,
        residentId: residentQ.id,
        amountPaid: 8500.0,
        paymentMethod: 'UPI',
        transactionReference: txnRef,
        status: 'PENDING_REVIEW',
      },
    });

    const checkPending = await prisma.monthlyPayment.findUnique({ where: { id: paymentQ.id } });
    assert(checkPending.status === 'PENDING', 'TEST 14: Unverified QR payment remains PENDING');

    const checkRemindersPending = await prisma.paymentReminder.findMany({
      where: { monthlyPaymentId: paymentQ.id, status: 'PENDING' },
    });
    assert(checkRemindersPending.length === 2, 'TEST 14: Unverified QR payment does not cancel reminders');

    // -------------------------------------------------------------
    // TEST 13: Incorrect Transaction ID cannot verify payment
    // -------------------------------------------------------------
    console.log('\n--- TEST: Incorrect Transaction Reference ---');
    const { testProcessVerifiedPayment } = require('./test-qr-helper');
    const badRefResult = await testProcessVerifiedPayment({
      referenceId: 'NON_EXISTENT_REF_999999',
      gatewayPaymentId: 'NON_EXISTENT_REF_999999',
      amountPaid: 8500.0,
      paymentMethod: 'UPI',
      gatewayProvider: 'UPI_GATEWAY',
      paymentDate: new Date(),
    });
    assert(badRefResult.success === false, 'TEST 13: Incorrect transaction ID cannot become PAID');

    // -------------------------------------------------------------
    // TEST 1 - 7: Authoritative Payment Verification Workflow
    // -------------------------------------------------------------
    console.log('\n--- TEST: Authoritative Verification & Receipt Generation ---');
    const validVerifyResult = await testProcessVerifiedPayment({
      referenceId: txnRef,
      gatewayPaymentId: `BANK_UTR_${Date.now()}`,
      amountPaid: 8500.0,
      paymentMethod: 'UPI',
      gatewayProvider: 'UPI_GATEWAY',
      paymentDate: new Date(),
    });

    assert(validVerifyResult.success === true, 'TEST 1: Authoritative verification succeeds');
    assert(validVerifyResult.isPaid === true, 'TEST 1: MonthlyPayment transitioned to PAID');

    const paymentAfterPaid = await prisma.monthlyPayment.findUnique({ where: { id: paymentQ.id } });
    assert(paymentAfterPaid.status === 'PAID', 'TEST 1: Database status is PAID');
    assert(!!paymentAfterPaid.paidDate, 'TEST 1: paidDate is recorded');

    // TEST 2: PaymentRecord created with status VERIFIED
    const verifiedRecord = await prisma.paymentRecord.findFirst({
      where: { monthlyPaymentId: paymentQ.id, status: 'VERIFIED' },
    });
    assert(!!verifiedRecord, 'TEST 2: PaymentRecord created with status VERIFIED');

    // TEST 3, 5, 6: Receipt generated with downloadToken
    const receipt = await prisma.receipt.findFirst({
      where: { monthlyPaymentId: paymentQ.id },
    });
    assert(!!receipt, 'TEST 3: Official Receipt created');
    assert(!!receipt.receiptNumber, 'TEST 3: Receipt has unique receiptNumber');
    assert(!!receipt.downloadToken, 'TEST 5 & 6: Receipt has secure downloadToken');

    // TEST 8 & 9: Reminders cancelled on PAID
    const cancelledReminders = await prisma.paymentReminder.findMany({
      where: { monthlyPaymentId: paymentQ.id, status: 'CANCELLED' },
    });
    assert(cancelledReminders.length === 2, 'TEST 8 & 9: All pending reminders cancelled upon PAID settlement');

    // -------------------------------------------------------------
    // TEST 10 & 11: Idempotency Guards
    // -------------------------------------------------------------
    console.log('\n--- TEST: Verification Idempotency ---');
    const duplicateVerifyResult = await testProcessVerifiedPayment({
      referenceId: txnRef,
      gatewayPaymentId: validVerifyResult.gatewayPaymentId,
      amountPaid: 8500.0,
      paymentMethod: 'UPI',
      gatewayProvider: 'UPI_GATEWAY',
      paymentDate: new Date(),
    });

    assert(duplicateVerifyResult.isDuplicate === true, 'TEST 10 & 11: Duplicate verification detected as duplicate');
    assert(duplicateVerifyResult.receiptNumber === receipt.receiptNumber, 'TEST 10: Returns existing receipt');

    const verifiedRecordsCount = await prisma.paymentRecord.count({
      where: { monthlyPaymentId: paymentQ.id, status: 'VERIFIED' },
    });
    assert(verifiedRecordsCount === 1, 'TEST 11: No duplicate PaymentRecord created');

    const receiptsCount = await prisma.receipt.count({
      where: { monthlyPaymentId: paymentQ.id },
    });
    assert(receiptsCount === 1, 'TEST 10: No duplicate Receipt created');

    // -------------------------------------------------------------
    // TEST 16: Resident Receipts Listing
    // -------------------------------------------------------------
    console.log('\n--- TEST: Resident Receipts Listing ---');
    const residentReceipts = await prisma.receipt.findMany({
      where: { residentId: residentQ.id },
      orderBy: { paymentDate: 'desc' },
    });
    assert(residentReceipts.length === 1, 'TEST 16: Resident receipt list displays receipt after login');
    assert(residentReceipts[0].amountPaid === 8500.0, 'TEST 16: Receipt amount matches paid amount');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneQ } } });
    await prisma.resident.deleteMany({ where: { phone: phoneQ } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`QR PAYMENT COMPLETION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('QR completion test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runQrCompletionAndVerificationTests();
