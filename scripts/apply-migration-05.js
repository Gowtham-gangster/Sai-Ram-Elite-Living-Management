require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration05() {
  console.log('--- Applying Migration 05 to Supabase PostgreSQL ---');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260828000005_resident_based_monthly_rent.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  await client.query(sql);
  console.log('✅ Executed Migration 05 successfully!');

  // Verify Registration.monthlyRent exists and Room.baseRent dropped
  const regCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Registration' AND column_name = 'monthlyRent';
  `);
  console.log('  • Registration.monthlyRent column:', regCols.rows[0]);

  const roomCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Room' AND column_name = 'baseRent';
  `);
  console.log('  • Room.baseRent column (should be 0 rows):', roomCols.rows.length);

  await client.end();
}

applyMigration05().catch((err) => {
  console.error('Migration 05 failed:', err);
  process.exit(1);
});
