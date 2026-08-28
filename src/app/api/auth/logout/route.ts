import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getSessionUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await createAuditLog({
      adminUserId: user.userId,
      adminName: user.name,
      action: 'ADMIN_LOGOUT',
      entityType: 'AUTH',
      entityId: user.userId,
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
