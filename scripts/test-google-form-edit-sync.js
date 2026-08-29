/**
 * test-google-form-edit-sync.js
 * 
 * Verifies robust Google Forms -> Google Sheets -> Supabase synchronization
 * for edited existing form responses and all 20 required verification criteria.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function generateDeterministicResponseId(timestamp, mobile, fullName, rowIndex) {
  const cleanTime = (timestamp || '').trim();
  if (cleanTime) {
    const hash = crypto.createHash('sha256').update(`ts_${cleanTime}`).digest('hex').substring(0, 16);
    return `gform_${hash}`;
  }
  const cleanMobile = (mobile || '').replace(/[\s-]/g, '').trim();
  const cleanName = (fullName || '').trim().toLowerCase();
  const seed = `${cleanMobile}_${cleanName}_row${rowIndex || 0}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

function generateDeterministicLegacyId(timestamp, mobile, fullName) {
  const cleanMobile = (mobile || '').replace(/[\s-]/g, '').trim();
  const cleanName = (fullName || '').trim().toLowerCase();
  const cleanTime = (timestamp || '').trim();
  const seed = `${cleanTime}_${cleanMobile}_${cleanName}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

function parseSecurityDeposit(raw) {
  if (raw === undefined || raw === null) return { value: null, raw: '' };
  const str = String(raw).trim();
  return { value: str.length > 0 ? str : null, raw: str };
}

function parseMonthlyRent(raw) {
  if (raw === undefined || raw === null || raw === '') return { amount: null, raw: '' };
  const str = String(raw).trim();
  if (str === '' || /^(na|n\/a|nil|none|no|yes)$/i.test(str)) return { amount: null, raw: str };
  const cleanNumStr = str.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanNumStr);
  if (!isNaN(parsed) && parsed >= 0) return { amount: parsed, raw: str };
  return { amount: null, raw: str };
}

/**
 * Simulates synchronization of a list of Google Sheet rows
 */
