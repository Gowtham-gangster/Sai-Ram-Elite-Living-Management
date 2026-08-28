import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { processPaymentReminders } from '@/lib/reminders/paymentReminderEngine';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await processPaymentReminders();

    await createAuditLog({
      adminUserId: session.userId,
      adminName: session.name,
      action: 'PROCESS_REMINDERS',
      entityType: 'REMINDER',
      details: {
        scanned: summary.scanned,
        firstRemindersSent: summary.firstRemindersSent,
        secondRemindersSent: summary.secondRemindersSent,
        paidCancelled: summary.paidCancelled,
        failedCount: summary.failedCount,
      },
    });

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error processing payment reminders:', error);
    return NextResponse.json(
      { error: 'Failed to process payment reminders', details: error.message },
      { status: 500 }
    );
  }
}

// Support GET for scheduled cron triggers
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await processPaymentReminders();
    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error processing payment reminders via cron:', error);
    return NextResponse.json(
      { error: 'Failed to process payment reminders', details: error.message },
      { status: 500 }
    );
  }
}
