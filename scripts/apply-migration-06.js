require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration06() {
  console.log('--- Applying Migration 06 to Supabase PostgreSQL ---');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260828000006_remove_security_deposit_from_room.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  await client.query(sql);
  console.log('✅ Executed Migration 06 successfully!');

  // Verify Resident.securityDeposit and Registration.securityDeposit exist
  const resCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Resident' AND column_name = 'securityDeposit';
  `);
  console.log('  • Resident.securityDeposit column:', resCols.rows[0]);

  const regCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Registration' AND column_name = 'securityDeposit';
  `);
  console.log('  • Registration.securityDeposit column:', regCols.rows[0]);

  // Verify Room.securityDeposit dropped
  const roomCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Room' AND column_name = 'securityDeposit';
  `);
  console.log('  • Room.securityDeposit column count (must be 0):', roomCols.rows.length);

  await client.end();
}

applyMigration06().catch((err) => {
  console.error('Migration 06 failed:', err);
  process.exit(1);
});
