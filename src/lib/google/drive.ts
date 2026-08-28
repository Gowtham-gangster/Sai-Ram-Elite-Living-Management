import { google } from 'googleapis';
import { getGoogleAuthClient } from './auth';

export interface DriveAccessVerification {
  accessible: boolean;
  message: string;
  filesFoundCount?: number;
}

/**
 * Tests Google Drive API connectivity with the service account (Read-Only)
 */
export async function verifyDriveAccess(): Promise<DriveAccessVerification> {
  try {
    const auth = getGoogleAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // List top 5 files to verify read connectivity without fetching binary data
    const res = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)',
    });

    const count = (res.data.files || []).length;

    return {
      accessible: true,
      message: 'Google Drive API connection successful.',
      filesFoundCount: count,
    };
  } catch (err: any) {
    return {
      accessible: false,
      message: err.message || 'Google Drive API access could not be verified.',
    };
  }
}
