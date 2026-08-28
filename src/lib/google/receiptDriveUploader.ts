import { google } from 'googleapis';
import { Readable } from 'stream';
import { getGoogleAuthClient } from './auth';

export interface UploadReceiptOptions {
  receiptNumber: string;
  residentName: string;
  billingMonth: string;
  pdfBytes: Uint8Array | Buffer;
}

export interface UploadReceiptResult {
  fileId: string;
  fileName: string;
  folderId: string;
}

/**
 * Finds or creates a deterministic folder hierarchy in Google Drive:
 * SAIRAM_RECEIPTS / {Year} / {MM-MonthName}
 */
async function getOrCreateFolder(
  drive: any,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const listRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    return listRes.data.files[0].id;
  }

  // Create folder if not found
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const createRes = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to create Google Drive folder: ${folderName}`);
  }

  return createRes.data.id;
}

/**
 * Uploads a generated Receipt PDF to a deterministic private Google Drive folder hierarchy
 */
export async function uploadReceiptPdfToDrive(
  options: UploadReceiptOptions
): Promise<UploadReceiptResult> {
  const { receiptNumber, residentName, billingMonth, pdfBytes } = options;

  const auth = getGoogleAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Determine date components for folder structure
  const now = new Date();
  const yearStr = String(now.getFullYear());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthNum = String(now.getMonth() + 1).padStart(2, '0');
  const monthName = monthNames[now.getMonth()];
  const monthFolderStr = `${monthNum}-${monthName}`;

  // 2. Resolve or create deterministic folder hierarchy
  const rootFolderId = await getOrCreateFolder(drive, 'SAIRAM_RECEIPTS');
  const yearFolderId = await getOrCreateFolder(drive, yearStr, rootFolderId);
  const targetFolderId = await getOrCreateFolder(drive, monthFolderStr, yearFolderId);

  // 3. Construct sanitized filename
  const cleanName = residentName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanMonth = billingMonth.replace(/[^a-zA-Z0-9-]/g, '_');
  const fileName = `${receiptNumber}_${cleanName}_${cleanMonth}.pdf`;

  // 4. Upload file as stream
  const bufferStream = new Readable();
  bufferStream.push(Buffer.from(pdfBytes));
  bufferStream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [targetFolderId],
    mimeType: 'application/pdf',
  };

  const media = {
    mimeType: 'application/pdf',
    body: bufferStream,
  };

  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  if (!uploadRes.data.id) {
    throw new Error('Google Drive upload succeeded but no file ID was returned.');
  }

  return {
    fileId: uploadRes.data.id,
    fileName: uploadRes.data.name || fileName,
    folderId: targetFolderId,
  };
}
