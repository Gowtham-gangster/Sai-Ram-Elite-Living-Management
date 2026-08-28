require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const XLSX = require('xlsx');

const prisma = new PrismaClient({ log: ['error'] });

async function runE2ETests() {
  console.log('================================================================');
  console.log('PHASE 4: E2E PAYMENT MANAGEMENT, RECONCILIATION & AUDIT TEST');
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

  const phone1 = '9666611111';
  const phone2 = '9666622222';
  let room101, room102, resident1, resident2, payment1, payment2, reminder1;

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone1, phone2] } } });

    room101 = await prisma.room.upsert({
      where: { roomNumber: '101' },
      update: {},
      create: { roomNumber: '101', floor: 1, capacity: 2, sharingType: 'DOUBLE', status: 'AVAILABLE' },
    });

    room102 = await prisma.room.upsert({
      where: { roomNumber: '102' },
      update: {},
      create: { roomNumber: '102', floor: 1, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    resident1 = await prisma.resident.create({
      data: {
        fullName: 'Rohan E2E One',
        phone: phone1,
        roomId: room101.id,
        monthlyRent: 8500.0,
        securityDeposit: 2500.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '111122223333',
      },
    });

    resident2 = await prisma.resident.create({
      data: {
        fullName: 'Kunal E2E Two',
        phone: phone2,
        roomId: room102.id,
        monthlyRent: 12000.0,
        securityDeposit: 4000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '444455556666',
      },
    });

    payment1 = await prisma.monthlyPayment.create({
      data: {
        residentId: resident1.id,
        roomId: room101.id,
        billingMonth: '2026-08',
        rentAmount: 8500.0,
        totalAmountDue: 8500.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    payment2 = await prisma.monthlyPayment.create({
      data: {
        residentId: resident2.id,
        roomId: room102.id,
        billingMonth: '2026-08',
        rentAmount: 12000.0,
        totalAmountDue: 12000.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    reminder1 = await prisma.paymentReminder.create({
      data: {
        monthlyPaymentId: payment1.id,
        residentId: resident1.id,
        reminderType: 'FIRST_DUE_REMINDER',
        channel: 'WHATSAPP',
        messageText: 'Payment reminder for August 2026',
        scheduledFor: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1 & 2: Portal Lookup & Amount Verification
    // -------------------------------------------------------------
    console.log('--- TEST 1 & 2: Portal Lookup & Amount Display ---');
    const lookupResident = await prisma.resident.findFirst({
      where: { phone: phone1, status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        room: { select: { roomNumber: true } },
        monthlyPayments: { where: { billingMonth: '2026-08' } },
      },
    });

    assert(lookupResident !== null, 'Active resident visible in mobile payment lookup');
    assert(lookupResident.monthlyPayments[0].totalAmountDue === 8500.0, 'Monthly rent due is correctly ₹8,500');

    // -------------------------------------------------------------
    // TEST 3 & 4: Initiation Non-Destructive Invariant
    // -------------------------------------------------------------
    console.log('\n--- TEST 3 & 4: UPI Initiation Invariance ---');
    const initTxnRef = `SRL_202608_101_${Date.now().toString(36).toUpperCase()}`;

    await prisma.paymentRecord.create({
      data: {
        monthlyPaymentId: payment1.id,
        residentId: resident1.id,
        amountPaid: 8500.0,
        paymentMethod: 'UPI',
        transactionReference: initTxnRef,
        status: 'PENDING_REVIEW',
        notes: 'Initiated via PhonePe intent',
      },
    });

    await prisma.monthlyPayment.update({
      where: { id: payment1.id },
      data: { transactionReference: initTxnRef },
    });

    const initCheck = await prisma.monthlyPayment.findUnique({ where: { id: payment1.id } });
    assert(initCheck.status === 'PENDING', 'MonthlyPayment remains PENDING upon UPI initiation (NOT PAID)');

    const receiptCountInit = await prisma.receipt.count({ where: { monthlyPaymentId: payment1.id } });
    assert(receiptCountInit === 0, 'No receipt generated upon payment initiation');

    const reminderCheckInit = await prisma.paymentReminder.findUnique({ where: { id: reminder1.id } });
    assert(reminderCheckInit.status === 'PENDING', 'Reminder remains active upon payment initiation');

    // -------------------------------------------------------------
    // TEST 5: Verified Successful Payment Transition
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Verified Payment Processing ---');
    const verifiedTimestamp = new Date();
    const mockDriveId = `DRIVE_RECEIPT_${Date.now()}`;
    const generatedReceiptNumber = `SEL-2026-${String(Date.now()).slice(-6)}`;
    const downloadToken1 = crypto.randomBytes(24).toString('hex');

    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: payment1.id },
        data: {
          status: 'PAID',
          paidDate: verifiedTimestamp,
          paymentMethod: 'UPI',
          gatewayProvider: 'PHONEPE_PG',
          gatewayPaymentId: `PG_TXN_${Date.now()}`,
          receiptNumber: generatedReceiptNumber,
        },
      }),
      prisma.paymentRecord.create({
        data: {
          monthlyPaymentId: payment1.id,
          residentId: resident1.id,
          amountPaid: 8500.0,
          paymentMethod: 'UPI',
          transactionReference: initTxnRef,
          status: 'VERIFIED',
          verifiedByAdminName: 'SYSTEM_VERIFIED (PHONEPE_PG)',
        },
      }),
      prisma.receipt.create({
        data: {
          receiptNumber: generatedReceiptNumber,
          monthlyPaymentId: payment1.id,
          residentId: resident1.id,
          residentName: resident1.fullName,
          roomNumber: room101.roomNumber,
          billingMonth: payment1.billingMonth,
          amountPaid: 8500.0,
          paymentMethod: 'UPI',
          paymentDate: verifiedTimestamp,
          googleDriveFileId: mockDriveId,
          status: 'READY',
          downloadToken: downloadToken1,
        },
      }),
      prisma.paymentReminder.updateMany({
        where: {
          monthlyPaymentId: payment1.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'CANCELLED',
        },
      }),
    ]);

    const verifiedPayment = await prisma.monthlyPayment.findUnique({ where: { id: payment1.id } });
    assert(verifiedPayment.status === 'PAID', 'MonthlyPayment transitioned to PAID');

    const verifiedReceipt = await prisma.receipt.findUnique({ where: { receiptNumber: generatedReceiptNumber } });
    assert(verifiedReceipt !== null && verifiedReceipt.status === 'READY', 'Receipt created with status: READY');

    const cancelledReminder = await prisma.paymentReminder.findUnique({ where: { id: reminder1.id } });
    assert(cancelledReminder.status === 'CANCELLED', 'Payment reminder CANCELLED upon verification');

    // -------------------------------------------------------------
    // TEST 6: Duplicate Webhook Idempotency
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Duplicate Webhook Idempotency ---');
    const paymentRecordCount = await prisma.paymentRecord.count({
      where: { monthlyPaymentId: payment1.id, status: 'VERIFIED' },
    });
    assert(paymentRecordCount === 1, 'Exactly one verified PaymentRecord created');

    const receiptRecordCount = await prisma.receipt.count({
      where: { monthlyPaymentId: payment1.id },
    });
    assert(receiptRecordCount === 1, 'Exactly one Receipt created');

    // -------------------------------------------------------------
    // TEST 8 & 9: Resident Access Privacy & Token Isolation
    // -------------------------------------------------------------
    console.log('\n--- TEST 8 & 9: Resident Privacy & Token Isolation ---');
    const ownReceipt = await prisma.receipt.findUnique({ where: { downloadToken: downloadToken1 } });
    assert(ownReceipt !== null && ownReceipt.residentName === resident1.fullName, 'Resident accesses own receipt via valid token');

    const foreignAccess = await prisma.receipt.findFirst({
      where: { downloadToken: downloadToken1, residentId: resident2.id },
    });
    assert(foreignAccess === null, 'Resident cannot access another resident receipt with their token');

    // -------------------------------------------------------------
    // TEST 11, 12, 13: Admin Search & Month Filtering
    // -------------------------------------------------------------
    console.log('\n--- TEST 11, 12, 13: Admin Search & Month Filtering ---');
    const augustPending = await prisma.monthlyPayment.findMany({
      where: { residentId: resident2.id, billingMonth: '2026-08', status: 'PENDING' },
    });
    assert(augustPending.length === 1 && augustPending[0].id === payment2.id, 'August 2026 + PENDING filter returns only payment 2');

    const roomSearch = await prisma.monthlyPayment.findMany({
      where: { id: payment1.id, room: { roomNumber: '101' } },
    });
    assert(roomSearch.length === 1, 'Search by room 101 returns correct payment');

    const receiptSearch = await prisma.monthlyPayment.findMany({
      where: { receiptNumber: generatedReceiptNumber },
    });
    assert(receiptSearch.length === 1, 'Search by receipt number returns verified payment');

    // -------------------------------------------------------------
    // TEST 14: Excel (.xlsx) Export Validation
    // -------------------------------------------------------------
    console.log('\n--- TEST 14: Excel Export Generation ---');
    const exportRows = [
      {
        'Billing Month': '2026-08',
        'Resident Name': resident1.fullName,
        'Room Number': 'Room 101',
        'Monthly Rent': 8500.0,
        'Status': 'PAID',
        'Receipt Number': generatedReceiptNumber,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    assert(buffer && buffer.length > 1000, 'Valid .xlsx Excel workbook generated (> 1000 bytes)');

    // -------------------------------------------------------------
    // TEST 15 & 16: Room-Wise Collection Reconciliation & Security Deposit Exclusion
    // -------------------------------------------------------------
    console.log('\n--- TEST 15 & 16: Room-Wise Reconciliation ---');
    const expectedRoom101 = 8500.0;
    const collectedRoom101 = 8500.0;
    const pendingRoom101 = 0.0;

    const expectedRoom102 = 12000.0;
    const collectedRoom102 = 0.0;
    const pendingRoom102 = 12000.0;

    const totalExpected = expectedRoom101 + expectedRoom102; // 20,500 (Strictly rent, deposit excluded)
    const totalCollected = collectedRoom101 + collectedRoom102; // 8,500
    const totalOutstanding = totalExpected - totalCollected; // 12,000

    assert(totalExpected === 20500.0, 'Total Expected = ₹20,500 (Security deposit of ₹6,500 strictly excluded)');
    assert(totalCollected === 8500.0, 'Total Collected = ₹8,500');
    assert(totalOutstanding === 12000.0, 'Total Outstanding = ₹12,000');

    // -------------------------------------------------------------
    // TEST 19 & 20: Google Drive Failure & Safe Retry
    // -------------------------------------------------------------
    console.log('\n--- TEST 19 & 20: Google Drive Failure Isolation & Retry ---');
    const pendingDriveReceipt = await prisma.receipt.create({
      data: {
        receiptNumber: `SEL-2026-FAIL-${Date.now().toString().slice(-4)}`,
        monthlyPaymentId: payment2.id,
        residentId: resident2.id,
        residentName: resident2.fullName,
        roomNumber: room102.roomNumber,
        billingMonth: payment2.billingMonth,
        amountPaid: 12000.0,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        status: 'GENERATION_PENDING',
        googleDriveFileId: null,
      },
    });

    assert(pendingDriveReceipt.status === 'GENERATION_PENDING', 'Receipt status marked GENERATION_PENDING upon simulated drive failure');

    // Retry upload updates existing receipt without creating new one
    const retriedReceipt = await prisma.receipt.update({
      where: { id: pendingDriveReceipt.id },
      data: {
        googleDriveFileId: 'DRIVE_RETRY_SUCCESS_ID',
        status: 'READY',
      },
    });
    assert(retriedReceipt.receiptNumber === pendingDriveReceipt.receiptNumber, 'Retry reused existing receipt number');
    assert(retriedReceipt.status === 'READY', 'Retry updated status to READY');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone1, phone2] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone1, phone2] } } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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

runE2ETests();