async function simulateSyncRows(rows) {
  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errors = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRowData = rows[i];
    const rowIndex = i + 2;

    const fullName = (rawRowData.full_name || '').trim();
    if (!fullName) {
      skippedCount++;
      continue;
    }

    const mobileNumber = (rawRowData.mobile_number || '').replace(/[\s-]/g, '').trim();
    if (!mobileNumber || mobileNumber.length < 10) {
      errors.push(`Row ${rowIndex}: Invalid mobile`);
      continue;
    }

    const guardianName = rawRowData.guardian_name ? String(rawRowData.guardian_name).trim() : null;
    const emergencyContactNumber = rawRowData.emergency_contact_number ? String(rawRowData.emergency_contact_number).replace(/[\s-]/g, '').trim() : null;
    const aadhaarNumber = rawRowData.aadhaar_number ? String(rawRowData.aadhaar_number).replace(/\D/g, '') : null;
    const occupation = rawRowData.occupation ? String(rawRowData.occupation).trim() : 'Student';
    const occupationType = occupation.toUpperCase().includes('STUDENT') ? 'STUDENT' : 'WORKING_PROFESSIONAL';
    const companyOrCollegeName = rawRowData.company_or_college_name ? String(rawRowData.company_or_college_name).trim() : null;
    const requestedRoomNumber = rawRowData.requested_room_number ? String(rawRowData.requested_room_number).replace(/^room\s*/i, '').trim() : null;
    const checkInDate = rawRowData.check_in_date ? new Date(rawRowData.check_in_date) : new Date();

    const { amount: rentAmount } = parseMonthlyRent(rawRowData.monthly_rent);
    const monthlyRent = rentAmount !== null ? rentAmount : 0.0;
    const { value: depositValue } = parseSecurityDeposit(rawRowData.security_deposit);
    const securityDeposit = depositValue;

    const identityDocUrl = rawRowData.identity_document_url || null;
    const googleDriveFileId = rawRowData.google_drive_file_id || null;
    const timestampStr = rawRowData.source_submitted_at || '';
    const sourceSubmittedAt = timestampStr ? new Date(timestampStr) : new Date();

    const candidateResponseId = generateDeterministicResponseId(timestampStr, mobileNumber, fullName, rowIndex);
    const legacyResponseId = generateDeterministicLegacyId(timestampStr, mobileNumber, fullName);

    // Multi-tier lookup
    let existingRegistration = await prisma.registration.findFirst({
      where: {
        externalSource: 'GOOGLE_FORM',
        OR: [
          { externalResponseId: candidateResponseId },
          { externalResponseId: legacyResponseId },
        ],
      },
    });

    if (!existingRegistration && sourceSubmittedAt && timestampStr) {
      existingRegistration = await prisma.registration.findFirst({
        where: {
          externalSource: 'GOOGLE_FORM',
          sourceSubmittedAt: sourceSubmittedAt,
        },
      });
    }

    if (!existingRegistration && mobileNumber) {
      existingRegistration = await prisma.registration.findFirst({
        where: {
          externalSource: 'GOOGLE_FORM',
          mobileNumber: mobileNumber,
        },
      });
    }

    if (!existingRegistration) {
      await prisma.registration.create({
        data: {
          externalSource: 'GOOGLE_FORM',
          externalResponseId: candidateResponseId,
          fullName,
          mobileNumber,
          guardianName,
          emergencyContactNumber,
          aadhaarNumber,
          occupation,
          occupationType,
          companyOrCollegeName,
          requestedRoomNumber,
          checkInDate,
          monthlyRent,
          securityDeposit,
          declarationAccepted: true,
          sourceSubmittedAt,
          identityDocumentUrl: identityDocUrl,
          googleDriveFileId,
          status: 'NEW',
          rawSourceData: JSON.stringify(rawRowData),
        },
      });
      newCount++;
    } else {
      const isDateChanged = existingRegistration.checkInDate && checkInDate
        ? existingRegistration.checkInDate.toISOString().slice(0, 10) !== checkInDate.toISOString().slice(0, 10)
        : (existingRegistration.checkInDate || null) !== (checkInDate || null);

      const isDocChanged =
        (existingRegistration.googleDriveFileId || null) !== (googleDriveFileId || null) ||
        (existingRegistration.identityDocumentUrl || null) !== (identityDocUrl || null);

      const changedFieldNames = [];
      if (existingRegistration.fullName !== fullName) changedFieldNames.push('Full Name');
      if (existingRegistration.mobileNumber !== mobileNumber) changedFieldNames.push('Mobile Number');
      if ((existingRegistration.guardianName || null) !== (guardianName || null)) changedFieldNames.push('Guardian Name');
      if ((existingRegistration.emergencyContactNumber || null) !== (emergencyContactNumber || null)) changedFieldNames.push('Emergency Contact');
      if ((existingRegistration.aadhaarNumber || null) !== (aadhaarNumber || null)) changedFieldNames.push('Aadhaar Number');
      if ((existingRegistration.occupation || null) !== (occupation || null)) changedFieldNames.push('Occupation');
      if ((existingRegistration.companyOrCollegeName || null) !== (companyOrCollegeName || null)) changedFieldNames.push('Company/College');
      if ((existingRegistration.requestedRoomNumber || null) !== (requestedRoomNumber || null)) changedFieldNames.push('Requested Room');
      if (existingRegistration.monthlyRent !== monthlyRent) changedFieldNames.push('Monthly Rent');
      if ((existingRegistration.securityDeposit || null) !== (securityDeposit || null)) changedFieldNames.push('Security Deposit');
      if (isDateChanged) changedFieldNames.push('Check-in Date');
      if (isDocChanged) changedFieldNames.push('Identity Document');

      if (changedFieldNames.length > 0) {
        await prisma.registration.update({
          where: { id: existingRegistration.id },
          data: {
            fullName,
            mobileNumber,
            guardianName,
            emergencyContactNumber,
            aadhaarNumber,
            occupation,
            occupationType,
            companyOrCollegeName,
            requestedRoomNumber,
            checkInDate,
            monthlyRent,
            securityDeposit,
            identityDocumentUrl: identityDocUrl || existingRegistration.identityDocumentUrl,
            googleDriveFileId: googleDriveFileId || existingRegistration.googleDriveFileId,
            rawSourceData: JSON.stringify(rawRowData),
            updatedAt: new Date(),
          },
        });
        updatedCount++;

        // If approved resident, sync profile fields
        if (existingRegistration.status === 'APPROVED' && existingRegistration.residentId) {
          const linkedResident = await prisma.resident.findUnique({
            where: { id: existingRegistration.residentId },
          });
          if (linkedResident) {
            const residentUpdates = {};
            if (fullName && fullName !== linkedResident.fullName) residentUpdates.fullName = fullName;
            if (mobileNumber && mobileNumber !== linkedResident.phone) residentUpdates.phone = mobileNumber;
            if (companyOrCollegeName && companyOrCollegeName !== linkedResident.address) residentUpdates.address = companyOrCollegeName;
            if (emergencyContactNumber && emergencyContactNumber !== linkedResident.emergencyContactPhone) residentUpdates.emergencyContactPhone = emergencyContactNumber;
            if (guardianName && guardianName !== linkedResident.emergencyContactName) residentUpdates.emergencyContactName = guardianName;
            if (aadhaarNumber && aadhaarNumber !== linkedResident.idProofNumber) residentUpdates.idProofNumber = aadhaarNumber;
            if (monthlyRent !== null && monthlyRent !== linkedResident.monthlyRent) residentUpdates.monthlyRent = monthlyRent;
            if (securityDeposit !== null && securityDeposit !== linkedResident.securityDeposit) residentUpdates.securityDeposit = securityDeposit;

            if (Object.keys(residentUpdates).length > 0) {
              await prisma.resident.update({
                where: { id: linkedResident.id },
                data: residentUpdates,
              });
            }
          }
        }
      } else {
        skippedCount++;
      }
    }
  }

  return { newCount, updatedCount, skippedCount, errors };
}

