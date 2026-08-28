const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Read existing SQLite data using Prisma
const prisma = new PrismaClient();

async function backupSQLite() {
  console.log('--- 1. Backing up SQLite Database File ---');
  const dbPath = path.join(__dirname, '../prisma/dev.db');
  const backupPath = path.join(__dirname, '../prisma/dev.db.backup');
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Copied dev.db to ${backupPath}`);

  console.log('--- 2. Exporting All SQLite Records to JSON ---');
  const exportData = {
    exportedAt: new Date().toISOString(),
    adminUsers: await prisma.adminUser.findMany(),
    rooms: await prisma.room.findMany(),
    residents: await prisma.resident.findMany(),
    registrations: await prisma.registration.findMany(),
    roomChangeRequests: await prisma.roomChangeRequest.findMany(),
    monthlyPayments: await prisma.monthlyPayment.findMany(),
    paymentRecords: await prisma.paymentRecord.findMany(),
    receipts: await prisma.receipt.findMany(),
    paymentReminders: await prisma.paymentReminder.findMany(),
    reminderTemplates: await prisma.reminderTemplate.findMany(),
    syncLogs: await prisma.syncLog.findMany(),
    hostelSettings: await prisma.hostelSettings.findMany(),
    notifications: await prisma.notification.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };

  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonPath = path.join(backupDir, 'sqlite_export.json');
  fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`✅ Exported structured records to ${jsonPath}`);
  console.log(`   - Admin Users: ${exportData.adminUsers.length}`);
  console.log(`   - Rooms: ${exportData.rooms.length}`);
  console.log(`   - Residents: ${exportData.residents.length}`);
  console.log(`   - Registrations: ${exportData.registrations.length}`);
  console.log(`   - Monthly Payments: ${exportData.monthlyPayments.length}`);
  console.log(`   - Receipts: ${exportData.receipts.length}`);
  console.log(`   - Audit Logs: ${exportData.auditLogs.length}`);

  await prisma.$disconnect();
}

backupSQLite().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
