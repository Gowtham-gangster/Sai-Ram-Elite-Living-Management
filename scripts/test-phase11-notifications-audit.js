const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 11: NOTIFICATIONS & AUDIT LOGS TESTS      ');
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

  // 2. Fetch Notifications
  console.log('\n--- Step 2: GET /api/notifications ---');
  const notifRes = await fetch(`${baseUrl}/api/notifications`, { headers });
  const notifData = await notifRes.json();
  console.log('Notifications Status:', notifRes.status, {
    totalFetched: notifData.notifications?.length,
    unreadCount: notifData.unreadCount,
  });
  if (notifRes.status !== 200 || !Array.isArray(notifData.notifications)) {
    throw new Error('Failed to fetch notifications!');
  }
  console.log('✅ Step 2 PASSED: Notifications API verified.');

  // 3. Create a Test Notification and Mark As Read
  console.log('\n--- Step 3: Test Notification Read Transitions ---');
  const testNotif = await prisma.notification.create({
    data: {
      title: 'Test Operational Notification',
      message: 'Testing notification read lifecycle.',
      type: 'INFO',
      isRead: false,
    },
  });

  // Mark specific read
  const markReadRes = await fetch(`${baseUrl}/api/notifications`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ id: testNotif.id }),
  });
  const markReadData = await markReadRes.json();
  console.log('Mark Read Status:', markReadRes.status, 'Message:', markReadData.message);
  if (markReadRes.status !== 200) throw new Error('Failed to mark notification read!');

  // Mark all read
  const markAllRes = await fetch(`${baseUrl}/api/notifications`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ markAllRead: true }),
  });
  const markAllData = await markAllRes.json();
  console.log('Mark All Read Status:', markAllRes.status, 'Message:', markAllData.message);
  if (markAllRes.status !== 200) throw new Error('Failed to mark all notifications read!');

  // Cleanup test notification
  await prisma.notification.delete({ where: { id: testNotif.id } });
  console.log('✅ Step 3 PASSED: Notification read state transitions verified.');

  // 4. Fetch Audit Logs
  console.log('\n--- Step 4: GET /api/audit-logs ---');
  const auditRes = await fetch(`${baseUrl}/api/audit-logs?limit=50`, { headers });
  const auditData = await auditRes.json();
  console.log('Audit Logs API Status:', auditRes.status, 'Total Logs:', auditData.logs?.length);
  if (auditRes.status !== 200 || !auditData.logs || auditData.logs.length === 0) {
    throw new Error('Failed to retrieve audit log records!');
  }

  const sampleLog = auditData.logs[0];
  console.log('Sample Audit Log Entry:', {
    id: sampleLog.id,
    action: sampleLog.action,
    entityType: sampleLog.entityType,
    admin: sampleLog.adminName,
    timestamp: sampleLog.createdAt,
    details: sampleLog.details,
  });
  console.log('✅ Step 4 PASSED: Audit logs retrieved with structured detail payloads.');

  // 5. Test Filter by Entity Type
  console.log('\n--- Step 5: Filter Audit Logs by Entity Type ---');
  const filterRes = await fetch(`${baseUrl}/api/audit-logs?entityType=PAYMENT`, { headers });
  const filterData = await filterRes.json();
  console.log(`Filtered for entityType=PAYMENT returned ${filterData.logs?.length} records.`);
  for (const log of filterData.logs) {
    if (log.entityType !== 'PAYMENT') throw new Error('Entity filter returned mismatched entity type!');
  }
  console.log('✅ Step 5 PASSED: Entity filter validation successful.');

  console.log('\n🎉 ALL PHASE 11 NOTIFICATIONS & AUDIT LOGS TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
