require('dotenv').config();
const { google } = require('googleapis');

function getGoogleAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error('Google service account email or private key is missing from environment variables.');
  }

  // Handle escaped newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

async function inspectLiveSheet() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  console.log('=== INSPECTING LIVE GOOGLE SPREADSHEET ===');
  console.log('Spreadsheet ID:', spreadsheetId);

  const auth = getGoogleAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  const meta = metaRes.data;
  console.log('\n1. Spreadsheet Title:', meta.properties.title);
  console.log('2. Available Tabs:');
  meta.sheets.forEach((s) => {
    console.log(`   - "${s.properties.title}" (ID: ${s.properties.sheetId}, Rows: ${s.properties.gridProperties.rowCount}, Cols: ${s.properties.gridProperties.columnCount})`);
  });

  const sheetTitle = meta.sheets[0].properties.title;

  // Header row
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!1:1`,
  });

  const headers = headerRes.data.values ? headerRes.data.values[0] : [];
  console.log(`\n3. Actual Header Row (from '${sheetTitle}'): Total ${headers.length} headers`);
  headers.forEach((h, i) => {
    console.log(`   Col ${i + 1} [Index ${i}]: "${h}"`);
  });

  // Fetch Formatted Values
  const formattedRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:Z10`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  console.log(`\n4. Formatted Rows Count: ${formattedRes.data.values ? formattedRes.data.values.length : 0}`);
  if (formattedRes.data.values && formattedRes.data.values.length > 1) {
    for (let r = 1; r < formattedRes.data.values.length; r++) {
      const row = formattedRes.data.values[r];
      console.log(`\n--- Row ${r + 1} (Formatted) ---`);
      headers.forEach((h, c) => {
        let val = row[c] !== undefined ? row[c] : '[EMPTY]';
        let safeVal = String(val);
        // Mask Aadhaar & Phone in log
        if (h.toLowerCase().includes('aadhaar') || h.toLowerCase().includes('adhar')) {
          safeVal = safeVal.length >= 4 ? `XXXX-XXXX-${safeVal.slice(-4)}` : '[MASKED]';
        } else if (h.toLowerCase().includes('mobile') || h.toLowerCase().includes('contact') || h.toLowerCase().includes('number') && !h.toLowerCase().includes('room') && !h.toLowerCase().includes('aadhaar')) {
          safeVal = safeVal.length >= 4 ? `******${safeVal.slice(-4)}` : '[MASKED]';
        } else if (safeVal.startsWith('http')) {
          safeVal = '[URL_SAVED_SECURELY]';
        }
        console.log(`   "${h}": "${safeVal}"`);
      });
    }
  }

  // Fetch Last 5 Rows to see recent test submissions
  const allRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A:M`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const allRows = allRowsRes.data.values || [];
  const validRows = allRows.filter((r, i) => i > 0 && r[1] && String(r[1]).trim().length > 0);
  console.log(`\n7. Total Populated Rows with Names: ${validRows.length}`);
  validRows.forEach((row, idx) => {
    console.log(`\n--- Populated Row ${idx + 1} ---`);
    headers.forEach((h, c) => {
      let val = row[c] !== undefined ? row[c] : '[EMPTY]';
      let safeVal = String(val);
      if (h.toLowerCase().includes('aadhaar') || h.toLowerCase().includes('adhar')) {
        safeVal = safeVal.length >= 4 ? `XXXX-XXXX-${safeVal.slice(-4)}` : '[MASKED]';
      } else if (h.toLowerCase().includes('mobile') || (h.toLowerCase().includes('contact') && !h.toLowerCase().includes('room'))) {
        safeVal = safeVal.length >= 4 ? `******${safeVal.slice(-4)}` : '[MASKED]';
      } else if (safeVal.startsWith('http')) {
        safeVal = '[URL_SAVED_SECURELY]';
      }
      console.log(`   "${h}": "${safeVal}"`);
    });
  });
}

inspectLiveSheet().catch((err) => {
  console.error('Inspection Error:', err);
  process.exit(1);
});
