import { google } from 'googleapis';
import { Readable } from 'stream';
import { getGoogleAuthClient } from './auth';

export interface UploadReceiptOptions {
  receiptNumber: string;
  residentName: string;
  roomNumber?: string;
  billingMonth: string;
  paymentReference?: string;
  pdfBytes: Uint8Array | Buffer;
}

export interface UploadReceiptResult {
  fileId: string;
  fileName: string;
  folderId: string;
  folderName: string;
  webViewLink?: string;
  isExisting?: boolean;
}

// In-memory cache for resolved Google Drive folder IDs
const folderIdCache = new Map<string, string>();

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Returns the configured root Google Drive folder ID for fee receipts.
 */
export function getReceiptsRootFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim() || '1EqijJJZWSpjOg2NFdJC7sFCJMkhOyMLc';
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_RECEIPTS_FOLDER_ID is not configured.');
  }
  return folderId;
}

/**
 * Authoritatively converts MonthlyPayment.billingMonth (e.g. "2026-08") to strict "Month-Year" (e.g. "August-2026").
 * Formats supported: "YYYY-MM", "YYYY/MM", "YYYY-M", Date objects.
 */
export function formatBillingMonthToFolderName(billingMonth: string | Date): string {
  if (billingMonth instanceof Date) {
    const year = billingMonth.getFullYear();
    const monthName = MONTH_NAMES[billingMonth.getMonth()];
    return `${monthName}-${year}`;
  }

  const raw = String(billingMonth || '').trim();
  const parts = raw.split(/[-/]/);

  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);

    if (!isNaN(year) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      const monthName = MONTH_NAMES[monthNum - 1];
      return `${monthName}-${year}`;
    }
  }

  // Fallback for non-standard formats
  const parsedDate = new Date(raw);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const monthName = MONTH_NAMES[parsedDate.getMonth()];
    return `${monthName}-${year}`;
  }

  throw new Error(`Invalid billingMonth format: "${raw}". Expected YYYY-MM (e.g. 2026-08).`);
}

/**
 * Sanitizes strings for safe inclusion in filenames across all operating systems & Google Drive.
 * Strips: / \ : * ? " < > | control characters and collapses whitespace.
 */
export function sanitizeReceiptFilenamePart(value?: string | null): string {
  if (!value) return 'Unknown';
  return String(value)
    .trim()
    .replace(/[/\\:*?"<>|]/g, '_') // Remove illegal characters
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
}

/**
 * Generates the deterministic receipt filename:
 * Receipt_<ResidentName>_<RoomNumber>_<Month-Year>_<PaymentReference>.pdf
 */
export function generateReceiptFilename(params: {
  residentName: string;
  roomNumber?: string;
  billingMonth: string;
  paymentReference?: string;
  receiptNumber?: string;
}): string {
  const cleanName = sanitizeReceiptFilenamePart(params.residentName) || 'Resident';
  const cleanRoom = sanitizeReceiptFilenamePart(params.roomNumber) || 'General';
  const monthYearStr = formatBillingMonthToFolderName(params.billingMonth);
  const cleanRef = sanitizeReceiptFilenamePart(params.paymentReference || params.receiptNumber) || 'REF';

  return `Receipt_${cleanName}_${cleanRoom}_${monthYearStr}_${cleanRef}.pdf`;
}

/**
 * Finds or creates an authoritative month subfolder (MMMM-YYYY) strictly as a direct child of the root receipts folder.
 * Idempotent: Never creates duplicate folders.
 */
export async function getOrCreateMonthlyReceiptFolder(
  drive: any,
  billingMonth: string
): Promise<{ folderId: string; folderName: string }> {
  const rootFolderId = getReceiptsRootFolderId();
  const folderName = formatBillingMonthToFolderName(billingMonth);
  const cacheKey = `${rootFolderId}:${folderName}`;

  if (folderIdCache.has(cacheKey)) {
    return {
      folderId: folderIdCache.get(cacheKey)!,
      folderName,
    };
  }

  // Search specifically for a child folder of rootFolderId with exact matching folderName
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${rootFolderId}' in parents and trashed=false`;

  const listRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    const existingFolderId = listRes.data.files[0].id;
    folderIdCache.set(cacheKey, existingFolderId);
    return {
      folderId: existingFolderId,
      folderName,
    };
  }

  // Create folder inside rootFolderId
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [rootFolderId],
  };

  const createRes = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name',
    supportsAllDrives: true,
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to create Google Drive folder: ${folderName} under root ${rootFolderId}`);
  }

  const createdFolderId = createRes.data.id;
  folderIdCache.set(cacheKey, createdFolderId);

  return {
    folderId: createdFolderId,
    folderName,
  };
}

/**
 * Uploads a generated Receipt PDF to the designated Month-Year Google Drive folder.
 * Guaranteed idempotent: If a file with the same name already exists in the target folder, returns the existing file ID.
 */
export async function uploadReceiptPdfToDrive(
  options: UploadReceiptOptions
): Promise<UploadReceiptResult> {
  const { receiptNumber, residentName, roomNumber, billingMonth, paymentReference, pdfBytes } = options;

  const auth = getGoogleAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Resolve target Month-Year folder inside root
  const { folderId: targetFolderId, folderName } = await getOrCreateMonthlyReceiptFolder(
    drive,
    billingMonth
  );

  // 2. Construct sanitized deterministic filename
  const fileName = generateReceiptFilename({
    residentName,
    roomNumber,
    billingMonth,
    paymentReference: paymentReference || receiptNumber,
    receiptNumber,
  });

  // 3. Idempotency Check: check if file with this exact name already exists in target folder
  const checkQuery = `name='${fileName}' and '${targetFolderId}' in parents and trashed=false`;
  const existingFiles = await drive.files.list({
    q: checkQuery,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existingFiles.data.files && existingFiles.data.files.length > 0 && existingFiles.data.files[0].id) {
    const existingFile = existingFiles.data.files[0];
    return {
      fileId: String(existingFile.id),
      fileName: existingFile.name || fileName,
      folderId: targetFolderId,
      folderName,
      webViewLink: existingFile.webViewLink || undefined,
      isExisting: true,
    };
  }

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
    throw new Error(`Google Drive failed to return a file ID for uploaded receipt: ${fileName}`);
  }

  return {
    fileId: String(uploadRes.data.id),
    fileName: uploadRes.data.name || fileName,
    folderId: targetFolderId,
    folderName,
    webViewLink: uploadRes.data.webViewLink || undefined,
    isExisting: false,
  };
}

/**
 * Clears in-memory folder cache (useful for automated testing)
 */
export function clearFolderIdCache(): void {
  folderIdCache.clear();
}
