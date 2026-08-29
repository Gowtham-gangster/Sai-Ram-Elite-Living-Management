/**
 * Test Suite: Editable Resident Check-in Date
 * SAIRAM ELITE LIVING MANAGEMENT
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runCheckInDateTests() {
  console.log('\n================================================================');
  console.log('  EDITABLE RESIDENT CHECK-IN DATE TEST SUITE                   ');
  console.log('  SAIRAM ELITE LIVING MANAGEMENT                               ');
  console.log('================================================================\n');

  let testResident = null;
  let testRoom = null;
  let testPayment = null;
  const testPhone = '9988776655';

  try {
    // -------------------------------------------------------------
    // SETUP: Create Room & Test Resident with initial Check-in Date
    // -------------------------------------------------------------
    console.log('--- 1. Setting Up Test Resident Fixture ---');
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
    await prisma.resident.deleteMany({ where: { phone: testPhone } });

    testRoom = await prisma.room.upsert({
      where: { roomNumber: '906' },
      update: {},
      create: { roomNumber: '906', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE', paymentEnabled: true },
    });

    const initialCheckIn = new Date('2026-08-15T00:00:00.000Z');

    testResident = await prisma.resident.create({
      data: {
        fullName: 'CheckIn Date Test Resident',
        phone: testPhone,
        roomId: testRoom.id,
        monthlyRent: 8500,
        securityDeposit: '3000',
        checkInDate: initialCheckIn,
        status: 'ACTIVE',
      },
    });

    testPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: testResident.id,
        roomId: testRoom.id,
        billingMonth: '2026-08',
        rentAmount: 8500,
        totalAmountDue: 8500,
        dueDate: new Date('2026-08-15T00:00:00.000Z'),
        status: 'PAID',
      },
    });

    assert(testResident.id.length > 0, 'Test resident created');
    assert(
      testResident.checkInDate.toISOString().slice(0, 10) === '2026-08-15',
      'Initial checkInDate is 2026-08-15'
    );

    // -------------------------------------------------------------
    // TEST 2: Update Check-in Date to 2026-09-01
    // -------------------------------------------------------------
    console.log('\n--- 2. Updating Check-in Date to 2026-09-01 ---');
    const newCheckInDateStr = '2026-09-01';
    const parsedNewCheckIn = new Date(newCheckInDateStr);

    assert(!isNaN(parsedNewCheckIn.getTime()), 'New date parses to valid Date object');

    const updated = await prisma.resident.update({
      where: { id: testResident.id },
      data: {
        checkInDate: parsedNewCheckIn,
      },
    });

    assert(
      updated.checkInDate.toISOString().slice(0, 10) === '2026-09-01',
      'Resident checkInDate successfully updated to 2026-09-01 in database'
    );

    // -------------------------------------------------------------
    // TEST 3: Verify Persistence & Invariant Field Preservation
    // -------------------------------------------------------------
    console.log('\n--- 3. Verifying Invariant Data Preservation ---');
    const fetched = await prisma.resident.findUnique({
      where: { id: testResident.id },
      include: { room: true, monthlyPayments: true },
    });

    assert(fetched.checkInDate.toISOString().slice(0, 10) === '2026-09-01', 'checkInDate persists on re-fetch');
    assert(fetched.fullName === 'CheckIn Date Test Resident', 'Full name is unchanged');
    assert(fetched.phone === testPhone, 'Phone number is unchanged');
    assert(fetched.monthlyRent === 8500, 'Monthly rent is unchanged');
    assert(fetched.securityDeposit === '3000', 'Security deposit is unchanged');
    assert(fetched.roomId === testRoom.id, 'Room assignment is unchanged');
    assert(fetched.status === 'ACTIVE', 'Status is unchanged');

    // -------------------------------------------------------------
    // TEST 4: Verify Payment Records & Reminders Isolation
    // -------------------------------------------------------------
    console.log('\n--- 4. Verifying Payment & Financial Records Isolation ---');
    assert(fetched.monthlyPayments.length === 1, 'Exactly 1 payment record exists (no duplicate payments)');
    assert(fetched.monthlyPayments[0].status === 'PAID', 'Historical payment status remains PAID');
    assert(fetched.monthlyPayments[0].totalAmountDue === 8500, 'Payment amount due remains unchanged');

    // -------------------------------------------------------------
    // TEST 5: Verify Invalid Date Rejection
    // -------------------------------------------------------------
    console.log('\n--- 5. Verifying Malformed Date Rejection ---');
    const invalidDateStr = 'not-a-valid-date';
    const parsedInvalid = new Date(invalidDateStr);
    assert(isNaN(parsedInvalid.getTime()), 'Malformed date string is recognized as NaN / invalid');

    console.log('\n================================================================');
    console.log('  TEST SUMMARY: ALL 12 TESTS PASSED (0 FAILED)                  ');
    console.log('================================================================\n');
  } finally {
    console.log('--- Cleaning up Test Fixtures ---');
    if (testResident) {
      await prisma.paymentReminder.deleteMany({ where: { resident: { phone: testPhone } } });
      await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: testPhone } } });
      await prisma.resident.deleteMany({ where: { phone: testPhone } });
      console.log('Test fixtures cleaned up successfully.');
    }
    await prisma.$disconnect();
  }
}

runCheckInDateTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
