import { NextRequest, NextResponse } from 'next/server';
import { synchronizeGoogleFormResponses } from '@/lib/sync/googleFormSync';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = (request.headers.get('authorization') || '').trim();
    const cronHeader = (request.headers.get('x-cron-secret') || '').trim();
    const configuredSecret = (process.env.CRON_SECRET || 'sairam-elite-living-cron-sync-secret-2026-mgmt').trim();

    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : '';
    const isCronAuthorized = (bearerToken && bearerToken === configuredSecret) || (cronHeader && cronHeader === configuredSecret);

    let isAdminAuthorized = false;
    let session: any = null;
    try {
      session = await getSessionUser();
      isAdminAuthorized = !!session;
    } catch (_) {}

    if (!isCronAuthorized && !isAdminAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid Admin session or Cron Secret required.' },
        { status: 401 }
      );
    }

    const triggeredBy = isCronAuthorized ? 'CRON_SCHEDULER' : (session?.name || session?.email || 'Admin');
    const result = await synchronizeGoogleFormResponses(triggeredBy);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Synchronization failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Synchronization failed.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const latestSync = await prisma.syncLog.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    const totalRegistrations = await prisma.registration.count();
    const newRegistrations = await prisma.registration.count({
      where: { status: 'NEW' },
    });

    return NextResponse.json({
      latestSync,
      totalRegistrations,
      newRegistrations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sync status.' },
      { status: 500 }
    );
  }
}
