require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const prisma = new PrismaClient();

async function dryRunSampleData() {
  console.log('================================================================');
  console.log('        SAMPLE DATA CLEANUP — DRY RUN INSPECTION                ');
  console.log('================================================================\n');

  // 1. Inspect Supabase Residents
  const residents = await prisma.resident.findMany({
    include: { room: true },
  });
  console.log(`--- Supabase Residents (${residents.length} total) ---`);
  residents.forEach((r) => {
    console.log(`  • ID: ${r.id} | Name: "${r.fullName}" | Phone: ${r.phone} | Status: ${r.status} | Room: ${r.room?.roomNumber}`);
  });

  // 2. Inspect Registrations
  const registrations = await prisma.registration.findMany({
    select: { id: true, fullName: true, mobileNumber: true, status: true, externalSource: true, residentId: true },
  });
  console.log(`\n--- Supabase Registrations (${registrations.length} total) ---`);
  const sampleRegs = registrations.filter(r => r.fullName.toLowerCase().includes('sample') || r.fullName.toLowerCase().includes('test') || r.fullName === 'Rahul Sharma' || r.fullName === 'Vikramaditya Roy' || r.fullName === 'Karthik Raman' || r.fullName === 'Aditya Patel');
  const googleFormRegs = registrations.filter(r => r.externalSource === 'GOOGLE_FORM' && !sampleRegs.includes(r));
  console.log(`  • Sample / Seed Registrations: ${sampleRegs.length}`);
  console.log(`  • Google Form Registrations: ${googleFormRegs.length}`);

  // 3. Inspect Payments, Receipts, Reminders
  const [paymentsCount, paymentRecordsCount, receiptsCount, remindersCount, auditCount, syncLogCount, notifCount, roomsCount, adminCount, settingsCount] = await Promise.all([
    prisma.monthlyPayment.count(),
    prisma.paymentRecord.count(),
    prisma.receipt.count(),
    prisma.paymentReminder.count(),
    prisma.auditLog.count(),
    prisma.syncLog.count(),
    prisma.notification.count(),
    prisma.room.count(),
    prisma.adminUser.count(),
    prisma.hostelSettings.count(),
  ]);

  console.log(`\n--- Supabase Entity Summary ---`);
  console.log(`  • AdminUser: ${adminCount} (PRESERVE)`);
  console.log(`  • HostelSettings: ${settingsCount} (PRESERVE)`);
  console.log(`  • Room: ${roomsCount} (PRESERVE)`);
  console.log(`  • Resident: ${residents.length} (SAMPLE - TO CLEAN)`);
  console.log(`  • MonthlyPayment: ${paymentsCount} (SAMPLE - TO CLEAN)`);
  console.log(`  • PaymentRecord: ${paymentRecordsCount} (SAMPLE - TO CLEAN)`);
  console.log(`  • Receipt: ${receiptsCount} (SAMPLE - TO CLEAN)`);
  console.log(`  • PaymentReminder: ${remindersCount} (SAMPLE - TO CLEAN)`);
  console.log(`  • RoomChangeRequest: ${await prisma.roomChangeRequest.count()} (SAMPLE - TO CLEAN)`);
  console.log(`  • Notification: ${notifCount} (SAMPLE/TEST NOTIFICATIONS - TO CLEAN)`);
  console.log(`  • SyncLog: ${syncLogCount} (LOG HISTORY)`);
  console.log(`  • AuditLog: ${auditCount} (LOG HISTORY)`);

  // Check SQLite dev.db / dev.db.backup
  console.log(`\n--- SQLite Database Inspection ---`);
  const backupJsonPath = path.join(__dirname, 'backup/sqlite_export.json');
  if (fs.existsSync(backupJsonPath)) {
    const data = JSON.parse(fs.readFileSync(backupJsonPath, 'utf8'));
    console.log(`  • SQLite Backup File Found: ${backupJsonPath}`);
    console.log(`  • SQLite Residents in backup: ${data.residents?.length || 0}`);
    console.log(`  • SQLite Payments in backup: ${data.monthlyPayments?.length || 0}`);
  }

  await prisma.$disconnect();
}

dryRunSampleData().catch((err) => {
  console.error('Dry run failed:', err);
  process.exit(1);
});
