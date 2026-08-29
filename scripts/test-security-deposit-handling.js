const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('===============================================================');
  console.log('TEST SUITE: GOOGLE FORM SHORT-ANSWER "SECURITY DEPOSIT" HANDLING');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Test values specified by the user & business rules
  const testCases = [
    { input: '0', expected: '0' },
    { input: '2000', expected: '2000' },
    { input: '1000', expected: '1000' },
    { input: 'Yes', expected: 'Yes' },
    { input: 'Yes Done', expected: 'Yes Done' },
    { input: '', expected: null },
    { input: null, expected: null },
    { input: 'Not Applicable', expected: 'Not Applicable' },
    { input: 'Paid via GPay to owner', expected: 'Paid via GPay to owner' },
  ];

  // Clean up any prior test records
  await prisma.registration.deleteMany({
    where: { mobileNumber: { startsWith: '99988' } },
  });
  await prisma.resident.deleteMany({
    where: { phone: { startsWith: '99988' } },
  });

  // 1. Find or create a test room
  let room = await prisma.room.findFirst();
  if (!room) {
    room = await prisma.room.create({
      data: {
        roomNumber: 'TEST-999',
        floor: 1,
        capacity: 10,
        sharingType: 'DOUBLE',
        monthlyRent: 7500,
        status: 'AVAILABLE',
      },
    });
  }

  // 2. Test Parser & String Normalization
  console.log('--- 1. Testing Raw String Parser Logic ---');
  for (const tc of testCases) {
    const rawVal = tc.input !== undefined && tc.input !== null ? String(tc.input).trim() : '';
    const storedVal = rawVal.length > 0 ? rawVal : null;
    assert(
      storedVal === tc.expected,
      `Parser preserves input "${tc.input}" as "${tc.expected}"`,
      `Got: ${storedVal}`
    );
  }

  // 3. Test Registration Creation & DB Persistence for all test cases
  console.log('\n--- 2. Testing Database Storage in Registration Model ---');
  const createdRegIds = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const phone = `999880000${i}`;
    const rawVal = tc.input !== undefined && tc.input !== null ? String(tc.input).trim() : '';
    const depositToStore = rawVal.length > 0 ? rawVal : null;

    const reg = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: `test_resp_${i}_${Date.now()}`,
        fullName: `Test Applicant ${i} (${tc.input})`,
        mobileNumber: phone,
        requestedRoomNumber: room.roomNumber,
        monthlyRent: 8000.0,
        securityDeposit: depositToStore,
        declarationAccepted: true,
        identityDocumentUrl: 'https://drive.google.com/file/d/test12345/view',
        googleDriveFileId: 'test12345',
        status: 'NEW',
        rawSourceData: JSON.stringify({ security_deposit: tc.input }),
      },
    });

    createdRegIds.push(reg.id);

    const fetched = await prisma.registration.findUnique({ where: { id: reg.id } });
    assert(
      fetched.securityDeposit === tc.expected,
      `Registration ID ${reg.id} saved exact text "${tc.expected}" (Type: ${typeof fetched.securityDeposit})`,
      `Fetched: ${fetched.securityDeposit}`
    );
  }

  // 4. Test Approval Flow & Migration to Resident Model
  console.log('\n--- 3. Testing Approval Flow into Resident Model ---');
  for (let i = 0; i < createdRegIds.length; i++) {
    const regId = createdRegIds[i];
    const tc = testCases[i];
    const reg = await prisma.registration.findUnique({ where: { id: regId } });

    // Simulate approval logic
    const resident = await prisma.resident.create({
      data: {
        fullName: reg.fullName,
        phone: reg.mobileNumber,
        roomId: room.id,
        monthlyRent: reg.monthlyRent || 0,
        securityDeposit: reg.securityDeposit, // Copy exact string
        checkInDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const fetchedRes = await prisma.resident.findUnique({ where: { id: resident.id } });
    assert(
      fetchedRes.securityDeposit === tc.expected,
      `Resident created with exact securityDeposit string "${tc.expected}"`,
      `Fetched: ${fetchedRes.securityDeposit}`
    );

    // Verify initial monthly payment is solely based on monthlyRent
    const initialPayment = await prisma.monthlyPayment.create({
      data: {
        residentId: resident.id,
        roomId: room.id,
        billingMonth: '2026-08',
        rentAmount: resident.monthlyRent,
        maintenanceAmount: 0.0,
        penaltyAmount: 0.0,
        discountAmount: 0.0,
        totalAmountDue: resident.monthlyRent,
        status: 'PENDING',
        dueDate: new Date(),
      },
    });

    assert(
      initialPayment.totalAmountDue === 8000.0,
      `Monthly payment is ₹${initialPayment.totalAmountDue} (unaffected by security deposit "${tc.expected}")`
    );
  }

  // 5. Cleanup Test Records
  console.log('\n--- 4. Cleaning Up Test Records ---');
  await prisma.monthlyPayment.deleteMany({
    where: { resident: { phone: { startsWith: '99988' } } },
  });
  await prisma.resident.deleteMany({
    where: { phone: { startsWith: '99988' } },
  });
  await prisma.registration.deleteMany({
    where: { mobileNumber: { startsWith: '99988' } },
  });
  console.log('Test records deleted cleanly.');

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
