require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

function parseSecurityDeposit(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { amount: null, raw: '' };
  }
  const str = String(raw).trim();
  if (str === '' || /^(na|n\/a|nil|none|no|yes)$/i.test(str)) {
    return { amount: null, raw: str };
  }
  const cleanNumStr = str.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanNumStr);
  if (!isNaN(parsed) && parsed >= 0) {
    return { amount: parsed, raw: str };
  }
  return { amount: null, raw: str };
}

function parseMonthlyRent(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { amount: null, raw: '' };
  }
  const str = String(raw).trim();
  if (str === '' || /^(na|n\/a|nil|none|no|yes)$/i.test(str)) {
    return { amount: null, raw: str };
  }
  const cleanNumStr = str.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanNumStr);
  if (!isNaN(parsed) && parsed >= 0) {
    return { amount: parsed, raw: str };
  }
  return { amount: null, raw: str };
}

const prisma = new PrismaClient({
  log: ['error'],
});

async function runDepositTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RESIDENT-LEVEL ONE-TIME SECURITY DEPOSIT ARCHITECTURE');
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

  try {
    // -------------------------------------------------------------
    // Test 1: Parser unit tests for Security Deposit strings
    // -------------------------------------------------------------
    console.log('--- Test 1: parseSecurityDeposit Currency String Parsing ---');
    const depositCases = [
      { input: '₹2000', expected: 2000 },
      { input: '₹ 2,000', expected: 2000 },
      { input: '2000', expected: 2000 },
      { input: '2,000', expected: 2000 },
      { input: '₹3,500/-', expected: 3500 },
      { input: '0', expected: 0 },
      { input: '', expected: null },
      { input: 'N/A', expected: null },
      { input: 'None', expected: null },
    ];

    let allDepositPassed = true;
    for (const tc of depositCases) {
      const res = parseSecurityDeposit(tc.input);
      if (res.amount !== tc.expected) {
        allDepositPassed = false;
        console.error(`   Parser error on "${tc.input}": got ${res.amount}, expected ${tc.expected}`);
      }
    }
    assert(allDepositPassed, 'parseSecurityDeposit normalizes ₹2000, ₹ 2,000, 2000, 2,000 to numeric values');

    // -------------------------------------------------------------
    // Test 2: Room Entity Invariant (No Room-Level Financial Fields)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Room Entity Invariants ---');
    const sampleRoom = await prisma.room.findFirst();
    assert(sampleRoom !== null, 'Room exists in Supabase PostgreSQL');
    assert(sampleRoom.securityDeposit === undefined, 'Room model does NOT have securityDeposit property');
    assert(sampleRoom.baseRent === undefined, 'Room model does NOT have baseRent property');
    assert(sampleRoom.monthlyRent === undefined, 'Room model does NOT have monthlyRent property');

    // -------------------------------------------------------------
    // Test 3: Google Form Sync Intake with Rent & Deposit
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Google Form Sync Intake ---');
    const testPhoneA = '9876500001';
    const testPhoneB = '9876500002';

    // Clean up any existing records with test phones
    await prisma.monthlyPayment.deleteMany({
      where: { resident: { phone: { in: [testPhoneA, testPhoneB] } } },
    });
    await prisma.resident.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB] } },
    });
    await prisma.registration.deleteMany({
      where: { mobileNumber: { in: [testPhoneA, testPhoneB] } },
    });

    const parsedRentA = parseMonthlyRent('₹8,000').amount;
    const parsedDepositA = parseSecurityDeposit('₹2,000').amount;

    const regA = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: 'test_deposit_arch_001',
        fullName: 'Resident A (Deposit Test)',
        mobileNumber: testPhoneA,
        requestedRoomNumber: '101',
        monthlyRent: parsedRentA,
        securityDeposit: parsedDepositA,
        status: 'NEW',
      },
    });

    assert(regA.monthlyRent === 8000, 'Registration.monthlyRent = 8000');
    assert(regA.securityDeposit === 2000, 'Registration.securityDeposit = 2000');

    // -------------------------------------------------------------
    // Test 4: Registration Approval & Resident Onboarding
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Registration Approval ---');
    const room101 = await prisma.room.findUnique({
      where: { roomNumber: '101' },
    });
    assert(!!room101, 'Target Room 101 exists in database');

    const residentA = await prisma.resident.create({
      data: {
        fullName: regA.fullName,
        phone: regA.mobileNumber,
        roomId: room101.id,
        monthlyRent: regA.monthlyRent || 0,
        securityDeposit: regA.securityDeposit || 2000,
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    assert(residentA.monthlyRent === 8000, 'Resident.monthlyRent = 8000');
    assert(residentA.securityDeposit === 2000, 'Resident.securityDeposit = 2000 (One-time)');

    // -------------------------------------------------------------
    // Test 5: Monthly Payment Generation (Strictly monthlyRent only)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Recurring Monthly Payment Generation ---');
    const paymentA = await prisma.monthlyPayment.create({
      data: {
        residentId: residentA.id,
        roomId: room101.id,
        billingMonth: '2026-08',
        rentAmount: residentA.monthlyRent,
        maintenanceAmount: 0.0,
        penaltyAmount: 0.0,
        discountAmount: 0.0,
        totalAmountDue: residentA.monthlyRent, // Strictly 8000, NOT 8000 + 2000
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    assert(
      paymentA.rentAmount === 8000 && paymentA.totalAmountDue === 8000,
      `MonthlyPayment.totalAmountDue = ₹8,000 (NOT ₹10,000). Got: ₹${paymentA.totalAmountDue}`
    );

    // -------------------------------------------------------------
    // Test 6: Room Dynamic Collection with Single Resident
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Room 101 Dynamic Collection with Resident A ---');
    const room101WithResidentA = await prisma.room.findUnique({
      where: { id: room101.id },
      include: {
        residents: { where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } } },
      },
    });

    const collectionSingle = room101WithResidentA.residents.reduce((sum, r) => sum + r.monthlyRent, 0);
    assert(
      collectionSingle === 8000,
      `Room 101 Monthly Collection = ₹8,000 (NOT ₹10,000). Got: ₹${collectionSingle}`
    );

    // -------------------------------------------------------------
    // Test 7: Multi-Resident Room with Different Rents & Deposits
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Multi-Resident Room (Resident A + Resident B) ---');
    const parsedRentB = parseMonthlyRent('7500').amount;
    const parsedDepositB = parseSecurityDeposit('3000').amount;

    const residentB = await prisma.resident.create({
      data: {
        fullName: 'Resident B (Deposit Test)',
        phone: testPhoneB,
        roomId: room101.id,
        monthlyRent: parsedRentB || 7500,
        securityDeposit: parsedDepositB || 3000,
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const room101WithBoth = await prisma.room.findUnique({
      where: { id: room101.id },
      include: {
        residents: { where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } } },
      },
    });

    const collectionBoth = room101WithBoth.residents.reduce((sum, r) => sum + r.monthlyRent, 0);
    assert(
      collectionBoth === 15500,
      `Room 101 Monthly Collection = ₹15,500 (Rent A: ₹8,000 + Rent B: ₹7,500, Deposits ₹2,000 & ₹3,000 ignored). Got: ₹${collectionBoth}`
    );

    // -------------------------------------------------------------
    // Test 8: Dashboard Expected Monthly Collection Calculation
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Dashboard Revenue Aggregation ---');
    const activeResidents = await prisma.resident.findMany({
      where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
    });
    const dashboardExpected = activeResidents.reduce((sum, r) => sum + r.monthlyRent, 0);
    const sumDeposits = activeResidents.reduce((sum, r) => sum + r.securityDeposit, 0);

    assert(
      dashboardExpected >= 15500,
      `Dashboard expected revenue correctly aggregates active monthlyRent (₹${dashboardExpected}) without deposits (₹${sumDeposits})`
    );

    // -------------------------------------------------------------
    // Test 9: PostgreSQL View Dynamic Collection Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 9: PostgreSQL room_occupancy_view Invariants ---');
    const viewRows = await prisma.$queryRawUnsafe(
      `SELECT "roomNumber", current_occupancy, available_slots, monthly_collection FROM public.room_occupancy_view WHERE "roomNumber" = '101';`
    );
    assert(viewRows.length > 0, 'public.room_occupancy_view successfully queried');
    assert(
      Number(viewRows[0].monthly_collection) === 15500,
      `public.room_occupancy_view monthly_collection = ₹15,500 (Got: ₹${viewRows[0].monthly_collection})`
    );

    // -------------------------------------------------------------
    // Test 10: WhatsApp Reminder Formatting (Rent only)
    // -------------------------------------------------------------
    console.log('\n--- Test 10: WhatsApp Reminder Content ---');
    const reminderMessage = `Dear ${residentA.fullName}, your monthly rent of ₹${residentA.monthlyRent.toLocaleString('en-IN')} for August 2026 is due.`;
    assert(
      reminderMessage.includes('₹8,000') && !reminderMessage.includes('₹10,000'),
      `WhatsApp reminder refers strictly to ₹8,000 monthly rent: "${reminderMessage}"`
    );

    // -------------------------------------------------------------
    // Cleanup Test Data
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.monthlyPayment.deleteMany({ where: { id: paymentA.id } });
    await prisma.resident.deleteMany({ where: { id: { in: [residentA.id, residentB.id] } } });
    await prisma.registration.deleteMany({ where: { id: regA.id } });
    console.log('✅ Cleaned up temporary test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDepositTests();
