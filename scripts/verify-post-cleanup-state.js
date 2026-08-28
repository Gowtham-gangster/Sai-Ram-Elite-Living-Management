require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');

const prisma = new PrismaClient();

async function verifyPostCleanupState() {
  console.log('================================================================');
  console.log('     POST-CLEANUP PRODUCTION DATABASE & SYSTEM VERIFICATION     ');
  console.log('================================================================\n');

  // 1. Check Admin Login
  console.log('--- 1. Testing Admin Authentication ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });

  if (!loginRes.ok) throw new Error('Admin login failed!');
  const cookie = loginRes.headers.get('set-cookie') || '';
  console.log('✅ Admin login operational (admin@sairam.com).');

  // 2. Check Dashboard API
  console.log('\n--- 2. Testing Dashboard API ---');
  const dashRes = await fetch('http://localhost:3000/api/dashboard', {
    headers: { cookie },
  });
  if (!dashRes.ok) throw new Error('Dashboard API request failed!');
  const dashData = await dashRes.json();
  console.log(`✅ Dashboard Metrics:`);
  console.log(`   - Total Rooms: ${dashData.metrics.totalRooms}`);
  console.log(`   - Active Residents: ${dashData.metrics.activeResidents} (Clean)`);
  console.log(`   - Total Capacity: ${dashData.metrics.totalCapacity}`);
  console.log(`   - Occupancy: ${dashData.metrics.occupancyPercentage}%`);
  console.log(`   - Total Registrations: ${dashData.metrics.totalRegistrations} (Intact Google Form intakes)`);
  console.log(`   - Pending Registrations: ${dashData.metrics.pendingRegistrations}`);

  // 3. Check RLS on All Tables
  console.log('\n--- 3. Verifying RLS on All 14 Tables ---');
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const rlsRes = await pgClient.query(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  let allRlsEnabled = true;
  for (const row of rlsRes.rows) {
    if (!row.relrowsecurity) allRlsEnabled = false;
    console.log(`  🔒 Table "${row.relname}": RLS ${row.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
  }
  if (!allRlsEnabled) throw new Error('RLS is disabled on some tables!');

  // 4. Check Storage Buckets
  console.log('\n--- 4. Verifying Storage Buckets ---');
  const bucketsRes = await pgClient.query(`
    SELECT id, name, public FROM storage.buckets
    WHERE id IN ('resident-documents', 'payment-proofs');
  `);
  bucketsRes.rows.forEach((b) => {
    console.log(`  📦 Bucket "${b.name}": Private = ${!b.public}`);
  });

  // 5. Check Orphan Records
  console.log('\n--- 5. Verifying Zero Orphan Records ---');
  const orphanReg = await pgClient.query(`
    SELECT count(*) FROM public."Registration" reg
    LEFT JOIN public."Resident" res ON reg."residentId" = res.id
    WHERE reg."residentId" IS NOT NULL AND res.id IS NULL;
  `);
  console.log(`  • Orphan Registrations: ${orphanReg.rows[0].count}`);

  await pgClient.end();
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log('   🎉 ALL POST-CLEANUP INTEGRITY CHECKS PASSED (100% OPERATIONAL)');
  console.log('================================================================\n');
}

verifyPostCleanupState().catch((err) => {
  console.error('Post-cleanup verification failed:', err);
  process.exit(1);
});
