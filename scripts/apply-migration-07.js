require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function applyMigration() {
  console.log('================================================================');
  console.log('APPLYING MIGRATION: 20260828000007_add_google_drive_file_id_to_registration.sql');
  console.log('================================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL.');

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260828000007_add_google_drive_file_id_to_registration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration SQL...');
    await client.query(sql);
    console.log('✅ Migration 07 applied successfully.');

    // Verify column exists
    const checkRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Registration' AND column_name = 'googleDriveFileId';
    `);

    if (checkRes.rows.length > 0) {
      console.log('✅ Verified "googleDriveFileId" column exists on table "Registration".');
    } else {
      console.error('❌ "googleDriveFileId" column not found after migration.');
    }

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
