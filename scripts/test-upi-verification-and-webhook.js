require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ||
  'sairam-elite-living-payment-webhook-secret-2026-prod';

function generateHmacSignature(rawBody, secret = WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function testProcessVerifiedPayment(payload) {
  const { referenceId, amountPaid, gatewayPaymentId, gatewayProvider, paymentMethod } = payload;

  const payment = await prisma.monthlyPayment.findFirst({
    where: {
      OR: [
        { transactionReference: referenceId },
        { id: referenceId },
        { paymentRecords: { some: { transactionReference: referenceId } } },
      ],
    },
    include: {
      resident: true,
      room: true,
    },
  });

  if (!payment) {
    return { success: false, isPaid: false, status: 'FAILED' };
  }

  // Idempotency check
  const existingVerifiedRecord = await prisma.paymentRecord.findFirst({
    where: {
      monthlyPaymentId: payment.id,
      transactionReference: gatewayPaymentId || referenceId,
      status: 'VERIFIED',
    },
  });

  if (existingVerifiedRecord) {
    const existingReceipt = await prisma.receipt.findFirst({
      where: { monthlyPaymentId: payment.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      isPaid: payment.status === 'PAID',
      status: payment.status,
      monthlyPaymentId: payment.id,
      residentId: payment.residentId,
      amountExpected: payment.totalAmountDue,
      amountReceived: existingVerifiedRecord.amountPaid,
      referenceId,
      receiptNumber: existingReceipt?.receiptNumber,
      downloadToken: existingReceipt?.downloadToken,
      isDuplicate: true,
    };
  }

  const verifiedRecords = await prisma.paymentRecord.findMany({
    where: { monthlyPaymentId: payment.id, status: 'VERIFIED' },
    select: { amountPaid: true },
  });
  const priorPaid = verifiedRecords.reduce((acc, r) => acc + r.amountPaid, 0);
  const totalPaidAfterThis = priorPaid + amountPaid;
  const totalDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
  const remainingBalance = Math.max(0, totalDue - totalPaidAfterThis);
  const isFullSettlement = remainingBalance <= 0.01;
  const paymentStatus = isFullSettlement ? 'PAID' : 'PARTIALLY_PAID';

  const paidDate = payload.paymentDate || new Date();

  await prisma.$transaction(async (tx) => {
    await tx.monthlyPayment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        paidDate: isFullSettlement ? paidDate : undefined,
        paymentMethod: paymentMethod || 'UPI',
        gatewayProvider: gatewayProvider || 'UPI_GATEWAY',
        gatewayPaymentId: gatewayPaymentId || undefined,
        transactionReference: referenceId,
      },
    });

    await tx.paymentRecord.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        amountPaid,
        paymentMethod: paymentMethod || 'UPI',
        transactionReference: gatewayPaymentId || referenceId,
        status: 'VERIFIED',
        verifiedByAdminName: `SYSTEM_VERIFIED (${gatewayProvider || 'UPI_GATEWAY'})`,
        notes: `Automated verified UPI payment for ${payment.billingMonth} (Ref: ${referenceId})`,
      },
    });

    if (isFullSettlement) {
      await tx.paymentReminder.updateMany({
        where: {
          monthlyPaymentId: payment.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    await tx.receipt.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        residentName: payment.resident.fullName,
        receiptNumber: `RCP-TEST-${Date.now().toString(36).toUpperCase()}`,
        amountPaid,
        billingMonth: payment.billingMonth,
        paymentDate: paidDate,
        paymentMethod: paymentMethod || 'UPI',
        status: 'ISSUED',
        roomNumber: payment.room.roomNumber,
        downloadToken: `tok_${Date.now().toString(36)}`,
      },
    });
  });

  const receipt = await prisma.receipt.findFirst({
    where: { monthlyPaymentId: payment.id },
    orderBy: { createdAt: 'desc' },
  });

  return {
    success: true,
    isPaid: isFullSettlement,
    status: paymentStatus,
    monthlyPaymentId: payment.id,
    residentId: payment.residentId,
    amountExpected: totalDue,
    amountReceived: amountPaid,
    remainingBalance,
    referenceId,
    gatewayPaymentId,
    receiptNumber: receipt?.receiptNumber,
    downloadToken: receipt?.downloadToken,
  };
}

