require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyRLSHardening() {
  console.log('================================================================');
  console.log('      APPLYING CORRECTED RLS MIGRATION TO SUPABASE POSTGRESQL   ');
  console.log('================================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected to Supabase PostgreSQL via pg client.');

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260828000002_rls_and_storage.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('--- Executing DDL Statements from Migration 00002 ---');
  await client.query(sql);
  console.log('✅ Executed RLS activation and storage bucket configuration.');

  // Verify RLS status on all 14 tables
  console.log('\n--- Verifying RLS Status in pg_class ---');
  const res = await client.query(`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  let allEnabled = true;
  for (const row of res.rows) {
    if (!row.rls_enabled) {
      console.log(`  ❌ ${row.table_name}: RLS is STILL DISABLED!`);
      allEnabled = false;
    } else {
      console.log(`  🔒 ${row.table_name}: RLS ENABLED (100% Secure)`);
    }
  }

  if (!allEnabled) {
    throw new Error('Some tables do not have RLS enabled!');
  }

  // Verify storage buckets
  console.log('\n--- Verifying Storage Buckets ---');
  const bucketsRes = await client.query(`
    SELECT id, name, public FROM storage.buckets
    WHERE id IN ('resident-documents', 'payment-proofs');
  `);
  for (const b of bucketsRes.rows) {
    console.log(`  📦 Bucket "${b.name}" -> Public: ${b.public} (Private = ${!b.public})`);
  }

  await client.end();
  console.log('\n✅ RLS Hardening successfully applied to Supabase PostgreSQL!');
}

applyRLSHardening().catch((err) => {
  console.error('❌ Failed to apply RLS hardening:', err);
  process.exit(1);
});
