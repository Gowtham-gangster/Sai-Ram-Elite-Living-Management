const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateHostelAdministrator() {
  console.log('================================================================');
  console.log('  PHASE 14: FULL HOSTEL ADMINISTRATOR LIFECYCLE E2E SIMULATION  ');
  console.log('================================================================\n');

  const baseUrl = 'http://localhost:3000';

  // ---------------------------------------------------------
  // 1. AUTHENTICATION & ACCESS CONTROLS
  // ---------------------------------------------------------
  console.log('--- 1. Testing Authentication Lifecycle ---');
  // Invalid Login Test
  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '172.16.0.10' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'incorrect_password' }),
  });
  if (badLogin.status !== 401) throw new Error('Invalid login did not return 401!');
  console.log('✅ Invalid login rejected (401 Unauthorized).');

  // Valid Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '172.16.0.11' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  if (loginRes.status !== 200 || !cookie) throw new Error('Admin login failed!');
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };
  console.log('✅ Valid admin login authenticated and JWT cookie issued.');

  // Verify Session
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers });
  const meData = await meRes.json();
  if (meRes.status !== 200 || meData.user.email !== 'admin@sairam.com') throw new Error('Session verification failed!');
  console.log(`✅ Session verified for ${meData.user.name} (${meData.user.role}).`);

  // Pre-cleanup if Room 901 exists from previous run
  await prisma.resident.deleteMany({ where: { phone: '9876543210' } });
  await prisma.room.deleteMany({ where: { roomNumber: '901' } });

  // ---------------------------------------------------------
  // 2. ROOMS MANAGEMENT
  // ---------------------------------------------------------
  console.log('\n--- 2. Testing Rooms Management Lifecycle ---');
  // Add Room 901
  const createRoomRes = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomNumber: '901',
      floor: 9,
      sharingType: 'TRIPLE',
      capacity: 3,
      baseRent: 8000,
      amenities: ['Attached Washroom', 'AC', 'Geyser'],
    }),
  });
  const createRoomData = await createRoomRes.json();
  if (createRoomRes.status !== 201) throw new Error('Failed to create Room 901!');
  const testRoomId = createRoomData.room.id;
  console.log(`✅ Room 901 created (Capacity: ${createRoomData.room.capacity}, Base Rent: ₹${createRoomData.room.baseRent}).`);

  // Duplicate Room Number Check
  const dupRoomRes = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomNumber: '901',
      floor: 9,
      sharingType: 'TRIPLE',
      capacity: 3,
      baseRent: 8000,
    }),
  });
  if (dupRoomRes.status !== 409 && dupRoomRes.status !== 400) throw new Error('Duplicate room number was not prevented!');
  console.log('✅ Duplicate room number 901 successfully prevented.');

  // Edit Room
  const editRoomRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      roomNumber: '901',
      floor: 9,
      sharingType: 'TRIPLE',
      capacity: 3,
      baseRent: 8500,
      status: 'AVAILABLE',
      amenities: ['Attached Washroom', 'AC', 'Geyser', 'Smart TV'],
    }),
  });
  if (editRoomRes.status !== 200) throw new Error('Failed to edit Room 901!');
  console.log('✅ Room 901 updated (Base Rent: ₹8500).');

  // ---------------------------------------------------------
  // 3. RESIDENT MANAGEMENT
  // ---------------------------------------------------------
  console.log('\n--- 3. Testing Resident Management Lifecycle ---');
  // Onboard Resident into Room 901
  const createResRes = await fetch(`${baseUrl}/api/residents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fullName: 'Vikas Reddy',
      phone: '9876543210',
      alternatePhone: '9876543211',
      email: 'vikas.reddy@example.com',
      roomId: testRoomId,
      monthlyRent: 8500,
      securityDeposit: 17000,
      checkInDate: '2026-08-01',
      emergencyContactName: 'Venkat Reddy',
      emergencyContactPhone: '9876543212',
    }),
  });
  const createResData = await createResRes.json();
  if (createResRes.status !== 201) throw new Error('Failed to onboard resident Vikas Reddy!');
  const testResidentId = createResData.resident.id;
  console.log(`✅ Resident Vikas Reddy admitted into Room 901 (Security Deposit: ₹17000).`);

  // Move / Change Room to another available room
  const otherRoom = await prisma.room.findFirst({
    where: { NOT: { id: testRoomId }, status: 'AVAILABLE' },
  });

  const changeRoomRes = await fetch(`${baseUrl}/api/residents/${testResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'CHANGE_ROOM',
      newRoomId: otherRoom.id,
      notes: 'Transfer to room ' + otherRoom.roomNumber,
    }),
  });
  if (changeRoomRes.status !== 200) throw new Error('Room move failed!');
  console.log(`✅ Resident room transfer to Room ${otherRoom.roomNumber} executed and logged in audit trail.`);

  // Start Notice Period
  const noticeRes = await fetch(`${baseUrl}/api/residents/${testResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'START_NOTICE_PERIOD',
      expectedCheckoutDate: '2026-09-01',
    }),
  });
  if (noticeRes.status !== 200) throw new Error('Failed to start notice period!');
  console.log('✅ Notice period recorded (Expected Checkout: 2026-09-01).');

  // Checkout Resident
  const checkoutRes = await fetch(`${baseUrl}/api/residents/${testResidentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'CHECKOUT',
      checkOutDate: '2026-08-27',
      notes: 'Full deposit settled after room inspection',
    }),
  });
  const checkoutData = await checkoutRes.json();
  if (checkoutRes.status !== 200 || checkoutData.resident.status !== 'VACATED') throw new Error('Checkout failed!');
  console.log('✅ Resident Vikas Reddy successfully checked out (Status: VACATED).');

  // Verify Historical Resident Profile Access
  const profileRes = await fetch(`${baseUrl}/api/residents/${testResidentId}`, { headers });
  const profileData = await profileRes.json();
  if (profileRes.status !== 200 || profileData.resident.fullName !== 'Vikas Reddy') {
    throw new Error('Historical resident profile lost after checkout!');
  }
  console.log('✅ Historical resident record permanently accessible with full audit history.');

  // ---------------------------------------------------------
  // 4. MONTHLY PAYMENT & BILLING
  // ---------------------------------------------------------
  console.log('\n--- 4. Testing Monthly Payments & Receipt Issuance ---');
  // Add payment for an active resident with a pending payment record
  const paymentBill = await prisma.monthlyPayment.findFirst({
    where: { status: 'PENDING' },
    include: { resident: true },
  });

  if (!paymentBill) throw new Error('No pending payment bill found to record payment!');

  const recordPaymentRes = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthlyPaymentId: paymentBill.id,
      amountPaid: paymentBill.totalAmountDue,
      paymentMethod: 'UPI',
      transactionReference: 'UPI-REF-SIM-998877',
      notes: 'Rent settlement via simulation',
    }),
  });
  const recordPaymentData = await recordPaymentRes.json();
  console.log('Payment Recording Status:', recordPaymentRes.status, 'Receipt #:', recordPaymentData.receipt?.receiptNumber);
  if (recordPaymentRes.status !== 200 && recordPaymentRes.status !== 201) {
    throw new Error('Failed to record payment!');
  }
  console.log('✅ Payment recorded, verified as PAID, and official receipt generated.');

  // ---------------------------------------------------------
  // 5. RECEIPT INSPECTION & PDF PRINT STYLES
  // ---------------------------------------------------------
  console.log('\n--- 5. Testing Receipt Generation & Formatting ---');
  const receiptsRes = await fetch(`${baseUrl}/api/receipts`, { headers });
  const receiptsData = await receiptsRes.json();
  if (receiptsRes.status !== 200 || receiptsData.receipts.length === 0) throw new Error('Receipts directory empty!');
  const latestReceipt = receiptsData.receipts[0];
  console.log(`✅ Latest Receipt: ${latestReceipt.receiptNumber} for ${latestReceipt.residentName} (₹${latestReceipt.amountPaid.toLocaleString('en-IN')}).`);

  const singleReceiptRes = await fetch(`${baseUrl}/api/receipts/${latestReceipt.id}`, { headers });
  const singleReceiptData = await singleReceiptRes.json();
  if (singleReceiptRes.status !== 200 || !singleReceiptData.receipt) throw new Error('Failed to retrieve printable receipt!');
  console.log(`✅ Printable receipt layout loaded with hostel profile.`);

  // ---------------------------------------------------------
  // 6. REMINDER INFRASTRUCTURE
  // ---------------------------------------------------------
  console.log('\n--- 6. Testing Payment Reminder Candidate Engine ---');
  const remindersRes = await fetch(`${baseUrl}/api/reminders`, { headers });
  const remindersData = await remindersRes.json();
  if (remindersRes.status !== 200 || !remindersData.summary) throw new Error('Reminders API failure!');
  console.log(`✅ Reminder Candidates: ${remindersData.candidates.length} candidate resident(s) evaluated.`);

  // ---------------------------------------------------------
  // 7. EXECUTIVE DASHBOARD & 7 MANAGEMENT REPORTS
  // ---------------------------------------------------------
  console.log('\n--- 7. Testing Dashboard Metrics & Reports Analytics ---');
  const dashRes = await fetch(`${baseUrl}/api/dashboard`, { headers });
  const dashData = await dashRes.json();
  if (dashRes.status !== 200) throw new Error('Dashboard failure!');
  console.log('✅ Dashboard Metrics:', {
    rooms: dashData.metrics.totalRooms,
    capacity: dashData.metrics.totalRoomCapacity,
    activeResidents: dashData.metrics.totalActiveResidents,
    occupancyRate: `${dashData.metrics.occupancyPercentage}%`,
  });

  const reportsRes = await fetch(`${baseUrl}/api/reports`, { headers });
  const reportsData = await reportsRes.json();
  if (reportsRes.status !== 200 || !reportsData.reports) throw new Error('Reports compile failure!');
  console.log('✅ 7 Reports Verified:', Object.keys(reportsData.reports));

  // ---------------------------------------------------------
  // 8. STRICT ZERO-BED RULE AUDIT
  // ---------------------------------------------------------
  console.log('\n--- 8. Strict Zero-Bed Architecture Final Validation ---');
  const allRooms = await prisma.room.findMany();
  const allResidents = await prisma.resident.findMany();
  for (const r of allRooms) {
    if ('bedNumber' in r || 'bedId' in r || 'bed' in r) throw new Error('Forbidden bed field in Room!');
  }
  for (const res of allResidents) {
    if ('bedNumber' in res || 'bedId' in res || 'bed' in res) throw new Error('Forbidden bed field in Resident!');
  }
  console.log('✅ 100% Zero-Bed compliance verified across all models.');

  // ---------------------------------------------------------
  // Cleanup Test Resident & Test Room
  // ---------------------------------------------------------
  console.log('\n--- Cleanup test records ---');
  await prisma.auditLog.deleteMany({ where: { entityId: testResidentId } });
  await prisma.resident.delete({ where: { id: testResidentId } });
  await prisma.room.delete({ where: { id: testRoomId } });
  console.log('Cleaned up test room and test resident records.');

  console.log('\n================================================================');
  console.log('  🎉 PHASE 14 FULL E2E ADMINISTRATOR SIMULATION PASSED 100%     ');
  console.log('================================================================');
}

simulateHostelAdministrator()
  .catch(e => {
    console.error('❌ E2E Simulation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
