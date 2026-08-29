const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Step 1: Adding paymentEnabled column to Room table ===');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "paymentEnabled" BOOLEAN NOT NULL DEFAULT true;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Room_paymentEnabled_idx" ON "Room"("paymentEnabled");
  `);
  console.log('✔ Column "paymentEnabled" added with default true and index created.');

  console.log('\n=== Step 2: Configuring Room 102 as paymentEnabled = false ===');
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Room" SET "paymentEnabled" = false WHERE "roomNumber" = '102';
  `);
  console.log(`✔ Room 102 updated: ${result} row(s) updated.`);

  console.log('\n=== Step 3: Verifying Room table configurations ===');
  const rooms = await prisma.$queryRawUnsafe(`
    SELECT id, "roomNumber", floor, capacity, status, "paymentEnabled"
    FROM "Room"
    ORDER BY "roomNumber" ASC;
  `);
  console.log(`Total Rooms: ${rooms.length}`);
  const r102 = rooms.find(r => r.roomNumber === '102');
  const r101 = rooms.find(r => r.roomNumber === '101');

  console.log('Room 101:', r101);
  console.log('Room 102:', r102);

  if (r102 && r102.paymentEnabled === false && r101 && r101.paymentEnabled === true) {
    console.log('✔ Migration and verification SUCCESSFUL!');
  } else {
    console.error('❌ Verification failed:', { r101, r102 });
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
