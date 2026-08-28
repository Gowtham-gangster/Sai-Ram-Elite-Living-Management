import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import {
  WhatsAppService,
  ResidentReminderInput,
  formatBillingMonthDisplay,
  normalizeWhatsAppPhoneNumber,
} from '@/lib/whatsapp';
import { formatKolkataDisplayDate } from '@/lib/reminders/paymentReminderEngine';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await request.json();
    const { residentId, monthlyPaymentId, reminderType = 'FIRST_DUE_REMINDER', testPhoneOverride } = body;

    if (!residentId) {
      return NextResponse.json({ error: 'Resident ID is required.' }, { status: 400 });
    }

    const resident = await db.resident.findUnique({
      where: { id: residentId },
      include: { room: true },
    });

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found.' }, { status: 404 });
    }

    let payment = null;
    if (monthlyPaymentId) {
      payment = await db.monthlyPayment.findUnique({
        where: { id: monthlyPaymentId },
      });
    } else {
      // Find latest unpaid or most recent payment
      payment = await db.monthlyPayment.findFirst({
        where: { residentId: resident.id },
        orderBy: { dueDate: 'desc' },
      });
    }

    const targetPhone = testPhoneOverride || resident.phone;
    const phoneNorm = normalizeWhatsAppPhoneNumber(targetPhone);

    if (!phoneNorm.isValid) {
      return NextResponse.json(
        { error: `Invalid recipient phone number: ${phoneNorm.error}` },
        { status: 400 }
      );
    }

    const billingMonth = payment?.billingMonth || new Date().toISOString().substring(0, 7);
    const amountDue = payment?.totalAmountDue ?? resident.monthlyRent;
    const dueDate = payment?.dueDate || new Date();

    const input: ResidentReminderInput = {
      residentId: resident.id,
      residentName: resident.fullName,
      phone: targetPhone,
      roomNumber: resident.room?.roomNumber || '101',
      billingMonth: formatBillingMonthDisplay(billingMonth),
      amountDue,
      dueDateFormatted: formatKolkataDisplayDate(dueDate),
      reminderType: reminderType === 'SECOND_REMINDER' ? 'SECOND_REMINDER' : 'FIRST_DUE_REMINDER',
    };

    const result = await WhatsAppService.sendPaymentReminder(input);

    await createAuditLog({
      adminUserId: session.userId,
      adminName: session.name,
      action: 'TEST_WHATSAPP_REMINDER',
      entityType: 'REMINDER',
      entityId: payment?.id || resident.id,
      details: {
        residentName: resident.fullName,
        recipientPhone: phoneNorm.e164,
        reminderType: input.reminderType,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      },
    });

    return NextResponse.json({
      success: result.success,
      result,
      recipient: phoneNorm.e164,
      renderedText: result.renderedText,
    });
  } catch (error: any) {
    console.error('Error sending test reminder:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch test reminder', details: error.message },
      { status: 500 }
    );
  }
}
