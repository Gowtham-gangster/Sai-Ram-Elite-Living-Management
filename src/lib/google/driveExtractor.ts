/**
 * Google Drive URL and File ID Extraction Utilities
 */

export interface ExtractedGoogleDriveDoc {
  fileId: string | null;
  viewUrl: string | null;
  downloadUrl: string | null;
  allFileIds: string[];
  raw: string;
}

/**
 * Robustly extracts Google Drive File ID(s) and canonical URLs from
 * various Google Forms response formats (URLs, comma-separated lists, IDs).
 */
export function extractGoogleDriveDoc(raw: any): ExtractedGoogleDriveDoc {
  if (!raw || typeof raw !== 'string') {
    return {
      fileId: null,
      viewUrl: null,
      downloadUrl: null,
      allFileIds: [],
      raw: '',
    };
  }

  const rawStr = String(raw).trim();
  if (rawStr === '' || /^(na|n\/a|nil|none|no|null|undefined)$/i.test(rawStr)) {
    return {
      fileId: null,
      viewUrl: null,
      downloadUrl: null,
      allFileIds: [],
      raw: rawStr,
    };
  }

  // Find all Google Drive file IDs using regex
  // Patterns matched:
  // 1. https://drive.google.com/open?id=FILE_ID
  // 2. https://drive.google.com/file/d/FILE_ID/view...
  // 3. https://drive.google.com/uc?id=FILE_ID
  // 4. https://docs.google.com/document/d/FILE_ID/...
  // 5. Raw file ID (alphanumeric with underscores and hyphens, typically 25-45 chars)
  const fileIdPatterns = [
    /[?&]id=([a-zA-Z0-9_-]{25,50})/g,
    /\/d\/([a-zA-Z0-9_-]{25,50})/g,
    /\/file\/d\/([a-zA-Z0-9_-]{25,50})/g,
  ];

  const extractedIds: string[] = [];

  for (const pattern of fileIdPatterns) {
    let match;
    while ((match = pattern.exec(rawStr)) !== null) {
      if (match[1] && !extractedIds.includes(match[1])) {
        extractedIds.push(match[1]);
      }
    }
  }

  // If no regex match from URLs, check if the raw string itself is a single file ID
  if (extractedIds.length === 0 && /^[a-zA-Z0-9_-]{25,50}$/.test(rawStr)) {
    extractedIds.push(rawStr);
  }

  const primaryFileId = extractedIds.length > 0 ? extractedIds[0] : null;

  return {
    fileId: primaryFileId,
    viewUrl: primaryFileId ? `https://drive.google.com/file/d/${primaryFileId}/view` : rawStr.startsWith('http') ? rawStr : null,
    downloadUrl: primaryFileId ? `https://drive.google.com/uc?export=download&id=${primaryFileId}` : null,
    allFileIds: extractedIds,
    raw: rawStr,
  };
}
