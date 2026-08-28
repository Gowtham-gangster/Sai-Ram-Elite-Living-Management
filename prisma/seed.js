const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for SAIRAM ELITE LIVING...');

  // 1. Create Default Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@sairam.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@sairam.com',
      passwordHash: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // 2. Create Default Hostel Settings
  const settings = await prisma.hostelSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      hostelName: 'SAIRAM ELITE LIVING',
      hostelAddress: 'Plot #42, ITPL Main Road, Near Prestige Tech Park, Whitefield, Bengaluru - 560066',
      contactPhone: '+91 98450 12345',
      contactEmail: 'contact@sairameliteliving.com',
      bankName: 'HDFC Bank',
      accountHolderName: 'SAIRAM ELITE LIVING HOSPITALITY LLP',
      accountNumber: '50200098765432',
      ifscCode: 'HDFC0001892',
      upiId: 'sairamelite@hdfcbank',
      paymentInstructions: 'Please transfer rent by the 5th of every month. Enter Resident Name & Room Number in remarks. Upload payment screenshot in management portal or share UTR with admin.',
      defaultDueDayOfMonth: 5,
      lateFeePerDay: 50.0,
      gracePeriodDays: 3,
      rulesAndRegulations: '1. Biometric/Gate curfew at 10:30 PM.\n2. Non-resident visitors permitted in lounge only until 8:00 PM.\n3. AC and geyser to be switched off when leaving room.\n4. Cleanliness and quiet hours strictly observed (11 PM - 6 AM).\n5. 30-day notice required before vacating.',
    },
  });
  console.log('✅ Hostel Settings initialized');

  // 3. Create Sample Rooms (STRICTLY ROOM NUMBERS & CAPACITIES - ZERO BEDS)
  const roomData = [
    {
      roomNumber: '101',
      floor: 1,
      capacity: 2,
      sharingType: 'DOUBLE',
      baseRent: 8500,
      securityDeposit: 10000,
      amenities: JSON.stringify(['AC', 'Attached Washroom', 'High Speed WiFi', 'Wardrobe', 'Study Desk', 'Daily Housekeeping']),
      status: 'AVAILABLE',
      notes: 'First floor north-facing room with good natural ventilation.',
    },
    {
      roomNumber: '102',
      floor: 1,
      capacity: 3,
      sharingType: 'TRIPLE',
      baseRent: 7000,
      securityDeposit: 8000,
      amenities: JSON.stringify(['AC', 'Attached Washroom', 'High Speed WiFi', 'Wardrobe', 'Balcony']),
      status: 'AVAILABLE',
      notes: 'Spacious triple sharing room with attached balcony.',
    },
    {
      roomNumber: '103',
      floor: 1,
      capacity: 1,
      sharingType: 'SINGLE',
      baseRent: 14000,
      securityDeposit: 15000,
      amenities: JSON.stringify(['AC', 'Attached Washroom', 'High Speed WiFi', 'Smart TV', 'Mini Fridge', 'Study Desk']),
      status: 'AVAILABLE',
      notes: 'Premium executive single suite.',
    },
    {
      roomNumber: '201',
      floor: 2,
      capacity: 4,
      sharingType: 'FOUR_SHARE',
      baseRent: 6000,
      securityDeposit: 7000,
      amenities: JSON.stringify(['Non-AC', 'Attached Washroom', 'High Speed WiFi', 'Lockers', 'Daily Housekeeping']),
      status: 'AVAILABLE',
      notes: 'Budget 4-sharing room on second floor.',
    },
    {
      roomNumber: '202',
      floor: 2,
      capacity: 2,
      sharingType: 'DOUBLE',
      baseRent: 8500,
      securityDeposit: 10000,
      amenities: JSON.stringify(['AC', 'Attached Washroom', 'High Speed WiFi', 'Balcony', 'Wardrobe']),
      status: 'AVAILABLE',
      notes: 'Second floor room with lake view.',
    },
  ];

  const createdRooms = [];
  for (const r of roomData) {
    const room = await prisma.room.upsert({
      where: { roomNumber: r.roomNumber },
      update: {},
      create: r,
    });
    createdRooms.push(room);
  }
  console.log(`✅ Seeded ${createdRooms.length} rooms`);

  // 4. Create Initial Residents assigned to Rooms (Multiple residents in Room 101)
  const room101 = createdRooms.find(r => r.roomNumber === '101');
  const room102 = createdRooms.find(r => r.roomNumber === '102');
  const room103 = createdRooms.find(r => r.roomNumber === '103');

  const residentsData = [
    {
      fullName: 'Rahul Sharma',
      phone: '9876500001',
      alternatePhone: '9876500091',
      email: 'rahul.sharma@example.com',
      emergencyContactName: 'Mahesh Sharma (Father)',
      emergencyContactPhone: '9876599991',
      roomId: room101.id,
      monthlyRent: 8500,
      securityDeposit: 10000,
      idProofType: 'AADHAAR',
      idProofNumber: 'XXXX-XXXX-1234',
      address: 'House #14, Civil Lines, Jaipur, Rajasthan',
      status: 'ACTIVE',
      checkInDate: new Date('2026-01-10'),
      expectedCheckoutDate: new Date('2027-01-10'),
    },
    {
      fullName: 'Vikramaditya Roy',
      phone: '9876500002',
      alternatePhone: '9876500092',
      email: 'vikram.roy@example.com',
      emergencyContactName: 'Ananya Roy (Sister)',
      emergencyContactPhone: '9876599992',
      roomId: room101.id,
      monthlyRent: 8500,
      securityDeposit: 10000,
      idProofType: 'PAN',
      idProofNumber: 'ABCDE1234F',
      address: 'Flat 4B, Greenfield Apts, Kolkata, WB',
      status: 'ACTIVE',
      checkInDate: new Date('2026-02-01'),
      expectedCheckoutDate: new Date('2027-02-01'),
    },
    {
      fullName: 'Karthik Raman',
      phone: '9876500003',
      alternatePhone: null,
      email: 'karthik.r@example.com',
      emergencyContactName: 'S. Ramanathan (Father)',
      emergencyContactPhone: '9876599993',
      roomId: room102.id,
      monthlyRent: 7000,
      securityDeposit: 8000,
      idProofType: 'AADHAAR',
      idProofNumber: 'XXXX-XXXX-5678',
      address: '22 Anna Salai, Chennai, TN',
      status: 'ACTIVE',
      checkInDate: new Date('2026-03-15'),
      expectedCheckoutDate: new Date('2027-03-15'),
    },
    {
      fullName: 'Aditya Patel',
      phone: '9876500004',
      alternatePhone: '9876500094',
      email: 'aditya.p@example.com',
      emergencyContactName: 'Kishore Patel (Uncle)',
      emergencyContactPhone: '9876599994',
      roomId: room103.id,
      monthlyRent: 14000,
      securityDeposit: 15000,
      idProofType: 'DRIVING_LICENSE',
      idProofNumber: 'KA0420210009988',
      address: '5th Cross, Indiranagar, Bengaluru',
      status: 'ACTIVE',
      checkInDate: new Date('2026-04-01'),
      expectedCheckoutDate: new Date('2027-04-01'),
    },
  ];

  const createdResidents = [];
  for (const res of residentsData) {
    const existing = await prisma.resident.findUnique({ where: { phone: res.phone } });
    if (!existing) {
      const created = await prisma.resident.create({ data: res });
      createdResidents.push(created);
    } else {
      const updated = await prisma.resident.update({
        where: { phone: res.phone },
        data: res,
      });
      createdResidents.push(updated);
    }
  }
  console.log(`✅ Seeded ${createdResidents.length} residents`);

  // Update room occupancy status
  await prisma.room.update({ where: { roomNumber: '101' }, data: { status: 'FULL' } });
  await prisma.room.update({ where: { roomNumber: '103' }, data: { status: 'FULL' } });

  // 5. Create Monthly Payments for August 2026
  const currentMonth = '2026-08';
  const dueDate = new Date('2026-08-05');

  for (const resident of createdResidents) {
    let paymentStatus = 'PAID';
    let paymentMethod = 'UPI';
    let paidDate = new Date('2026-08-03');
    let receiptNo = `REC-${currentMonth.replace('-', '')}-${resident.phone.slice(-4)}`;

    if (resident.fullName === 'Karthik Raman') {
      paymentStatus = 'PENDING';
      paymentMethod = null;
      paidDate = null;
      receiptNo = null;
    } else if (resident.fullName === 'Aditya Patel') {
      paymentStatus = 'SUBMITTED';
      paymentMethod = 'BANK_TRANSFER';
      paidDate = null;
      receiptNo = null;
    }

    const room = createdRooms.find(r => r.id === resident.roomId);
    const rentAmount = resident.monthlyRent || (room ? room.baseRent : 8000);

    const existingPayment = await prisma.monthlyPayment.findFirst({
      where: {
        residentId: resident.id,
        billingMonth: currentMonth,
      },
    });

    let payment;
    if (!existingPayment) {
      payment = await prisma.monthlyPayment.create({
        data: {
          residentId: resident.id,
          roomId: resident.roomId,
          billingMonth: currentMonth,
          rentAmount: rentAmount,
          maintenanceAmount: 500,
          penaltyAmount: 0,
          discountAmount: 0,
          totalAmountDue: rentAmount + 500,
          status: paymentStatus,
          dueDate: dueDate,
          paidDate: paidDate,
          paymentMethod: paymentMethod,
          receiptNumber: receiptNo,
          transactionReference: paymentStatus === 'PAID' ? 'UPI/20260803/9812739182' : paymentStatus === 'SUBMITTED' ? 'NEFT/HDFC/9928172615' : null,
          verifiedByAdminName: paymentStatus === 'PAID' ? 'System Administrator' : null,
          verifiedAt: paymentStatus === 'PAID' ? new Date('2026-08-03') : null,
        },
      });

      if (paymentStatus === 'PAID') {
        // Record payment & receipt
        await prisma.paymentRecord.create({
          data: {
            monthlyPaymentId: payment.id,
            residentId: resident.id,
            amountPaid: rentAmount + 500,
            paymentDate: paidDate,
            paymentMethod: paymentMethod,
            transactionReference: 'UPI/20260803/9812739182',
            status: 'VERIFIED',
            verifiedByAdminName: 'System Administrator',
            notes: 'Verified via bank statement lookup.',
          },
        });

        await prisma.receipt.create({
          data: {
            receiptNumber: receiptNo,
            monthlyPaymentId: payment.id,
            residentId: resident.id,
            residentName: resident.fullName,
            roomNumber: room.roomNumber,
            billingMonth: currentMonth,
            amountPaid: rentAmount + 500,
            paymentMethod: paymentMethod,
            paymentDate: paidDate,
            generatedBy: 'System Administrator',
          },
        });
      } else if (paymentStatus === 'SUBMITTED') {
        await prisma.paymentRecord.create({
          data: {
            monthlyPaymentId: payment.id,
            residentId: resident.id,
            amountPaid: rentAmount + 500,
            paymentDate: new Date('2026-08-04'),
            paymentMethod: 'BANK_TRANSFER',
            transactionReference: 'NEFT/HDFC/9928172615',
            status: 'PENDING_REVIEW',
            notes: 'Resident uploaded bank transfer reference. Pending admin verification.',
          },
        });
      }
    }
  }
  console.log('✅ Monthly payments & receipts seeded');

  // 6. Seed Initial Notifications
  const notifsCount = await prisma.notification.count();
  if (notifsCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          title: 'New Payment Submitted',
          message: 'Aditya Patel (Room 103) submitted payment of ₹14,500 via Bank Transfer (Ref: NEFT/HDFC/9928172615).',
          type: 'INFO',
          isRead: false,
          linkUrl: '/payments',
        },
        {
          title: 'Rent Due Reminder',
          message: 'Karthik Raman (Room 102) has an unpaid rent balance for August 2026.',
          type: 'WARNING',
          isRead: false,
          linkUrl: '/payments',
        },
        {
          title: 'System Initialized',
          message: 'SAIRAM ELITE LIVING Management System successfully booted with luxury hostel configurations.',
          type: 'SUCCESS',
          isRead: true,
        },
      ],
    });
    console.log('✅ Notifications seeded');
  }

  // 7. Seed Initial Audit Log
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    await prisma.auditLog.create({
      data: {
        adminUserId: admin.id,
        adminName: admin.name,
        action: 'SYSTEM_BOOTSTRAP',
        entityType: 'AUTH',
        entityId: admin.id,
        details: JSON.stringify({ message: 'Initial administrative database seed completed.' }),
      },
    });
    console.log('✅ Audit log created');
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
