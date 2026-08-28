require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function bootstrapData() {
  console.log('================================================================');
  console.log('      ONE-TIME BOOTSTRAP: SQLITE DATA -> SUPABASE POSTGRESQL    ');
  console.log('================================================================\n');

  const jsonPath = path.join(__dirname, 'backup/sqlite_export.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Backup file not found at ${jsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // 1. Hostel Settings
  console.log('--- 1. Migrating Hostel Settings ---');
  for (const s of data.hostelSettings) {
    await prisma.hostelSettings.upsert({
      where: { id: s.id },
      update: {
        hostelName: s.hostelName,
        hostelAddress: s.hostelAddress,
        contactPhone: s.contactPhone,
        whatsAppNumber: s.whatsAppNumber,
        contactEmail: s.contactEmail,
        websiteUrl: s.websiteUrl,
        bankName: s.bankName,
        accountHolderName: s.accountHolderName,
        accountNumber: s.accountNumber,
        ifscCode: s.ifscCode,
        upiId: s.upiId,
        paymentInstructions: s.paymentInstructions,
        rulesAndRegulations: s.rulesAndRegulations,
      },
      create: {
        id: s.id,
        hostelName: s.hostelName,
        hostelAddress: s.hostelAddress,
        contactPhone: s.contactPhone,
        whatsAppNumber: s.whatsAppNumber,
        contactEmail: s.contactEmail,
        websiteUrl: s.websiteUrl,
        bankName: s.bankName,
        accountHolderName: s.accountHolderName,
        accountNumber: s.accountNumber,
        ifscCode: s.ifscCode,
        upiId: s.upiId,
        paymentInstructions: s.paymentInstructions,
        rulesAndRegulations: s.rulesAndRegulations,
      },
    });
  }
  console.log(`✅ Hostel Settings migrated (${data.hostelSettings.length})`);

  // 2. Admin Users
  console.log('\n--- 2. Migrating Admin Users ---');
  for (const u of data.adminUsers) {
    await prisma.adminUser.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash: u.passwordHash,
        role: u.role,
        isActive: u.isActive,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: u.passwordHash,
        role: u.role,
        isActive: u.isActive,
        createdAt: new Date(u.createdAt),
      },
    });
  }
  console.log(`✅ Admin Users migrated (${data.adminUsers.length})`);

  // 3. Rooms
  console.log('\n--- 3. Migrating Rooms ---');
  for (const r of data.rooms) {
    await prisma.room.upsert({
      where: { id: r.id },
      update: {
        roomNumber: r.roomNumber,
        floor: r.floor,
        capacity: r.capacity,
        sharingType: r.sharingType,
        baseRent: r.baseRent,
        securityDeposit: r.securityDeposit,
        amenities: r.amenities,
        status: r.status,
        notes: r.notes,
      },
      create: {
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        capacity: r.capacity,
        sharingType: r.sharingType,
        baseRent: r.baseRent,
        securityDeposit: r.securityDeposit,
        amenities: r.amenities,
        status: r.status,
        notes: r.notes,
        createdAt: new Date(r.createdAt),
      },
    });
  }
  console.log(`✅ Rooms migrated (${data.rooms.length})`);

  // 4. Residents
  console.log('\n--- 4. Migrating Residents ---');
  for (const res of data.residents) {
    await prisma.resident.upsert({
      where: { id: res.id },
      update: {
        fullName: res.fullName,
        phone: res.phone,
        alternatePhone: res.alternatePhone,
        email: res.email,
        roomId: res.roomId,
        monthlyRent: res.monthlyRent,
        securityDeposit: res.securityDeposit,
        checkInDate: new Date(res.checkInDate),
        expectedCheckoutDate: res.expectedCheckoutDate ? new Date(res.expectedCheckoutDate) : null,
        checkOutDate: res.checkOutDate ? new Date(res.checkOutDate) : null,
        idProofType: res.idProofType,
        idProofNumber: res.idProofNumber,
        emergencyContactName: res.emergencyContactName,
        emergencyContactPhone: res.emergencyContactPhone,
        address: res.address,
        status: res.status,
        notes: res.notes,
      },
      create: {
        id: res.id,
        fullName: res.fullName,
        phone: res.phone,
        alternatePhone: res.alternatePhone,
        email: res.email,
        roomId: res.roomId,
        monthlyRent: res.monthlyRent,
        securityDeposit: res.securityDeposit,
        checkInDate: new Date(res.checkInDate),
        expectedCheckoutDate: res.expectedCheckoutDate ? new Date(res.expectedCheckoutDate) : null,
        checkOutDate: res.checkOutDate ? new Date(res.checkOutDate) : null,
        idProofType: res.idProofType,
        idProofNumber: res.idProofNumber,
        emergencyContactName: res.emergencyContactName,
        emergencyContactPhone: res.emergencyContactPhone,
        address: res.address,
        status: res.status,
        notes: res.notes,
        createdAt: new Date(res.createdAt),
      },
    });
  }
  console.log(`✅ Residents migrated (${data.residents.length})`);

  // 5. Registrations (73 Google Form intake rows)
  console.log('\n--- 5. Migrating Registrations (Google Form Intakes) ---');
  for (const reg of data.registrations) {
    await prisma.registration.upsert({
      where: { id: reg.id },
      update: {
        externalSource: reg.externalSource,
        externalResponseId: reg.externalResponseId,
        fullName: reg.fullName,
        mobileNumber: reg.mobileNumber,
        guardianName: reg.guardianName,
        emergencyContactNumber: reg.emergencyContactNumber,
        aadhaarNumber: reg.aadhaarNumber,
        occupationType: reg.occupationType,
        occupation: reg.occupation,
        companyOrCollegeName: reg.companyOrCollegeName,
        requestedRoomNumber: reg.requestedRoomNumber,
        checkInDate: reg.checkInDate ? new Date(reg.checkInDate) : null,
        securityDeposit: reg.securityDeposit,
        declarationAccepted: reg.declarationAccepted,
        declarationAcceptedAt: reg.declarationAcceptedAt ? new Date(reg.declarationAcceptedAt) : null,
        sourceSubmittedAt: reg.sourceSubmittedAt ? new Date(reg.sourceSubmittedAt) : null,
        identityDocumentUrl: reg.identityDocumentUrl,
        status: reg.status,
        reviewedBy: reg.reviewedBy,
        reviewedAt: reg.reviewedAt ? new Date(reg.reviewedAt) : null,
        rejectionReason: reg.rejectionReason,
        residentId: reg.residentId,
        rawSourceData: reg.rawSourceData,
      },
      create: {
        id: reg.id,
        externalSource: reg.externalSource,
        externalResponseId: reg.externalResponseId,
        fullName: reg.fullName,
        mobileNumber: reg.mobileNumber,
        guardianName: reg.guardianName,
        emergencyContactNumber: reg.emergencyContactNumber,
        aadhaarNumber: reg.aadhaarNumber,
        occupationType: reg.occupationType,
        occupation: reg.occupation,
        companyOrCollegeName: reg.companyOrCollegeName,
        requestedRoomNumber: reg.requestedRoomNumber,
        checkInDate: reg.checkInDate ? new Date(reg.checkInDate) : null,
        securityDeposit: reg.securityDeposit,
        declarationAccepted: reg.declarationAccepted,
        declarationAcceptedAt: reg.declarationAcceptedAt ? new Date(reg.declarationAcceptedAt) : null,
        sourceSubmittedAt: reg.sourceSubmittedAt ? new Date(reg.sourceSubmittedAt) : null,
        identityDocumentUrl: reg.identityDocumentUrl,
        status: reg.status,
        reviewedBy: reg.reviewedBy,
        reviewedAt: reg.reviewedAt ? new Date(reg.reviewedAt) : null,
        rejectionReason: reg.rejectionReason,
        residentId: reg.residentId,
        rawSourceData: reg.rawSourceData,
        createdAt: new Date(reg.createdAt),
      },
    });
  }
  console.log(`✅ Registrations migrated (${data.registrations.length})`);

  // 6. Monthly Payments
  console.log('\n--- 6. Migrating Monthly Payments ---');
  for (const p of data.monthlyPayments) {
    await prisma.monthlyPayment.upsert({
      where: { id: p.id },
      update: {
        residentId: p.residentId,
        roomId: p.roomId,
        billingMonth: p.billingMonth,
        rentAmount: p.rentAmount,
        maintenanceAmount: p.maintenanceAmount || 0,
        penaltyAmount: p.penaltyAmount || 0,
        discountAmount: p.discountAmount || 0,
        totalAmountDue: p.totalAmountDue,
        status: p.status,
        dueDate: new Date(p.dueDate),
        paidDate: p.paidDate ? new Date(p.paidDate) : null,
        paymentMethod: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        firstReminderSentAt: p.firstReminderSentAt ? new Date(p.firstReminderSentAt) : null,
        secondReminderSentAt: p.secondReminderSentAt ? new Date(p.secondReminderSentAt) : null,
        reminderStatus: p.reminderStatus || 'IDLE',
        transactionReference: p.transactionReference,
        paymentProofUrl: p.paymentProofUrl,
        notes: p.notes,
      },
      create: {
        id: p.id,
        residentId: p.residentId,
        roomId: p.roomId,
        billingMonth: p.billingMonth,
        rentAmount: p.rentAmount,
        maintenanceAmount: p.maintenanceAmount || 0,
        penaltyAmount: p.penaltyAmount || 0,
        discountAmount: p.discountAmount || 0,
        totalAmountDue: p.totalAmountDue,
        status: p.status,
        dueDate: new Date(p.dueDate),
        paidDate: p.paidDate ? new Date(p.paidDate) : null,
        paymentMethod: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        firstReminderSentAt: p.firstReminderSentAt ? new Date(p.firstReminderSentAt) : null,
        secondReminderSentAt: p.secondReminderSentAt ? new Date(p.secondReminderSentAt) : null,
        reminderStatus: p.reminderStatus || 'IDLE',
        transactionReference: p.transactionReference,
        paymentProofUrl: p.paymentProofUrl,
        notes: p.notes,
        createdAt: new Date(p.createdAt),
      },
    });
  }
  console.log(`✅ Monthly Payments migrated (${data.monthlyPayments.length})`);

  // 7. Payment Records
  console.log('\n--- 7. Migrating Payment Records ---');
  for (const pr of data.paymentRecords) {
    await prisma.paymentRecord.upsert({
      where: { id: pr.id },
      update: {
        monthlyPaymentId: pr.monthlyPaymentId,
        residentId: pr.residentId,
        amountPaid: pr.amountPaid,
        paymentDate: new Date(pr.paymentDate),
        paymentMethod: pr.paymentMethod,
        transactionReference: pr.transactionReference,
        proofAttachmentUrl: pr.proofAttachmentUrl,
        status: pr.status,
        notes: pr.notes,
      },
      create: {
        id: pr.id,
        monthlyPaymentId: pr.monthlyPaymentId,
        residentId: pr.residentId,
        amountPaid: pr.amountPaid,
        paymentDate: new Date(pr.paymentDate),
        paymentMethod: pr.paymentMethod,
        transactionReference: pr.transactionReference,
        proofAttachmentUrl: pr.proofAttachmentUrl,
        status: pr.status,
        notes: pr.notes,
        createdAt: new Date(pr.createdAt),
      },
    });
  }
  console.log(`✅ Payment Records migrated (${data.paymentRecords.length})`);

  // 8. Receipts
  console.log('\n--- 8. Migrating Receipts ---');
  for (const rc of data.receipts) {
    await prisma.receipt.upsert({
      where: { receiptNumber: rc.receiptNumber },
      update: {
        monthlyPaymentId: rc.monthlyPaymentId,
        residentId: rc.residentId,
        residentName: rc.residentName,
        roomNumber: rc.roomNumber,
        billingMonth: rc.billingMonth,
        amountPaid: rc.amountPaid,
        paymentMethod: rc.paymentMethod,
        paymentDate: new Date(rc.paymentDate),
        generatedBy: rc.generatedBy,
        notes: rc.notes,
      },
      create: {
        id: rc.id,
        receiptNumber: rc.receiptNumber,
        monthlyPaymentId: rc.monthlyPaymentId,
        residentId: rc.residentId,
        residentName: rc.residentName,
        roomNumber: rc.roomNumber,
        billingMonth: rc.billingMonth,
        amountPaid: rc.amountPaid,
        paymentMethod: rc.paymentMethod,
        paymentDate: new Date(rc.paymentDate),
        generatedBy: rc.generatedBy,
        notes: rc.notes,
        createdAt: new Date(rc.createdAt),
      },
    });
  }
  console.log(`✅ Receipts migrated (${data.receipts.length})`);

  // 9. Payment Reminders
  console.log('\n--- 9. Migrating Payment Reminders ---');
  for (const rem of data.paymentReminders) {
    await prisma.paymentReminder.upsert({
      where: { id: rem.id },
      update: {
        residentId: rem.residentId,
        monthlyPaymentId: rem.monthlyPaymentId,
        reminderType: rem.reminderType,
        channel: rem.channel,
        scheduledFor: new Date(rem.scheduledFor),
        sentAt: rem.sentAt ? new Date(rem.sentAt) : null,
        status: rem.status,
        providerMessageId: rem.providerMessageId,
        failureReason: rem.failureReason,
        attemptCount: rem.attemptCount,
        messageText: rem.messageText,
      },
      create: {
        id: rem.id,
        residentId: rem.residentId,
        monthlyPaymentId: rem.monthlyPaymentId,
        reminderType: rem.reminderType,
        channel: rem.channel,
        scheduledFor: new Date(rem.scheduledFor),
        sentAt: rem.sentAt ? new Date(rem.sentAt) : null,
        status: rem.status,
        providerMessageId: rem.providerMessageId,
        failureReason: rem.failureReason,
        attemptCount: rem.attemptCount,
        messageText: rem.messageText,
        createdAt: new Date(rem.createdAt),
      },
    });
  }
  console.log(`✅ Payment Reminders migrated (${data.paymentReminders.length})`);

  // 10. Audit Logs
  console.log('\n--- 10. Migrating Audit Logs ---');
  for (const al of data.auditLogs) {
    await prisma.auditLog.create({
      data: {
        id: al.id,
        adminUserId: al.adminUserId,
        adminName: al.adminName,
        action: al.action,
        entityType: al.entityType,
        entityId: al.entityId,
        details: al.details,
        ipAddress: al.ipAddress,
        createdAt: new Date(al.createdAt),
      },
    });
  }
  console.log(`✅ Audit Logs migrated (${data.auditLogs.length})`);

  console.log('\n================================================================');
  console.log('   🎉 ALL DATA SUCCESSFULLY BOOTSTRAPPED TO SUPABASE (100%)    ');
  console.log('================================================================\n');

  // Verify counts in Supabase
  console.log('--- Final Live Supabase PostgreSQL Row Counts ---');
  console.log('AdminUsers in Supabase:', await prisma.adminUser.count());
  console.log('Rooms in Supabase:', await prisma.room.count());
  console.log('Residents in Supabase:', await prisma.resident.count());
  console.log('Registrations in Supabase:', await prisma.registration.count());
  console.log('MonthlyPayments in Supabase:', await prisma.monthlyPayment.count());
  console.log('Receipts in Supabase:', await prisma.receipt.count());
  console.log('AuditLogs in Supabase:', await prisma.auditLog.count());

  await prisma.$disconnect();
}

bootstrapData().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
