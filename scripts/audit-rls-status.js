require('dotenv').config();
const { Client } = require('pg');

async function auditRLS() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('================================================================');
  console.log('       SUPABASE POSTGRESQL RLS & SECURITY AUDIT                 ');
  console.log('================================================================\n');

  // 1. Check all tables in public schema and their RLS status
  const tablesRes = await client.query(`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  console.log('--- 1. Tables and RLS Enablement Status ---');
  for (const row of tablesRes.rows) {
    const status = row.rls_enabled ? '🔒 ENABLED' : '⚠️ UNRESTRICTED (DISABLED)';
    console.log(`  • ${row.table_name}: ${status}`);
  }

  // 2. Check all policies in public schema
  console.log('\n--- 2. Installed RLS Policies in public Schema ---');
  const policiesRes = await client.query(`
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  if (policiesRes.rows.length === 0) {
    console.log('  👉 [NONE] 0 RLS policies currently exist in public schema.');
  } else {
    for (const p of policiesRes.rows) {
      console.log(`  • [${p.tablename}] Policy "${p.policyname}": CMD=${p.cmd}, ROLES=${p.roles}`);
    }
  }

  // 3. Check storage buckets and policies
  console.log('\n--- 3. Storage Buckets & Policies ---');
  try {
    const bucketsRes = await client.query(`SELECT id, name, public, created_at FROM storage.buckets;`);
    if (bucketsRes.rows.length === 0) {
      console.log('  👉 [NONE] 0 Storage buckets found.');
    } else {
      for (const b of bucketsRes.rows) {
        console.log(`  • Bucket "${b.name}" (id: ${b.id}) - Public: ${b.public}`);
      }
    }

    const storagePoliciesRes = await client.query(`
      SELECT policyname, tablename, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'storage';
    `);
    console.log(`  Storage Policies (${storagePoliciesRes.rows.length}):`);
    for (const sp of storagePoliciesRes.rows) {
      console.log(`    - [${sp.tablename}] "${sp.policyname}": ${sp.cmd}`);
    }
  } catch (err) {
    console.log('  Storage schema query note:', err.message);
  }

  await client.end();
}

auditRLS().catch((err) => {
  console.error('RLS audit failed:', err);
  process.exit(1);
});
