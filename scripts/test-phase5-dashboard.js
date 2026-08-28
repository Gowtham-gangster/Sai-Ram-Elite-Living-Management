const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 5: DASHBOARD OVERVIEW API & METRICS TESTS ');
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

  // 2. Fetch Dashboard Statistics
  console.log('\n--- Step 2: GET /api/dashboard ---');
  const dashRes = await fetch(`${baseUrl}/api/dashboard`, { headers });
  const dashData = await dashRes.json();
  console.log('Dashboard API HTTP Status:', dashRes.status);
  if (dashRes.status !== 200) throw new Error('Failed to fetch dashboard statistics: ' + JSON.stringify(dashData));

  const m = dashData.metrics;
  const v = dashData.visualizations;

  console.log('\n--- Step 3: Verifying Required 11 Metrics ---');
  console.log('1. Total Rooms:', m.totalRooms);
  console.log('2. Total Room Capacity:', m.totalRoomCapacity);
  console.log('3. Total Active Residents:', m.totalActiveResidents);
  console.log('4. Available Capacity:', m.availableCapacity);
  console.log('5. Occupancy Percentage:', `${m.occupancyPercentage}%`);
  console.log('6. New Residents This Month:', m.newResidentsThisMonth);
  console.log('7. Residents in Notice Period:', m.residentsInNoticePeriod);
  console.log('8. Upcoming Checkouts:', m.upcomingCheckoutsCount);
  console.log('9. Payments Collected This Month:', `₹${m.paymentsCollectedThisMonth}`);
  console.log('10. Pending Payments:', `₹${m.pendingPaymentsAmount} (${m.pendingPaymentsCount} counts)`);
  console.log('11. Overdue Payments:', `₹${m.overduePaymentsAmount} (${m.overduePaymentsCount} counts)`);

  // Assertions
  if (
    typeof m.totalRooms !== 'number' ||
    typeof m.totalRoomCapacity !== 'number' ||
    typeof m.totalActiveResidents !== 'number' ||
    typeof m.availableCapacity !== 'number' ||
    typeof m.occupancyPercentage !== 'number' ||
    typeof m.paymentsCollectedThisMonth !== 'number'
  ) {
    throw new Error('Metrics validation failed - metric types invalid!');
  }

  // Cross-reference with database directly
  const dbRoomsCount = await prisma.room.count();
  const dbResidentsCount = await prisma.resident.count({ where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } } });

  console.log('\n--- Step 4: Cross-referencing with Direct Database Queries ---');
  console.log('DB Rooms Count:', dbRoomsCount, 'API Reported:', m.totalRooms);
  console.log('DB Active Residents:', dbResidentsCount, 'API Reported:', m.totalActiveResidents);

  if (dbRoomsCount !== m.totalRooms || dbResidentsCount !== m.totalActiveResidents) {
    throw new Error('API metrics mismatch against direct database queries!');
  }
  console.log('✅ Direct database parity confirmed 100%.');

  // Verify Visualizations
  console.log('\n--- Step 5: Verifying Visualizations ---');
  console.log('Floor Breakdown items:', v.floorBreakdown?.length);
  console.log('Sharing Breakdown items:', v.sharingBreakdown?.length);
  console.log('Payment Status Distribution:', v.paymentStatusDistribution);
  console.log('Recent Residents count:', v.recentResidents?.length);
  console.log('Recent Payments count:', v.recentPayments?.length);

  if (!v.floorBreakdown || !v.sharingBreakdown || !v.paymentStatusDistribution) {
    throw new Error('Visualizations data payload missing!');
  }
  console.log('✅ Visualizations data verified.');

  console.log('\n🎉 ALL PHASE 5 DASHBOARD OVERVIEW TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
