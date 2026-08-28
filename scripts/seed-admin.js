const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@sairam.com').toLowerCase().trim();
  const name = args[1] || 'System Administrator';
  const password = args[2] || 'admin123';
  const role = args[3] || 'SUPER_ADMIN';

  console.log(`\n--- Provisioning Administrator Account: ${email} ---`);

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role,
      isActive: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role,
      isActive: true,
    },
  });

  // Ensure default hostel settings exist
  await prisma.hostelSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      hostelName: 'SAIRAM ELITE LIVING',
      hostelAddress: 'Plot #42, ITPL Main Road, Whitefield, Bengaluru - 560066',
      contactPhone: '+91 98450 12345',
      contactEmail: 'contact@sairameliteliving.com',
      bankName: 'ICICI Bank',
      accountHolderName: 'SAIRAM ELITE LIVING',
      accountNumber: '002305012345',
      ifscCode: 'ICIC0000023',
      upiId: 'sairamhostel@icici',
      paymentInstructions: 'Please share transaction screenshot with resident full name and room number after UPI transfer.',
      defaultDueDayOfMonth: 5,
      gracePeriodDays: 3,
      lateFeePerDay: 50,
    },
  });

  // Ensure standard reminder templates exist
  const defaultTemplates = [
    {
      reminderType: 'UPCOMING_DUE',
      title: 'Upcoming Rent Due Reminder',
      templateBody: 'Dear {{resident_name}}, this is a friendly reminder that your monthly rent of ₹{{amount_due}} for Room {{room_number}} is due on {{due_date}}. Please pay via UPI to {{upi_id}}.',
      channel: 'WHATSAPP',
      daysOffset: -3,
    },
    {
      reminderType: 'DUE_TODAY',
      title: 'Rent Due Today Notice',
      templateBody: 'Hello {{resident_name}}, your hostel rent of ₹{{amount_due}} for Room {{room_number}} is due today ({{due_date}}). Kindly clear your dues. Thank you, {{hostel_name}}.',
      channel: 'WHATSAPP',
      daysOffset: 0,
    },
    {
      reminderType: 'OVERDUE_NOTICE',
      title: 'Overdue Rent Notice',
      templateBody: 'URGENT: Dear {{resident_name}}, your monthly rent of ₹{{amount_due}} for Room {{room_number}} is overdue. Please settle immediately to avoid late fees. UPI ID: {{upi_id}}.',
      channel: 'WHATSAPP',
      daysOffset: 2,
    },
    {
      reminderType: 'CUSTOM',
      title: 'Custom Announcement Template',
      templateBody: 'Notice for {{resident_name}} (Room {{room_number}}): {{custom_message}}. - Management, {{hostel_name}}.',
      channel: 'WHATSAPP',
      daysOffset: 0,
    },
  ];

  for (const tpl of defaultTemplates) {
    await prisma.reminderTemplate.upsert({
      where: { reminderType: tpl.reminderType },
      update: {},
      create: tpl,
    });
  }

  console.log(`✅ Administrator successfully provisioned:`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Role:  ${admin.role}`);
  console.log(`\n🚀 System ready for production operation.\n`);
}

main()
  .catch((e) => {
    console.error('Error provisioning administrator:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
