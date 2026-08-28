import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sairam-elite-living-super-secret-jwt-key-2026-management-portal'
);

export const RESIDENT_COOKIE_NAME = 'sairam_resident_session';

export interface ResidentSessionPayload {
  residentId: string;
  phone: string;
  fullName: string;
  roomNumber: string;
}

/**
 * Generate a signed JWT for the resident
 */
export async function createResidentToken(payload: ResidentSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode the resident JWT
 */
export async function verifyResidentToken(token?: string): Promise<ResidentSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      residentId: payload.residentId as string,
      phone: payload.phone as string,
      fullName: payload.fullName as string,
      roomNumber: payload.roomNumber as string,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieve current authenticated resident session from HTTP-only request cookies
 */
export async function getResidentSession(): Promise<ResidentSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(RESIDENT_COOKIE_NAME)?.value;
    return await verifyResidentToken(token);
  } catch (error) {
    console.error('Error reading resident session cookie:', error);
    return null;
  }
}
