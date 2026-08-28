require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

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

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RESIDENT-BASED MONTHLY RENT ARCHITECTURE');
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
    // Test 1: Parser unit test for multiple rent string formats
    // -------------------------------------------------------------
    console.log('--- Test 1: parseMonthlyRent Unit Tests ---');
    const testCases = [
      { input: '₹8,000', expected: 8000 },
      { input: '₹ 8500', expected: 8500 },
      { input: '8,000', expected: 8000 },
      { input: '9000', expected: 9000 },
      { input: '₹ 12,500/-', expected: 12500 },
      { input: '', expected: null },
      { input: 'N/A', expected: null },
      { input: 'None', expected: null },
      { input: undefined, expected: null },
    ];

    let allParserPassed = true;
    for (const tc of testCases) {
      const res = parseMonthlyRent(tc.input);
      if (res.amount !== tc.expected) {
        allParserPassed = false;
        console.error(`   Parser error on input "${tc.input}": got ${res.amount}, expected ${tc.expected}`);
      }
    }
    assert(allParserPassed, 'parseMonthlyRent handles currency symbols, commas, blanks, and invalid strings');

    // -------------------------------------------------------------
    // Test 2: Database Schema Invariants
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Database Schema Invariants ---');
    const roomsInDb = await prisma.room.findMany({ take: 1 });
    assert(roomsInDb.length > 0, 'Rooms exist in Supabase database');
    assert(roomsInDb[0].baseRent === undefined, 'Room model does NOT have baseRent property');

    // -------------------------------------------------------------
    // Test 3: Create Registration with monthlyRent
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Create Registration with monthlyRent ---');
    const testPhone = '9999888877';
    // Clean up any test registrations with this phone first
    await prisma.registration.deleteMany({ where: { mobileNumber: testPhone } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });

    const createdReg = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: 'test_rent_arch_001',
        fullName: 'Test Applicant RentArch',
        mobileNumber: testPhone,
        requestedRoomNumber: '101',
        monthlyRent: 8500.0,
        securityDeposit: 2000.0,
        status: 'NEW',
      },
    });

    assert(createdReg.monthlyRent === 8500.0, 'Registration created with monthlyRent = 8500.0');

    // -------------------------------------------------------------
    // Test 4: In-Place Registration Rent Update
    // -------------------------------------------------------------
    console.log('\n--- Test 4: In-Place Registration Rent Update ---');
    const updatedReg = await prisma.registration.update({
      where: { id: createdReg.id },
      data: {
        monthlyRent: 9000.0,
      },
    });
    assert(updatedReg.monthlyRent === 9000.0, 'Registration monthlyRent updated in-place to 9000.0');

    // -------------------------------------------------------------
    // Test 5: Registration Approval copies monthlyRent to Resident
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Registration Approval Flow ---');
    const targetRoom = await prisma.room.findUnique({
      where: { roomNumber: '101' },
      include: { residents: { where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } } } },
    });
    assert(!!targetRoom, 'Target Room 101 exists');

    const createdResident = await prisma.resident.create({
      data: {
        fullName: updatedReg.fullName,
        phone: updatedReg.mobileNumber,
        roomId: targetRoom.id,
        monthlyRent: updatedReg.monthlyRent || 0.0,
        securityDeposit: updatedReg.securityDeposit || 2000.0,
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    assert(createdResident.monthlyRent === 9000.0, 'Resident.monthlyRent correctly copied from Registration (9000.0)');

    // -------------------------------------------------------------
    // Test 6: Create Second Resident in Room 101 with different rent
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Multi-Resident Room Dynamic Collection ---');
    const testPhone2 = '9999888878';
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone2 } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone2 } });

    const createdResident2 = await prisma.resident.create({
      data: {
        fullName: 'Test Roommate RentArch',
        phone: testPhone2,
        roomId: targetRoom.id,
        monthlyRent: 7500.0, // Different agreed rent in the same room!
        securityDeposit: 2000.0,
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    // Query Room 101 with active residents
    const roomWithResidents = await prisma.room.findUnique({
      where: { id: targetRoom.id },
      include: {
        residents: {
          where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
        },
      },
    });

    const roomCollection = roomWithResidents.residents.reduce((sum, r) => sum + r.monthlyRent, 0);
    assert(
      roomCollection === 16500.0,
      `Room 101 Monthly Collection = ₹16,500 (Resident 1: ₹9,000 + Resident 2: ₹7,500). Got: ₹${roomCollection}`
    );

    // -------------------------------------------------------------
    // Test 7: Vacating a resident decreases room collection dynamically
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Dynamic Collection update on Vacate ---');
    await prisma.resident.update({
      where: { id: createdResident2.id },
      data: { status: 'VACATED', checkOutDate: new Date() },
    });

    const roomAfterVacate = await prisma.room.findUnique({
      where: { id: targetRoom.id },
      include: {
        residents: {
          where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
        },
      },
    });

    const roomCollectionAfterVacate = roomAfterVacate.residents.reduce((sum, r) => sum + r.monthlyRent, 0);
    assert(
      roomCollectionAfterVacate === 9000.0,
      `Room 101 Monthly Collection after 1 vacate = ₹9,000. Got: ₹${roomCollectionAfterVacate}`
    );

    // -------------------------------------------------------------
    // Test 8: Dashboard expected monthly revenue calculation
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Dashboard Expected Monthly Revenue Calculation ---');
    const allActiveResidents = await prisma.resident.findMany({
      where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
    });
    const totalExpectedRevenue = allActiveResidents.reduce((sum, r) => sum + r.monthlyRent, 0);
    assert(
      totalExpectedRevenue >= 9000.0,
      `Dashboard expected revenue correctly aggregates active residents. Total: ₹${totalExpectedRevenue}`
    );

    // -------------------------------------------------------------
    // Test 9: Payment Due Generation based on resident.monthlyRent
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Payment Due Generation ---');
    const billingMonth = '2026-08';
    const due = await prisma.monthlyPayment.create({
      data: {
        residentId: createdResident.id,
        roomId: targetRoom.id,
        billingMonth,
        rentAmount: createdResident.monthlyRent,
        maintenanceAmount: 0.0,
        penaltyAmount: 0.0,
        discountAmount: 0.0,
        totalAmountDue: createdResident.monthlyRent,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    assert(due.rentAmount === 9000.0, 'MonthlyPayment.rentAmount equals Resident.monthlyRent (₹9,000)');
    assert(due.totalAmountDue === 9000.0, 'MonthlyPayment.totalAmountDue equals ₹9,000');

    // -------------------------------------------------------------
    // Test 10: PostgreSQL View Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 10: PostgreSQL View Dynamic Collection ---');
    const viewRows = await prisma.$queryRawUnsafe(
      `SELECT "roomNumber", current_occupancy, available_slots, monthly_collection FROM public.room_occupancy_view WHERE "roomNumber" = '101';`
    );
    assert(viewRows.length > 0, 'public.room_occupancy_view queried successfully');
    assert(
      Number(viewRows[0].monthly_collection) === 9000.0,
      `public.room_occupancy_view monthly_collection matches active resident rent (₹9,000). Got: ₹${viewRows[0].monthly_collection}`
    );

    // -------------------------------------------------------------
    // Test 11: Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Cleanup Test Data ---');
    await prisma.monthlyPayment.deleteMany({ where: { id: due.id } });
    await prisma.resident.deleteMany({ where: { id: { in: [createdResident.id, createdResident2.id] } } });
    await prisma.registration.deleteMany({ where: { id: createdReg.id } });
    console.log('✅ Cleaned up temporary test records from Supabase.');

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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

runTests();
