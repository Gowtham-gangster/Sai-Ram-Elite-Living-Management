import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, failureReason } = body;

    const reminder = await db.paymentReminder.findUnique({
      where: { id },
      include: { resident: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    let updated;
    if (action === 'CANCEL') {
      updated = await db.paymentReminder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    } else if (action === 'RETRY') {
      updated = await db.paymentReminder.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attemptCount: reminder.attemptCount + 1,
          failureReason: null,
        },
      });
    } else if (action === 'MARK_FAILED') {
      updated = await db.paymentReminder.update({
        where: { id },
        data: {
          status: 'FAILED',
          failureReason: failureReason || 'Channel timeout or invalid contact number',
          attemptCount: reminder.attemptCount + 1,
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid action. Supported: CANCEL, RETRY, MARK_FAILED' }, { status: 400 });
    }

    return NextResponse.json({ success: true, reminder: updated });
  } catch (error: any) {
    console.error('Error updating reminder:', error);
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}
