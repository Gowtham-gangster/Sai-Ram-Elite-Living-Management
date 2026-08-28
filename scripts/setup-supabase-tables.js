require('dotenv').config();
const { Client } = require('pg');

async function cleanViewsAndDependencies() {
  console.log('--- Connecting to Supabase PostgreSQL via pg ---');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected successfully to Supabase PostgreSQL!');

  console.log('--- Dropping dependent views in public schema ---');
  await client.query(`
    DROP VIEW IF EXISTS public.room_occupancy_view CASCADE;
    DROP VIEW IF EXISTS public.v_room_occupancy_census CASCADE;
    DROP VIEW IF EXISTS public.v_resident_active_ledger CASCADE;
    DROP VIEW IF EXISTS public.v_pending_registration_queue CASCADE;
    DROP TABLE IF EXISTS public.profiles CASCADE;
  `);
  console.log('✅ Dropped views successfully.');

  await client.end();
}

cleanViewsAndDependencies().catch((err) => {
  console.error('Clean failed:', err);
  process.exit(1);
});
