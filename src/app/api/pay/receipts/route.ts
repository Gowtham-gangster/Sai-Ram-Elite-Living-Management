import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getResidentSession } from '@/lib/residentAuth';

export async function POST(request: NextRequest) {
  try {
    const session = await getResidentSession();
    const body = await request.json().catch(() => ({}));
    const { mobileNumber, residentId } = body;

    let targetResidentId = session?.residentId || residentId;

    if (!targetResidentId && mobileNumber) {
      const cleanedInput = mobileNumber.replace(/[^\d+]/g, '');
      const tenDigit = cleanedInput.replace(/^\+?91/, '').replace(/^0/, '').slice(-10);

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
        },
        select: { id: true },
      });

      if (!resident) {
        return NextResponse.json({ receipts: [] }, { status: 200 });
      }

      targetResidentId = resident.id;
    }

    if (!targetResidentId) {
      return NextResponse.json(
        { error: 'Authentication or resident identification required.' },
        { status: 400 }
      );
    }

    // If authenticated via session, prevent IDOR (cannot query other resident's receipts)
    if (session?.residentId && residentId && residentId !== session.residentId) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot access another resident receipts.' },
        { status: 403 }
      );
    }

    // Fetch all receipts for this resident, sorted newest first
    const receipts = await prisma.receipt.findMany({
      where: { residentId: targetResidentId },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        receiptNumber: true,
        billingMonth: true,
        amountPaid: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
        downloadToken: true,
        googleDriveFileId: true,
        roomNumber: true,
      },
    });

    return NextResponse.json({
      success: true,
      receipts: receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        billingMonth: r.billingMonth,
        amountPaid: r.amountPaid,
        paymentDate: r.paymentDate,
        paymentMethod: r.paymentMethod,
        status: r.status,
        downloadToken: r.downloadToken,
        roomNumber: r.roomNumber,
        hasDriveFile: !!r.googleDriveFileId,
      })),
    });
  } catch (error: any) {
    console.error('Error in /api/pay/receipts:', error);
    return NextResponse.json({ error: 'Failed to fetch receipts.' }, { status: 500 });
  }
}
