import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  getReminderScheduleForDueDate,
  calculateEligibleReminderForToday,
} from '@/lib/reminders/paymentReminderEngine';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    if (search) {
      where.OR = [
        { resident: { fullName: { contains: search, mode: 'insensitive' } } },
        { resident: { phone: { contains: search } } },
        { messageText: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [reminders, unpaidPayments] = await Promise.all([
      db.paymentReminder.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        include: {
          resident: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              alternatePhone: true,
              room: { select: { roomNumber: true, floor: true } },
            },
          },
          monthlyPayment: {
            select: {
              id: true,
              billingMonth: true,
              totalAmountDue: true,
              dueDate: true,
              status: true,
            },
          },
        },
      }),
      db.monthlyPayment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE', 'SUBMITTED'] },
        },
        include: {
          resident: {
            select: { id: true, fullName: true, phone: true, alternatePhone: true },
          },
          room: {
            select: { id: true, roomNumber: true, floor: true, paymentEnabled: true },
          },
          reminders: {
            orderBy: { sequence: 'desc' },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const now = new Date();

    const candidates = unpaidPayments.map((p) => {
      const isOverdue = p.status === 'OVERDUE' || new Date(p.dueDate) < now;
      const dueDaysDiff = Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let category = 'PENDING';
      if (isOverdue) category = 'OVERDUE';
      else if (dueDaysDiff <= 3 && dueDaysDiff >= 0) category = 'DUE_SOON';

      const reminderSchedule = getReminderScheduleForDueDate(new Date(p.dueDate), 6);
      const eligibleToday = calculateEligibleReminderForToday(new Date(p.dueDate), now);

      return {
        paymentId: p.id,
        residentId: p.resident.id,
        residentName: p.resident.fullName,
        phone: p.resident.phone,
        roomNumber: p.room.roomNumber,
        floor: p.room.floor,
        paymentEnabled: p.room.paymentEnabled,
        billingMonth: p.billingMonth,
        amountDue: p.totalAmountDue,
        dueDate: p.dueDate,
        status: p.status,
        category,
        lastReminder: p.reminders[0] || null,
        reminderSchedule,
        eligibleToday,
        scheduleStatus: p.room.paymentEnabled === false
          ? 'Payment management disabled for this room'
          : p.status === 'PAID'
          ? 'Completed — Reminders stopped'
          : 'Continues every 2 days until payment',
      };
    });

    const allReminders = await db.paymentReminder.findMany({ select: { status: true } });

    return NextResponse.json({
      reminders,
      candidates,
      summary: {
        total: allReminders.length,
        scheduled: allReminders.filter((r) => r.status === 'SCHEDULED' || r.status === 'PENDING').length,
        pending: allReminders.filter((r) => r.status === 'PENDING').length,
        sent: allReminders.filter((r) => r.status === 'SENT').length,
        failed: allReminders.filter((r) => r.status === 'FAILED').length,
        cancelled: allReminders.filter((r) => r.status === 'CANCELLED').length,
        dueSoonCandidates: candidates.filter((c) => c.category === 'DUE_SOON').length,
        overdueCandidates: candidates.filter((c) => c.category === 'OVERDUE').length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { residentId, monthlyPaymentId, reminderType, channel, customMessage, scheduledDate } = body;

    if (!residentId) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    const [resident, payment, settings, template] = await Promise.all([
      db.resident.findUnique({
        where: { id: residentId },
        include: { room: true },
      }),
      monthlyPaymentId ? db.monthlyPayment.findUnique({ where: { id: monthlyPaymentId } }) : null,
      db.hostelSettings.findUnique({ where: { id: 'default' } }),
      db.reminderTemplate.findUnique({ where: { reminderType: reminderType || 'UPCOMING_DUE' } }),
    ]);

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    const templateText = template ? template.templateBody : 'Reminder: Rent due for {{resident_name}} in Room {{room_number}}.';

    // Format dynamic placeholders
    const formattedMessage = templateText
      .replace(/{{resident_name}}/g, resident.fullName)
      .replace(/{{room_number}}/g, resident.room.roomNumber)
      .replace(/{{amount_due}}/g, (payment?.totalAmountDue || resident.monthlyRent || 0).toLocaleString('en-IN'))
      .replace(/{{billing_month}}/g, payment?.billingMonth || new Date().toISOString().slice(0, 7))
      .replace(
        /{{due_date}}/g,
        payment ? new Date(payment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '5th of this month'
      )
      .replace(/{{hostel_name}}/g, settings?.hostelName || 'SAIRAM ELITE LIVING')
      .replace(/{{upi_id}}/g, settings?.upiId || 'sairamelite@hdfcbank')
      .replace(/{{custom_message}}/g, customMessage || '');

    const isScheduled = scheduledDate && new Date(scheduledDate) > new Date();

    const reminder = await db.paymentReminder.create({
      data: {
        residentId,
        monthlyPaymentId: payment?.id || null,
        reminderType: reminderType || 'UPCOMING_DUE',
        channel: channel || 'WHATSAPP',
        scheduledFor: scheduledDate ? new Date(scheduledDate) : new Date(),
        sentAt: isScheduled ? null : new Date(),
        status: isScheduled ? 'SCHEDULED' : 'SENT',
        messageText: formattedMessage,
        attemptCount: isScheduled ? 0 : 1,
      },
      include: {
        resident: { select: { fullName: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: isScheduled
        ? `Reminder scheduled for ${resident.fullName} on ${new Date(scheduledDate).toLocaleDateString('en-IN')}.`
        : `Reminder recorded for ${resident.fullName} (Simulated Dispatch - No WhatsApp spam).`,
      reminder,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error dispatching reminder:', error);
    return NextResponse.json({ error: 'Failed to process reminder' }, { status: 500 });
  }
}
