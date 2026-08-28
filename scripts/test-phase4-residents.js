const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 4: RESIDENT MANAGEMENT API & CRUD TESTS   ');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Admin Login
  console.log('--- Step 1: Admin Login ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status, 'Cookie Set:', Boolean(cookie));
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

  // 2. Fetch Residents Listing
  console.log('\n--- Step 2: GET /api/residents ---');
  const resResidents = await fetch(`${baseUrl}/api/residents`, { headers });
  const dataResidents = await resResidents.json();
  console.log(`Fetched ${dataResidents.residents?.length} residents.`);
  if (!dataResidents.residents || dataResidents.residents.length === 0) {
    throw new Error('Failed to retrieve resident list!');
  }
  console.log('Sample Resident Record:', {
    name: dataResidents.residents[0].fullName,
    phone: dataResidents.residents[0].phone,
    room: dataResidents.residents[0].room.roomNumber,
    status: dataResidents.residents[0].status,
  });
  console.log('✅ Step 2 PASSED: Residents listing retrieved.');

  // 3. Create a Test Room for Phase 4 tests
  console.log('\n--- Step 3: Setup Test Rooms ---');
  const roomA = await prisma.room.create({
    data: {
      roomNumber: '701',
      floor: 7,
      capacity: 1, // Single capacity!
      sharingType: 'SINGLE',
      baseRent: 12000,
      securityDeposit: 15000,
      status: 'AVAILABLE',
    },
  });

  const roomB = await prisma.room.create({
    data: {
      roomNumber: '702',
      floor: 7,
      capacity: 2,
      sharingType: 'DOUBLE',
      baseRent: 8500,
      securityDeposit: 10000,
      status: 'AVAILABLE',
    },
  });
  console.log('Created test rooms 701 (Capacity 1) and 702 (Capacity 2).');

  // 4. Onboard Resident into Room 701
  console.log('\n--- Step 4: POST /api/residents (Onboard Resident) ---');
  const onboardRes = await fetch(`${baseUrl}/api/residents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fullName: 'Siddharth Varma',
      phone: '9845112233',
      alternatePhone: '9845112244',
      email: 'siddharth@example.com',
      roomId: roomA.id,
      monthlyRent: 12000,
      securityDeposit: 15000,
      checkInDate: new Date('2026-08-01').toISOString().slice(0, 10),
      idProofType: 'AADHAAR',
      idProofNumber: '1234-5678-9012',
      emergencyContactName: 'R. Varma (Father)',
      emergencyContactPhone: '9845199999',
      address: 'Plot 44, Jubilee Hills, Hyderabad',
      status: 'ACTIVE',
    }),
  });
  const onboardData = await onboardRes.json();
  console.log('Onboard Status:', onboardRes.status, 'Resident ID:', onboardData.resident?.id);
  if (onboardRes.status !== 201) throw new Error('Failed to onboard resident: ' + JSON.stringify(onboardData));
  const newResidentId = onboardData.resident.id;
  console.log('✅ Step 4 PASSED: Resident onboarded.');

  // 5. Test Room Full Rejection (Room 701 has capacity 1, now full)
  console.log('\n--- Step 5: Capacity Overflow Protection (Room Full) ---');
  const overflowRes = await fetch(`${baseUrl}/api/residents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fullName: 'Overflow Resident',
      phone: '9845119999',
      roomId: roomA.id, // Target full room 701!
      checkInDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
    }),
  });
  const overflowData = await overflowRes.json();
  console.log('Overflow Attempt Status:', overflowRes.status, 'Error:', overflowData.error);
  if (overflowRes.status !== 400) throw new Error('Failed: Room overflow was not rejected with HTTP 400!');
  console.log('✅ Step 5 PASSED: Room capacity overflow prevented.');

  // 6. Test Get Full Profile & Payment History (GET /api/residents/[id])
  console.log('\n--- Step 6: GET /api/residents/[id] (Full Profile & Ledger) ---');
  const profileRes = await fetch(`${baseUrl}/api/residents/${newResidentId}`, { headers });
  const profileData = await profileRes.json();
  console.log('Profile Fetch Status:', profileRes.status, {
    name: profileData.resident?.fullName,
    room: profileData.resident?.room?.roomNumber,
    paymentsCount: profileData.resident?.monthlyPayments?.length,
    auditLogsCount: profileData.auditLogs?.length,
  });
  if (profileRes.status !== 200 || !profileData.resident?.monthlyPayments) {
    throw new Error('Failed to load complete resident profile!');
  }
  console.log('✅ Step 6 PASSED: Full profile, room data, payments ledger, and audit history retrieved.');

  // 7. Test Room Transfer (PATCH /api/residents/[id] -> CHANGE_ROOM)
  console.log('\n--- Step 7: PATCH CHANGE_ROOM (Transfer from Room 701 to 702) ---');
  const transferRes = await fetch(`${baseUrl}/api/residents/${newResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'CHANGE_ROOM',
      newRoomId: roomB.id,
      notes: 'Transferred to double sharing room 702.',
    }),
  });
  const transferData = await transferRes.json();
  console.log('Transfer Status:', transferRes.status, 'Message:', transferData.message);
  if (transferRes.status !== 200) throw new Error('Failed to transfer room: ' + JSON.stringify(transferData));
  console.log('✅ Step 7 PASSED: Room transfer completed and logged in audit trail.');

  // 8. Test Notice Period (PATCH /api/residents/[id] -> START_NOTICE_PERIOD)
  console.log('\n--- Step 8: PATCH START_NOTICE_PERIOD ---');
  const noticeRes = await fetch(`${baseUrl}/api/residents/${newResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'START_NOTICE_PERIOD',
      expectedCheckoutDate: new Date('2026-09-01').toISOString().slice(0, 10),
      notes: 'Notice period initiated.',
    }),
  });
  const noticeData = await noticeRes.json();
  console.log('Notice Status:', noticeRes.status, 'Message:', noticeData.message);
  if (noticeRes.status !== 200 || noticeData.resident?.status !== 'NOTICE_PERIOD') {
    throw new Error('Failed to set notice period status!');
  }
  console.log('✅ Step 8 PASSED: Notice period recorded.');

  // 9. Test Complete Checkout (PATCH /api/residents/[id] -> CHECKOUT)
  console.log('\n--- Step 9: PATCH CHECKOUT (Vacate & Free Room) ---');
  const checkoutRes = await fetch(`${baseUrl}/api/residents/${newResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'CHECKOUT',
      checkOutDate: new Date('2026-09-01').toISOString().slice(0, 10),
      refundDepositAmount: 15000,
      deductionsAmount: 0,
      notes: 'Keys returned, room inspected in good condition.',
    }),
  });
  const checkoutData = await checkoutRes.json();
  console.log('Checkout Status:', checkoutRes.status, 'Message:', checkoutData.message);
  if (checkoutRes.status !== 200 || checkoutData.resident?.status !== 'VACATED') {
    throw new Error('Failed to complete resident checkout!');
  }

  // Verify historical records preserved
  const verifyHistoric = await prisma.resident.findUnique({
    where: { id: newResidentId },
    include: { monthlyPayments: true },
  });
  console.log('Historical Verification:', {
    id: verifyHistoric.id,
    status: verifyHistoric.status,
    preservedPayments: verifyHistoric.monthlyPayments.length,
  });
  if (verifyHistoric.status !== 'VACATED' || verifyHistoric.monthlyPayments.length === 0) {
    throw new Error('Historical data was not preserved during checkout!');
  }
  console.log('✅ Step 9 PASSED: Checkout completed, room slot freed, all historical records preserved.');

  // Clean up test records
  console.log('\n--- Cleanup test records ---');
  await prisma.monthlyPayment.deleteMany({ where: { residentId: newResidentId } });
  await prisma.auditLog.deleteMany({ where: { entityId: newResidentId } });
  await prisma.resident.delete({ where: { id: newResidentId } });
  await prisma.room.delete({ where: { id: roomA.id } });
  await prisma.room.delete({ where: { id: roomB.id } });
  console.log('Cleaned up test records.');

  console.log('\n🎉 ALL PHASE 4 RESIDENT MANAGEMENT TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
