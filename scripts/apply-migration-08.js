require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function applyMigration() {
  console.log('================================================================');
  console.log('APPLYING MIGRATION: 20260828000008_add_receipt_drive_and_status.sql');
  console.log('================================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL.');

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260828000008_add_receipt_drive_and_status.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration SQL...');
    await client.query(sql);
    console.log('✅ Migration 08 applied successfully.');

    // Verify columns exist
    const checkRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Receipt' AND column_name IN ('googleDriveFileId', 'status', 'downloadToken');
    `);

    console.log(`✅ Verified ${checkRes.rows.length} columns added to table "Receipt".`);

    console.log('\nRegenerating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client regenerated.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
