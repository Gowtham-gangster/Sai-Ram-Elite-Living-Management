require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSelect() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(supabaseUrl, anonKey);

  const tables = [
    'admin_users',
    'rooms',
    'residents',
    'registrations',
    'hostel_settings',
  ];

  for (const t of tables) {
    const { data, error, status, statusText } = await supabase.from(t).select('*');
    console.log(`Table "${t}" -> status: ${status} ${statusText}, error:`, error, `rows:`, data?.length);
  }
}

testSelect();
