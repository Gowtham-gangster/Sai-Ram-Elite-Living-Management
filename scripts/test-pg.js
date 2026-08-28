require('dotenv').config();
const { Client } = require('pg');

async function testPg() {
  const connStr = process.env.DATABASE_URL.replace(':5432/', ':6543/');
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query('SELECT count(*) FROM public."Resident";');
  console.log('Resident count via pg:', res.rows[0].count);
  await client.end();
}

testPg().catch(console.error);
