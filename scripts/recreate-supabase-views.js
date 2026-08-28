require('dotenv').config();
const { Client } = require('pg');

async function recreateViews() {
  console.log('--- Connecting to Supabase PostgreSQL to recreate Views ---');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  await client.query(`
    CREATE OR REPLACE VIEW public.room_occupancy_view AS
    SELECT
      rm.id AS room_id,
      rm."roomNumber",
      rm.floor,
      rm."sharingType",
      rm.capacity,
      rm.status AS configured_status,
      COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')) AS current_occupancy,
      GREATEST(0, rm.capacity - COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD'))) AS available_slots,
      COALESCE(SUM(res."monthlyRent") FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')), 0) AS monthly_collection,
      CASE
        WHEN rm.status = 'MAINTENANCE' THEN 'MAINTENANCE'
        WHEN COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')) >= rm.capacity THEN 'FULL'
        ELSE 'AVAILABLE'
      END AS dynamic_status,
      CASE
        WHEN rm.capacity > 0 THEN 
          ROUND((COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD'))::NUMERIC / rm.capacity::NUMERIC) * 100, 1)
        ELSE 0
      END AS occupancy_percentage,
      rm."createdAt",
      rm."updatedAt"
    FROM public."Room" rm
    LEFT JOIN public."Resident" res ON res."roomId" = rm.id
    GROUP BY rm.id, rm."roomNumber", rm.floor, rm."sharingType", rm.capacity, rm.status, rm."createdAt", rm."updatedAt";
  `);

  console.log('✅ Created public.room_occupancy_view in Supabase PostgreSQL!');

  await client.end();
}

recreateViews().catch((err) => {
  console.error('Recreating views failed:', err);
  process.exit(1);
});
