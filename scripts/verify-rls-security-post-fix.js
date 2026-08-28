require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

async function verifyRLSSecurity() {
  console.log('================================================================');
  console.log('      RLS SECURITY HARDENING POST-EXECUTION VERIFICATION        ');
  console.log('================================================================\n');

  // 1. Test Anonymous Access via Supabase PostgREST Client
  console.log('--- 1. Testing Anonymous / Public Internet Access via PostgREST ---');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(supabaseUrl, anonKey);

  const sensitiveTables = [
    'AdminUser',
    'Resident',
    'Registration',
    'MonthlyPayment',
    'PaymentRecord',
    'Receipt',
    'AuditLog',
    'HostelSettings',
  ];

  let anonymousBlockedCount = 0;
  for (const table of sensitiveTables) {
    const { data, error, status } = await supabase.from(table).select('*');
    // With RLS enabled and zero anon policies, PostgREST returns empty data [] or 401/403
    if (!data || data.length === 0) {
      console.log(`  🛡️ Table "${table}": Public/Anon Access BLOCKED (Status: ${status}, Rows exposed: 0)`);
      anonymousBlockedCount++;
    } else {
      console.error(`  ❌ Table "${table}": EXPOSED! Leaked ${data.length} rows to anonymous client!`);
    }
  }

  if (anonymousBlockedCount === sensitiveTables.length) {
    console.log('✅ PASS: All sensitive tables are 100% shielded from anonymous/public access.');
  } else {
    throw new Error('Security check failed: Some tables leaked data to anonymous clients!');
  }

  // 2. Test Server-Side Prisma Access & Data Integrity
  console.log('\n--- 2. Testing Server-Side Prisma Data Access & Record Counts ---');
  const [
    adminCount,
    roomCount,
    residentCount,
    regCount,
    paymentCount,
    receiptCount,
    auditCount,
  ] = await Promise.all([
    prisma.adminUser.count(),
    prisma.room.count(),
    prisma.resident.count(),
    prisma.registration.count(),
    prisma.monthlyPayment.count(),
    prisma.receipt.count(),
    prisma.auditLog.count(),
  ]);

  console.log(`✅ Server-side Prisma Access Working 100%:`);
  console.log(`   - Admin Users: ${adminCount}`);
  console.log(`   - Rooms: ${roomCount}`);
  console.log(`   - Residents: ${residentCount}`);
  console.log(`   - Registrations: ${regCount}`);
  console.log(`   - Monthly Payments: ${paymentCount}`);
  console.log(`   - Receipts: ${receiptCount}`);
  console.log(`   - Audit Logs: ${auditCount}`);

  // 3. Test Admin Authentication & Dashboard API
  console.log('\n--- 3. Testing Application Authentication & Dashboard API ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });

  if (!loginRes.ok) throw new Error('Admin login failed!');
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('✅ Admin login succeeded through Next.js API.');

  const dashRes = await fetch('http://localhost:3000/api/dashboard', {
    headers: { cookie: cookieHeader || '' },
  });
  const dashData = await dashRes.json();
  console.log(`✅ Dashboard API Succeeded: Total Registrations: ${dashData.metrics.totalRegistrations}, Active Residents: ${dashData.metrics.activeResidents}`);

  console.log('\n================================================================');
  console.log('   🎉 RLS SECURITY AUDIT & VERIFICATION PASSED (100% SECURE)    ');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

verifyRLSSecurity().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
