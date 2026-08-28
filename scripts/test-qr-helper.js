const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function testProcessVerifiedPayment(payload) {
  const { referenceId, amountPaid, gatewayPaymentId, gatewayProvider, paymentMethod } = payload;

  const payment = await prisma.monthlyPayment.findFirst({
    where: {
      OR: [
        { transactionReference: referenceId },
        { id: referenceId },
        { paymentRecords: { some: { transactionReference: referenceId } } },
      ],
    },
    include: {
      resident: true,
      room: true,
    },
  });

  if (!payment) {
    return { success: false, isPaid: false, status: 'FAILED' };
  }

  // Idempotency check
  const existingVerifiedRecord = await prisma.paymentRecord.findFirst({
    where: {
      monthlyPaymentId: payment.id,
      transactionReference: gatewayPaymentId || referenceId,
      status: 'VERIFIED',
    },
  });

  if (existingVerifiedRecord) {
    const existingReceipt = await prisma.receipt.findFirst({
      where: { monthlyPaymentId: payment.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      isPaid: payment.status === 'PAID',
      status: payment.status,
      monthlyPaymentId: payment.id,
      residentId: payment.residentId,
      amountExpected: payment.totalAmountDue,
      amountReceived: existingVerifiedRecord.amountPaid,
      referenceId,
      gatewayPaymentId,
      receiptNumber: existingReceipt?.receiptNumber,
      downloadToken: existingReceipt?.downloadToken,
      isDuplicate: true,
    };
  }

  const verifiedRecords = await prisma.paymentRecord.findMany({
    where: { monthlyPaymentId: payment.id, status: 'VERIFIED' },
    select: { amountPaid: true },
  });
  const priorPaid = verifiedRecords.reduce((acc, r) => acc + r.amountPaid, 0);
  const totalPaidAfterThis = priorPaid + amountPaid;
  const totalDue = Number(payment.totalAmountDue || payment.rentAmount || 0);
  const remainingBalance = Math.max(0, totalDue - totalPaidAfterThis);
  const isFullSettlement = remainingBalance <= 0.01;
  const paymentStatus = isFullSettlement ? 'PAID' : 'PARTIALLY_PAID';

  const paidDate = payload.paymentDate || new Date();

  await prisma.$transaction(async (tx) => {
    await tx.monthlyPayment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        paidDate: isFullSettlement ? paidDate : undefined,
        paymentMethod: paymentMethod || 'UPI',
        gatewayProvider: gatewayProvider || 'UPI_GATEWAY',
        gatewayPaymentId: gatewayPaymentId || undefined,
        transactionReference: referenceId,
      },
    });

    await tx.paymentRecord.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        amountPaid,
        paymentMethod: paymentMethod || 'UPI',
        transactionReference: gatewayPaymentId || referenceId,
        status: 'VERIFIED',
        verifiedByAdminName: `SYSTEM_VERIFIED (${gatewayProvider || 'UPI_GATEWAY'})`,
        notes: `Automated verified UPI payment for ${payment.billingMonth} (Ref: ${referenceId})`,
      },
    });

    if (isFullSettlement) {
      await tx.paymentReminder.updateMany({
        where: {
          monthlyPaymentId: payment.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    await tx.receipt.create({
      data: {
        monthlyPaymentId: payment.id,
        residentId: payment.residentId,
        residentName: payment.resident.fullName,
        receiptNumber: `RCP-QR-${Date.now().toString(36).toUpperCase()}`,
        amountPaid,
        billingMonth: payment.billingMonth,
        paymentDate: paidDate,
        paymentMethod: paymentMethod || 'UPI',
        status: 'ISSUED',
        roomNumber: payment.room.roomNumber,
        downloadToken: `tok_${Date.now().toString(36)}`,
      },
    });
  });

  const receipt = await prisma.receipt.findFirst({
    where: { monthlyPaymentId: payment.id },
    orderBy: { createdAt: 'desc' },
  });

  return {
    success: true,
    isPaid: isFullSettlement,
    status: paymentStatus,
    monthlyPaymentId: payment.id,
    residentId: payment.residentId,
    amountExpected: totalDue,
    amountReceived: amountPaid,
    remainingBalance,
    referenceId,
    gatewayPaymentId,
    receiptNumber: receipt?.receiptNumber,
    downloadToken: receipt?.downloadToken,
  };
}

module.exports = {
  testProcessVerifiedPayment,
};
