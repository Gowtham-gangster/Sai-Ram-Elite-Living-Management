import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getResidentSession } from '@/lib/residentAuth';

function formatBillingMonth(isoMonth: string): string {
  try {
    if (/^\d{4}-\d{2}$/.test(isoMonth)) {
      const [year, month] = isoMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    return isoMonth;
  } catch {
    return isoMonth;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getResidentSession();

    if (!session || !session.residentId) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Lookup resident from database using session.residentId
    const resident = await prisma.resident.findUnique({
      where: { id: session.residentId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        room: {
          select: {
            roomNumber: true,
            paymentEnabled: true,
          },
        },
        monthlyPayments: {
          orderBy: [
            { billingMonth: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 5,
          select: {
            id: true,
            billingMonth: true,
            rentAmount: true,
            maintenanceAmount: true,
            penaltyAmount: true,
            discountAmount: true,
            totalAmountDue: true,
            status: true,
            dueDate: true,
            paidDate: true,
          },
        },
      },
    });

    if (!resident || resident.status === 'LEFT') {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const isPaymentManaged = resident.room ? resident.room.paymentEnabled !== false : true;

    const pendingPayment = isPaymentManaged
      ? resident.monthlyPayments.find(
          (p) => p.status === 'PENDING' || p.status === 'OVERDUE' || p.status === 'SUBMITTED' || p.status === 'PARTIALLY_PAID'
        )
      : null;
    const selectedPayment = isPaymentManaged ? (pendingPayment || resident.monthlyPayments[0] || null) : null;
    const tenDigit = resident.phone.replace(/[^\d]/g, '').slice(-10);
    const maskedPhone = `+91 ••••• ••${tenDigit.slice(-4)}`;

    return NextResponse.json({
      authenticated: true,
      isPaymentManaged,
      resident: {
        id: resident.id,
        name: resident.fullName,
        roomNumber: resident.room?.roomNumber || 'Unassigned',
        maskedMobile: maskedPhone,
        status: resident.status,
        isPaymentManaged,
      },
      payment: selectedPayment
        ? {
            id: selectedPayment.id,
            billingMonth: formatBillingMonth(selectedPayment.billingMonth),
            rawBillingMonth: selectedPayment.billingMonth,
            rentAmount: selectedPayment.rentAmount,
            maintenanceAmount: selectedPayment.maintenanceAmount,
            penaltyAmount: selectedPayment.penaltyAmount,
            discountAmount: selectedPayment.discountAmount,
            totalAmountDue: selectedPayment.totalAmountDue,
            status: selectedPayment.status,
            isPaid: selectedPayment.status === 'PAID',
            dueDateFormatted: new Date(selectedPayment.dueDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error in /api/pay/session:', error);
    return NextResponse.json({ authenticated: false, error: 'Failed to read session' }, { status: 500 });
  }
}
