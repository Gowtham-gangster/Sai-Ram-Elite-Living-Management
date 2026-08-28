import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sairam-elite-living-super-secret-jwt-key-2026-management-portal'
);

const AUTH_COOKIE_NAME = 'sairam_admin_token';

// Security Headers Helper
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

// Protected management route paths
const PROTECTED_ROUTES = [
  '/dashboard',
  '/residents',
  '/rooms',
  '/registrations',
  '/payments',
  '/receipts',
  '/reminders',
  '/reports',
  '/settings',
  '/admin',
];

async function verifyToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, internal files, images, favicons
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Check admin session token
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyToken(token);
  const isAuthenticated = !!session;

  // Root route "/" -> Redirect directly to /dashboard if logged in, else to /login
  if (pathname === '/') {
    if (isAuthenticated) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
  }

  // If user is accessing /login or legacy /admin/login
  if (pathname === '/login' || pathname === '/admin/login') {
    if (isAuthenticated) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    // Redirect /admin/login to /login for unified login portal
    if (pathname === '/admin/login') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Check if current route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      if (pathname !== '/dashboard' && pathname !== '/admin/dashboard') {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    // Redirect legacy /admin root to /dashboard
    if (pathname === '/admin') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }

    return applySecurityHeaders(NextResponse.next());
  }

  // Handle protected API routes
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/supabase/health') &&
    !pathname.startsWith('/api/auth/login') &&
    !pathname.startsWith('/api/google/test-connection') &&
    !pathname.startsWith('/api/pay/') &&
    !pathname.startsWith('/api/payments/webhook')
  ) {
    // Check for valid Cron Secret header
    const authHeader = (request.headers.get('authorization') || '').trim();
    const cronHeader = (request.headers.get('x-cron-secret') || '').trim();
    const configuredCronSecret = (process.env.CRON_SECRET || 'sairam-elite-living-cron-sync-secret-2026-mgmt').trim();

    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : '';
    const isCronAuthorized = (bearerToken && bearerToken === configuredCronSecret) || (cronHeader && cronHeader === configuredCronSecret);

    if (!isAuthenticated && !isCronAuthorized) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Unauthorized. Please login or provide a valid Cron Secret to access management APIs.' },
          { status: 401 }
        )
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
