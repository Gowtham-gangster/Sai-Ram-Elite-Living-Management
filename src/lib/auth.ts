import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sairam-elite-living-super-secret-jwt-key-2026-management-portal'
);

export const AUTH_COOKIE_NAME = 'sairam_admin_token';
export const TOKEN_EXPIRY = '7d';

export interface AuthSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Hash plain text password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify plain text password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a signed JWT session token
 */
export async function signAuthToken(payload: AuthSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode JWT token
 */
export async function verifyAuthToken(token: string): Promise<AuthSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Retrieve current authenticated user from request cookies
 */
export async function getSessionUser(): Promise<AuthSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}
