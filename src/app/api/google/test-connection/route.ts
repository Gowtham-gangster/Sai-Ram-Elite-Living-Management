import { NextRequest, NextResponse } from 'next/server';
import { getSpreadsheetMetadata, getSheetHeaders } from '@/lib/google/sheets';
import { verifyDriveAccess } from '@/lib/google/drive';

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return NextResponse.json({
        connected: false,
        status: 'CONFIGURATION_REQUIRED',
        message: 'Google Service Account credentials or Spreadsheet ID are not configured in environment variables.',
        requiredVariables: [
          'GOOGLE_SPREADSHEET_ID',
          'GOOGLE_SERVICE_ACCOUNT_EMAIL',
          'GOOGLE_PRIVATE_KEY',
        ],
      });
    }

    // 1. Fetch metadata and headers (Read-Only)
    const metadata = await getSpreadsheetMetadata(spreadsheetId);
    const { sheetTitle, headers } = await getSheetHeaders(spreadsheetId);

    // 2. Map headers to application registration fields
    const fieldMapping: Record<string, string> = {};
    headers.forEach((header) => {
      const h = header.toLowerCase();
      let appField = 'custom_field';

      if (h.includes('timestamp') || h.includes('time')) {
        appField = 'source_submitted_at';
      } else if (
        h.includes('name') &&
        (h.includes('full') ||
          (!h.includes('father') &&
            !h.includes('guardian') &&
            !h.includes('emergency') &&
            !h.includes('college') &&
            !h.includes('company')))
      ) {
        appField = 'full_name';
      } else if (
        h.includes('mobile') ||
        ((h.includes('phone') || h.includes('contact')) &&
          !h.includes('emergency') &&
          !h.includes('guardian'))
      ) {
        appField = 'mobile_number';
      } else if (h.includes('father') || h.includes('guardian')) {
        appField = 'guardian_name';
      } else if (h.includes('emergency')) {
        appField = 'emergency_contact_number';
      } else if (h.includes('aadhaar') || h.includes('aadhar')) {
        appField = 'aadhaar_number';
      } else if (h.includes('occupation') && !h.includes('type')) {
        appField = 'occupation';
      } else if (h.includes('occupation') && h.includes('type')) {
        appField = 'occupation_type';
      } else if (
        h.includes('college') ||
        h.includes('company') ||
        h.includes('workplace') ||
        h.includes('institution')
      ) {
        appField = 'company_or_college_name';
      } else if (h.includes('room')) {
        appField = 'requested_room_number';
      } else if (
        h.includes('check-in') ||
        h.includes('joining') ||
        h.includes('admission') ||
        h.includes('date')
      ) {
        appField = 'check_in_date';
      } else if (h.includes('deposit') || h.includes('security')) {
        appField = 'security_deposit';
      } else if (
        h.includes('declaration') ||
        h.includes('agree') ||
        h.includes('rule') ||
        h.includes('accept')
      ) {
        appField = 'declaration_accepted';
      } else if (
        h.includes('id') ||
        h.includes('upload') ||
        h.includes('proof') ||
        h.includes('document') ||
        h.includes('card')
      ) {
        appField = 'identity_document_url';
      }

      fieldMapping[header] = appField;
    });

    // 3. Test Drive read access
    const driveVerification = await verifyDriveAccess();

    return NextResponse.json({
      connected: true,
      status: 'SUCCESS',
      spreadsheetTitle: metadata.title,
      sheetTabs: metadata.sheets.map((s) => s.title),
      responseSheetIdentified: sheetTitle,
      headers,
      fieldMapping,
      driveAccess: driveVerification,
    });
  } catch (error: any) {
    console.error('Google connection test error:', error);
    return NextResponse.json(
      {
        connected: false,
        status: 'CONNECTION_ERROR',
        error: error.message || 'Failed to connect to Google Sheets / Google Drive API.',
      },
      { status: 500 }
    );
  }
}
