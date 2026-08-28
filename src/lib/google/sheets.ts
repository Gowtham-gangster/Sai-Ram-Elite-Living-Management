import { google } from 'googleapis';
import { getGoogleAuthClient } from './auth';

export interface SpreadsheetMetadata {
  title: string;
  spreadsheetId: string;
  sheets: {
    sheetId: number;
    title: string;
    index: number;
    rowCount?: number;
    columnCount?: number;
  }[];
}

export interface MappedGoogleFormRegistration {
  source_submitted_at?: string | null;
  full_name: string;
  mobile_number: string;
  guardian_name?: string | null;
  emergency_contact_number?: string | null;
  aadhaar_number?: string | null;
  occupation?: string | null;
  occupation_type?: string | null;
  company_or_college_name?: string | null;
  requested_room_number?: string | null;
  check_in_date?: string | null;
  security_deposit?: number | null;
  identity_document_url?: string | null;
  declaration_accepted: boolean;
  raw_row_data: Record<string, any>;
}

/**
 * Standardizes mapping of exact Google Form response columns to application registration fields
 */
export function mapHeaderToApplicationField(rawHeader: string): string {
  const h = rawHeader.trim().toLowerCase();

  if (h.includes('timestamp') || h === 'time') {
    return 'source_submitted_at';
  }
  if (h === 'full name' || (h.includes('name') && !h.includes('father') && !h.includes('guardian') && !h.includes('emergency') && !h.includes('company') && !h.includes('college'))) {
    return 'full_name';
  }
  if (h === 'mobile number' || h === 'phone number' || (h.includes('mobile') || (h.includes('phone') && !h.includes('emergency')))) {
    return 'mobile_number';
  }
  if (h.includes('father') || h.includes('guardian')) {
    return 'guardian_name';
  }
  if (h.includes('emergency')) {
    return 'emergency_contact_number';
  }
  if (h.includes('aadhaar number') || h.includes('adhar number') || (h.includes('aadhaar') && !h.includes('card') && !h.includes('upload'))) {
    return 'aadhaar_number';
  }
  if (h.includes('adhar card') || h.includes('collage id') || h.includes('company id') || h.includes('document') || h.includes('proof')) {
    return 'identity_document_url';
  }
  if (h === 'occupation') {
    return 'occupation';
  }
  if (h.includes('occupation') && h.includes('type')) {
    return 'occupation_type';
  }
  if (h.includes('company or college') || h.includes('college name') || h.includes('company name')) {
    return 'company_or_college_name';
  }
  if (h.includes('room number') || h.includes('room')) {
    return 'requested_room_number';
  }
  if (h.includes('check in date') || h.includes('joining date') || h.includes('date')) {
    return 'check_in_date';
  }
  if (h.includes('security deposit') || h.includes('deposit')) {
    return 'security_deposit';
  }
  if (h.includes('declaration') || h.includes('accept') || h.includes('agree')) {
    return 'declaration_accepted';
  }

  return 'unmapped_field';
}

/**
 * Retrieves spreadsheet metadata and sheet tabs (Read-Only)
 */
export async function getSpreadsheetMetadata(spreadsheetId?: string): Promise<SpreadsheetMetadata> {
  const targetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
  if (!targetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not configured in environment variables.');
  }

  const auth = getGoogleAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.get({
    spreadsheetId: targetId,
  });

  const title = res.data.properties?.title || 'Untitled Spreadsheet';
  const sheetsList = (res.data.sheets || []).map((s) => ({
    sheetId: s.properties?.sheetId || 0,
    title: s.properties?.title || 'Sheet1',
    index: s.properties?.index || 0,
    rowCount: s.properties?.gridProperties?.rowCount || 0,
    columnCount: s.properties?.gridProperties?.columnCount || 0,
  }));

  return {
    title,
    spreadsheetId: targetId,
    sheets: sheetsList,
  };
}

/**
 * Retrieves the header row from a specific sheet/tab (Read-Only)
 */
export async function getSheetHeaders(
  spreadsheetId?: string,
  sheetName?: string
): Promise<{ sheetTitle: string; headers: string[]; fieldMapping: Record<string, string> }> {
  const targetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
  if (!targetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not configured in environment variables.');
  }

  const auth = getGoogleAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  let targetSheetTitle = sheetName;
  if (!targetSheetTitle) {
    const meta = await getSpreadsheetMetadata(targetId);
    if (!meta.sheets.length) {
      throw new Error('Spreadsheet contains no sheets/tabs.');
    }
    const responseSheet = meta.sheets.find((s) =>
      s.title.toLowerCase().includes('response') || s.title.toLowerCase().includes('form')
    );
    targetSheetTitle = responseSheet ? responseSheet.title : meta.sheets[0].title;
  }

  // Read Row 1
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: targetId,
    range: `'${targetSheetTitle}'!1:1`,
  });

  const rawHeaders = (res.data.values && res.data.values[0]) || [];
  const headers = rawHeaders.map((h: any) => String(h).trim());

  const fieldMapping: Record<string, string> = {};
  headers.forEach((h) => {
    fieldMapping[h] = mapHeaderToApplicationField(h);
  });

  return {
    sheetTitle: targetSheetTitle,
    headers,
    fieldMapping,
  };
}

/**
 * Retrieves sample row data for structure validation (Read-Only, limited rows)
 */
export async function getSampleRows(
  spreadsheetId?: string,
  sheetName?: string,
  limit: number = 3
): Promise<{ headers: string[]; sampleRows: string[][] }> {
  const targetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
  if (!targetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not configured in environment variables.');
  }

  const auth = getGoogleAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const { sheetTitle, headers } = await getSheetHeaders(targetId, sheetName);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: targetId,
    range: `'${sheetTitle}'!2:${limit + 1}`,
  });

  const sampleRows = (res.data.values || []) as string[][];

  return {
    headers,
    sampleRows,
  };
}
