require('dotenv').config();
const { google } = require('googleapis');

function normalizePrivateKey(key) {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
}

function getGoogleAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const privateKey = normalizePrivateKey(rawKey);
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

async function inspectAllTabs() {
  console.log('================================================================');
  console.log('INSPECTING ALL TABS IN SPREADSHEET');
  console.log('================================================================\n');

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const auth = getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Spreadsheet Title:', metaRes.data.properties.title);

    for (const sheet of metaRes.data.sheets) {
      const tabTitle = sheet.properties.title;
      console.log(`\n================= TAB: "${tabTitle}" =================`);

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabTitle}'!A1:Z`,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = res.data.values || [];
      console.log(`Row count (including header): ${rows.length}`);

      if (rows.length > 0) {
        const headers = rows[0];
        console.log('Headers:');
        headers.forEach((h, idx) => {
          console.log(`  [Col ${idx}] "${h}" (Normalized: "${String(h).trim().toLowerCase()}")`);
        });

        // Check for document column
        let docColIdx = -1;
        headers.forEach((h, idx) => {
          const lower = String(h).trim().toLowerCase();
          if (lower.includes('adhar') || lower.includes('aadhaar') || lower.includes('id') || lower.includes('card') || lower.includes('document')) {
            if (!lower.includes('number')) {
              docColIdx = idx;
              console.log(`  => Document Upload Column identified at Col ${idx}: "${h}"`);
            }
          }
        });

        let foundDocs = 0;
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const name = row[1] || 'No Name';
          const docVal = docColIdx >= 0 ? row[docColIdx] : null;
          if (docVal && String(docVal).trim() !== '') {
            foundDocs++;
            if (foundDocs <= 5) {
              console.log(`  Sample Row ${r + 1} (${name}):`);
              console.log(`    Value: "${docVal}"`);
            }
          }
        }
        console.log(`  Total rows with document: ${foundDocs}/${rows.length - 1}`);
      }
    }
  } catch (err) {
    console.error('Inspection error:', err);
  }
}

inspectAllTabs();
