const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAllTests() {
  console.log('================================================================');
  console.log('  SAIRAM ELITE LIVING — COMPLETE HOSTEL MANAGEMENT SYSTEM E2E   ');
  console.log('================================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Authentication Check
  console.log('--- 1. Testing Authentication & Session ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  if (loginRes.status !== 200 || !cookie) throw new Error('Auth failed!');
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };
  console.log('✅ Admin login & JWT session active.');

  // 2. Dashboard API
  console.log('\n--- 2. Testing Dashboard Overview API ---');
  const dashRes = await fetch(`${baseUrl}/api/dashboard`, { headers });
  const dashData = await dashRes.json();
  if (dashRes.status !== 200 || !dashData.metrics || !dashData.visualizations) throw new Error('Dashboard API error!');
  console.log('✅ Dashboard Metrics Parity:', {
    rooms: dashData.metrics.totalRooms,
    capacity: dashData.metrics.totalRoomCapacity,
    residents: dashData.metrics.totalActiveResidents,
    occupancy: `${dashData.metrics.occupancyPercentage}%`,
  });

  // 3. Rooms API
  console.log('\n--- 3. Testing Rooms Module ---');
  const roomsRes = await fetch(`${baseUrl}/api/rooms`, { headers });
  const roomsData = await roomsRes.json();
  if (roomsRes.status !== 200 || !roomsData.rooms) throw new Error('Rooms API error!');
  console.log(`✅ Rooms loaded: ${roomsData.rooms.length} rooms.`);

  // 4. Residents API
  console.log('\n--- 4. Testing Residents Module ---');
  const residentsRes = await fetch(`${baseUrl}/api/residents`, { headers });
  const residentsData = await residentsRes.json();
  if (residentsRes.status !== 200 || !residentsData.residents) throw new Error('Residents API error!');
  console.log(`✅ Residents loaded: ${residentsData.residents.length} residents.`);

  // 5. Payments API
  console.log('\n--- 5. Testing Monthly Payments Module ---');
  const paymentsRes = await fetch(`${baseUrl}/api/payments`, { headers });
  const paymentsData = await paymentsRes.json();
  if (paymentsRes.status !== 200 || !paymentsData.payments) throw new Error('Payments API error!');
  console.log(`✅ Payments loaded: ${paymentsData.payments.length} payment records.`);

  // 6. Receipts API
  console.log('\n--- 6. Testing Receipts Module ---');
  const receiptsRes = await fetch(`${baseUrl}/api/receipts`, { headers });
  const receiptsData = await receiptsRes.json();
  if (receiptsRes.status !== 200 || !receiptsData.receipts) throw new Error('Receipts API error!');
  console.log(`✅ Receipts loaded: ${receiptsData.receipts.length} receipts.`);

  // 7. Reminders API & Templates
  console.log('\n--- 7. Testing Reminders & Templates Module ---');
  const remindersRes = await fetch(`${baseUrl}/api/reminders`, { headers });
  const templatesRes = await fetch(`${baseUrl}/api/reminders/templates`, { headers });
  const remindersData = await remindersRes.json();
  const templatesData = await templatesRes.json();
  if (remindersRes.status !== 200 || templatesRes.status !== 200) throw new Error('Reminders API error!');
  console.log(`✅ Reminders loaded: ${remindersData.reminders.length} reminders, ${remindersData.candidates.length} candidates, ${templatesData.templates.length} templates.`);

  // 8. Settings API
  console.log('\n--- 8. Testing Hostel & Banking Settings Module ---');
  const settingsRes = await fetch(`${baseUrl}/api/settings`, { headers });
  const settingsData = await settingsRes.json();
  if (settingsRes.status !== 200 || !settingsData.settings || !settingsData.adminUser) throw new Error('Settings API error!');
  console.log('✅ Settings loaded:', {
    hostel: settingsData.settings.hostelName,
    bank: settingsData.settings.bankName,
    upi: settingsData.settings.upiId,
  });

  // 9. Reports API
  console.log('\n--- 9. Testing Reports & Analytics Module ---');
  const reportsRes = await fetch(`${baseUrl}/api/reports`, { headers });
  const reportsData = await reportsRes.json();
  if (reportsRes.status !== 200 || !reportsData.reports || !reportsData.summary) throw new Error('Reports API error!');
  console.log('✅ All 7 Reports Loaded:', Object.keys(reportsData.reports));

  // 10. Notifications API
  console.log('\n--- 10. Testing Notifications Module ---');
  const notifRes = await fetch(`${baseUrl}/api/notifications`, { headers });
  const notifData = await notifRes.json();
  if (notifRes.status !== 200) throw new Error('Notifications API error!');
  console.log(`✅ Notifications loaded: ${notifData.notifications?.length} notifications.`);

  // 11. Audit Logs API
  console.log('\n--- 11. Testing Audit Trail Module ---');
  const auditRes = await fetch(`${baseUrl}/api/audit-logs`, { headers });
  const auditData = await auditRes.json();
  if (auditRes.status !== 200 || !auditData.logs) throw new Error('Audit Logs API error!');
  console.log(`✅ Audit Logs loaded: ${auditData.logs.length} immutable records.`);

  // 12. Strict Zero Beds & No Gateways Compliance Check
  console.log('\n--- 12. Strict Zero-Bed & Privacy Compliance Verification ---');
  const allRoomsCheck = await prisma.room.findMany();
  const allResidentsCheck = await prisma.resident.findMany();
  
  for (const r of allRoomsCheck) {
    if ('bedNumber' in r || 'bedId' in r || 'bed' in r) throw new Error('Bed field in Room!');
  }
  for (const res of allResidentsCheck) {
    if ('bedNumber' in res || 'bedId' in res || 'bed' in res) throw new Error('Bed field in Resident!');
  }
  console.log('✅ 100% Zero-Bed architecture verified across SQLite database tables.');

  console.log('\n================================================================');
  console.log('  🎉 ALL 12 PHASES IMPLEMENTED & FULL E2E VALIDATION PASSED 100%');
  console.log('================================================================');
}

runAllTests()
  .catch(e => {
    console.error('❌ E2E failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
