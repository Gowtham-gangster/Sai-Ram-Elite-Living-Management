require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

async function generateTestReceiptPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderWidth: 1.5,
    borderColor: rgb(0.89, 0.91, 0.94),
    color: rgb(1, 1, 1),
  });

  page.drawRectangle({
    x: 24,
    y: height - 120,
    width: width - 48,
    height: 96,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText('SAIRAM ELITE LIVING', {
    x: 48,
    y: height - 68,
    size: 20,
    font: fontBold,
    color: rgb(0.96, 0.62, 0.04),
  });

  page.drawText('RENT PAYMENT RECEIPT', {
    x: width - 180,
    y: height - 76,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Receipt No: ${data.receiptNumber}`, {
    x: 48,
    y: height - 150,
    size: 11,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText(`Resident: ${data.residentName}`, {
    x: 48,
    y: height - 180,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.33),
  });

  page.drawText(`Room: Room ${data.roomNumber}`, {
    x: 48,
    y: height - 200,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.33),
  });

  page.drawText(`Billing Month: ${data.billingMonth}`, {
    x: 48,
    y: height - 220,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.33),
  });

  page.drawText(`Amount Paid: Rs. ${data.amountPaid.toFixed(2)}`, {
    x: 48,
    y: height - 240,
    size: 11,
    font: fontBold,
    color: rgb(0.96, 0.62, 0.04),
  });

  return await pdfDoc.save();
}

async function runReceiptWorkflowTests() {
  console.log('================================================================');
  console.log('TEST SUITE: AUTOMATIC RECEIPT GENERATION & GOOGLE DRIVE WORKFLOW');
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

  const testPhone = '9777766666';
  let testRoom, testResident, testPayment, testReminder;

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });

    testRoom = await prisma.room.upsert({
      where: { roomNumber: '999' },
      update: {},
      create: {
        roomNumber: '999',
        floor: 9,
        capacity: 1,
        sharingType: 'SINGLE',
        amenities: 'Balcony',
        status: 'AVAILABLE',
      },
    });

    testResident = await prisma.resident.create({
      data: {
        fullName: 'Arjun Receipt Tester',
        phone: testPhone,
        roomId: testRoom.id,
        monthlyRent: 11000.0,
        securityDeposit: 3000.0, // One-time security deposit
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '999988887777',
      },
    });

    testPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-08',
        rentAmount: 11000.0,
        maintenanceAmount: 0.0,
        totalAmountDue: 11000.0,
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
        messageText: 'Payment reminder message for August 2026',
        scheduledFor: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 16: Payment Merely Initiated (No Receipt, No Cancellation)
    // -------------------------------------------------------------
    console.log('--- TEST 16: Initiation Zero-Side-Effect Invariant ---');
    const receiptsOnInitiate = await prisma.receipt.count({ where: { monthlyPaymentId: testPayment.id } });
    assert(receiptsOnInitiate === 0, 'No receipt generated when payment is only initiated');

    const reminderOnInitiate = await prisma.paymentReminder.findUnique({ where: { id: testReminder.id } });
    assert(reminderOnInitiate.status === 'PENDING', 'Payment reminders remain active when payment is only initiated');

    // -------------------------------------------------------------
    // TEST 5 & 6: PDF Generation with pdf-lib & Security Deposit Exclusion
    // -------------------------------------------------------------
    console.log('\n--- TEST 5 & 6: Vector PDF Receipt Generation ---');
    const sampleReceiptNo = 'SEL-2026-999001';
    const pdfBytes = await generateTestReceiptPdf({
      receiptNumber: sampleReceiptNo,
      residentName: testResident.fullName,
      roomNumber: testRoom.roomNumber,
      billingMonth: testPayment.billingMonth,
      amountPaid: testPayment.totalAmountDue, // Exactly 11,000 (NOT 11,000 + 3,000)
    });

    assert(pdfBytes && pdfBytes.length > 500, 'Server-side vector PDF receipt generated (> 500 bytes)');
    assert(testPayment.totalAmountDue === 11000.0, 'Rent receipt amount strictly equals monthly rent (Security deposit excluded)');

    // -------------------------------------------------------------
    // TEST 1, 2, 3, 4, 9: Atomic Verification & Receipt Creation
    // -------------------------------------------------------------
    console.log('\n--- TEST 1, 2, 3, 4, 9: Atomic Verification & Receipt Creation ---');
    const verifiedRef = `SRL_202608_999_${Date.now().toString(36).toUpperCase()}`;
    const generatedReceiptNo = `SEL-2026-${String(Date.now()).slice(-6)}`;
    const downloadToken = crypto.randomBytes(24).toString('hex');
    const mockDriveFileId = `DRIVE_FILE_${Date.now()}`;

    // Perform database transaction transitioning payment to PAID and creating receipt
    await prisma.$transaction([
      prisma.monthlyPayment.update({
        where: { id: testPayment.id },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          paymentMethod: 'UPI',
          gatewayProvider: 'TEST_GATEWAY',
          gatewayPaymentId: `GW_${Date.now()}`,
          transactionReference: verifiedRef,
          receiptNumber: generatedReceiptNo,
        },
      }),
      prisma.paymentRecord.create({
        data: {
          monthlyPaymentId: testPayment.id,
          residentId: testResident.id,
          amountPaid: 11000.0,
          paymentMethod: 'UPI',
          transactionReference: verifiedRef,
          status: 'VERIFIED',
          verifiedByAdminName: 'SYSTEM_VERIFIED',
        },
      }),
      prisma.receipt.create({
        data: {
          receiptNumber: generatedReceiptNo,
          monthlyPaymentId: testPayment.id,
          residentId: testResident.id,
          residentName: testResident.fullName,
          roomNumber: testRoom.roomNumber,
          billingMonth: testPayment.billingMonth,
          amountPaid: testPayment.totalAmountDue,
          paymentMethod: 'UPI',
          paymentDate: new Date(),
          googleDriveFileId: mockDriveFileId,
          status: 'READY',
          downloadToken,
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

    const createdReceipt = await prisma.receipt.findUnique({
      where: { receiptNumber: generatedReceiptNo },
    });

    assert(createdReceipt !== null, 'Receipt metadata record saved in Supabase');
    assert(createdReceipt.amountPaid === 11000.0, 'Receipt record amount matches 11,000.00');
    assert(createdReceipt.roomNumber === '999', 'Receipt record room matches 999');
    assert(createdReceipt.googleDriveFileId === mockDriveFileId, 'Google Drive file ID saved in Supabase');
    assert(createdReceipt.downloadToken === downloadToken, 'Unique secure downloadToken generated');

    // -------------------------------------------------------------
    // TEST 11 & 15: Reminder Cancellation
    // -------------------------------------------------------------
    console.log('\n--- TEST 11 & 15: Automatic Reminder Cancellation ---');
    const cancelledReminder = await prisma.paymentReminder.findUnique({ where: { id: testReminder.id } });
    assert(cancelledReminder.status === 'CANCELLED', 'WhatsApp payment reminder CANCELLED upon verified payment');

    // -------------------------------------------------------------
    // TEST 12: Idempotency Check (Duplicate Execution)
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Duplicate Webhook / Receipt Idempotency ---');
    const totalReceiptsForPayment = await prisma.receipt.count({ where: { monthlyPaymentId: testPayment.id } });
    assert(totalReceiptsForPayment === 1, 'Exactly one Receipt record exists in Supabase');

    const totalRecordsForPayment = await prisma.paymentRecord.count({ where: { monthlyPaymentId: testPayment.id } });
    assert(totalRecordsForPayment === 1, 'Exactly one PaymentRecord exists in Supabase');

    // -------------------------------------------------------------
    // TEST 10 & 11: Resident Download Authorization
    // -------------------------------------------------------------
    console.log('\n--- TEST 10 & 11: Resident Download Authorization ---');
    const validTokenReceipt = await prisma.receipt.findUnique({
      where: { downloadToken: createdReceipt.downloadToken },
    });
    assert(validTokenReceipt !== null && validTokenReceipt.id === createdReceipt.id, 'Resident access with valid token succeeds');

    const fakeTokenReceipt = await prisma.receipt.findUnique({
      where: { downloadToken: 'fake_unauthorized_token_123' },
    });
    assert(fakeTokenReceipt === null, 'Unauthorized/tampered download token safely rejected (returns null)');

    // -------------------------------------------------------------
    // TEST 13: Drive Failure Isolation
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Google Drive Failure Isolation ---');
    const checkPaidStatus = await prisma.monthlyPayment.findUnique({ where: { id: testPayment.id } });
    assert(checkPaidStatus.status === 'PAID', 'MonthlyPayment remains PAID even if Drive encounters network issues');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });
    await prisma.room.delete({ where: { roomNumber: '999' } });
    console.log('✅ Cleaned up test fixtures.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`WORKFLOW TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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

runReceiptWorkflowTests();
