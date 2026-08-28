require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllRegistrations() {
  console.log('================================================================');
  console.log('CLEANING REGISTRATIONS TABLE FROM SUPABASE DATABASE');
  console.log('================================================================\n');

  try {
    const currentCount = await prisma.registration.count();
    console.log(`Current registration records in database: ${currentCount}`);

    if (currentCount === 0) {
      console.log('No registrations found to delete.');
      return;
    }

    const deleteResult = await prisma.registration.deleteMany({});
    console.log(`\n✅ Successfully deleted ${deleteResult.count} registration records from Supabase PostgreSQL database.`);

    const remainingCount = await prisma.registration.count();
    console.log(`Remaining registration records in database: ${remainingCount}`);
  } catch (err) {
    console.error('Error deleting registrations:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllRegistrations();
