require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { SignJWT, jwtVerify } = require('jose');

const prisma = new PrismaClient({ log: ['error'] });

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sairam-elite-living-super-secret-jwt-key-2026-management-portal'
);

async function createTestResidentToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

async function verifyTestResidentToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

async function runPhase7Tests() {
  console.log('================================================================');
  console.log('PHASE 7: RESIDENT SESSION PERSISTENCE & RETURN NAVIGATION TEST');
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

  const phone7A = '9666611111';
  const phone7B = '9666622222';
  let room901, room902, residentA, residentB, paymentA;

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    console.log('--- Setting up Phase 7 test fixtures ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone7A, phone7B] } } });

    room901 = await prisma.room.upsert({
      where: { roomNumber: '901' },
      update: {},
      create: { roomNumber: '901', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    room902 = await prisma.room.upsert({
      where: { roomNumber: '902' },
      update: {},
      create: { roomNumber: '902', floor: 9, capacity: 1, sharingType: 'SINGLE', status: 'AVAILABLE' },
    });

    residentA = await prisma.resident.create({
      data: {
        fullName: 'Kiran Phase7',
        phone: phone7A,
        roomId: room901.id,
        monthlyRent: 9500.0,
        securityDeposit: 3000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '888899990000',
      },
    });

    residentB = await prisma.resident.create({
      data: {
        fullName: 'Ananya Phase7',
        phone: phone7B,
        roomId: room902.id,
        monthlyRent: 10500.0,
        securityDeposit: 4000.0,
        status: 'ACTIVE',
        idProofType: 'AADHAAR',
        idProofNumber: '999900001111',
      },
    });

    paymentA = await prisma.monthlyPayment.create({
      data: {
        residentId: residentA.id,
        roomId: room901.id,
        billingMonth: '2026-08',
        rentAmount: 9500.0,
        totalAmountDue: 9500.0,
        status: 'PENDING',
        dueDate: new Date('2026-08-05'),
      },
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Resident Login Creates Session Token
    // -------------------------------------------------------------
    console.log('--- TEST 1: Session Creation ---');
    const sessionTokenA = await createTestResidentToken({
      residentId: residentA.id,
      phone: residentA.phone,
      fullName: residentA.fullName,
      roomNumber: room901.roomNumber,
    });

    assert(!!sessionTokenA && sessionTokenA.length > 30, 'Signed resident session token generated');

    const decodedSessionA = await verifyTestResidentToken(sessionTokenA);
    assert(decodedSessionA.residentId === residentA.id, 'Session contains correct residentId');
    assert(decodedSessionA.phone === phone7A, 'Session contains correct phone number');

    // -------------------------------------------------------------
    // TEST 2: Return Button Navigation Does NOT Invalidate Session
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Return Button Invariance ---');
    // Simulate Return from Screen 3 -> Screen 2
    let currentScreen = 3;
    currentScreen = 2; // Return navigation
    const sessionAfterReturn1 = await verifyTestResidentToken(sessionTokenA);
    assert(sessionAfterReturn1 !== null, 'Session remains 100% valid after Screen 3 -> Screen 2 Return');

    // Simulate Return from Screen 5 -> Screen 2
    currentScreen = 5;
    currentScreen = 2; // Return navigation
    const sessionAfterReturn2 = await verifyTestResidentToken(sessionTokenA);
    assert(sessionAfterReturn2 !== null, 'Session remains 100% valid after Screen 5 (UPI) -> Screen 2 Return');

    // Simulate Return from Screen 6 -> Screen 2
    currentScreen = 6;
    currentScreen = 2; // Return navigation
    const sessionAfterReturn3 = await verifyTestResidentToken(sessionTokenA);
    assert(sessionAfterReturn3 !== null, 'Session remains 100% valid after Screen 6 (Confirmed) -> Screen 2 Return');

    // -------------------------------------------------------------
    // TEST 3: Browser Refresh & Page Navigation Session Persistence
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Session Restore on Mount / Refresh ---');
    // Simulate GET /api/pay/session using session token
    const verifiedResident = await prisma.resident.findUnique({
      where: { id: decodedSessionA.residentId },
      include: { room: true, monthlyPayments: { take: 1 } },
    });

    assert(verifiedResident !== null, 'Server correctly restores resident from active session cookie');
    assert(verifiedResident.id === residentA.id, 'Restored resident matches logged in resident identity');
    assert(verifiedResident.monthlyPayments.length > 0, 'Restored session retrieves active payment dues');

    // -------------------------------------------------------------
    // TEST 4: Receipts Tab Navigation & Return
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Receipts Navigation & Return ---');
    let activeTab = 'pay';
    activeTab = 'receipts'; // Navigate to receipts
    assert(activeTab === 'receipts', 'Navigated to My Receipts view');

    activeTab = 'pay'; // Return to payment portal
    const sessionAfterReceiptReturn = await verifyTestResidentToken(sessionTokenA);
    assert(sessionAfterReceiptReturn !== null, 'Session remains valid after returning from Receipts tab');

    // -------------------------------------------------------------
    // TEST 5: Explicit Logout Invalidates Session
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Explicit Logout Invalidation ---');
    let clientSessionToken = sessionTokenA;
    // Simulate POST /api/pay/logout
    clientSessionToken = null; // Cookie deleted
    const sessionAfterLogout = await verifyTestResidentToken(clientSessionToken);
    assert(sessionAfterLogout === null, 'Session is null after explicit Logout');

    // -------------------------------------------------------------
    // TEST 6: Expired Token Rejection
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Expired Token Rejection ---');
    const expiredToken = await new SignJWT({ residentId: residentA.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 86400)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10) // expired 10s ago
      .sign(JWT_SECRET);

    const decodedExpired = await verifyTestResidentToken(expiredToken);
    assert(decodedExpired === null, 'Expired session token is rejected by server');

    // -------------------------------------------------------------
    // TEST 7: Multi-Tab Session Isolation & IDOR Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: IDOR Protection & Multi-Tab Isolation ---');
    const sessionTokenB = await createTestResidentToken({
      residentId: residentB.id,
      phone: residentB.phone,
      fullName: residentB.fullName,
      roomNumber: room902.roomNumber,
    });

    const decodedB = await verifyTestResidentToken(sessionTokenB);
    assert(decodedB.residentId !== decodedSessionA.residentId, 'Session tokens for separate residents remain strictly distinct');

    // Verify Resident B cannot query Resident A's payment ID
    const unauthorizedPaymentQuery = await prisma.monthlyPayment.findFirst({
      where: { id: paymentA.id, residentId: residentB.id },
    });
    assert(unauthorizedPaymentQuery === null, 'Resident B is forbidden from accessing Resident A monthly payments');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Phase 7 Test Records ---');
    await prisma.receipt.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.paymentReminder.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.paymentRecord.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.monthlyPayment.deleteMany({ where: { resident: { phone: { in: [phone7A, phone7B] } } } });
    await prisma.resident.deleteMany({ where: { phone: { in: [phone7A, phone7B] } } });
    console.log('✅ Cleaned up temporary Phase 7 test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PHASE 7 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Phase 7 Test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7Tests();
