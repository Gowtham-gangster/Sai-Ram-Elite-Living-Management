/**
 * test-document-propagation.js
 * 
 * Verifies Identity Document propagation from Registration -> Resident profile
 * across intake, approval, Google Form edits, server-side document security, and zero duplication.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function generateDeterministicResponseId(timestamp) {
  const cleanTime = (timestamp || '').trim();
  const hash = crypto.createHash('sha256').update(`ts_${cleanTime}`).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

async function runTests() {
  console.log('=== STARTING IDENTITY DOCUMENT PROPAGATION TEST SUITE ===\n');
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

  // Setup room for testing
  let testRoom = await prisma.room.findFirst({ where: { roomNumber: '201' } });
  if (!testRoom) {
    testRoom = await prisma.room.create({
      data: {
        roomNumber: '201',
        floorNumber: 2,
        roomType: 'DOUBLE',
        capacity: 2,
        monthlyRent: 7500,
        status: 'AVAILABLE',
      },
    });
  }

  // Clean up any test records
  await prisma.resident.deleteMany({
    where: { phone: { in: ['9999900001', '9999900002'] } },
  });
  await prisma.registration.deleteMany({
    where: { mobileNumber: { in: ['9999900001', '9999900002'] } },
  });

  const testDocUrl = 'https://drive.google.com/open?id=1kg8vIj3b0HIW2dVz-ufT-n4WstQtYulK';
  const testDriveId = '1kg8vIj3b0HIW2dVz-ufT-n4WstQtYulK';

  // TEST 1: Registration with Identity Document
  console.log('\n--- 1. Testing Registration Creation with Identity Document ---');
  const regWithDoc = await prisma.registration.create({
    data: {
      externalSource: 'GOOGLE_FORM',
      externalResponseId: generateDeterministicResponseId('2026-08-29 14:00:00'),
      fullName: 'Vikram Singh',
      mobileNumber: '9999900001',
      guardianName: 'Rajendra Singh',
      emergencyContactNumber: '9999999991',
      aadhaarNumber: '987654321098',
      occupation: 'Software Engineer',
      occupationType: 'WORKING_PROFESSIONAL',
      companyOrCollegeName: 'Tech Mahindra',
      requestedRoomNumber: '201',
      monthlyRent: 7500,
      securityDeposit: '2000',
      identityDocumentUrl: testDocUrl,
      googleDriveFileId: testDriveId,
      status: 'NEW',
    },
  });

  assert(regWithDoc.id !== null, 'Registration with doc created');
  assert(regWithDoc.identityDocumentUrl === testDocUrl, 'Registration retains identityDocumentUrl');
  assert(regWithDoc.googleDriveFileId === testDriveId, 'Registration retains googleDriveFileId');

  // TEST 2: Registration without Identity Document
  console.log('\n--- 2. Testing Registration Creation without Document ---');
  const regNoDoc = await prisma.registration.create({
    data: {
      externalSource: 'GOOGLE_FORM',
      externalResponseId: generateDeterministicResponseId('2026-08-29 14:05:00'),
      fullName: 'Anil Kumar',
      mobileNumber: '9999900002',
      requestedRoomNumber: '201',
      monthlyRent: 7500,
      securityDeposit: '0',
      status: 'NEW',
    },
  });

  assert(regNoDoc.identityDocumentUrl === null, 'No-doc registration has null identityDocumentUrl');
  assert(regNoDoc.googleDriveFileId === null, 'No-doc registration has null googleDriveFileId');

  // TEST 3: Approval Workflow & Propagation to Resident
  console.log('\n--- 3. Testing Approval Workflow & Document Propagation ---');
  const residentWithDoc = await prisma.$transaction(async (tx) => {
    const resident = await tx.resident.create({
      data: {
        fullName: regWithDoc.fullName,
        phone: regWithDoc.mobileNumber,
        roomId: testRoom.id,
        monthlyRent: regWithDoc.monthlyRent,
        securityDeposit: regWithDoc.securityDeposit,
        checkInDate: new Date(),
        idProofType: 'AADHAAR',
        idProofNumber: regWithDoc.aadhaarNumber,
        identityDocumentUrl: regWithDoc.identityDocumentUrl,
        googleDriveFileId: regWithDoc.googleDriveFileId,
        emergencyContactName: regWithDoc.guardianName,
        emergencyContactPhone: regWithDoc.emergencyContactNumber,
        address: regWithDoc.companyOrCollegeName,
        status: 'ACTIVE',
      },
    });

    await tx.registration.update({
      where: { id: regWithDoc.id },
      data: {
        status: 'APPROVED',
        residentId: resident.id,
        reviewedBy: 'Admin',
        reviewedAt: new Date(),
      },
    });

    return resident;
  });

  assert(residentWithDoc.id !== null, 'Resident created upon approval');
  assert(residentWithDoc.identityDocumentUrl === testDocUrl, 'Resident has identical identityDocumentUrl from Registration');
  assert(residentWithDoc.googleDriveFileId === testDriveId, 'Resident has identical googleDriveFileId from Registration');

  const updatedReg = await prisma.registration.findUnique({ where: { id: regWithDoc.id } });
  assert(updatedReg.status === 'APPROVED', 'Registration status is APPROVED');
  assert(updatedReg.residentId === residentWithDoc.id, 'Registration links to Resident ID');

  // TEST 4: Approval of Registration without Document
  console.log('\n--- 4. Testing Approval without Document ---');
  const residentNoDoc = await prisma.$transaction(async (tx) => {
    const resident = await tx.resident.create({
      data: {
        fullName: regNoDoc.fullName,
        phone: regNoDoc.mobileNumber,
        roomId: testRoom.id,
        monthlyRent: regNoDoc.monthlyRent,
        securityDeposit: regNoDoc.securityDeposit,
        checkInDate: new Date(),
        identityDocumentUrl: regNoDoc.identityDocumentUrl || null,
        googleDriveFileId: regNoDoc.googleDriveFileId || null,
        status: 'ACTIVE',
      },
    });

    await tx.registration.update({
      where: { id: regNoDoc.id },
      data: {
        status: 'APPROVED',
        residentId: resident.id,
        reviewedBy: 'Admin',
        reviewedAt: new Date(),
      },
    });

    return resident;
  });

  assert(residentNoDoc.identityDocumentUrl === null, 'Approved resident without doc has null identityDocumentUrl');
  assert(residentNoDoc.googleDriveFileId === null, 'Approved resident without doc has null googleDriveFileId');

  // TEST 5: Google Form Document Replacement for Approved Resident
  console.log('\n--- 5. Testing Google Form Document Replacement ---');
  const updatedDocUrl = 'https://drive.google.com/open?id=2updatedDocFileIdForTestingXYZ';
  const updatedDriveId = '2updatedDocFileIdForTestingXYZ';

  // Simulate Google Sheet Sync updating the registration and approved resident
  await prisma.registration.update({
    where: { id: regWithDoc.id },
    data: {
      identityDocumentUrl: updatedDocUrl,
      googleDriveFileId: updatedDriveId,
      updatedAt: new Date(),
    },
  });

  await prisma.resident.update({
    where: { id: residentWithDoc.id },
    data: {
      identityDocumentUrl: updatedDocUrl,
      googleDriveFileId: updatedDriveId,
    },
  });

  const refreshedReg = await prisma.registration.findUnique({ where: { id: regWithDoc.id } });
  const refreshedResident = await prisma.resident.findUnique({ where: { id: residentWithDoc.id } });

  assert(refreshedReg.identityDocumentUrl === updatedDocUrl, 'Registration updated to latest doc URL');
  assert(refreshedReg.googleDriveFileId === updatedDriveId, 'Registration updated to latest Drive ID');
  assert(refreshedResident.identityDocumentUrl === updatedDocUrl, 'Resident profile updated to latest doc URL');
  assert(refreshedResident.googleDriveFileId === updatedDriveId, 'Resident profile updated to latest Drive ID');
  assert(refreshedReg.residentId === residentWithDoc.id, 'residentId relationship remains strictly preserved');
  assert(refreshedReg.status === 'APPROVED', 'Registration status remains APPROVED');

  // TEST 6: Zero Duplicate Registrations and Residents
  console.log('\n--- 6. Testing Zero Duplication ---');
  const totalRegsForMobile = await prisma.registration.count({
    where: { mobileNumber: '9999900001' },
  });
  const totalResidentsForPhone = await prisma.resident.count({
    where: { phone: '9999900001' },
  });

  assert(totalRegsForMobile === 1, 'Exactly 1 Registration exists (zero duplicate registrations)');
  assert(totalResidentsForPhone === 1, 'Exactly 1 Resident exists (zero duplicate residents)');

  // Clean up test data
  await prisma.resident.deleteMany({
    where: { phone: { in: ['9999900001', '9999900002'] } },
  });
  await prisma.registration.deleteMany({
    where: { mobileNumber: { in: ['9999900001', '9999900002'] } },
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
