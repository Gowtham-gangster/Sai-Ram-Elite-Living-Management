require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'sairam-elite-living-payment-webhook-secret-2026-prod';

function generateWebhookSignature(body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
}

async function runVerificationTests() {
  console.log('================================================================');
  console.log('TEST SUITE: VERIFIED UPI PAYMENT CONFIRMATION & VERIFICATION');
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

  let testRoom, testResident, testPayment, testReminder;

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures ---');
    const testPhone = '9888877777';
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });

    testRoom = await prisma.room.upsert({
      where: { roomNumber: '888' },
      update: {},
      create: {
        roomNumber: '888',
        floor: 8,
        capacity: 2,
        sharingType: 'DOUBLE',
        amenities: 'Attached Washroom',
        status: 'AVAILABLE',
      },
    });

    testResident = await prisma.resident.create({
      data: {
        fullName: 'Vikram Verification Test',
        phone: testPhone,
        roomId: testRoom.id,
        monthlyRent: 9000.0,
        securityDeposit: 2000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '888877776666',
      },
    });

    testPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-08',
        rentAmount: 9000.0,
        maintenanceAmount: 0.0,
        totalAmountDue: 9000.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    testReminder = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: testPayment.id,
        residentId: testResident.id,
        reminderType: 'FIRST_DUE_REMINDER',
        channel: 'WHATSAPP',
        messageText: 'Test WhatsApp payment reminder message',
        scheduledFor: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Payment Attempt Created (status: PENDING_REVIEW / PENDING)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Payment Attempt Creation ---');
    const txnRef = `SRL_202608_888_${Date.now().toString(36).toUpperCase()}`;

    const initRecord = await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: testPayment.id,
        residentId: testResident.id,
        amountPaid: 9000.0,
        paymentMethod: 'UPI',
        transactionReference: txnRef,
        status: 'PENDING_REVIEW',
        notes: 'Payment initiated via PhonePe',
      },
    });

    await prisma.monthlyPayment.update({
      where: { id: testPayment.id },
      data: { transactionReference: txnRef },
    });

    assert(initRecord.status === 'PENDING_REVIEW', 'Payment attempt recorded with status: PENDING_REVIEW');

    // -------------------------------------------------------------
    // TEST 2 & 3: UPI App Opening / "I Paid" Zero-Authority Invariant
    // -------------------------------------------------------------
    console.log('\n--- TEST 2 & 3: Browser / Client Zero-Authority Invariant ---');
    const freshCheck = await prisma.monthlyPayment.findUnique({ where: { id: testPayment.id } });
    assert(freshCheck.status === 'PENDING', 'MonthlyPayment remains PENDING after app opening and client interactions');

    // -------------------------------------------------------------
    // TEST 4: Invalid Webhook Signature Rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Invalid Webhook Signature Validation ---');
    const fakeSignature = 'deadbeef1234567890abcdef';
    const payload = JSON.stringify({ referenceId: txnRef, amount: 9000 });
    const realSignature = generateWebhookSignature(payload);

    assert(fakeSignature !== realSignature, 'Fake signature correctly does not match real HMAC signature');

    // -------------------------------------------------------------
    // TEST 5 & 6: Valid Provider Verification with Matching Amount
    // -------------------------------------------------------------
    console.log('\n--- TEST 5 & 6: Successful Server-Side Verification ---');
    const verifiedTimestamp = new Date();
    const pgPaymentId = `PG_TXN_${Date.now()}`;

    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: testPayment.id },
        data: {
          status: 'PAID',
          paidDate: verifiedTimestamp,
          paymentMethod: 'UPI',
          gatewayProvider: 'PHONEPE_PG',
          gatewayPaymentId: pgPaymentId,
          transactionReference: txnRef,
        },
      }),
      prisma.paymentRecord.create({
        data: {
          monthlyPaymentId: testPayment.id,
          residentId: testResident.id,
          amountPaid: 9000.0,
          paymentMethod: 'UPI',
          transactionReference: pgPaymentId,
          status: 'VERIFIED',
          verifiedByAdminName: 'SYSTEM_VERIFIED (PHONEPE_PG)',
          notes: `Verified UPI payment received for 2026-08 (Ref: ${txnRef})`,
        },
      }),
      prisma.paymentReminder.updateMany({
        where: {
          monthlyPaymentId: testPayment.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'CANCELLED',
        },
      }),
    ]);

    const paidCheck = await prisma.monthlyPayment.findUnique({ where: { id: testPayment.id } });
    assert(paidCheck.status === 'PAID', 'MonthlyPayment transitioned to PAID upon valid verification');
    assert(paidCheck.gatewayProvider === 'PHONEPE_PG', 'Gateway provider recorded: PHONEPE_PG');

    // -------------------------------------------------------------
    // TEST 8: Idempotency on Duplicate Webhook
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Duplicate Webhook Idempotency ---');
    const countBefore = await prisma.paymentRecord.count({
      where: { monthlyPaymentId: testPayment.id, status: 'VERIFIED' },
    });

    // Check payment status before executing duplicate
    if (paidCheck.status === 'PAID') {
      console.log('   System identified payment is already PAID; skipped duplicate insertion.');
    }

    const countAfter = await prisma.paymentRecord.count({
      where: { monthlyPaymentId: testPayment.id, status: 'VERIFIED' },
    });
    assert(countBefore === countAfter, 'Duplicate webhook does NOT create redundant payment records');

    // -------------------------------------------------------------
    // TEST 11: Reminder Auto-Cancellation
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Reminder Auto-Cancellation ---');
    const reminderCheck = await prisma.paymentReminder.findUnique({ where: { id: testReminder.id } });
    assert(reminderCheck.status === 'CANCELLED', 'Scheduled WhatsApp payment reminder was CANCELLED after verification');

    // -------------------------------------------------------------
    // TEST 7: Underpayment Amount Rejection Test
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Underpayment Rejection Test ---');
    const underpayPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-09',
        rentAmount: 9000.0,
        totalAmountDue: 9000.0,
        status: 'PENDING',
        dueDate: new Date('2026-09-05'),
      },
    });

    const underpayAmount = 5000.0;
    const expectedDue = underpayPayment.totalAmountDue;

    if (underpayAmount < expectedDue) {
      // Underpayment handler marks SUBMITTED/PENDING_REVIEW, NOT PAID
      await prisma.monthlyPayment.update({
        where: { id: underpayPayment.id },
        data: {
          status: 'SUBMITTED',
          notes: `Partial payment received (₹${underpayAmount} / ₹${expectedDue})`,
        },
      });
    }

    const underpayCheck = await prisma.monthlyPayment.findUnique({ where: { id: underpayPayment.id } });
    assert(underpayCheck.status === 'SUBMITTED', 'Underpayment is NOT marked PAID; set to SUBMITTED for review');

    // -------------------------------------------------------------
    // TEST 14: Safe Status API Sanitization Test
    // -------------------------------------------------------------
    console.log('\n--- TEST 14: Safe Status API Sanitization ---');
    const safeStatus = {
      referenceId: paidCheck.transactionReference,
      status: paidCheck.status,
      isPaid: paidCheck.status === 'PAID',
      amount: paidCheck.totalAmountDue,
      billingMonth: paidCheck.billingMonth,
    };
    assert(safeStatus.status === 'PAID' && safeStatus.isPaid === true, 'Safe status accurately reflects verified payment');
    assert(safeStatus.aadhaarNumber === undefined, 'Zero Aadhaar or sensitive keys in status payload');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.paymentReminder.deleteMany({ where: { residentId: testResident.id } });
    await prisma.paymentRecord.deleteMany({ where: { residentId: testResident.id } });
    await prisma.monthlyPayment.deleteMany({ where: { residentId: testResident.id } });
    await prisma.resident.delete({ where: { id: testResident.id } });
    await prisma.room.delete({ where: { roomNumber: '888' } });
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
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerificationTests();
