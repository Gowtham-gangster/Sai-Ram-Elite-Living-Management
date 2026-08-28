require('dotenv').config();
const { google } = require('googleapis');

async function inspectRawSheets() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  console.log('--- Google Spreadsheet Tabs ---');
  metaRes.data.sheets.forEach((s) => {
    console.log(`  • Title: "${s.properties.title}", SheetId: ${s.properties.sheetId}`);
  });

  const targetSheetTitle = metaRes.data.sheets[0].properties.title;
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${targetSheetTitle}'!A1:Z5`,
  });

  console.log('\n--- Headers (Row 1) ---');
  const headers = rowsRes.data.values ? rowsRes.data.values[0] : [];
  headers.forEach((h, i) => console.log(`  [Col ${i}] "${h}"`));

  console.log('\n--- Sample Rows ---');
  const dataRows = (rowsRes.data.values || []).slice(1, 4);
  dataRows.forEach((r, idx) => {
    console.log(`\nRow ${idx + 2}:`);
    r.forEach((val, cIdx) => {
      console.log(`   [${headers[cIdx] || `Col ${cIdx}`}]: "${val}"`);
    });
  });
}

inspectRawSheets().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
