const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updatedRooms = await prisma.room.updateMany({
    data: { securityDeposit: 2000 },
  });
  const updatedResidents = await prisma.resident.updateMany({
    data: { securityDeposit: 2000 },
  });

  console.log(`✅ Updated ${updatedRooms.count} rooms to ₹2,000 security deposit.`);
  console.log(`✅ Updated ${updatedResidents.count} residents to ₹2,000 security deposit.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
