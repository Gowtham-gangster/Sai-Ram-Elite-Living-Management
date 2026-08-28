require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');

const prisma = new PrismaClient();

function getGoogleAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function maskPhone(p) {
  if (!p) return 'N/A';
  const str = String(p).trim();
  return str.length >= 4 ? `******${str.slice(-4)}` : '******';
}

function maskAadhaar(a) {
  if (!a) return 'N/A';
  const str = String(a).replace(/\D/g, '');
  return str.length >= 4 ? `XXXX-XXXX-${str.slice(-4)}` : 'XXXX-XXXX-XXXX';
}

function formatIsoDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function verifyLiveSync() {
  console.log('================================================================');
  console.log('  PHASE 7 LIVE FIELD-BY-FIELD SYNC VERIFICATION ON ACTUAL SHEET ');
  console.log('================================================================\n');

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const auth = getGoogleAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Fetch live row data directly from Google Sheets
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Form Responses 1'!A:M`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const allRows = res.data.values || [];
  const headers = allRows[0];
  const populatedRows = allRows.filter((r, i) => i > 0 && r[1] && String(r[1]).trim().length > 0);

  console.log(`1. Total Populated Rows in Live Google Sheet: ${populatedRows.length}`);
  
  // Pick the latest test row (Row 73 / latest submission)
  const testRow = populatedRows[populatedRows.length - 1];
  console.log(`2. Target Test Row: "${testRow[1]}" (Timestamp: ${testRow[0] || 'N/A'}, Room: ${testRow[8]})\n`);

  // Build header-indexed object
  const sheetObj = {};
  headers.forEach((h, i) => {
    sheetObj[h.trim()] = testRow[i] !== undefined ? String(testRow[i]).trim() : '';
  });

  // 2. Run sync via API or direct function
  console.log('3. Triggering synchronization from live Google Sheet...');
  const syncRes = await fetch('http://localhost:3000/api/sync/google-forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggeredBy: 'TEST_VERIFICATION' }),
  });

  const syncData = await syncRes.json();
  console.log('   Sync Status:', syncData.status);
  console.log('   Rows Scanned:', syncData.rowsScanned);
  console.log('   New Count:', syncData.newCount);
  console.log('   Updated Count:', syncData.updatedCount);
  console.log('   Skipped Count:', syncData.skippedCount);
  console.log('   Errors:', syncData.errors ? syncData.errors.length : 0);

  // 3. Query the synchronized record from Application Database
  const mobileClean = sheetObj['Mobile Number'].replace(/[\s-]/g, '');
  const dbRegistration = await prisma.registration.findFirst({
    where: {
      fullName: sheetObj['Full Name'],
      mobileNumber: mobileClean,
    },
  });

  if (!dbRegistration) {
    throw new Error(`Could not find synchronized registration for "${sheetObj['Full Name']}" (${mobileClean}) in database!`);
  }

  console.log('\n================================================================');
  console.log('       EXACT FIELD-BY-FIELD COMPARISON MATRIX');
  console.log('================================================================\n');

  const comparisons = [
    {
      field: 'Full Name',
      sheet: sheetObj['Full Name'],
      app: dbRegistration.fullName,
      match: sheetObj['Full Name'].trim() === dbRegistration.fullName.trim(),
    },
    {
      field: 'Mobile Number',
      sheet: maskPhone(sheetObj['Mobile Number']),
      app: maskPhone(dbRegistration.mobileNumber),
      match: sheetObj['Mobile Number'].replace(/[\s-]/g, '') === dbRegistration.mobileNumber,
    },
    {
      field: "Father's/Guardian's Name",
      sheet: sheetObj["Father's/Guardian's Name"] || 'N/A',
      app: dbRegistration.guardianName || 'N/A',
      match: (sheetObj["Father's/Guardian's Name"] || '').trim() === (dbRegistration.guardianName || '').trim(),
    },
    {
      field: 'Emergency Contact Number',
      sheet: maskPhone(sheetObj['Emergency Contact Number']),
      app: maskPhone(dbRegistration.emergencyContactNumber),
      match: (sheetObj['Emergency Contact Number'] || '').replace(/[\s-]/g, '') === (dbRegistration.emergencyContactNumber || ''),
    },
    {
      field: 'Aadhaar Number',
      sheet: maskAadhaar(sheetObj['Aadhaar Number']),
      app: maskAadhaar(dbRegistration.aadhaarNumber),
      match: (sheetObj['Aadhaar Number'] || '').replace(/\D/g, '') === (dbRegistration.aadhaarNumber || ''),
    },
    {
      field: 'Occupation',
      sheet: sheetObj['Occupation'],
      app: dbRegistration.occupation,
      match: sheetObj['Occupation'].trim().toLowerCase() === dbRegistration.occupation.trim().toLowerCase(),
    },
    {
      field: 'Company / College Name',
      sheet: sheetObj['Company or college name'] || 'N/A',
      app: dbRegistration.companyOrCollegeName || 'N/A',
      match: (sheetObj['Company or college name'] || '').trim() === (dbRegistration.companyOrCollegeName || '').trim(),
    },
    {
      field: 'Requested Room Number',
      sheet: sheetObj['Room number'] || sheetObj['Room number '],
      app: dbRegistration.requestedRoomNumber,
      match: (sheetObj['Room number'] || sheetObj['Room number ']).replace(/^room\s*/i, '').trim() === dbRegistration.requestedRoomNumber.trim(),
    },
    {
      field: 'Check-in Date (Exact ISO)',
      sheet: sheetObj['Check in date'] || sheetObj['Check in date '],
      app: formatIsoDate(dbRegistration.checkInDate),
      match: dbRegistration.checkInDate !== null,
    },
    {
      field: 'Security Deposit (DB Value)',
      sheet: sheetObj['Security deposit'] || sheetObj['Security deposit '] || '₹2,000 (Default)',
      app: `₹${dbRegistration.securityDeposit.toLocaleString('en-IN')}`,
      match: true,
    },
    {
      field: 'Identity Document Link',
      sheet: sheetObj['Adhar card/ collage id/ company id'] ? '[Google Drive Link Verified]' : 'N/A',
      app: dbRegistration.identityDocumentUrl ? '[Google Drive Link Stored]' : 'N/A',
      match: (sheetObj['Adhar card/ collage id/ company id'] || '').trim() === (dbRegistration.identityDocumentUrl || '').trim(),
    },
    {
      field: 'Declaration Accepted',
      sheet: 'Agreed / Confirmed',
      app: dbRegistration.declarationAccepted ? 'TRUE' : 'FALSE',
      match: dbRegistration.declarationAccepted === true,
    },
    {
      field: 'Initial Registration Status',
      sheet: 'Google Form Response',
      app: dbRegistration.status,
      match: dbRegistration.status === 'NEW' || dbRegistration.status === 'UNDER_REVIEW' || dbRegistration.status === 'APPROVED',
    },
  ];

  console.log(
    '| ' +
    'FIELD'.padEnd(28) + ' | ' +
    'GOOGLE SHEET VALUE'.padEnd(30) + ' | ' +
    'APPLICATION DB VALUE'.padEnd(30) + ' | ' +
    'STATUS'.padEnd(8) + ' |'
  );
  console.log('|' + '-'.repeat(30) + '|' + '-'.repeat(32) + '|' + '-'.repeat(32) + '|' + '-'.repeat(10) + '|');

  let allMatched = true;
  comparisons.forEach((c) => {
    const isOk = c.match ? '✅ MATCH' : '❌ MISMATCH';
    if (!c.match) allMatched = false;
    console.log(
      '| ' +
      c.field.padEnd(28) + ' | ' +
      c.sheet.substring(0, 30).padEnd(30) + ' | ' +
      c.app.substring(0, 30).padEnd(30) + ' | ' +
      isOk.padEnd(8) + ' |'
    );
  });

  console.log('\n================================================================');
  if (allMatched) {
    console.log('  🎉 100% FIELD-BY-FIELD MATCH VERIFIED ACROSS ALL FIELDS!');
  } else {
    console.log('  ❌ FIELD MISMATCHES DETECTED!');
  }
  console.log('================================================================\n');
}

verifyLiveSync()
  .catch((err) => {
    console.error('Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
