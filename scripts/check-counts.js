const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = {
    AdminUser: await prisma.adminUser.count(),
    Resident: await prisma.resident.count(),
    Registration: await prisma.registration.count(),
    Room: await prisma.room.count(),
    MonthlyPayment: await prisma.monthlyPayment.count(),
    PaymentRecord: await prisma.paymentRecord.count(),
    Receipt: await prisma.receipt.count(),
    PaymentReminder: await prisma.paymentReminder.count(),
    ReminderTemplate: await prisma.reminderTemplate.count(),
    HostelSettings: await prisma.hostelSettings.count(),
    PaymentSession: await prisma.paymentSession.count(),
    RoomChangeRequest: await prisma.roomChangeRequest.count(),
    Notification: await prisma.notification.count(),
    AuditLog: await prisma.auditLog.count().catch(() => 'N/A'),
    SyncLog: await prisma.syncLog.count().catch(() => 'N/A'),
  };

  console.log('CURRENT TABLE COUNTS:');
  console.log(JSON.stringify(counts, null, 2));
}

main().finally(() => prisma.$disconnect());
