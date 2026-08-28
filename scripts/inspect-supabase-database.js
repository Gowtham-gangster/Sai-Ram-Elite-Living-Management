require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function inspectSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('================================================================');
  console.log('          SUPABASE DATABASE VERIFICATION & AUDIT                ');
  console.log('================================================================\n');

  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Publishable/Anon Key Present: ${!!anonKey}`);
  console.log(`Service Role Key Present: ${!!serviceKey}`);

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing Supabase URL or Anon key.');
    return;
  }

  // 1. Fetch OpenAPI schema definition from Supabase REST endpoint
  console.log('\n--- 1. Querying Supabase OpenAPI Schema (/rest/v1/) ---');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${anonKey}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.log(`Response status: ${res.status} ${res.statusText}`);
    } else {
      const openApi = await res.json();
      const paths = Object.keys(openApi.paths || {});
      const definitions = Object.keys(openApi.definitions || {});
      
      console.log(`Exposed REST Endpoints (Public Tables/Views in OpenAPI):`);
      if (paths.length === 0 || (paths.length === 1 && paths[0] === '/')) {
        console.log('  👉 [NONE] No public tables or views are exposed in Supabase PostgREST.');
      } else {
        paths.forEach((p) => console.log(`  - ${p}`));
      }

      console.log(`\nTable Definitions in OpenAPI:`);
      if (definitions.length === 0) {
        console.log('  👉 [NONE] 0 Table definitions found in public schema.');
      } else {
        definitions.forEach((d) => console.log(`  - ${d}`));
      }
    }
  } catch (err) {
    console.error('Error fetching OpenAPI schema:', err.message);
  }

  // 2. Test direct queries on expected tables
  console.log('\n--- 2. Testing Direct Table Queries via Supabase Client ---');
  const supabase = createClient(supabaseUrl, anonKey);
  const expectedTables = [
    'admin_users',
    'rooms',
    'residents',
    'registrations',
    'room_change_requests',
    'monthly_payments',
    'payment_records',
    'receipts',
    'payment_reminders',
    'reminder_templates',
    'sync_logs',
    'hostel_settings',
    'system_notifications',
    'audit_logs',
  ];

  for (const table of expectedTables) {
    const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ Table "${table}": ${error.message} (Code: ${error.code})`);
    } else {
      console.log(`  ✅ Table "${table}": Exists!`);
    }
  }
}

inspectSupabase();
