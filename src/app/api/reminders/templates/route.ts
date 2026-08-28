import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

const DEFAULT_TEMPLATES = [
  {
    reminderType: 'UPCOMING_DUE',
    title: 'Upcoming Rent Due Reminder',
    channel: 'WHATSAPP',
    daysOffset: -3,
    isActive: true,
    templateBody:
      'Dear {{resident_name}},\n\nThis is a friendly reminder from {{hostel_name}} that your monthly hostel rent of ₹{{amount_due}} for {{billing_month}} (Room {{room_number}}) is due on {{due_date}}.\n\nKindly make the payment via UPI to {{upi_id}} or net banking and upload the receipt/UTR reference.\n\nThank you!',
  },
  {
    reminderType: 'DUE_TODAY',
    title: 'Rent Due Today Notice',
    channel: 'WHATSAPP',
    daysOffset: 0,
    isActive: true,
    templateBody:
      'Dear {{resident_name}},\n\nYour hostel rent of ₹{{amount_due}} for {{billing_month}} (Room {{room_number}}) is due TODAY ({{due_date}}).\n\nPlease transfer to UPI: {{upi_id}} to avoid late fee penalties.\n\nRegards,\n{{hostel_name}}',
  },
  {
    reminderType: 'OVERDUE_NOTICE',
    title: 'Overdue Rent Notice (Urgent)',
    channel: 'WHATSAPP',
    daysOffset: 2,
    isActive: true,
    templateBody:
      'URGENT NOTICE:\nDear {{resident_name}},\n\nYour rent payment of ₹{{amount_due}} for {{billing_month}} (Room {{room_number}}) is OVERDUE since {{due_date}}.\n\nLate fees may apply. Please settle the pending dues immediately via UPI: {{upi_id}} and contact hostel administration.\n\n{{hostel_name}} Administration',
  },
  {
    reminderType: 'CUSTOM',
    title: 'Custom Announcement / Alert',
    channel: 'WHATSAPP',
    daysOffset: 0,
    isActive: true,
    templateBody:
      'Hello {{resident_name}} (Room {{room_number}}),\n\nImportant update from {{hostel_name}} management:\n\n{{custom_message}}\n\nRegards,\nManagement',
  },
];

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let templates = await db.reminderTemplate.findMany();

    if (templates.length === 0) {
      // Seed default templates
      for (const t of DEFAULT_TEMPLATES) {
        await db.reminderTemplate.create({ data: t });
      }
      templates = await db.reminderTemplate.findMany();
    }

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reminderType, title, templateBody, channel, daysOffset, isActive } = body;

    if (!reminderType || !templateBody) {
      return NextResponse.json({ error: 'reminderType and templateBody are required' }, { status: 400 });
    }

    const updated = await db.reminderTemplate.upsert({
      where: { reminderType },
      update: {
        title: title || undefined,
        templateBody,
        channel: channel || 'WHATSAPP',
        daysOffset: daysOffset !== undefined ? parseInt(daysOffset, 10) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      create: {
        reminderType,
        title: title || reminderType,
        templateBody,
        channel: channel || 'WHATSAPP',
        daysOffset: daysOffset !== undefined ? parseInt(daysOffset, 10) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
