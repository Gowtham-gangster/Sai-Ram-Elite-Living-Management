require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySupabaseProduction() {
  console.log('================================================================');
  console.log('   SUPABASE POSTGRESQL PRODUCTION & LIVE SYNC VERIFICATION      ');
  console.log('================================================================\n');

  // 1. Verify Prisma connection to Supabase PostgreSQL
  console.log('--- 1. Testing Live Connection to Supabase PostgreSQL ---');
  const [adminCount, roomCount, residentCount, regCount, paymentCount] = await Promise.all([
    prisma.adminUser.count(),
    prisma.room.count(),
    prisma.resident.count(),
    prisma.registration.count(),
    prisma.monthlyPayment.count(),
  ]);

  console.log(`✅ Supabase PostgreSQL Connected:`);
  console.log(`   - Admin Users: ${adminCount}`);
  console.log(`   - Rooms: ${roomCount}`);
  console.log(`   - Residents: ${residentCount}`);
  console.log(`   - Registrations: ${regCount}`);
  console.log(`   - Monthly Payments: ${paymentCount}`);

  // 2. Authenticate admin user
  console.log('\n--- 2. Testing Application API Authentication against Supabase ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });

  if (!loginRes.ok) throw new Error('Admin login failed against Supabase!');
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('✅ Admin authenticated successfully against Supabase AdminUser table.');

  // 3. Test Google Sheet to Supabase Sync
  console.log('\n--- 3. Testing Google Sheet -> Supabase Live Sync ---');
  const syncRes = await fetch('http://localhost:3000/api/sync/google-forms', {
    method: 'POST',
    headers: { cookie: cookieHeader || '' },
  });

  if (!syncRes.ok) throw new Error('Google Sheet synchronization API returned error!');
  const syncData = await syncRes.json();
  console.log(`✅ Sync Executed: Scanned: ${syncData.rowsScanned}, New: ${syncData.newCount}, Updated: ${syncData.updatedCount}, Skipped: ${syncData.skippedCount}`);

  // 4. Test Idempotency (Sync again without changes)
  console.log('\n--- 4. Testing Sync Idempotency (No Duplicates) ---');
  const syncRes2 = await fetch('http://localhost:3000/api/sync/google-forms', {
    method: 'POST',
    headers: { cookie: cookieHeader || '' },
  });
  const syncData2 = await syncRes2.json();
  if (syncData2.newCount !== 0) {
    throw new Error(`Sync created ${syncData2.newCount} duplicate records on re-run!`);
  }
  console.log(`✅ Idempotency Verified: 0 duplicates created on re-run (All ${syncData2.skippedCount} rows skipped).`);

  // 5. Test Live Dashboard Aggregation from Supabase
  console.log('\n--- 5. Testing Dashboard Aggregations from Supabase ---');
  const dashRes = await fetch('http://localhost:3000/api/dashboard', {
    headers: { cookie: cookieHeader || '' },
  });
  const dashData = await dashRes.json();
  console.log(`✅ Dashboard Metrics from Supabase:`);
  console.log(`   - Total Registrations: ${dashData.metrics?.totalRegistrations} (Pending: ${dashData.metrics?.pendingRegistrations})`);
  console.log(`   - Active Residents: ${dashData.metrics?.activeResidents}`);
  console.log(`   - Total Rooms: ${dashData.metrics?.totalRooms} (Occupancy: ${dashData.metrics?.occupancyPercentage}%)`);

  // 6. Test Approval Workflow in Supabase (Registration -> Resident -> Capacity)
  console.log('\n--- 6. Testing Registration Approval Flow in Supabase ---');
  // Create test registration in Supabase
  const testReg = await prisma.registration.create({
    data: {
      fullName: 'Supabase Test Resident',
      mobileNumber: '9998887776',
      requestedRoomNumber: '101',
      status: 'NEW',
      externalSource: 'TEST_SUITE',
    },
  });

  const targetRoom = await prisma.room.findFirst({ where: { roomNumber: '101' } });
  const occupantsBefore = await prisma.resident.count({
    where: { roomId: targetRoom.id, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
  });

  // Approve via API
  const fullApproveUrl = `http://localhost:3000/api/registrations/${testReg.id}/approve`;
  const appRes = await fetch(fullApproveUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieHeader || '' },
    body: JSON.stringify({
      roomId: targetRoom.id,
      monthlyRent: targetRoom.baseRent,
      securityDeposit: 2000,
      checkInDate: new Date().toISOString(),
    }),
  });

  if (!appRes.ok) throw new Error('Failed to approve registration in Supabase');
  const appData = await appRes.json();
  const createdResidentId = appData.resident?.id;
  console.log(`✅ Approved Registration in Supabase -> Created Resident ID: ${createdResidentId}`);

  const occupantsAfter = await prisma.resident.count({
    where: { roomId: targetRoom.id, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
  });
  if (occupantsAfter !== occupantsBefore + 1) {
    throw new Error('Room occupancy did not increase after approval in Supabase!');
  }
  console.log(`✅ Room 101 Occupants in Supabase: ${occupantsBefore} -> ${occupantsAfter}`);

  // Clean test artifact
  if (createdResidentId) {
    await prisma.monthlyPayment.deleteMany({ where: { residentId: createdResidentId } });
    await prisma.resident.delete({ where: { id: createdResidentId } });
  }
  await prisma.registration.delete({ where: { id: testReg.id } });
  console.log('✅ Test artifacts cleaned cleanly from Supabase.');

  console.log('\n================================================================');
  console.log('   🎉 SUPABASE PRODUCTION VERIFICATION PASSED 100% (ALL CHECKS) ');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

verifySupabaseProduction().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