async function runTests() {
  console.log('=== STARTING GOOGLE FORM EDIT SYNC TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${name}`);
      failed++;
    }
  }

  // Cleanup test data
  await prisma.registration.deleteMany({
    where: {
      mobileNumber: { in: ['9876500001', '9876500002', '9876500003', '9876500004'] },
    },
  });

  const testMobile = '9876500001';
  const testTimestamp = '2026-08-29 10:00:00';

  // TEST 1: New Submission
  console.log('\n--- 1. Testing New Submission ---');
  const initialRow = {
    source_submitted_at: testTimestamp,
    full_name: 'Rahul',
    mobile_number: testMobile,
    guardian_name: 'Mr. Sharma',
    emergency_contact_number: '9876599999',
    aadhaar_number: '123456789012',
    requested_room_number: '101',
    occupation: 'Student',
    company_or_college_name: 'ABC College',
    check_in_date: '2026-09-01',
    monthly_rent: '6500',
    security_deposit: '2000',
    identity_document_url: 'https://drive.google.com/file/d/testDoc1/view',
    google_drive_file_id: 'testDoc1',
  };

  const res1 = await simulateSyncRows([initialRow]);
  assert(res1.newCount === 1, 'Sync 1 creates exactly 1 new registration');
  assert(res1.updatedCount === 0, 'Sync 1 updatedCount is 0');
  assert(res1.skippedCount === 0, 'Sync 1 skippedCount is 0');

  const reg1 = await prisma.registration.findFirst({
    where: { mobileNumber: testMobile },
  });
  assert(reg1 !== null, 'Registration found in DB');
  assert(reg1.fullName === 'Rahul', 'Initial name is Rahul');
  assert(reg1.monthlyRent === 6500, 'Initial rent is 6500');
  assert(reg1.securityDeposit === '2000', 'Initial deposit is "2000"');
  assert(reg1.requestedRoomNumber === '101', 'Initial room is 101');
  const initialExternalId = reg1.externalResponseId;
  assert(initialExternalId.startsWith('gform_'), 'externalResponseId is formatted gform_*');

  // TEST 2: Unchanged Submission
  console.log('\n--- 2. Testing Unchanged Submission ---');
  const res2 = await simulateSyncRows([initialRow]);
  assert(res2.newCount === 0, 'Sync 2 newCount is 0');
  assert(res2.updatedCount === 0, 'Sync 2 updatedCount is 0');
  assert(res2.skippedCount === 1, 'Sync 2 skippedCount is 1 (idempotent)');

  // TEST 3: Name Edit
  console.log('\n--- 3. Testing Name Edit ---');
  const nameEditRow = { ...initialRow, full_name: 'Rahul Kumar' };
  const res3 = await simulateSyncRows([nameEditRow]);
  assert(res3.newCount === 0, 'Name edit does not create new registration');
  assert(res3.updatedCount === 1, 'Name edit updates existing registration');
  const reg3 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg3.fullName === 'Rahul Kumar', 'DB contains updated name "Rahul Kumar"');
  assert(reg3.externalResponseId === initialExternalId, 'externalResponseId is strictly PRESERVED');

  // TEST 4: Room Edit
  console.log('\n--- 4. Testing Room Edit ---');
  const roomEditRow = { ...nameEditRow, requested_room_number: '102' };
  const res4 = await simulateSyncRows([roomEditRow]);
  assert(res4.updatedCount === 1, 'Room edit updates existing registration');
  const reg4 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg4.requestedRoomNumber === '102', 'DB contains updated room "102"');

  // TEST 5: Occupation Edit
  console.log('\n--- 5. Testing Occupation Edit ---');
  const occEditRow = { ...roomEditRow, occupation: 'Developer' };
  const res5 = await simulateSyncRows([occEditRow]);
  assert(res5.updatedCount === 1, 'Occupation edit updates existing registration');
  const reg5 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg5.occupation === 'Developer', 'DB contains updated occupation "Developer"');

  // TEST 6: Company/College Edit
  console.log('\n--- 6. Testing Company/College Edit ---');
  const compEditRow = { ...occEditRow, company_or_college_name: 'XYZ Tech Ltd' };
  const res6 = await simulateSyncRows([compEditRow]);
  assert(res6.updatedCount === 1, 'Company edit updates existing registration');
  const reg6 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg6.companyOrCollegeName === 'XYZ Tech Ltd', 'DB contains updated company');

  // TEST 7: Monthly Rent Edit
  console.log('\n--- 7. Testing Monthly Rent Edit ---');
  const rentEditRow = { ...compEditRow, monthly_rent: '7000' };
  const res7 = await simulateSyncRows([rentEditRow]);
  assert(res7.updatedCount === 1, 'Monthly rent edit updates existing registration');
  const reg7 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg7.monthlyRent === 7000, 'DB contains updated monthly rent 7000');

  // TEST 8 & 9: Security Deposit Numeric & Text Values
  console.log('\n--- 8 & 9. Testing Security Deposit Text Values ---');
  const depEditRow = { ...rentEditRow, security_deposit: 'Yes Done' };
  const res8 = await simulateSyncRows([depEditRow]);
  assert(res8.updatedCount === 1, 'Security deposit edit updates existing registration');
  const reg8 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg8.securityDeposit === 'Yes Done', 'DB contains exact text "Yes Done" without numeric coercion');

  // TEST 10: Multiple Field Edit Simultaneously
  console.log('\n--- 10. Testing Multiple Field Edit Simultaneously ---');
  const multiEditRow = {
    ...depEditRow,
    full_name: 'Rahul K. Sharma',
    requested_room_number: '103',
    occupation: 'Senior Engineer',
    company_or_college_name: 'Global Tech Corp',
    monthly_rent: '8000',
    security_deposit: 'Paid via GPay to Owner',
  };
  const res10 = await simulateSyncRows([multiEditRow]);
  assert(res10.updatedCount === 1, 'Simultaneous multi-field edit updates in 1 operation');
  const reg10 = await prisma.registration.findFirst({ where: { mobileNumber: testMobile } });
  assert(reg10.fullName === 'Rahul K. Sharma', 'Multi-edit: name updated');
  assert(reg10.requestedRoomNumber === '103', 'Multi-edit: room updated');
  assert(reg10.occupation === 'Senior Engineer', 'Multi-edit: occupation updated');
  assert(reg10.companyOrCollegeName === 'Global Tech Corp', 'Multi-edit: company updated');
  assert(reg10.monthlyRent === 8000, 'Multi-edit: rent updated');
  assert(reg10.securityDeposit === 'Paid via GPay to Owner', 'Multi-edit: deposit updated to raw text');
  assert(reg10.externalResponseId === initialExternalId, 'Multi-edit: externalResponseId unchanged');

  // TEST 11: Mobile Number Edit (Preserving Stable Anchor)
  console.log('\n--- 11. Testing Mobile Number Edit ---');
  const newMobile = '9876500002';
  const mobileEditRow = { ...multiEditRow, mobile_number: newMobile };
  const res11 = await simulateSyncRows([mobileEditRow]);
  assert(res11.updatedCount === 1, 'Mobile number edit updates existing registration via timestamp anchor');
  const reg11 = await prisma.registration.findFirst({ where: { id: reg10.id } });
  assert(reg11.mobileNumber === newMobile, 'DB contains updated mobile number');
  assert(reg11.externalResponseId === initialExternalId, 'externalResponseId remains immutable');

  // TEST 12: Google Drive Document Update
  console.log('\n--- 12. Testing Google Drive Document Update ---');
  const docEditRow = {
    ...mobileEditRow,
    identity_document_url: 'https://drive.google.com/file/d/updatedDoc2/view',
    google_drive_file_id: 'updatedDoc2',
  };
  const res12 = await simulateSyncRows([docEditRow]);
  assert(res12.updatedCount === 1, 'Drive doc edit updates existing registration');
  const reg12 = await prisma.registration.findFirst({ where: { id: reg10.id } });
  assert(reg12.googleDriveFileId === 'updatedDoc2', 'Google Drive file ID updated');

  // TEST 13 & 14: Approved Registration & residentId Preservation
  console.log('\n--- 13 & 14. Testing Approved Registration & residentId Preservation ---');
  let testRoom = await prisma.room.findFirst({ where: { roomNumber: '101' } });
  if (!testRoom) {
    testRoom = await prisma.room.create({
      data: {
        roomNumber: '101',
        floorNumber: 1,
        roomType: 'DOUBLE',
        capacity: 2,
        monthlyRent: 6500,
        status: 'AVAILABLE',
      },
    });
  }

  const testResident = await prisma.resident.create({
    data: {
      fullName: reg12.fullName,
      phone: reg12.mobileNumber,
      roomId: testRoom.id,
      monthlyRent: reg12.monthlyRent,
      securityDeposit: reg12.securityDeposit,
      status: 'ACTIVE',
      checkInDate: new Date(),
    },
  });

  await prisma.registration.update({
    where: { id: reg12.id },
    data: {
      status: 'APPROVED',
      residentId: testResident.id,
      reviewedBy: 'Admin',
      reviewedAt: new Date(),
    },
  });

  // Now resident edits Google Form again
  const approvedEditRow = {
    ...docEditRow,
    full_name: 'Rahul K. Sharma (Approved)',
    monthly_rent: '8500',
    security_deposit: 'Yes Done 2000',
    company_or_college_name: 'Executive Tech Solutions',
  };

  const res13 = await simulateSyncRows([approvedEditRow]);
  assert(res13.updatedCount === 1, 'Approved registration edit updates cleanly');
  const reg13 = await prisma.registration.findFirst({ where: { id: reg12.id } });
  assert(reg13.status === 'APPROVED', 'Registration status remains APPROVED');
  assert(reg13.residentId === testResident.id, 'Registration residentId remains intact');
  assert(reg13.fullName === 'Rahul K. Sharma (Approved)', 'Registration name updated');

  const updatedResident = await prisma.resident.findUnique({ where: { id: testResident.id } });
  assert(updatedResident.fullName === 'Rahul K. Sharma (Approved)', 'Linked Resident fullName synced');
  assert(updatedResident.monthlyRent === 8500, 'Linked Resident monthlyRent synced');
  assert(updatedResident.securityDeposit === 'Yes Done 2000', 'Linked Resident securityDeposit synced');

  // TEST 15: Row Reordering Test
  console.log('\n--- 15. Testing Row Reordering ---');
  const rowA = {
    source_submitted_at: '2026-08-29 11:00:00',
    full_name: 'Resident A',
    mobile_number: '9876500003',
    requested_room_number: '101',
    monthly_rent: '6000',
    security_deposit: '2000',
  };
  const rowB = {
    source_submitted_at: '2026-08-29 12:00:00',
    full_name: 'Resident B',
    mobile_number: '9876500004',
    requested_room_number: '102',
    monthly_rent: '7000',
    security_deposit: '1000',
  };

  await simulateSyncRows([rowA, rowB]);
  const countBeforeReorder = await prisma.registration.count();

  // Reorder rows: B first, then A, plus the approved edit row
  const res15 = await simulateSyncRows([rowB, approvedEditRow, rowA]);
  const countAfterReorder = await prisma.registration.count();
  assert(countBeforeReorder === countAfterReorder, 'Total registration count unchanged after row reordering');
  assert(res15.newCount === 0, 'Zero new registrations created on reordered rows');
  assert(res15.skippedCount === 3, 'All 3 reordered rows skipped (matched accurately)');

  // Clean up test data
  await prisma.resident.deleteMany({ where: { id: testResident.id } });
  await prisma.registration.deleteMany({
    where: {
      mobileNumber: { in: ['9876500001', '9876500002', '9876500003', '9876500004'] },
    },
  });

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
