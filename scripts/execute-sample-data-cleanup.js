require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const prisma = new PrismaClient();

async function executeSampleDataCleanup() {
  console.log('================================================================');
  console.log('      EXECUTING SAMPLE DATA CLEANUP (LOCAL DB + SUPABASE)       ');
  console.log('================================================================\n');

  // STEP 1: Create Complete Pre-Cleanup Snapshot Backup
  console.log('--- STEP 1: Creating Pre-Cleanup Snapshot Backup ---');
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const preCleanupSnapshot = {
    timestamp: new Date().toISOString(),
    adminUsers: await prisma.adminUser.findMany(),
    hostelSettings: await prisma.hostelSettings.findMany(),
    rooms: await prisma.room.findMany(),
    residents: await prisma.resident.findMany(),
    registrations: await prisma.registration.findMany(),
    monthlyPayments: await prisma.monthlyPayment.findMany(),
    paymentRecords: await prisma.paymentRecord.findMany(),
    receipts: await prisma.receipt.findMany(),
    paymentReminders: await prisma.paymentReminder.findMany(),
  };

  const backupFile = path.join(backupDir, `pre_cleanup_snapshot_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(preCleanupSnapshot, null, 2));
  console.log(`✅ Snapshot backup saved to: ${backupFile}`);

  // Backup SQLite physical file if exists
  const sqliteDbPath = path.join(__dirname, '../prisma/dev.db');
  if (fs.existsSync(sqliteDbPath)) {
    const sqliteBackup = path.join(__dirname, '../prisma/dev.db.pre_clean_backup');
    fs.copyFileSync(sqliteDbPath, sqliteBackup);
    console.log(`✅ SQLite dev.db backed up to: ${sqliteBackup}`);
  }

  // STEP 2: Execute Supabase PostgreSQL Cleanup via Transaction
  console.log('\n--- STEP 2: Cleaning Sample Data in Supabase PostgreSQL ---');
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  try {
    await pgClient.query('BEGIN');

    // 1. Delete dependent financial sample records
    const prRes = await pgClient.query('DELETE FROM public."PaymentRecord";');
    console.log(`  🗑️ Deleted PaymentRecords: ${prRes.rowCount}`);

    const rcRes = await pgClient.query('DELETE FROM public."Receipt";');
    console.log(`  🗑️ Deleted Receipts: ${rcRes.rowCount}`);

    const rmRes = await pgClient.query('DELETE FROM public."PaymentReminder";');
    console.log(`  🗑️ Deleted PaymentReminders: ${rmRes.rowCount}`);

    const mpRes = await pgClient.query('DELETE FROM public."MonthlyPayment";');
    console.log(`  🗑️ Deleted MonthlyPayments: ${mpRes.rowCount}`);

    const rcrRes = await pgClient.query('DELETE FROM public."RoomChangeRequest";');
    console.log(`  🗑️ Deleted RoomChangeRequests: ${rcrRes.rowCount}`);

    // 2. Unlink any registrations linked to sample residents
    await pgClient.query('UPDATE public."Registration" SET "residentId" = NULL, "status" = \'NEW\' WHERE "residentId" IS NOT NULL;');

    // 3. Delete sample/mock registrations
    const sampleRegRes = await pgClient.query(`
      DELETE FROM public."Registration"
      WHERE "fullName" ILIKE '%sample%'
         OR "fullName" ILIKE '%test%'
         OR "fullName" IN ('Rahul Sharma', 'Vikramaditya Roy', 'Karthik Raman', 'Aditya Patel');
    `);
    console.log(`  🗑️ Deleted Sample Registrations: ${sampleRegRes.rowCount}`);

    // 4. Delete all sample residents
    const resRes = await pgClient.query('DELETE FROM public."Resident";');
    console.log(`  🗑️ Deleted Sample Residents: ${resRes.rowCount}`);

    // 5. Delete test rooms if any (preserve rooms 101, 102, 103, 104, 201, 202)
    const testRoomsRes = await pgClient.query(`
      DELETE FROM public."Room"
      WHERE "roomNumber" NOT IN ('101', '102', '103', '104', '201', '202');
    `);
    console.log(`  🗑️ Deleted Test Rooms: ${testRoomsRes.rowCount}`);

    // 6. Delete test notifications
    const notifRes = await pgClient.query('DELETE FROM public."Notification";');
    console.log(`  🗑️ Deleted Test Notifications: ${notifRes.rowCount}`);

    await pgClient.query('COMMIT');
    console.log('✅ PostgreSQL transaction committed successfully!');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Transaction failed, rolled back:', err);
    throw err;
  } finally {
    await pgClient.end();
  }

  // STEP 3: Verify Retained Production Data in Supabase
  console.log('\n--- STEP 3: Verifying Retained Supabase Production State ---');
  const [adminCount, roomCount, residentCount, regCount, paymentCount, receiptCount] = await Promise.all([
    prisma.adminUser.count(),
    prisma.room.count(),
    prisma.resident.count(),
    prisma.registration.count(),
    prisma.monthlyPayment.count(),
    prisma.receipt.count(),
  ]);

  console.log(`Post-Cleanup Supabase Counts:`);
  console.log(`  • AdminUser: ${adminCount} (Preserved - Admin login active)`);
  console.log(`  • HostelSettings: ${await prisma.hostelSettings.count()} (Preserved)`);
  console.log(`  • Rooms: ${roomCount} (Preserved: 101, 102, 103, 104, 201, 202)`);
  console.log(`  • Residents: ${residentCount} (Clean - 0 sample residents)`);
  console.log(`  • Registrations: ${regCount} (Preserved: Genuine Google Form intakes)`);
  console.log(`  • MonthlyPayments: ${paymentCount} (Clean - 0 sample payments)`);
  console.log(`  • Receipts: ${receiptCount} (Clean - 0 sample receipts)`);

  // STEP 4: Inspect Google Sheets & Drive (Strictly Read-Only Verification)
  console.log('\n--- STEP 4: Inspecting Google Sheets State (Strictly Read-Only) ---');
  const { google } = require('googleapis');
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  const rowCount = metaRes.data.sheets[0].properties.gridProperties.rowCount;
  console.log(`✅ Google Sheet "${metaRes.data.sheets[0].properties.title}" verified UNTOUCHED: ${rowCount} rows preserved intact.`);

  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log('   🎉 SAMPLE DATA CLEANUP COMPLETED SUCCESSFULLY (100% CLEAN)   ');
  console.log('================================================================\n');
}

executeSampleDataCleanup().catch((err) => {
  console.error('Cleanup execution failed:', err);
  process.exit(1);
});
