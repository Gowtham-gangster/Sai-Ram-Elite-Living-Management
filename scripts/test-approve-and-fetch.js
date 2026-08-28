require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testApprove() {
  console.log('Testing Registration creation and approve flow...');
  const reg = await prisma.registration.create({
    data: {
      externalSource: 'GOOGLE_FORM',
      externalResponseId: `test_approve_${Date.now()}`,
      fullName: 'Approve Test Resident',
      mobileNumber: '9888812345',
      requestedRoomNumber: '101',
      monthlyRent: 8000.0,
      securityDeposit: 2000.0,
      status: 'NEW',
    },
  });

  console.log('Created test registration:', reg.id);

  const fetchRes = await prisma.registration.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Fetched ${fetchRes.length} registrations successfully.`);

  await prisma.registration.delete({ where: { id: reg.id } });
  console.log('Cleaned up test registration.');
  await prisma.$disconnect();
}

testApprove();
