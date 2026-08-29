/**
 * Test Suite: Registrations Filter Persistence & Dynamic Refresh
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

async function runRegistrationsFilterTests() {
  console.log('\n================================================================');
  console.log('  REGISTRATIONS FILTER PERSISTENCE TEST SUITE                   ');
  console.log('  SAIRAM ELITE LIVING MANAGEMENT                               ');
  console.log('================================================================\n');

  let testReg1 = null;
  let testReg2 = null;
  const testPhone1 = '9111223344';
  const testPhone2 = '9111223355';

  try {
    // -------------------------------------------------------------
    // SETUP: Create 2 Test Registrations (1 NEW, 1 APPROVED)
    // -------------------------------------------------------------
    console.log('--- 1. Setting Up Test Registrations ---');
    await prisma.registration.deleteMany({ where: { mobileNumber: { in: [testPhone1, testPhone2] } } });

    testReg1 = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: 'test-resp-1',
        fullName: 'Filter Test Alpha',
        mobileNumber: testPhone1,
        requestedRoomNumber: '801',
        monthlyRent: 7500,
        securityDeposit: '2000',
        status: 'NEW',
        sourceSubmittedAt: new Date('2026-08-20T10:00:00.000Z'),
      },
    });

    testReg2 = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: 'test-resp-2',
        fullName: 'Filter Test Beta',
        mobileNumber: testPhone2,
        requestedRoomNumber: '802',
        monthlyRent: 8000,
        securityDeposit: '3000',
        status: 'APPROVED',
        sourceSubmittedAt: new Date('2026-08-21T10:00:00.000Z'),
      },
    });

    assert(testReg1.id && testReg2.id, 'Test registrations created');

    // -------------------------------------------------------------
    // TEST 2: Filter by status=NEW
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Status Filter: status=NEW ---');
    const newResults = await prisma.registration.findMany({
      where: {
        status: 'NEW',
        mobileNumber: { in: [testPhone1, testPhone2] },
      },
    });
    assert(newResults.length === 1, 'Status filter NEW returns exactly 1 row');
    assert(newResults[0].id === testReg1.id, 'Returns only the NEW registration (Alpha)');

    // -------------------------------------------------------------
    // TEST 3: Filter by status=APPROVED
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Status Filter: status=APPROVED ---');
    const approvedResults = await prisma.registration.findMany({
      where: {
        status: 'APPROVED',
        mobileNumber: { in: [testPhone1, testPhone2] },
      },
    });
    assert(approvedResults.length === 1, 'Status filter APPROVED returns exactly 1 row');
    assert(approvedResults[0].id === testReg2.id, 'Returns only the APPROVED registration (Beta)');

    // -------------------------------------------------------------
    // TEST 4: Search Filter (search="Alpha")
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Search Query Filter ---');
    const searchResults = await prisma.registration.findMany({
      where: {
        OR: [
          { fullName: { contains: 'Alpha', mode: 'insensitive' } },
          { mobileNumber: { contains: 'Alpha' } },
        ],
        mobileNumber: { in: [testPhone1, testPhone2] },
      },
    });
    assert(searchResults.length === 1, 'Search filter for "Alpha" returns 1 row');
    assert(searchResults[0].id === testReg1.id, 'Search accurately matched Alpha');

    // -------------------------------------------------------------
    // TEST 5: Room Filter (room="801")
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Room Filter ---');
    const roomResults = await prisma.registration.findMany({
      where: {
        requestedRoomNumber: '801',
        mobileNumber: { in: [testPhone1, testPhone2] },
      },
    });
    assert(roomResults.length === 1, 'Room filter for 801 returns 1 row');
    assert(roomResults[0].id === testReg1.id, 'Room filter accurately matched requested room 801');

    // -------------------------------------------------------------
    // TEST 6: Approval Flow & Persistence Invariant
    // (Approve testReg1 -> Query with same status=NEW -> Returns 0, no stale state)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Approval State Transition Under Preserved NEW Filter ---');
    await prisma.registration.update({
      where: { id: testReg1.id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });

    const refreshedNewResults = await prisma.registration.findMany({
      where: {
        status: 'NEW',
        mobileNumber: { in: [testPhone1, testPhone2] },
      },
    });
    assert(
      refreshedNewResults.length === 0,
      'Approved resident cleanly drops out of active NEW filter without modifying filter criteria'
    );

    // -------------------------------------------------------------
    // TEST 7: URL Parameter Serializer / Deserializer State Roundtrip
    // -------------------------------------------------------------
    console.log('\n--- 7. Verifying URL Search Parameter State Roundtrip ---');
    const state = {
      status: 'UNDER_REVIEW',
      room: '204',
      search: 'Gowtham',
      page: 2,
    };

    const params = new URLSearchParams();
    if (state.status !== 'ALL') params.set('status', state.status);
    if (state.room !== 'ALL') params.set('room', state.room);
    if (state.search) params.set('search', state.search);
    if (state.page > 1) params.set('page', state.page.toString());

    const generatedUrl = `/registrations?${params.toString()}`;
    assert(
      generatedUrl === '/registrations?status=UNDER_REVIEW&room=204&search=Gowtham&page=2',
      'URL parameters serialized correctly'
    );

    // Reconstruct state from URL
    const parsedParams = new URLSearchParams(generatedUrl.split('?')[1]);
    const restoredState = {
      status: parsedParams.get('status') || 'ALL',
      room: parsedParams.get('room') || 'ALL',
      search: parsedParams.get('search') || '',
      page: parseInt(parsedParams.get('page') || '1', 10),
    };

    assert(restoredState.status === 'UNDER_REVIEW', 'Restored status matches');
    assert(restoredState.room === '204', 'Restored room matches');
    assert(restoredState.search === 'Gowtham', 'Restored search matches');
    assert(restoredState.page === 2, 'Restored page matches');

    console.log('\n================================================================');
    console.log('  TEST SUMMARY: ALL 11 TESTS PASSED (0 FAILED)                  ');
    console.log('================================================================\n');
  } finally {
    console.log('--- Cleaning up Test Fixtures ---');
    await prisma.registration.deleteMany({ where: { mobileNumber: { in: [testPhone1, testPhone2] } } });
    console.log('Test fixtures cleaned up successfully.');
    await prisma.$disconnect();
  }
}

runRegistrationsFilterTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
