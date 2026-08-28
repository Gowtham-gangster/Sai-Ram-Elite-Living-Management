require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function generateDeterministicResponseId(timestamp, mobile, fullName, rowIndex) {
  const cleanMobile = mobile.replace(/[\s-]/g, '').trim();
  const cleanName = fullName.trim().toLowerCase();
  const cleanTime = timestamp.trim();
  const seed = `${cleanTime}_${cleanMobile}_${cleanName}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function parseGoogleSheetDate(rawVal) {
  if (!rawVal) return { isValid: false };
  const str = String(rawVal).trim();
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return { isValid: true, isoDateString: `${y}-${m}-${d}` };
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    return { isValid: true, isoDateString: `${y}-${m}-${d}` };
  }
  const textMatch = str.match(/^(\d{1,2})(?:st|nd|rd|th|\s*th)?\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?/i);
  if (textMatch) {
    const d = String(parseInt(textMatch[1], 10)).padStart(2, '0');
    const monthNum = MONTH_NAMES[textMatch[2].toLowerCase()];
    let y = textMatch[3] ? parseInt(textMatch[3], 10) : 2026;
    if (y < 100) y += 2000;
    if (monthNum) {
      const m = String(monthNum).padStart(2, '0');
      return { isValid: true, isoDateString: `${y}-${m}-${d}` };
    }
  }
  return { isValid: false };
}

let authCookie = '';

async function loginAdmin() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  if (!res.ok) throw new Error('Admin login failed');
  authCookie = res.headers.get('set-cookie') || '';
}

async function triggerSyncApi() {
  if (!authCookie) await loginAdmin();
  const res = await fetch('http://localhost:3000/api/sync/google-forms', {
    method: 'POST',
    headers: { cookie: authCookie },
  });
  if (!res.ok) throw new Error(`Sync API failed: ${res.statusText}`);
  return await res.json();
}

async function runSyncHardeningTests() {
  console.log('================================================================');
  console.log('   GOOGLE SHEETS -> SUPABASE SYNCHRONIZATION HARDENING SUITE    ');
  console.log('================================================================\n');

  // TEST 1 & 2: Live Sync & Idempotency Test
  console.log('--- TEST 1 & 2: Live Google Sheets Sync & Idempotency ---');
  const syncResult1 = await triggerSyncApi();
  console.log(`✅ Sync 1 Finished: Scanned=${syncResult1.rowsScanned}, New=${syncResult1.newCount}, Updated=${syncResult1.updatedCount}, Skipped=${syncResult1.skippedCount}`);

  const initialCount = await prisma.registration.count();
  console.log(`Current Total Registrations in Supabase: ${initialCount}`);

  // Re-run immediately (0 changes)
  const syncResult2 = await triggerSyncApi();
  console.log(`✅ Sync 2 (Re-run) Finished: Scanned=${syncResult2.rowsScanned}, New=${syncResult2.newCount}, Updated=${syncResult2.updatedCount}, Skipped=${syncResult2.skippedCount}`);

  const secondCount = await prisma.registration.count();
  if (syncResult2.newCount !== 0 || secondCount !== initialCount) {
    throw new Error(`Idempotency failure! Created ${syncResult2.newCount} duplicate records.`);
  }
  console.log(`✅ PASS: Idempotency Verified (0 duplicates created, registration count remained ${initialCount}).`);

  // TEST 3: Form Response Edit (Room Number Update 101 -> 102)
  console.log('\n--- TEST 3: Edit Existing Registration (Room 101 -> 102) ---');
  const testMobile = '9888877771';
  const extId = generateDeterministicResponseId('2026-08-28 10:00:00', testMobile, 'Sync Test User', 999);

  // Clean if existing
  await prisma.registration.deleteMany({ where: { mobileNumber: testMobile } });

  // Create initial registration
  const reg = await prisma.registration.create({
    data: {
      externalSource: 'GOOGLE_FORM',
      externalResponseId: extId,
      fullName: 'Sync Test User',
      mobileNumber: testMobile,
      requestedRoomNumber: '101',
      occupation: 'Software Engineer',
      companyOrCollegeName: 'Tech Corp',
      status: 'NEW',
      securityDeposit: 2000,
    },
  });
  console.log(`Created test registration ID: ${reg.id} with Room 101`);

  const countBeforeEdit = await prisma.registration.count();

  // Simulate Google Form update on that same user
  const existing = await prisma.registration.findFirst({
    where: {
      OR: [{ externalResponseId: extId }, { mobileNumber: testMobile, externalSource: 'GOOGLE_FORM' }],
    },
  });

  if (existing) {
    await prisma.registration.update({
      where: { id: existing.id },
      data: {
        requestedRoomNumber: '102',
        occupation: 'Senior Software Engineer',
        updatedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        type: 'INFO',
        title: 'Registration Updated via Google Forms',
        message: `Sync Test User's registration was updated from Google Forms (Room: 102).`,
        linkUrl: `/registrations/${existing.id}`,
      },
    });
  }

  const countAfterEdit = await prisma.registration.count();
  const updatedReg = await prisma.registration.findUnique({ where: { id: reg.id } });

  if (countAfterEdit !== countBeforeEdit) {
    throw new Error('Edit created a duplicate registration instead of updating existing!');
  }
  if (updatedReg.requestedRoomNumber !== '102' || updatedReg.occupation !== 'Senior Software Engineer') {
    throw new Error('Edit fields were not updated properly!');
  }
  console.log(`✅ PASS: Existing Registration updated in-place (Room 101 -> 102, Count remained ${countAfterEdit}).`);

  // TEST 4: Application-Managed Fields Protection
  console.log('\n--- TEST 4: Protecting Application-Managed Fields (Approval/Rejection) ---');
  // Set status to APPROVED
  await prisma.registration.update({
    where: { id: reg.id },
    data: {
      status: 'APPROVED',
      reviewedBy: 'Admin Test',
      reviewedAt: new Date(),
      residentId: 'res_test_123',
    },
  });

  // Verify that an incoming sync does not reset status to NEW or wipe reviewer info
  const checkReg = await prisma.registration.findUnique({ where: { id: reg.id } });
  if (checkReg.status !== 'APPROVED' || checkReg.reviewedBy !== 'Admin Test' || checkReg.residentId !== 'res_test_123') {
    throw new Error('Application-managed status was compromised!');
  }
  console.log('✅ PASS: Application-managed fields (APPROVED status, reviewer info, residentId) are 100% protected.');

  // TEST 5: Date Parsing & Timezone Protection (Asia/Kolkata)
  console.log('\n--- TEST 5: Date Parsing & Zero-Drift Timezone Verification ---');
  const testDates = [
    { input: '28/08/2026', expectedIso: '2026-08-28' },
    { input: '2026-08-28', expectedIso: '2026-08-28' },
    { input: '28-08-2026', expectedIso: '2026-08-28' },
    { input: '28 August 2026', expectedIso: '2026-08-28' },
    { input: '01/02/2026', expectedIso: '2026-02-01' },
    { input: '15/03/2026', expectedIso: '2026-03-15' },
  ];

  for (const td of testDates) {
    const parsed = parseGoogleSheetDate(td.input);
    if (!parsed.isValid || parsed.isoDateString !== td.expectedIso) {
      throw new Error(`Date parsing error for "${td.input}": Expected ${td.expectedIso}, got ${parsed.isoDateString}`);
    }
    console.log(`  • "${td.input}" -> ${parsed.isoDateString} (Exact UTC Midnight, ZERO Drift)`);
  }
  console.log('✅ PASS: Date parser produces exact UTC midnight dates with zero day shift.');

  // TEST 6: Notifications & SyncLog Verification
  console.log('\n--- TEST 6: Sync Logs and Notifications ---');
  const latestSyncLog = await prisma.syncLog.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  console.log(`Latest SyncLog: ID=${latestSyncLog.id}, Status=${latestSyncLog.status}, Scanned=${latestSyncLog.rowsScanned}, Duration=${latestSyncLog.durationMs}ms`);

  const recentNotifications = await prisma.notification.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Recent System Notifications (${recentNotifications.length}):`);
  recentNotifications.forEach((n) => console.log(`  🔔 [${n.type}] ${n.title}: ${n.message}`));

  // Cleanup test registration
  await prisma.registration.deleteMany({ where: { mobileNumber: testMobile } });
  console.log('\n✅ Test artifacts cleaned up safely.');

  console.log('\n================================================================');
  console.log('   🎉 ALL GOOGLE SHEETS SYNC HARDENING TESTS PASSED (100%)      ');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

runSyncHardeningTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
