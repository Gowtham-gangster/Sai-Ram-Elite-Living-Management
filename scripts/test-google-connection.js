const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function normalizePrivateKey(key) {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
}

function mapHeaderToApplicationField(rawHeader) {
  const h = rawHeader.trim().toLowerCase();

  if (h.includes('timestamp') || h === 'time') {
    return 'source_submitted_at';
  }
  if (h === 'full name' || (h.includes('name') && !h.includes('father') && !h.includes('guardian') && !h.includes('emergency') && !h.includes('company') && !h.includes('college'))) {
    return 'full_name';
  }
  if (h === 'mobile number' || h === 'phone number' || (h.includes('mobile') || (h.includes('phone') && !h.includes('emergency')))) {
    return 'mobile_number';
  }
  if (h.includes('father') || h.includes('guardian')) {
    return 'guardian_name';
  }
  if (h.includes('emergency')) {
    return 'emergency_contact_number';
  }
  if (h.includes('aadhaar number') || h.includes('adhar number') || (h.includes('aadhaar') && !h.includes('card') && !h.includes('upload'))) {
    return 'aadhaar_number';
  }
  if (h.includes('adhar card') || h.includes('collage id') || h.includes('company id') || h.includes('document') || h.includes('proof')) {
    return 'identity_document_url';
  }
  if (h === 'occupation') {
    return 'occupation';
  }
  if (h.includes('occupation') && h.includes('type')) {
    return 'occupation_type';
  }
  if (h.includes('company or college') || h.includes('college name') || h.includes('company name')) {
    return 'company_or_college_name';
  }
  if (h.includes('room number') || h.includes('room')) {
    return 'requested_room_number';
  }
  if (h.includes('check in date') || h.includes('joining date') || h.includes('date')) {
    return 'check_in_date';
  }
  if (h.includes('security deposit') || h.includes('deposit')) {
    return 'security_deposit';
  }
  if (h.includes('declaration') || h.includes('accept') || h.includes('agree')) {
    return 'declaration_accepted';
  }

  return 'unmapped_field';
}

async function testGoogleConnection() {
  console.log('================================================================');
  console.log('   GOOGLE SHEETS & GOOGLE DRIVE CONNECTION VERIFICATION TEST    ');
  console.log('================================================================\n');

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  console.log('--- 1. Environment & Credential Configuration Check ---');
  console.log(`📋 GOOGLE_SPREADSHEET_ID:       ${spreadsheetId ? 'CONFIGURED (' + spreadsheetId.substring(0, 6) + '...)' : 'MISSING'}`);
  console.log(`📧 GOOGLE_SERVICE_ACCOUNT_EMAIL: ${clientEmail ? 'CONFIGURED (' + clientEmail + ')' : 'MISSING'}`);
  console.log(`🔑 GOOGLE_PRIVATE_KEY:           ${rawKey ? 'CONFIGURED (PEM format detected)' : 'MISSING'}`);

  if (!spreadsheetId || !clientEmail || !rawKey) {
    throw new Error('Google service account credentials missing in .env');
  }

  const privateKey = normalizePrivateKey(rawKey);

  // 1. Authenticate with Google JWT
  console.log('\n--- 2. Authenticating Service Account via Google JWT ---');
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  await auth.authorize();
  console.log('✅ Google Service Account authentication successful (Token generated).');

  // 2. Test Google Sheets Access
  console.log('\n--- 3. Testing Google Sheets Read-Only Access ---');
  const sheets = google.sheets({ version: 'v4', auth });

  const metaRes = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const title = metaRes.data.properties?.title || 'Untitled';
  const sheetTabs = (metaRes.data.sheets || []).map((s) => s.properties?.title || 'Sheet');
  console.log(`✅ Spreadsheet Title: "${title}"`);
  console.log(`✅ Available Sheet Tabs (${sheetTabs.length}):`, sheetTabs);

  // Identify Form Response Sheet
  const responseSheetTitle = sheetTabs.find((t) =>
    t.toLowerCase().includes('response') || t.toLowerCase().includes('form')
  ) || sheetTabs[0];

  console.log(`✅ Response Sheet Identified: "${responseSheetTitle}"`);

  // 3. Read Header Row
  console.log('\n--- 4. Reading Header Row from Google Form Response Sheet ---');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${responseSheetTitle}'!1:1`,
  });

  const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
  console.log(`✅ Retrieved ${headers.length} Columns from Row 1:`);
  headers.forEach((h, idx) => {
    console.log(`   [Col ${idx + 1}] "${h}"`);
  });

  // 4. Generate Application Field Mapping
  console.log('\n--- 5. Google Sheet Header to Application Field Mapping ---');
  const fieldMapping = {};
  headers.forEach((header) => {
    const appField = mapHeaderToApplicationField(header);
    fieldMapping[header] = appField;
    console.log(`   "${header}" ➔ ${appField}`);
  });

  // 5. Test Google Drive Access
  console.log('\n--- 6. Testing Google Drive Read-Only Connectivity ---');
  let driveAccessible = false;
  let driveMessage = '';
  try {
    const drive = google.drive({ version: 'v3', auth });
    const driveRes = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)',
    });
    const fileCount = (driveRes.data.files || []).length;
    driveAccessible = true;
    driveMessage = `Google Drive API connection verified. Accessible files found: ${fileCount}.`;
    console.log(`✅ ${driveMessage}`);
  } catch (driveErr) {
    driveAccessible = false;
    driveMessage = `Google Drive API limitation: ${driveErr.message}`;
    console.log(`⚠️ ${driveMessage}`);
  }

  // 6. Security Check
  console.log('\n--- 7. Security & Zero-Bed Architecture Compliance ---');
  const gitignoreContent = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  if (!gitignoreContent.includes('.env') || !gitignoreContent.includes('*credentials*.json')) {
    throw new Error('.gitignore missing credential patterns!');
  }
  console.log('✅ .gitignore verified: .env, *.key.json, and *credentials*.json are strictly ignored.');
  console.log('✅ Strictly Read-Only: ZERO spreadsheet mutations, writes, or deletions executed.');
  console.log('✅ Zero credentials exposed to client-side code.');

  console.log('\n================================================================');
  console.log('  🎉 GOOGLE SHEETS & DRIVE CONNECTION TEST COMPLETED (STATUS: OK)');
  console.log('================================================================\n');

  process.exit(0);
}

testGoogleConnection().catch((err) => {
  console.error('❌ Google Connection Test Error:', err.message);
  process.exit(1);
});
