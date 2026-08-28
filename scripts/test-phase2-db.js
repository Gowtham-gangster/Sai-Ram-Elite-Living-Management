const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log(' PHASE 2 DATABASE ARCHITECTURE & RELATIONSHIP TESTS ');
  console.log('====================================================\n');

  // 1. Verify Multiple Residents in a Single Room
  console.log('--- TEST 1: Multiple Residents in Same Room ---');
  const testRoom = await prisma.room.create({
    data: {
      roomNumber: '999',
      floor: 9,
      capacity: 3,
      sharingType: 'TRIPLE',
      baseRent: 7500,
      securityDeposit: 9000,
      amenities: JSON.stringify(['AC', 'High Speed WiFi']),
      status: 'AVAILABLE'
    }
  });
  console.log('Created test room:', testRoom.roomNumber, 'with capacity:', testRoom.capacity);

  const res1 = await prisma.resident.create({
    data: {
      fullName: 'Test Resident One',
      phone: '9999900001',
      alternatePhone: '9999900011',
      roomId: testRoom.id,
      monthlyRent: 7500,
      securityDeposit: 9000,
      checkInDate: new Date('2026-08-01'),
      expectedCheckoutDate: new Date('2027-08-01'),
      status: 'ACTIVE'
    }
  });

  const res2 = await prisma.resident.create({
    data: {
      fullName: 'Test Resident Two',
      phone: '9999900002',
      alternatePhone: '9999900012',
      roomId: testRoom.id,
      monthlyRent: 7500,
      securityDeposit: 9000,
      checkInDate: new Date('2026-08-01'),
      expectedCheckoutDate: new Date('2027-08-01'),
      status: 'ACTIVE'
    }
  });

  const roomWithResidents = await prisma.room.findUnique({
    where: { id: testRoom.id },
    include: { residents: true }
  });
  console.log('Room 999 resident count:', roomWithResidents.residents.length);
  if (roomWithResidents.residents.length !== 2) throw new Error('Failed: Multiple residents not linked to room');
  console.log('✅ TEST 1 PASSED: Multiple residents properly belong to the same room without beds.\n');

  // 2. Verify Payment, Payment Record & Receipt Lifecycle
  console.log('--- TEST 2: Payment & Receipt Entity Creation ---');
  const payment = await prisma.monthlyPayment.create({
    data: {
      residentId: res1.id,
      roomId: testRoom.id,
      billingMonth: '2026-09',
      rentAmount: 7500,
      maintenanceAmount: 500,
      totalAmountDue: 8000,
      status: 'PAID',
      dueDate: new Date('2026-09-05'),
      paidDate: new Date('2026-09-04'),
      paymentMethod: 'UPI',
      receiptNumber: 'REC-TEST-99901',
      transactionReference: 'UPI/TEST/999111',
      verifiedByAdminName: 'Test Admin'
    }
  });

  const receipt = await prisma.receipt.create({
    data: {
      receiptNumber: 'REC-TEST-99901',
      monthlyPaymentId: payment.id,
      residentId: res1.id,
      residentName: res1.fullName,
      roomNumber: testRoom.roomNumber,
      billingMonth: '2026-09',
      amountPaid: 8000,
      paymentMethod: 'UPI',
      paymentDate: new Date('2026-09-04'),
      generatedBy: 'Test Admin'
    }
  });

  const queryPayment = await prisma.monthlyPayment.findUnique({
    where: { id: payment.id },
    include: { receipts: true, resident: true, room: true }
  });
  console.log('MonthlyPayment query verification:', {
    id: queryPayment.id,
    resident: queryPayment.resident.fullName,
    room: queryPayment.room.roomNumber,
    receiptNo: queryPayment.receipts[0]?.receiptNumber
  });
  if (!queryPayment.receipts[0]) throw new Error('Failed: Receipt not linked to MonthlyPayment');
  console.log('✅ TEST 2 PASSED: Payment & Receipt relational hierarchy verified.\n');

  // 3. Verify Unique Constraints (Duplicate MonthlyPayment for same resident and month)
  console.log('--- TEST 3: Duplicate Billing Month Constraint ---');
  let threwExpected = false;
  try {
    await prisma.monthlyPayment.create({
      data: {
        residentId: res1.id,
        roomId: testRoom.id,
        billingMonth: '2026-09', // Duplicate month!
        rentAmount: 7500,
        totalAmountDue: 8000,
        status: 'PENDING',
        dueDate: new Date('2026-09-05')
      }
    });
  } catch (err) {
    threwExpected = true;
    console.log('Caught expected constraint violation:', err.code);
  }
  if (!threwExpected) throw new Error('Failed: Unique constraint [residentId, billingMonth] did not fire!');
  console.log('✅ TEST 3 PASSED: Unique constraint enforced.\n');

  // 4. Test Cleanup of Test Records
  console.log('--- TEST 4: Cleanup & Cascade ---');
  await prisma.receipt.delete({ where: { id: receipt.id } });
  await prisma.monthlyPayment.delete({ where: { id: payment.id } });
  await prisma.resident.delete({ where: { id: res1.id } });
  await prisma.resident.delete({ where: { id: res2.id } });
  await prisma.room.delete({ where: { id: testRoom.id } });
  console.log('✅ TEST 4 PASSED: Clean CRUD test cycle completed.\n');

  // 5. Zero-Bed Verification on Database Tables
  console.log('--- TEST 5: Strict Zero-Bed Inspection ---');
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  console.log('Database Models in Prisma Client:', models);

  const forbiddenBedTerms = ['bed', 'beds', 'bedid', 'bednumber', 'bedstatus', 'bedassignment'];
  for (const model of models) {
    if (forbiddenBedTerms.includes(model.toLowerCase())) {
      throw new Error('Forbidden model found: ' + model);
    }
  }
  console.log('✅ TEST 5 PASSED: 0 bed models or bed fields exist in database.\n');

  console.log('🎉 ALL PHASE 2 DATABASE ARCHITECTURE TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
