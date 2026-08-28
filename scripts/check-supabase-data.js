require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const supabase = createClient(supabaseUrl, anonKey);

  const tables = [
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

  console.log('================================================================');
  console.log('      SUPABASE DATA & ROW COUNT AUDIT IN PUBLIC SCHEMA          ');
  console.log('================================================================\n');

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${table}: Error: ${error.message}`);
    } else {
      console.log(`  📊 Table "${table}": ${count} row(s) in Supabase public schema`);
    }
  }

  // Check views
  const views = [
    'v_room_occupancy_census',
    'v_resident_active_ledger',
    'v_pending_registration_queue',
  ];
  console.log('\n--- Checking Views ---');
  for (const view of views) {
    const { count, error } = await supabase.from(view).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ View "${view}": Error: ${error.message}`);
    } else {
      console.log(`  👁️ View "${view}": Exists (${count} rows)`);
    }
  }
}

checkSupabaseData();
