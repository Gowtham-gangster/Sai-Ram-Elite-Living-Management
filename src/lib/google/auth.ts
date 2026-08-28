import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Normalizes PEM private key strings (replacing literal escaped newlines)
 */
function normalizePrivateKey(key?: string): string {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
}

/**
 * Creates an authenticated Google Service Account JWT Client
 * (Strictly Server-Side Only)
 */
export function getGoogleAuthClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'Google service account credentials missing: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set in environment variables.'
    );
  }

  const privateKey = normalizePrivateKey(rawKey);

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });
}
