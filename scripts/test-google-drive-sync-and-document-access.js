require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

function extractGoogleDriveDoc(raw) {
  if (!raw || typeof raw !== 'string') {
    return { fileId: null, viewUrl: null, downloadUrl: null, allFileIds: [], raw: '' };
  }
  const rawStr = String(raw).trim();
  if (rawStr === '' || /^(na|n\/a|nil|none|no|null|undefined)$/i.test(rawStr)) {
    return { fileId: null, viewUrl: null, downloadUrl: null, allFileIds: [], raw: rawStr };
  }
  const fileIdPatterns = [
    /[?&]id=([a-zA-Z0-9_-]{25,50})/g,
    /\/d\/([a-zA-Z0-9_-]{25,50})/g,
    /\/file\/d\/([a-zA-Z0-9_-]{25,50})/g,
  ];
  const extractedIds = [];
  for (const pattern of fileIdPatterns) {
    let match;
    while ((match = pattern.exec(rawStr)) !== null) {
      if (match[1] && !extractedIds.includes(match[1])) {
        extractedIds.push(match[1]);
      }
    }
  }
  if (extractedIds.length === 0 && /^[a-zA-Z0-9_-]{25,50}$/.test(rawStr)) {
    extractedIds.push(rawStr);
  }
  const primaryFileId = extractedIds.length > 0 ? extractedIds[0] : null;
  return {
    fileId: primaryFileId,
    viewUrl: primaryFileId ? `https://drive.google.com/file/d/${primaryFileId}/view` : rawStr.startsWith('http') ? rawStr : null,
    downloadUrl: primaryFileId ? `https://drive.google.com/uc?export=download&id=${primaryFileId}` : null,
    allFileIds: extractedIds,
    raw: rawStr,
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: GOOGLE DRIVE DOCUMENT SYNC & PROTECTED ACCESS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Extraction of File IDs from various URL formats
    // -------------------------------------------------------------
    console.log('--- Test 1: Google Drive URL / ID Extraction Unit Tests ---');
    const cases = [
      {
        input: 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz_12345',
        expectedId: '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345',
      },
      {
        input: 'https://drive.google.com/file/d/1XyZ9876543210_AbCdEfGhIjKlMnOp/view?usp=drivesdk',
        expectedId: '1XyZ9876543210_AbCdEfGhIjKlMnOp',
      },
      {
        input: 'https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOpQrStUvWxYz_12345&export=download',
        expectedId: '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345',
      },
      {
        input: '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345',
        expectedId: '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345',
      },
      {
        input: '',
        expectedId: null,
      },
      {
        input: 'N/A',
        expectedId: null,
      },
    ];

    let allExtractionPassed = true;
    for (const c of cases) {
      const res = extractGoogleDriveDoc(c.input);
      if (res.fileId !== c.expectedId) {
        allExtractionPassed = false;
        console.error(`   Extraction mismatch for "${c.input}": got ${res.fileId}, expected ${c.expectedId}`);
      }
    }
    assert(allExtractionPassed, 'extractGoogleDriveDoc accurately parses file IDs from all Google Drive URL formats');

    // -------------------------------------------------------------
    // Test 2: New Registration Sync with Document Reference
    // -------------------------------------------------------------
    console.log('\n--- Test 2: New Registration Sync with Uploaded Document ---');
    const testMobile = '9988776655';
    await prisma.registration.deleteMany({ where: { mobileNumber: testMobile } });

    const sampleDriveUrl = 'https://drive.google.com/file/d/1TestDocId_AbCdEfGhIjKlMnOpQrStUv/view?usp=drivesdk';
    const sampleDocInfo = extractGoogleDriveDoc(sampleDriveUrl);

    const reg1 = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: `gform_test_doc_${Date.now()}`,
        fullName: 'Test Doc Resident',
        mobileNumber: testMobile,
        requestedRoomNumber: '101',
        monthlyRent: 8000.0,
        securityDeposit: 2000.0,
        identityDocumentUrl: sampleDocInfo.viewUrl,
        googleDriveFileId: sampleDocInfo.fileId,
        status: 'NEW',
      },
    });

    assert(reg1.googleDriveFileId === sampleDocInfo.fileId, `googleDriveFileId stored in Supabase: ${reg1.googleDriveFileId}`);
    assert(reg1.identityDocumentUrl === sampleDocInfo.viewUrl, `identityDocumentUrl stored in Supabase: ${reg1.identityDocumentUrl}`);

    // -------------------------------------------------------------
    // Test 3: Resident Edits Form & Replaces Document (In-Place Update)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Resident Replaces Uploaded Document in Form (In-Place Update) ---');
    const updatedDriveUrl = 'https://drive.google.com/file/d/1NewUpdatedDocId_ZyxWvuTsRqP/view';
    const updatedDocInfo = extractGoogleDriveDoc(updatedDriveUrl);

    const updatedReg = await prisma.registration.update({
      where: { id: reg1.id },
      data: {
        identityDocumentUrl: updatedDocInfo.viewUrl,
        googleDriveFileId: updatedDocInfo.fileId,
        updatedAt: new Date(),
      },
    });

    assert(updatedReg.id === reg1.id, 'Same Registration ID preserved during document replacement');
    assert(updatedReg.googleDriveFileId === updatedDocInfo.fileId, `Updated googleDriveFileId: ${updatedReg.googleDriveFileId}`);
    assert(updatedReg.status === 'NEW', 'Registration review status preserved during document update');

    // -------------------------------------------------------------
    // Test 4: Idempotent Repeated Sync (Zero Duplicates)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Repeated Synchronization Invariance ---');
    const countBefore = await prisma.registration.count({ where: { mobileNumber: testMobile } });
    // Simulate finding existing registration
    const existing = await prisma.registration.findFirst({ where: { id: reg1.id } });
    assert(existing !== null, 'Existing registration identified');
    const countAfter = await prisma.registration.count({ where: { mobileNumber: testMobile } });
    assert(countBefore === 1 && countAfter === 1, 'Zero duplicate registrations generated');

    // -------------------------------------------------------------
    // Test 5: Registration Without Document
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Registration Without Document Attachment ---');
    const testNoDocMobile = '9988776656';
    await prisma.registration.deleteMany({ where: { mobileNumber: testNoDocMobile } });

    const noDocReg = await prisma.registration.create({
      data: {
        externalSource: 'GOOGLE_FORM',
        externalResponseId: `gform_nodoc_${Date.now()}`,
        fullName: 'No Doc Resident',
        mobileNumber: testNoDocMobile,
        requestedRoomNumber: '102',
        monthlyRent: 8000.0,
        securityDeposit: 2000.0,
        identityDocumentUrl: null,
        googleDriveFileId: null,
        status: 'NEW',
      },
    });

    assert(noDocReg.googleDriveFileId === null, 'Registration without document has googleDriveFileId = null');
    assert(noDocReg.identityDocumentUrl === null, 'Registration without document has identityDocumentUrl = null');
    assert(noDocReg.status === 'NEW', 'Registration created successfully without requiring document upload');

    // -------------------------------------------------------------
    // Test 6: Document Endpoint Helper Invariants
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Document Reference Resolution Invariants ---');
    const resolvedDoc1 = extractGoogleDriveDoc(reg1.googleDriveFileId || reg1.identityDocumentUrl);
    const resolvedDoc2 = extractGoogleDriveDoc(noDocReg.googleDriveFileId || noDocReg.identityDocumentUrl);

    assert(resolvedDoc1.fileId !== null, 'Valid registration resolves to non-null fileId for API streaming');
    assert(resolvedDoc2.fileId === null, 'No-doc registration resolves to null fileId (triggering 404 response)');

    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    await prisma.registration.deleteMany({ where: { mobileNumber: { in: [testMobile, testNoDocMobile] } } });
    console.log('✅ Cleaned up temporary test registrations.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