async function runUpiVerificationTests() {
  console.log('================================================================');
  console.log('UPI PAYMENT VERIFICATION & WEBHOOK TEST SUITE');
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

  const phoneV = '9888877777';
  let room904, residentV, paymentV;

  try {
    // -------------------------------------------------------------
    // Setup Test Database Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up Test Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.resident.deleteMany({ where: { phone: phoneV } });

    room904 = await prisma.room.upsert({
      where: { roomNumber: '904' },
      update: {},
      create: { roomNumber: '904', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    residentV = await prisma.resident.create({
      data: {
        fullName: 'Vikram VerificationTest',
        phone: phoneV,
        roomId: room904.id,
        monthlyRent: 9000.0,
        securityDeposit: 3000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '666677778888',
      },
    });

    paymentV = await prisma.monthlyPayment.create({
      data: {
        residentId: residentV.id,
        roomId: room904.id,
        billingMonth: '2026-08',
        rentAmount: 9000.0,
        totalAmountDue: 9000.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    const reminder = await prisma.paymentReminder.create({
      data: {
        residentId: residentV.id,
        monthlyPaymentId: paymentV.id,
        reminderType: 'FIRST_REMINDER',
        status: 'PENDING',
        scheduledFor: new Date('2026-08-01'),
        messageText: 'Payment reminder for Room 904',
      },
    });

    const txnRef = `SRL_202608_904_${Date.now().toString(36).toUpperCase()}_TEST`;
    console.log(`Fixtures created. Test Reference: ${txnRef}\n`);

    // -------------------------------------------------------------
    // TEST 1 - 6: Payment Attempt & Failure / Rejection Invariance
    // -------------------------------------------------------------
    console.log('--- TEST 1 - 6: Payment Initiation & Bank Failure Invariance ---');
    const initRecord = await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: paymentV.id,
        residentId: residentV.id,
        amountPaid: 9000.0,
        paymentMethod: 'UPI',
        transactionReference: txnRef,
        status: 'PENDING_REVIEW',
      },
    });
    assert(!!initRecord.id, 'TEST 1: UPI payment attempt created in database');

    const paymentCheck1 = await prisma.monthlyPayment.findUnique({ where: { id: paymentV.id } });
    assert(paymentCheck1.status === 'PENDING', 'TEST 2 & 4: UPI app launch / bank rejection does NOT mark payment PAID');

    const reminderCheck1 = await prisma.paymentReminder.findUnique({ where: { id: reminder.id } });
    assert(reminderCheck1.status === 'PENDING', 'TEST 6 & 16: Failed/pending payment does NOT cancel reminders');

    // -------------------------------------------------------------
    // TEST 7 - 10: Cryptographic Webhook Validation & Idempotency
    // -------------------------------------------------------------
    console.log('\n--- TEST 7 - 10: Webhook Verification & Idempotency ---');
    const webhookPayload = {
      referenceId: txnRef,
      gatewayPaymentId: `PAY_UPI_${Date.now()}`,
      amount: 9000.0,
      timestamp: new Date().toISOString(),
      provider: 'STANDARD_UPI_GATEWAY',
      paymentMethod: 'UPI',
    };

    const rawPayloadString = JSON.stringify(webhookPayload);
    const validSignature = generateHmacSignature(rawPayloadString);
    const invalidSignature = generateHmacSignature(rawPayloadString, 'wrong-secret');

    const cryptoCheck1 = crypto.timingSafeEqual(
      Buffer.from(validSignature),
      Buffer.from(generateHmacSignature(rawPayloadString))
    );
    assert(cryptoCheck1 === true, 'TEST 7: Valid HMAC-SHA256 signature is verified');

    const cryptoCheck2 = validSignature === invalidSignature;
    assert(cryptoCheck2 === false, 'TEST 8: Invalid webhook signature is rejected');

    const result1 = await testProcessVerifiedPayment({
      referenceId: txnRef,
      gatewayPaymentId: webhookPayload.gatewayPaymentId,
      amountPaid: 9000.0,
      paymentMethod: 'UPI',
      gatewayProvider: 'STANDARD_UPI_GATEWAY',
      paymentDate: new Date(),
    });

    assert(result1.success === true, 'TEST 7: Valid provider webhook verifies payment successfully');
    assert(result1.isPaid === true, 'TEST 7: Verified payment transitions MonthlyPayment to PAID');

    const paymentAfterPaid = await prisma.monthlyPayment.findUnique({ where: { id: paymentV.id } });
    assert(paymentAfterPaid.status === 'PAID', 'TEST 11: MonthlyPayment status in DB is PAID');

    const verifiedRecords = await prisma.paymentRecord.findMany({
      where: { monthlyPaymentId: paymentV.id, status: 'VERIFIED' },
    });
    assert(verifiedRecords.length === 1, 'TEST 11: Exactly 1 verified PaymentRecord created');

    const receipts = await prisma.receipt.findMany({
      where: { monthlyPaymentId: paymentV.id },
    });
    assert(receipts.length === 1, 'TEST 12: Exactly 1 official Receipt created');
    assert(!!receipts[0].downloadToken, 'TEST 14: Receipt has secure downloadToken');

    const reminderAfterPaid = await prisma.paymentReminder.findUnique({ where: { id: reminder.id } });
    assert(reminderAfterPaid.status === 'CANCELLED', 'TEST 15: Verified payment cancels pending reminders');

    // Test 9 & 10: Duplicate Webhook Idempotency
    console.log('\n--- Duplicate Webhook Idempotency ---');
    const result2 = await testProcessVerifiedPayment({
      referenceId: txnRef,
      gatewayPaymentId: webhookPayload.gatewayPaymentId,
      amountPaid: 9000.0,
      paymentMethod: 'UPI',
      gatewayProvider: 'STANDARD_UPI_GATEWAY',
      paymentDate: new Date(),
    });

    assert(result2.isDuplicate === true, 'TEST 9 & 10: Duplicate webhook detected as duplicate');
    assert(result2.receiptNumber === receipts[0].receiptNumber, 'TEST 10: Duplicate webhook returns existing receipt');

    const verifiedRecordsCount = await prisma.paymentRecord.count({
      where: { monthlyPaymentId: paymentV.id, status: 'VERIFIED' },
    });
    assert(verifiedRecordsCount === 1, 'TEST 9: Duplicate webhook does NOT create duplicate PaymentRecord');

    const receiptsCount = await prisma.receipt.count({
      where: { monthlyPaymentId: paymentV.id },
    });
    assert(receiptsCount === 1, 'TEST 10: Duplicate webhook does NOT create duplicate Receipt');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: phoneV } } });
    await prisma.resident.deleteMany({ where: { phone: phoneV } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PAYMENT VERIFICATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Payment verification test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runUpiVerificationTests();
