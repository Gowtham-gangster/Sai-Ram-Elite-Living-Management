const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  console.log('=== SQLite Data Audit ===');
  console.log('AdminUsers:', await prisma.adminUser.count());
  console.log('Rooms:', await prisma.room.count());
  console.log('Residents:', await prisma.resident.count());
  console.log('Registrations:', await prisma.registration.count());
  console.log('RoomChangeRequests:', await prisma.roomChangeRequest.count());
  console.log('MonthlyPayments:', await prisma.monthlyPayment.count());
  console.log('PaymentRecords:', await prisma.paymentRecord.count());
  console.log('Receipts:', await prisma.receipt.count());
  console.log('PaymentReminders:', await prisma.paymentReminder.count());
  console.log('HostelSettings:', await prisma.hostelSettings.count());
  console.log('SyncLogs:', await prisma.syncLog.count());
  console.log('AuditLogs:', await prisma.auditLog.count());
  await prisma.$disconnect();
}

audit();
