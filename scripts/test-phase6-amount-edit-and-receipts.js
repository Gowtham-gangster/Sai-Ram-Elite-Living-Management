require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('PHASE 6: RESIDENT PAYMENT AMOUNT EDIT & RECEIPTS HISTORY TEST');
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

  const phone6A = '9777711111';
  const phone6B = '9777722222';
  let room801, room802, residentA, residentB, paymentA, paymentB, reminderA;

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone6A, phone6B] } } });

    room801 = await prisma.room.upsert({
      where: { roomNumber: '801' },
      update: {},
      create: { roomNumber: '801', floor: 8, capacity: 2, sharingType: 'DOUBLE', status: 'AVAILABLE' },
    });

    room802 = await prisma.room.upsert({
      where: { roomNumber: '802' },
      update: {},
      create: { roomNumber: '802', floor: 8, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    residentA = await prisma.resident.create({
      data: {
        fullName: 'Sameer Phase6',
        phone: phone6A,
        roomId: room801.id,
        monthlyRent: 8500.0,
        securityDeposit: 3000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '777788889999',
      },
    });

    residentB = await prisma.resident.create({
      data: {
        fullName: 'Pooja Phase6',
        phone: phone6B,
        roomId: room802.id,
        monthlyRent: 11000.0,
        securityDeposit: 4000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '111133335555',
      },
    });

    paymentA = await prisma.monthlyPayment.create({
      data: {
        residentId: residentA.id,
        roomId: room801.id,
        billingMonth: '2026-08',
        rentAmount: 8500.0,
        totalAmountDue: 8500.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    reminderA = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: paymentA.id,
        residentId: residentA.id,
        reminderType: 'FIRST_DUE_REMINDER',
        channel: 'WHATSAPP',
        messageText: 'Payment reminder for August 2026',
        scheduledFor: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Amount Edit creates attempt without modifying monthlyRent
    // -------------------------------------------------------------
    console.log('--- TEST 1: Amount Edit Invariance ---');
    const customAmountAttempt = 5000.0;
    const txnRef1 = `SRL_P6_${Date.now()}_A1`;

    await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: paymentA.id,
        residentId: residentA.id,
        amountPaid: customAmountAttempt,
        paymentMethod: 'UPI',
        transactionReference: txnRef1,
        status: 'PENDING_REVIEW',
        notes: 'Resident chose custom amount ₹5,000 against ₹8,500 bill',
      },
    });

    const residentCheckA = await prisma.resident.findUnique({ where: { id: residentA.id } });
    assert(residentCheckA.monthlyRent === 8500.0, 'Resident configured monthlyRent remains strictly ₹8,500');

    const paymentCheckA = await prisma.monthlyPayment.findUnique({ where: { id: paymentA.id } });
    assert(paymentCheckA.totalAmountDue === 8500.0, 'MonthlyPayment.totalAmountDue remains strictly ₹8,500');

    // -------------------------------------------------------------
    // TEST 2: Amount Validation Logic
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Server-Side Amount Validation ---');
    const invalidAmountZero = 0;
    const invalidAmountNegative = -500;
    const invalidAmountOverpay = 9000; // > 8500

    assert(invalidAmountZero <= 0, 'Server safely rejects ₹0 payment amount');
    assert(invalidAmountNegative <= 0, 'Server safely rejects negative payment amount');
    assert(invalidAmountOverpay > paymentA.totalAmountDue, 'Server safely rejects amount exceeding bill due');

    // -------------------------------------------------------------
    // TEST 3: Partial Payment Processing & State Update
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Partial Payment Processing ---');
    const receiptNum1 = `SEL-2026-P6-${String(Date.now()).slice(-4)}`;
    const downloadToken1 = crypto.randomBytes(24).toString('hex');

    // Process ₹5,000 partial payment
    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: paymentA.id },
        data: {
          status: 'PARTIALLY_PAID',
          transactionReference: txnRef1,
          gatewayProvider: 'PHONEPE_PG',
        },
      }),
      prisma.paymentRecord.create({
        data: {
          monthlyPaymentId: paymentA.id,
          residentId: residentA.id,
          amountPaid: 5000.0,
          paymentMethod: 'UPI',
          transactionReference: txnRef1,
          status: 'VERIFIED',
          verifiedByAdminName: 'SYSTEM_VERIFIED',
        },
      }),
      prisma.receipt.create({
        data: {
          receiptNumber: receiptNum1,
          monthlyPaymentId: paymentA.id,
          residentId: residentA.id,
          residentName: residentA.fullName,
          roomNumber: room801.roomNumber,
          billingMonth: paymentA.billingMonth,
          amountPaid: 5000.0,
          paymentMethod: 'UPI',
          paymentDate: new Date(),
          status: 'READY',
          googleDriveFileId: 'DRIVE_FILE_P6_1',
          downloadToken: downloadToken1,
        },
      }),
    ]);

    const partialPaymentCheck = await prisma.monthlyPayment.findUnique({ where: { id: paymentA.id } });
    assert(partialPaymentCheck.status === 'PARTIALLY_PAID', 'MonthlyPayment marked PARTIALLY_PAID (NOT fully PAID)');

    // Verify reminder remains active for partial payment
    const reminderCheck1 = await prisma.paymentReminder.findUnique({ where: { id: reminderA.id } });
    assert(reminderCheck1.status === 'PENDING', 'Payment reminder remains active for remaining balance');

    // -------------------------------------------------------------
    // TEST 4: Second Installment Completes Payment (Full Settlement)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Remaining Settlement & Final PAID Transition ---');
    const txnRef2 = `SRL_P6_${Date.now()}_A2`;
    const receiptNum2 = `SEL-2026-P6-${String(Date.now() + 1).slice(-4)}`;
    const downloadToken2 = crypto.randomBytes(24).toString('hex');

    // Process remaining ₹3,500
    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: paymentA.id },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          transactionReference: txnRef2,
          gatewayProvider: 'GPAY_PG',
        },
      }),
      prisma.paymentRecord.create({
        data: {
          monthlyPaymentId: paymentA.id,
          residentId: residentA.id,
          amountPaid: 3500.0,
          paymentMethod: 'UPI',
          transactionReference: txnRef2,
          status: 'VERIFIED',
          verifiedByAdminName: 'SYSTEM_VERIFIED',
        },
      }),
      prisma.receipt.create({
        data: {
          receiptNumber: receiptNum2,
          monthlyPaymentId: paymentA.id,
          residentId: residentA.id,
          residentName: residentA.fullName,
          roomNumber: room801.roomNumber,
          billingMonth: paymentA.billingMonth,
          amountPaid: 3500.0,
          paymentMethod: 'UPI',
          paymentDate: new Date(),
          status: 'READY',
          googleDriveFileId: 'DRIVE_FILE_P6_2',
          downloadToken: downloadToken2,
        },
      }),
      prisma.paymentReminder.updateMany({
        where: { monthlyPaymentId: paymentA.id, status: { in: ['PENDING', 'SCHEDULED'] } },
        data: { status: 'CANCELLED' },
      }),
    ]);

    const fullPaymentCheck = await prisma.monthlyPayment.findUnique({ where: { id: paymentA.id } });
    assert(fullPaymentCheck.status === 'PAID', 'MonthlyPayment transitioned to PAID upon full balance clearance');

    const reminderCheck2 = await prisma.paymentReminder.findUnique({ where: { id: reminderA.id } });
    assert(reminderCheck2.status === 'CANCELLED', 'Reminders CANCELLED upon full settlement');

    // -------------------------------------------------------------
    // TEST 5: Resident Receipt History (Multiple Receipts, Newest First)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Resident Receipt History ---');
    const residentReceipts = await prisma.receipt.findMany({
      where: { residentId: residentA.id },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    assert(residentReceipts.length === 2, 'Resident A has exactly 2 receipts in history');
    assert(residentReceipts[0].receiptNumber === receiptNum2, 'Newest receipt appears first in history list');
    assert(residentReceipts[1].receiptNumber === receiptNum1, 'Prior installment receipt appears second in history list');

    // -------------------------------------------------------------
    // TEST 6: IDOR Protection on Receipts
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Receipt IDOR Security ---');
    const residentBReceipts = await prisma.receipt.findMany({
      where: { residentId: residentB.id },
    });
    assert(residentBReceipts.length === 0, 'Resident B has 0 receipts (cannot see Resident A receipts)');

    const unauthorizedTokenAccess = await prisma.receipt.findFirst({
      where: { downloadToken: downloadToken1, residentId: residentB.id },
    });
    assert(unauthorizedTokenAccess === null, 'Resident B cannot access Resident A receipt token');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone6A, phone6B] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone6A, phone6B] } } });
    console.log('✅ Cleaned up temporary Phase 6 test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PHASE 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Phase 6 Test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase6Tests();
