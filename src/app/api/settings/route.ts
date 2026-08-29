import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { HostelSettingsSchema, UpdatePasswordSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notifications';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let settings = await db.hostelSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await db.hostelSettings.create({
        data: { id: 'default' },
      });
    }

    // Also get admin user profile details
    const adminUser = await db.adminUser.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Sanitize settings object to not return bank details to the UI
    const sanitizedSettings = {
      id: settings.id,
      hostelName: settings.hostelName,
      hostelAddress: settings.hostelAddress,
      contactPhone: settings.contactPhone,
      whatsAppNumber: settings.whatsAppNumber,
      contactEmail: settings.contactEmail,
      websiteUrl: settings.websiteUrl,
      rulesAndRegulations: settings.rulesAndRegulations,
      isBankManagedInEnv: true,
      updatedAt: settings.updatedAt,
    };

    return NextResponse.json({ settings: sanitizedSettings, adminUser });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = HostelSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings configuration', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updated = await db.hostelSettings.upsert({
      where: { id: 'default' },
      update: {
        hostelName: data.hostelName,
        hostelAddress: data.hostelAddress,
        contactPhone: data.contactPhone,
        whatsAppNumber: data.whatsAppNumber,
        contactEmail: data.contactEmail,
        websiteUrl: data.websiteUrl || 'https://sairameliteliving.com',
        rulesAndRegulations: data.rulesAndRegulations || '',
      },
      create: {
        id: 'default',
        hostelName: data.hostelName,
        hostelAddress: data.hostelAddress,
        contactPhone: data.contactPhone,
        whatsAppNumber: data.whatsAppNumber,
        contactEmail: data.contactEmail,
        websiteUrl: data.websiteUrl || 'https://sairameliteliving.com',
        rulesAndRegulations: data.rulesAndRegulations || '',
      },
    });

    await createNotification({
      title: 'Hostel Settings Updated',
      message: `Hostel profile and policy configurations were updated by ${session.name}.`,
      type: 'INFO',
      linkUrl: '/admin/settings',
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

// Admin Password Update Handler
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdatePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid password input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await db.adminUser.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.adminUser.update({
      where: { id: session.userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully.' });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
