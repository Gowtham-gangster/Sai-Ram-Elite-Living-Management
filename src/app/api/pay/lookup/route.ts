import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeWhatsAppPhoneNumber } from '@/lib/whatsapp/phoneNormalizer';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mobileNumber } = body;

    if (!mobileNumber || typeof mobileNumber !== 'string') {
      return NextResponse.json(
        { found: false, error: 'Please enter a valid mobile number.' },
        { status: 400 }
      );
    }

    const cleanedInput = mobileNumber.replace(/[^\d+]/g, '');
    const tenDigit = cleanedInput.replace(/^\+?91/, '').replace(/^0/, '').slice(-10);

    if (tenDigit.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigit)) {
      return NextResponse.json(
        { found: false, error: 'Please enter a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    // Lookup matching ACTIVE or NOTICE_PERIOD resident
    const resident = await prisma.resident.findFirst({
      where: {
        OR: [
          { phone: tenDigit },
          { phone: `+91${tenDigit}` },
          { phone: `91${tenDigit}` },
          { phone: `+91 ${tenDigit.slice(0, 5)} ${tenDigit.slice(5)}` },
          { alternatePhone: tenDigit },
          { alternatePhone: `+91${tenDigit}` },
        ],
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        room: {
          select: {
            roomNumber: true,
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

    if (!resident) {
      return NextResponse.json(
        {
          found: false,
          error: 'No active resident found matching this mobile number. Please check the number or contact hostel management.',
        },
        { status: 404 }
      );
    }

    // Find the latest pending/overdue payment first, or the most recent payment
    const pendingPayment = resident.monthlyPayments.find(
      (p) => p.status === 'PENDING' || p.status === 'OVERDUE' || p.status === 'SUBMITTED'
    );
    const selectedPayment = pendingPayment || resident.monthlyPayments[0] || null;

    const maskedPhone = `+91 ••••• ••${tenDigit.slice(-4)}`;

    const { createResidentToken, RESIDENT_COOKIE_NAME } = await import('@/lib/residentAuth');
    const token = await createResidentToken({
      residentId: resident.id,
      phone: tenDigit,
      fullName: resident.fullName,
      roomNumber: resident.room?.roomNumber || 'Unassigned',
    });

    const response = NextResponse.json({
      found: true,
      resident: {
        id: resident.id,
        name: resident.fullName,
        roomNumber: resident.room?.roomNumber || 'Unassigned',
        maskedMobile: maskedPhone,
        status: resident.status,
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

    response.cookies.set(RESIDENT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Error in /api/pay/lookup:', error);
    return NextResponse.json(
      { found: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
