import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { RecordPaymentSchema } from '@/lib/validations';
import { recordPaymentTransaction } from '@/lib/payment-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const residentId = searchParams.get('residentId');
    const roomId = searchParams.get('roomId');
    const paymentMethod = searchParams.get('paymentMethod');
    const search = searchParams.get('search');

    const where: any = {};
    if (month && month !== 'ALL') where.billingMonth = month;
    if (status && status !== 'ALL') where.status = status;
    if (residentId && residentId !== 'ALL') where.residentId = residentId;
    if (roomId && roomId !== 'ALL') where.roomId = roomId;
    if (paymentMethod && paymentMethod !== 'ALL') where.paymentMethod = paymentMethod;

    if (search) {
      where.OR = [
        { resident: { fullName: { contains: search } } },
        { resident: { phone: { contains: search } } },
        { room: { roomNumber: { contains: search } } },
        { receiptNumber: { contains: search } },
        { transactionReference: { contains: search } },
      ];
    }

    const payments = await db.monthlyPayment.findMany({
      where,
      orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
      include: {
        resident: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            alternatePhone: true,
            email: true,
            status: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
          },
        },
        paymentRecords: {
          orderBy: { paymentDate: 'desc' },
        },
        receipts: {
          orderBy: { createdAt: 'desc' },
        },
        reminders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();

    // Summary calculations
    const totalDues = payments.reduce((acc, p) => acc + p.totalAmountDue, 0);
    const collectedAmount = payments
      .filter((p) => p.status === 'PAID')
      .reduce((acc, p) => acc + p.totalAmountDue, 0);
    const pendingAmount = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'SUBMITTED')
      .reduce((acc, p) => acc + p.totalAmountDue, 0);
    const overdueAmount = payments
      .filter((p) => p.status === 'OVERDUE' || (p.status !== 'PAID' && new Date(p.dueDate) < now))
      .reduce((acc, p) => acc + p.totalAmountDue, 0);

    const paidResidents = new Set(payments.filter((p) => p.status === 'PAID').map((p) => p.residentId));
    const pendingResidents = new Set(payments.filter((p) => p.status !== 'PAID').map((p) => p.residentId));

    // Room-wise collection breakdown
    const roomMap = new Map<string, { roomNumber: string; expected: number; collected: number; pending: number; residentCount: number }>();

    for (const p of payments) {
      const rNum = p.room?.roomNumber || 'Unassigned';
      const existing = roomMap.get(rNum) || {
        roomNumber: rNum,
        expected: 0,
        collected: 0,
        pending: 0,
        residentCount: 0,
      };

      existing.expected += p.totalAmountDue;
      existing.residentCount += 1;

      if (p.status === 'PAID') {
        existing.collected += p.totalAmountDue;
      } else {
        existing.pending += p.totalAmountDue;
      }

      roomMap.set(rNum, existing);
    }

    const roomBreakdown = Array.from(roomMap.values()).sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
    );

    return NextResponse.json({
      payments,
      summary: {
        totalDues,
        collectedAmount,
        pendingAmount,
        overdueAmount,
        totalCount: payments.length,
        paidResidentsCount: paidResidents.size,
        pendingResidentsCount: pendingResidents.size,
        paidCount: payments.filter((p) => p.status === 'PAID').length,
        pendingCount: payments.filter((p) => p.status === 'PENDING').length,
        submittedCount: payments.filter((p) => p.status === 'SUBMITTED').length,
        overdueCount: payments.filter((p) => p.status === 'OVERDUE' || (p.status !== 'PAID' && new Date(p.dueDate) < now)).length,
        rejectedCount: payments.filter((p) => p.status === 'REJECTED').length,
      },
      roomBreakdown,
    });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RecordPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payment record data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const monthlyPayment = await db.monthlyPayment.findUnique({
      where: { id: data.monthlyPaymentId },
    });

    if (!monthlyPayment) {
      return NextResponse.json({ error: 'Monthly payment record not found' }, { status: 404 });
    }

    const result = await recordPaymentTransaction(
      {
        monthlyPaymentId: data.monthlyPaymentId,
        residentId: monthlyPayment.residentId,
        amountPaid: data.amountPaid,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference || undefined,
        proofAttachmentUrl: data.proofAttachmentUrl || undefined,
        notes: data.notes || undefined,
      },
      { id: session.userId, name: session.name }
    );

    // Cancel scheduled reminders for this payment
    await db.paymentReminder.updateMany({
      where: {
        monthlyPaymentId: monthlyPayment.id,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // Automatically generate and upload receipt
    try {
      const { generateAndUploadReceiptForPayment } = await import('@/lib/receipts/receiptEngine');
      await generateAndUploadReceiptForPayment(monthlyPayment.id);
    } catch (receiptErr) {
      console.error('Receipt generation error on manual record:', receiptErr);
    }

    // Record AuditLog
    await db.auditLog.create({
      data: {
        adminUserId: session.userId,
        adminName: session.name,
        action: 'RECORD_PAYMENT',
        entityType: 'MonthlyPayment',
        entityId: monthlyPayment.id,
        details: JSON.stringify({
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod,
          recordedBy: session.name,
          manual: true,
        }),
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: error.message || 'Failed to record payment' }, { status: 500 });
  }
}
