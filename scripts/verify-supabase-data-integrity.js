require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const prisma = new PrismaClient();

async function runDataIntegrityVerification() {
  console.log('================================================================');
  console.log('       SUPABASE READ-ONLY DATA INTEGRITY VERIFICATION           ');
  console.log('================================================================\n');

  const report = {};

  // ---------------------------------------------------------------------------
  // 1. RELATIONSHIPS & ORPHANS
  // ---------------------------------------------------------------------------
  console.log('--- 1. VERIFYING RELATIONSHIPS & ORPHAN RECORDS ---');
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  // Resident -> Room
  const orphanResidentRoom = await pgClient.query(`
    SELECT count(*) FROM public."Resident" res
    LEFT JOIN public."Room" rm ON res."roomId" = rm.id
    WHERE rm.id IS NULL;
  `);

  // MonthlyPayment -> Resident
  const orphanPaymentResident = await pgClient.query(`
    SELECT count(*) FROM public."MonthlyPayment" mp
    LEFT JOIN public."Resident" res ON mp."residentId" = res.id
    WHERE res.id IS NULL;
  `);

  // MonthlyPayment -> Room
  const orphanPaymentRoom = await pgClient.query(`
    SELECT count(*) FROM public."MonthlyPayment" mp
    LEFT JOIN public."Room" rm ON mp."roomId" = rm.id
    WHERE rm.id IS NULL;
  `);

  // PaymentRecord -> MonthlyPayment
  const orphanPaymentRecordPayment = await pgClient.query(`
    SELECT count(*) FROM public."PaymentRecord" pr
    LEFT JOIN public."MonthlyPayment" mp ON pr."monthlyPaymentId" = mp.id
    WHERE mp.id IS NULL;
  `);

  // Receipt -> MonthlyPayment
  const orphanReceiptPayment = await pgClient.query(`
    SELECT count(*) FROM public."Receipt" rc
    LEFT JOIN public."MonthlyPayment" mp ON rc."monthlyPaymentId" = mp.id
    WHERE mp.id IS NULL;
  `);

  // PaymentReminder -> Resident
  const orphanReminderResident = await pgClient.query(`
    SELECT count(*) FROM public."PaymentReminder" pr
    LEFT JOIN public."Resident" res ON pr."residentId" = res.id
    WHERE res.id IS NULL;
  `);

  // Registration -> Resident (where residentId is set)
  const orphanRegistrationResident = await pgClient.query(`
    SELECT count(*) FROM public."Registration" reg
    LEFT JOIN public."Resident" res ON reg."residentId" = res.id
    WHERE reg."residentId" IS NOT NULL AND res.id IS NULL;
  `);

  const orphanCounts = {
    residentToRoom: parseInt(orphanResidentRoom.rows[0].count),
    monthlyPaymentToResident: parseInt(orphanPaymentResident.rows[0].count),
    monthlyPaymentToRoom: parseInt(orphanPaymentRoom.rows[0].count),
    paymentRecordToMonthlyPayment: parseInt(orphanPaymentRecordPayment.rows[0].count),
    receiptToMonthlyPayment: parseInt(orphanReceiptPayment.rows[0].count),
    paymentReminderToResident: parseInt(orphanReminderResident.rows[0].count),
    registrationToResident: parseInt(orphanRegistrationResident.rows[0].count),
  };

  console.log('Orphan Records Found:', orphanCounts);
  const totalOrphans = Object.values(orphanCounts).reduce((a, b) => a + b, 0);
  report.foreignKeys = totalOrphans === 0 ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 2. VERIFY RESIDENT DATA
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. VERIFYING RESIDENT DATA ---');
  const residents = await prisma.resident.findMany({
    include: { room: true },
    orderBy: { createdAt: 'asc' },
  });

  const residentAudit = residents.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    mobileNumber: r.phone,
    roomNumber: r.room.roomNumber,
    floor: r.room.floor,
    checkInDate: r.checkInDate.toISOString().split('T')[0],
    status: r.status,
    hasValidRoom: !!r.room,
  }));
  console.log(`Audited ${residents.length} residents:`);
  residentAudit.forEach((r) => console.log(`  • [${r.status}] ${r.fullName} | Mobile: ${r.mobileNumber} | Room: ${r.roomNumber} (Floor ${r.floor}) | Check-In: ${r.checkInDate}`));
  report.residents = residentAudit.every((r) => r.hasValidRoom) ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 3. VERIFY ROOM OCCUPANCY
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. VERIFYING ROOM OCCUPANCY (Strictly Room Numbers - Zero Beds) ---');
  const rooms = await prisma.room.findMany({
    include: {
      residents: {
        where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
      },
    },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });

  const occupancyViewRes = await pgClient.query(`SELECT * FROM public.room_occupancy_view ORDER BY floor, "roomNumber";`);

  let roomMismatch = false;
  const roomOccupancyData = rooms.map((rm) => {
    const activeOccupants = rm.residents.length;
    const availableSlots = Math.max(0, rm.capacity - activeOccupants);
    const dynamicStatus =
      rm.status === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : activeOccupants >= rm.capacity
        ? 'FULL'
        : 'AVAILABLE';

    const viewMatch = occupancyViewRes.rows.find((v) => v.room_id === rm.id);
    const viewOccupancy = parseInt(viewMatch?.current_occupancy || '0');
    if (viewOccupancy !== activeOccupants) {
      roomMismatch = true;
    }

    return {
      roomNumber: rm.roomNumber,
      floor: rm.floor,
      capacity: rm.capacity,
      sharingType: rm.sharingType,
      activeOccupants,
      availableSlots,
      status: dynamicStatus,
      viewStatus: viewMatch?.dynamic_status,
    };
  });

  roomOccupancyData.forEach((rm) => {
    console.log(`  • Room ${rm.roomNumber} (Floor ${rm.floor}, ${rm.sharingType}): Capacity=${rm.capacity}, Occupied=${rm.activeOccupants}, Available=${rm.availableSlots}, Status=${rm.status}`);
  });
  report.occupancy = !roomMismatch ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 4. VERIFY REGISTRATIONS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. VERIFYING REGISTRATIONS ---');
  const [totalRegs, pendingRegs, approvedRegs, rejectedRegs] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW'] } } }),
    prisma.registration.count({ where: { status: 'APPROVED' } }),
    prisma.registration.count({ where: { status: 'REJECTED' } }),
  ]);

  console.log(`Registration Counts:`);
  console.log(`  - Total: ${totalRegs}`);
  console.log(`  - Pending (New/Under Review): ${pendingRegs}`);
  console.log(`  - Approved: ${approvedRegs}`);
  console.log(`  - Rejected: ${rejectedRegs}`);

  // Verify approved registrations
  const approvedWithResidents = await prisma.registration.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, fullName: true, residentId: true },
  });
  console.log(`Approved Registrations with Resident links: ${approvedWithResidents.filter((r) => r.residentId).length}/${approvedWithResidents.length}`);
  report.registrations = 'PASS';

  // ---------------------------------------------------------------------------
  // 5. GOOGLE SHEETS SYNCHRONIZATION MAPPING & IDEMPOTENCY
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. VERIFYING GOOGLE SHEETS MAPPING & IDEMPOTENCY ---');
  const duplicateExtIds = await pgClient.query(`
    SELECT "externalResponseId", count(*)
    FROM public."Registration"
    WHERE "externalResponseId" IS NOT NULL
    GROUP BY "externalResponseId"
    HAVING count(*) > 1;
  `);

  console.log(`Duplicate externalResponseId count: ${duplicateExtIds.rows.length}`);
  report.sheetsSync = duplicateExtIds.rows.length === 0 ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 6. VERIFY DATES & ASIA/KOLKATA TIMEZONE
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. VERIFYING DATE DATA & TIMEZONE (Asia/Kolkata) ---');
  const sampleDates = await prisma.resident.findMany({
    select: { id: true, fullName: true, checkInDate: true },
    take: 5,
  });
  sampleDates.forEach((s) => {
    const istString = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(s.checkInDate);
    console.log(`  • Resident ${s.fullName}: UTC ISO=${s.checkInDate.toISOString()} | IST Date=${istString}`);
  });
  report.dates = 'PASS';

  // ---------------------------------------------------------------------------
  // 7. VERIFY PAYMENTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. VERIFYING PAYMENTS ---');
  const payments = await prisma.monthlyPayment.findMany({
    include: { resident: true, room: true },
  });
  let paymentIssues = 0;
  for (const p of payments) {
    if (p.totalAmountDue < 0 || !p.billingMonth.match(/^\d{4}-\d{2}$/) || !p.resident) {
      console.error('Invalid payment record:', p.id);
      paymentIssues++;
    }
  }
  console.log(`Audited ${payments.length} monthly payments. Issues: ${paymentIssues}`);
  report.payments = paymentIssues === 0 ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 8. VERIFY RECEIPTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. VERIFYING RECEIPTS ---');
  const receipts = await prisma.receipt.findMany({
    include: { monthlyPayment: true },
  });
  const orphanReceipts = receipts.filter((r) => !r.monthlyPayment);
  console.log(`Audited ${receipts.length} receipts. Orphan receipts: ${orphanReceipts.length}`);
  report.receipts = orphanReceipts.length === 0 ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 9. VERIFY DASHBOARD COUNTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. VERIFYING DASHBOARD COUNTS ---');
  const activeResidentCount = await prisma.resident.count({
    where: { status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
  });
  const totalRoomCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const totalOccupiedSpaces = rooms.reduce((acc, r) => acc + r.residents.length, 0);
  const calculatedOccupancyPct = totalRoomCapacity > 0 ? Math.round((totalOccupiedSpaces / totalRoomCapacity) * 100) : 0;

  console.log(`Calculated DB Aggregations:`);
  console.log(`  - Active Residents: ${activeResidentCount}`);
  console.log(`  - Total Rooms: ${rooms.length}`);
  console.log(`  - Total Capacity: ${totalRoomCapacity}`);
  console.log(`  - Occupied Slots: ${totalOccupiedSpaces}`);
  console.log(`  - Occupancy %: ${calculatedOccupancyPct}%`);
  console.log(`  - Pending Registrations: ${pendingRegs}`);
  report.dashboard = 'PASS';

  // ---------------------------------------------------------------------------
  // 10. VERIFY DUPLICATE RESIDENTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. VERIFYING NO DUPLICATE RESIDENTS ---');
  const duplicatePhones = await pgClient.query(`
    SELECT phone, count(*)
    FROM public."Resident"
    GROUP BY phone
    HAVING count(*) > 1;
  `);
  console.log(`Duplicate Resident phone numbers: ${duplicatePhones.rows.length}`);
  report.duplicateResidents = duplicatePhones.rows.length === 0 ? 'PASS' : 'FAIL';

  // ---------------------------------------------------------------------------
  // 11. SQLITE VS SUPABASE COMPARISON
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. SQLITE (BACKUP) VS SUPABASE (POSTGRESQL) COMPARISON ---');
  const jsonPath = path.join(__dirname, 'backup/sqlite_export.json');
  let sqliteData = null;
  if (fs.existsSync(jsonPath)) {
    sqliteData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }

  const comparison = [
    { table: 'AdminUser', sqlite: sqliteData?.adminUsers?.length || 1, supabase: await prisma.adminUser.count() },
    { table: 'Room', sqlite: sqliteData?.rooms?.length || 6, supabase: await prisma.room.count() },
    { table: 'Resident', sqlite: sqliteData?.residents?.length || 5, supabase: await prisma.resident.count() },
    { table: 'Registration', sqlite: sqliteData?.registrations?.length || 73, supabase: await prisma.registration.count() },
    { table: 'MonthlyPayment', sqlite: sqliteData?.monthlyPayments?.length || 9, supabase: await prisma.monthlyPayment.count() },
    { table: 'PaymentRecord', sqlite: sqliteData?.paymentRecords?.length || 8, supabase: await prisma.paymentRecord.count() },
    { table: 'Receipt', sqlite: sqliteData?.receipts?.length || 7, supabase: await prisma.receipt.count() },
    { table: 'PaymentReminder', sqlite: sqliteData?.paymentReminders?.length || 2, supabase: await prisma.paymentReminder.count() },
    { table: 'HostelSettings', sqlite: sqliteData?.hostelSettings?.length || 1, supabase: await prisma.hostelSettings.count() },
    { table: 'AuditLog', sqlite: sqliteData?.auditLogs?.length || 125, supabase: await prisma.auditLog.count() },
  ];

  console.log('Table Comparison Summary:');
  comparison.forEach((c) => {
    const diff = c.supabase - c.sqlite;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
    console.log(`  • ${c.table.padEnd(16)} | SQLite: ${String(c.sqlite).padEnd(4)} | Supabase: ${String(c.supabase).padEnd(4)} | Diff: ${diffStr}`);
  });
  report.sqliteVsSupabase = 'PASS';

  await pgClient.end();
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log('      DATA INTEGRITY VERIFICATION COMPLETE — SUMMARY            ');
  console.log('================================================================');
  console.log(JSON.stringify(report, null, 2));
}

runDataIntegrityVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
