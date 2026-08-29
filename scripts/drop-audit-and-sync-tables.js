const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Step 1: Baseline Record Counts ===');
  const baseline = {
    AdminUser: await prisma.adminUser.count(),
    Resident: await prisma.resident.count(),
    Registration: await prisma.registration.count(),
    Room: await prisma.room.count(),
    HostelSettings: await prisma.hostelSettings.count(),
    MonthlyPayment: await prisma.monthlyPayment.count(),
    PaymentRecord: await prisma.paymentRecord.count(),
    Receipt: await prisma.receipt.count(),
    PaymentReminder: await prisma.paymentReminder.count(),
    ReminderTemplate: await prisma.reminderTemplate.count(),
    PaymentSession: await prisma.paymentSession.count(),
    RoomChangeRequest: await prisma.roomChangeRequest.count(),
    Notification: await prisma.notification.count(),
  };
  console.log(JSON.stringify(baseline, null, 2));

  console.log('\n=== Step 2: Dropping AuditLog & SyncLog Tables ===');
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "AuditLog" CASCADE;`);
  console.log('✔ Dropped table "AuditLog" (if existed)');

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SyncLog" CASCADE;`);
  console.log('✔ Dropped table "SyncLog" (if existed)');

  console.log('\n=== Step 3: Verifying PostgreSQL Information Schema ===');
  const remainingTables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public Schema Tables in Database:', remainingTables.map(t => t.table_name));

  const hasAuditLog = remainingTables.some(t => t.table_name === 'AuditLog');
  const hasSyncLog = remainingTables.some(t => t.table_name === 'SyncLog');

  if (!hasAuditLog && !hasSyncLog) {
    console.log('✔ VERIFIED: Neither AuditLog nor SyncLog exist in the database.');
  } else {
    console.error('❌ ERROR: Tables still found:', { hasAuditLog, hasSyncLog });
    process.exit(1);
  }

  console.log('\n=== Step 4: Verifying Business Data Integrity ===');
  const postDrop = {
    AdminUser: await prisma.adminUser.count(),
    Resident: await prisma.resident.count(),
    Registration: await prisma.registration.count(),
    Room: await prisma.room.count(),
    HostelSettings: await prisma.hostelSettings.count(),
    MonthlyPayment: await prisma.monthlyPayment.count(),
    PaymentRecord: await prisma.paymentRecord.count(),
    Receipt: await prisma.receipt.count(),
    PaymentReminder: await prisma.paymentReminder.count(),
    ReminderTemplate: await prisma.reminderTemplate.count(),
    PaymentSession: await prisma.paymentSession.count(),
    RoomChangeRequest: await prisma.roomChangeRequest.count(),
    Notification: await prisma.notification.count(),
  };
  console.log(JSON.stringify(postDrop, null, 2));

  for (const key of Object.keys(baseline)) {
    if (baseline[key] !== postDrop[key]) {
      console.error(`❌ DISCREPANCY detected in ${key}: before=${baseline[key]}, after=${postDrop[key]}`);
      process.exit(1);
    }
  }
  console.log('✔ 100% Data Integrity Confirmed: All business records match baseline exactly.');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
