import crypto from 'crypto';
import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/google/auth';
import { getSpreadsheetMetadata } from '@/lib/google/sheets';
import { prisma } from '@/lib/prisma';
import { parseGoogleSheetDate, formatToIsoDateOnly, formatToIndianDisplayDate } from './dateParser';
import { extractGoogleDriveDoc } from '@/lib/google/driveExtractor';

/**
 * EXACT CENTRALIZED GOOGLE SHEET HEADER MAPPING
 * Maps trimmed header strings directly to application fields.
 */
export const GOOGLE_SHEET_EXACT_HEADER_MAPPING: Record<string, string> = {
  'timestamp': 'source_submitted_at',
  'full name': 'full_name',
  'mobile number': 'mobile_number',
  "father's/guardian's name": 'guardian_name',
  "father's name": 'guardian_name',
  "guardian's name": 'guardian_name',
  'emergency contact number': 'emergency_contact_number',
  'emergency contact': 'emergency_contact_number',
  'aadhaar number': 'aadhaar_number',
  'aadhar number': 'aadhaar_number',
  'adhar number': 'aadhaar_number',
  'occupation': 'occupation',
  'company or college name': 'company_or_college_name',
  'company / college name': 'company_or_college_name',
  'room number': 'requested_room_number',
  'room number ': 'requested_room_number',
  'monthly rent': 'monthly_rent',
  'monthly rent ': 'monthly_rent',
  'rent': 'monthly_rent',
  'rent ': 'monthly_rent',
  'rent amount': 'monthly_rent',
  'check in date': 'check_in_date',
  'check in date ': 'check_in_date',
  'security deposit': 'security_deposit',
  'security deposit ': 'security_deposit',
  'adhaar card/ collage id / company id / any other id proof': 'identity_document_url',
  'adhaar card/ collage id/ company id/ any other id proof': 'identity_document_url',
  'aadhaar card/ college id / company id / any other id proof': 'identity_document_url',
  'aadhaar card/ collage id / company id / any other id proof': 'identity_document_url',
  'adhar card/ collage id/ company id': 'identity_document_url',
  'adhar card/ college id/ company id': 'identity_document_url',
  'aadhaar card/ college id/ company id': 'identity_document_url',
  'id proof': 'identity_document_url',
  'upload document': 'identity_document_url',
  'upload id proof': 'identity_document_url',
  'declaration': 'declaration_accepted',
};

export interface NormalizedSheetRow {
  rowIndex: number;
  sourceSubmittedAt: Date | null;
  rawSubmittedAtString: string;
  fullName: string;
  mobileNumber: string;
  guardianName: string | null;
  emergencyContactNumber: string | null;
  aadhaarNumber: string | null;
  occupation: string;
  occupationType: 'STUDENT' | 'WORKING_PROFESSIONAL' | 'OTHER';
  companyOrCollegeName: string | null;
  requestedRoomNumber: string | null;
  checkInDate: Date | null;
  rawCheckInDateString: string;
  monthlyRent: number | null;
  rawMonthlyRentString: string;
  securityDeposit: string | null;
  rawSecurityDepositString: string;
  identityDocumentUrl: string | null;
  declarationAccepted: boolean;
  rawSourceData: Record<string, any>;
  externalResponseId: string;
}

export interface SyncResult {
  success: boolean;
  status: 'SUCCESS' | 'SUCCESS_WITH_WARNINGS' | 'ERROR' | 'CONFIG_ERROR';
  rowsScanned: number;
  newCount: number;
  updatedCount: number;
  changesDetectedCount: number;
  roomChangeRequestsCount: number;
  skippedCount: number;
  validationErrorCount: number;
  systemErrorCount: number;
  errors: string[];
  durationMs: number;
  syncedAt: string;
  diagnostics?: Array<{
    rowIndex: number;
    fullName: string;
    mobileMasked: string;
    room: string;
    checkInDateIso: string | null;
    action: string;
  }>;
}

let isSyncRunning = false;

/**
 * Generates an immutable deterministic external response ID based purely on the original submission timestamp anchor.
 * This anchor NEVER changes even if the resident edits Full Name, Mobile, Room, Rent, Occupation, etc.
 */
export function generateDeterministicResponseId(
  timestamp: string,
  mobile?: string,
  fullName?: string,
  rowIndex?: number
): string {
  const cleanTime = (timestamp || '').trim();
  if (cleanTime) {
    const hash = crypto.createHash('sha256').update(`ts_${cleanTime}`).digest('hex').substring(0, 16);
    return `gform_${hash}`;
  }
  const cleanMobile = (mobile || '').replace(/[\s-]/g, '').trim();
  const cleanName = (fullName || '').trim().toLowerCase();
  const seed = `${cleanMobile}_${cleanName}_row${rowIndex || 0}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

/**
 * Legacy generator for backward compatibility lookup
 */
export function generateDeterministicLegacyId(
  timestamp: string,
  mobile: string,
  fullName: string
): string {
  const cleanMobile = (mobile || '').replace(/[\s-]/g, '').trim();
  const cleanName = (fullName || '').trim().toLowerCase();
  const cleanTime = (timestamp || '').trim();
  const seed = `${cleanTime}_${cleanMobile}_${cleanName}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `gform_${hash}`;
}

/**
 * Preserves exact Google Form short answer string for Security Deposit
 */
export function parseSecurityDeposit(raw: any): { value: string | null; raw: string } {
  if (raw === undefined || raw === null) {
    return { value: null, raw: '' };
  }
  const str = String(raw).trim();
  return { value: str.length > 0 ? str : null, raw: str };
}

/**
 * Parses numeric monthly rent safely from Google Sheet strings (e.g. "8000", "₹8000", "₹ 8,000", "8,000")
 */
export function parseMonthlyRent(raw: any): { amount: number | null; raw: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { amount: null, raw: '' };
  }
  const str = String(raw).trim();
  if (str === '' || /^(na|n\/a|nil|none|no|yes)$/i.test(str)) {
    return { amount: null, raw: str };
  }
  const cleanNumStr = str.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanNumStr);
  if (!isNaN(parsed) && parsed >= 0) {
    return { amount: parsed, raw: str };
  }
  return { amount: null, raw: str };
}
export async function synchronizeGoogleFormResponses(triggeredBy: string = 'SYSTEM'): Promise<SyncResult> {
  if (isSyncRunning) {
    throw new Error('A synchronization job is already running. Please wait for it to complete.');
  }

  isSyncRunning = true;
  const startTime = Date.now();
  const errors: string[] = [];
  const diagnostics: any[] = [];
  let rowsScanned = 0;
  let newCount = 0;
  let updatedCount = 0;
  let changesDetectedCount = 0;
  let roomChangeRequestsCount = 0;
  let skippedCount = 0;
  let validationErrorCount = 0;
  let systemErrorCount = 0;

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SPREADSHEET_ID is not configured in environment variables.');
    }

    const auth = getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Fetch Metadata & Response Sheet Tab
    const meta = await getSpreadsheetMetadata(spreadsheetId);
    let targetSheetTitle = 'Form Responses 1';
    const foundTab = meta.sheets.find((s) =>
      s.title.toLowerCase().includes('form response') || s.title.toLowerCase().includes('responses')
    );
    if (foundTab) {
      targetSheetTitle = foundTab.title;
    } else if (meta.sheets.length > 0) {
      targetSheetTitle = meta.sheets[0].title;
    }

    // 2. Read Header Row (Row 1)
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetTitle}'!1:1`,
    });

    const headers: string[] = headerRes.data.values ? headerRes.data.values[0] : [];
    if (!headers || headers.length === 0) {
      throw new Error(`No headers found in tab '${targetSheetTitle}'.`);
    }

    // Map headers to application field names
    const headerToFieldMap: Record<number, string> = {};
    const detectedFields: string[] = [];

    headers.forEach((headerText, colIdx) => {
      const normalizedHeader = String(headerText).trim().toLowerCase();
      let mappedField = GOOGLE_SHEET_EXACT_HEADER_MAPPING[normalizedHeader];

      // Flexible fallback for document upload variations
      if (!mappedField) {
        if (
          (normalizedHeader.includes('adhar') ||
            normalizedHeader.includes('aadhaar') ||
            normalizedHeader.includes('id proof') ||
            normalizedHeader.includes('card') ||
            normalizedHeader.includes('document')) &&
          !normalizedHeader.includes('number')
        ) {
          mappedField = 'identity_document_url';
        } else {
          mappedField = `col_${colIdx}`;
        }
      }

      headerToFieldMap[colIdx] = mappedField;
      if (mappedField && !mappedField.startsWith('col_')) {
        detectedFields.push(mappedField);
      }
    });

    // Validate Required Headers
    const requiredFields = ['full_name', 'mobile_number', 'requested_room_number', 'check_in_date'];
    const missingFields = requiredFields.filter((rf) => !detectedFields.includes(rf));

    if (missingFields.length > 0) {
      const errMessage = `Google Sheet structure has changed. Missing required columns: ${missingFields.join(
        ', '
      )}. Synchronization paused to prevent incorrect data mapping.`;

      return {
        success: false,
        status: 'CONFIG_ERROR',
        rowsScanned: 0,
        newCount: 0,
        updatedCount: 0,
        changesDetectedCount: 0,
        roomChangeRequestsCount: 0,
        skippedCount: 0,
        validationErrorCount: 1,
        systemErrorCount: 0,
        errors: [errMessage],
        durationMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      };
    }

    // 3. Fetch All Response Rows
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetTitle}'!A2:Z`,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rows = rowsRes.data.values || [];
    rowsScanned = rows.length;

    // Cache existing rooms for quick reference
    const allRooms = await prisma.room.findMany();
    const roomMapByNumber = new Map<string, any>(
      allRooms.map((r: any) => [r.roomNumber.trim().toUpperCase(), r])
    );

    // PERFORMANCE OPTIMIZATION: Single-Query Prefetching for Registrations
    // Eliminates 60+ sequential database network round-trips inside the row loop
    const existingRegistrationsList = await prisma.registration.findMany({
      where: { externalSource: 'GOOGLE_FORM' },
    });

    const regByResponseId = new Map<string, any>();
    const regByTimestamp = new Map<number, any>();
    const regByMobile = new Map<string, any>();

    for (const reg of existingRegistrationsList) {
      if (reg.externalResponseId) regByResponseId.set(reg.externalResponseId, reg);
      if (reg.sourceSubmittedAt) regByTimestamp.set(new Date(reg.sourceSubmittedAt).getTime(), reg);
      if (reg.mobileNumber) regByMobile.set(reg.mobileNumber, reg);
    }

    // 4. Process Each Row with ZERO Field Shifting & Robust Edit Detection
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1-indexed row number in spreadsheet

      // Build key-value map strictly from header indices
      const rawRowData: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        const fieldKey = headerToFieldMap[colIdx] || `col_${colIdx}`;
        rawRowData[fieldKey] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
      });

      const fullName = rawRowData.full_name ? String(rawRowData.full_name).trim() : '';
      // Skip completely empty rows
      if (!fullName) {
        skippedCount++;
        continue;
      }

      // Mobile Number normalization (preserve as string, clean whitespace/hyphens)
      const rawMobile = rawRowData.mobile_number ? String(rawRowData.mobile_number).trim() : '';
      const mobileNumber = rawMobile.replace(/[\s-]/g, '');

      if (!mobileNumber || mobileNumber.length < 10) {
        errors.push(`Row ${rowIndex} (${fullName}): Skipped due to invalid mobile number.`);
        validationErrorCount++;
        continue;
      }

      const guardianName = rawRowData.guardian_name ? String(rawRowData.guardian_name).trim() : null;
      const rawEmergency = rawRowData.emergency_contact_number ? String(rawRowData.emergency_contact_number).trim() : '';
      const emergencyContactNumber = rawEmergency ? rawEmergency.replace(/[\s-]/g, '') : null;

      // Aadhaar number normalization (digits only, never logged in plain text)
      const rawAadhaar = rawRowData.aadhaar_number ? String(rawRowData.aadhaar_number).replace(/\D/g, '') : null;
      const aadhaarNumber = rawAadhaar && rawAadhaar.length >= 10 ? rawAadhaar : null;

      // Occupation
      const occupation = rawRowData.occupation ? String(rawRowData.occupation).trim() : 'Student';
      const occupationUpper = occupation.toUpperCase();
      const occupationType: 'STUDENT' | 'WORKING_PROFESSIONAL' | 'OTHER' =
        occupationUpper.includes('STUDENT')
          ? 'STUDENT'
          : occupationUpper.includes('WORK') || occupationUpper.includes('PROF') || occupationUpper.includes('JOB')
          ? 'WORKING_PROFESSIONAL'
          : 'OTHER';

      const companyOrCollegeName = rawRowData.company_or_college_name
        ? String(rawRowData.company_or_college_name).trim()
        : null;

      // Room Number (preserve string "101", "A-101", etc.)
      const rawRoom = rawRowData.requested_room_number ? String(rawRowData.requested_room_number).trim() : '';
      const requestedRoomNumber = rawRoom ? rawRoom.replace(/^room\s*/i, '').trim() : null;

      // Strict Zero-Drift Check-In Date Parsing
      const rawCheckIn = rawRowData.check_in_date || '';
      const parsedDateResult = parseGoogleSheetDate(rawCheckIn);
      let checkInDate: Date | null = null;

      if (parsedDateResult.isValid && parsedDateResult.date) {
        checkInDate = parsedDateResult.date;
      } else if (rawCheckIn) {
        // Log warning for ambiguous historical date strings without stopping entire sync
        errors.push(`Row ${rowIndex} (${fullName}): Unparseable check-in date "${rawCheckIn}". Defaulted to current date.`);
        validationErrorCount++;
        checkInDate = new Date();
      } else {
        checkInDate = new Date();
      }

      // Monthly Rent Parsing
      const { amount: rentAmount } = parseMonthlyRent(rawRowData.monthly_rent);
      const monthlyRent = rentAmount !== null ? rentAmount : 0.0;

      // Security Deposit Mapping (Exact Short Answer String from Google Form)
      const { value: depositValue } = parseSecurityDeposit(rawRowData.security_deposit);
      const securityDeposit = depositValue;

      // Declaration Normalization
      const rawDecl = rawRowData.declaration_accepted ? String(rawRowData.declaration_accepted).toLowerCase() : '';
      const declarationAccepted =
        rawDecl.includes('confirm') ||
        rawDecl.includes('agree') ||
        rawDecl.includes('yes') ||
        rawDecl.includes('true') ||
        rawDecl.length > 0;

      // Google Drive Identity Document Link & File ID
      const rawIdentityDoc = rawRowData.identity_document_url
        ? String(rawRowData.identity_document_url).trim()
        : '';
      const docInfo = extractGoogleDriveDoc(rawIdentityDoc);
      const identityDocUrl = docInfo.viewUrl || (rawIdentityDoc.startsWith('http') ? rawIdentityDoc : null);
      const googleDriveFileId = docInfo.fileId;

      // Timestamp Parsing
      const timestampStr = rawRowData.source_submitted_at || '';
      const parsedTimestamp = parseGoogleSheetDate(timestampStr);
      const sourceSubmittedAt = parsedTimestamp.isValid && parsedTimestamp.date ? parsedTimestamp.date : new Date();

      // Compute Deterministic Identity Candidate & Legacy ID
      const candidateResponseId = generateDeterministicResponseId(
        timestampStr || `row_${rowIndex}`,
        mobileNumber,
        fullName,
        rowIndex
      );
      const legacyResponseId = generateDeterministicLegacyId(
        timestampStr || `row_${rowIndex}`,
        mobileNumber,
        fullName
      );

      // Multi-tier Fast In-Memory Identity Lookup (0 Network Roundtrips)
      // Priority 1: Match by exact externalResponseId (stable anchor or legacy ID)
      let existingRegistration =
        regByResponseId.get(candidateResponseId) ||
        regByResponseId.get(legacyResponseId);

      // Priority 2: Match by exact submission timestamp (if valid)
      if (!existingRegistration && parsedTimestamp.isValid && parsedTimestamp.date && timestampStr) {
        existingRegistration = regByTimestamp.get(parsedTimestamp.date.getTime());
      }

      // Priority 3: Fallback match by mobile number for Google Form registrations
      if (!existingRegistration && mobileNumber) {
        existingRegistration = regByMobile.get(mobileNumber);
      }

      if (!existingRegistration) {
        // CREATE NEW REGISTRATION (Status: NEW)
        const createdReg = await prisma.registration.create({
          data: {
            externalSource: 'GOOGLE_FORM',
            externalResponseId: candidateResponseId,
            fullName,
            mobileNumber,
            guardianName,
            emergencyContactNumber,
            aadhaarNumber,
            occupation,
            occupationType,
            companyOrCollegeName,
            requestedRoomNumber,
            checkInDate,
            monthlyRent,
            securityDeposit,
            declarationAccepted,
            declarationAcceptedAt: declarationAccepted ? new Date() : null,
            sourceSubmittedAt,
            identityDocumentUrl: identityDocUrl,
            googleDriveFileId,
            status: 'NEW',
            rawSourceData: JSON.stringify(rawRowData),
          },
        });

        regByResponseId.set(candidateResponseId, createdReg);
        if (sourceSubmittedAt) regByTimestamp.set(new Date(sourceSubmittedAt).getTime(), createdReg);
        if (mobileNumber) regByMobile.set(mobileNumber, createdReg);

        // Trigger in-app notification
        await prisma.notification.create({
          data: {
            type: 'INFO',
            title: 'New Registration Synchronized',
            message: `${fullName} submitted registration for Room ${requestedRoomNumber || 'N/A'}${monthlyRent > 0 ? ` (Rent: ₹${monthlyRent})` : ''}.`,
            linkUrl: '/registrations',
          },
        });

        diagnostics.push({
          rowIndex,
          fullName,
          mobileMasked: `******${mobileNumber.slice(-4)}`,
          room: requestedRoomNumber || 'N/A',
          checkInDateIso: checkInDate ? formatToIsoDateOnly(checkInDate) : null,
          action: 'CREATED_NEW',
        });

        newCount++;
      } else {
        // EXISTING REGISTRATION FOUND -> UPDATE IN-PLACE WITHOUT DUPLICATION
        const isDateChanged =
          existingRegistration.checkInDate && checkInDate
            ? formatToIsoDateOnly(existingRegistration.checkInDate) !== formatToIsoDateOnly(checkInDate)
            : (existingRegistration.checkInDate || null) !== (checkInDate || null);

        const isDocChanged =
          (existingRegistration.googleDriveFileId || null) !== (googleDriveFileId || null) ||
          (existingRegistration.identityDocumentUrl || null) !== (identityDocUrl || null);

        const changedFieldNames: string[] = [];

        if (existingRegistration.fullName !== fullName) changedFieldNames.push('Full Name');
        if (existingRegistration.mobileNumber !== mobileNumber) changedFieldNames.push('Mobile Number');
        if ((existingRegistration.guardianName || null) !== (guardianName || null)) changedFieldNames.push('Guardian Name');
        if ((existingRegistration.emergencyContactNumber || null) !== (emergencyContactNumber || null)) changedFieldNames.push('Emergency Contact');
        if ((existingRegistration.aadhaarNumber || null) !== (aadhaarNumber || null)) changedFieldNames.push('Aadhaar Number');
        if ((existingRegistration.occupation || null) !== (occupation || null)) changedFieldNames.push('Occupation');
        if ((existingRegistration.companyOrCollegeName || null) !== (companyOrCollegeName || null)) changedFieldNames.push('Company/College');
        if ((existingRegistration.requestedRoomNumber || null) !== (requestedRoomNumber || null)) changedFieldNames.push('Requested Room');
        if (existingRegistration.monthlyRent !== monthlyRent) changedFieldNames.push('Monthly Rent');
        if ((existingRegistration.securityDeposit || null) !== (securityDeposit || null)) changedFieldNames.push('Security Deposit');
        if (isDateChanged) changedFieldNames.push('Check-in Date');
        if (isDocChanged) changedFieldNames.push('Identity Document');

        const isChanged = changedFieldNames.length > 0;

        if (isChanged) {
          // Update Registration in-place, preserving externalResponseId, status, residentId, reviewedBy, etc.
          await prisma.registration.update({
            where: { id: existingRegistration.id },
            data: {
              fullName,
              mobileNumber,
              guardianName,
              emergencyContactNumber,
              aadhaarNumber,
              occupation,
              occupationType,
              companyOrCollegeName,
              requestedRoomNumber,
              checkInDate,
              monthlyRent,
              securityDeposit,
              declarationAccepted,
              identityDocumentUrl: identityDocUrl || existingRegistration.identityDocumentUrl,
              googleDriveFileId: googleDriveFileId || existingRegistration.googleDriveFileId,
              rawSourceData: JSON.stringify(rawRowData),
              updatedAt: new Date(),
            },
          });

          changesDetectedCount++;
          updatedCount++;

          // Create notification for updated registration with non-sensitive details
          await prisma.notification.create({
            data: {
              type: 'INFO',
              title: 'Registration Updated via Google Forms',
              message: `${fullName}'s submission was updated via Google Forms. Changed: ${changedFieldNames.join(', ')}${requestedRoomNumber ? ` (Room: ${requestedRoomNumber})` : ''}.`,
              linkUrl: `/registrations/${existingRegistration.id}`,
            },
          });

          diagnostics.push({
            rowIndex,
            fullName,
            mobileMasked: `******${mobileNumber.slice(-4)}`,
            room: requestedRoomNumber || 'N/A',
            checkInDateIso: checkInDate ? formatToIsoDateOnly(checkInDate) : null,
            action: `UPDATED (${changedFieldNames.join(', ')})`,
          });

          // APPROVED RESIDENT: Handle synchronized updates to linked resident record safely
          if (existingRegistration.status === 'APPROVED' && existingRegistration.residentId) {
            const linkedResident = await prisma.resident.findUnique({
              where: { id: existingRegistration.residentId },
              include: { room: true },
            });

            if (linkedResident) {
              const residentUpdates: any = {};
              if (fullName && fullName !== linkedResident.fullName) residentUpdates.fullName = fullName;
              if (mobileNumber && mobileNumber !== linkedResident.phone) residentUpdates.phone = mobileNumber;
              if (companyOrCollegeName && companyOrCollegeName !== linkedResident.address) residentUpdates.address = companyOrCollegeName;
              if (emergencyContactNumber && emergencyContactNumber !== linkedResident.emergencyContactPhone) residentUpdates.emergencyContactPhone = emergencyContactNumber;
              if (guardianName && guardianName !== linkedResident.emergencyContactName) residentUpdates.emergencyContactName = guardianName;
              if (aadhaarNumber && aadhaarNumber !== linkedResident.idProofNumber) residentUpdates.idProofNumber = aadhaarNumber;
              if (monthlyRent !== null && monthlyRent !== linkedResident.monthlyRent) residentUpdates.monthlyRent = monthlyRent;
              if (securityDeposit !== null && securityDeposit !== linkedResident.securityDeposit) residentUpdates.securityDeposit = securityDeposit;
              if (identityDocUrl && identityDocUrl !== linkedResident.identityDocumentUrl) residentUpdates.identityDocumentUrl = identityDocUrl;
              if (googleDriveFileId && googleDriveFileId !== linkedResident.googleDriveFileId) residentUpdates.googleDriveFileId = googleDriveFileId;

              if (Object.keys(residentUpdates).length > 0) {
                await prisma.resident.update({
                  where: { id: linkedResident.id },
                  data: residentUpdates,
                });
              }

              // High-risk Room Number Change: Create RoomChangeRequest (Do NOT auto-move resident or create duplicate)
              if (
                requestedRoomNumber &&
                linkedResident.room &&
                requestedRoomNumber.trim().toUpperCase() !== linkedResident.room.roomNumber.trim().toUpperCase()
              ) {
                const targetRoom = roomMapByNumber.get(requestedRoomNumber.trim().toUpperCase());
                if (targetRoom) {
                  const existingReq = await prisma.roomChangeRequest.findFirst({
                    where: {
                      residentId: linkedResident.id,
                      requestedRoomId: targetRoom.id,
                      status: 'PENDING',
                    },
                  });

                  if (!existingReq) {
                    await prisma.roomChangeRequest.create({
                      data: {
                        residentId: linkedResident.id,
                        currentRoomId: linkedResident.roomId,
                        requestedRoomId: targetRoom.id,
                        reason: 'Submitted via Google Form Response Edit',
                        source: 'GOOGLE_FORM',
                        status: 'PENDING',
                      },
                    });

                    await prisma.notification.create({
                      data: {
                        type: 'WARNING',
                        title: 'Room Change Request Submitted',
                        message: `${linkedResident.fullName} requested transfer from Room ${linkedResident.room.roomNumber} to Room ${targetRoom.roomNumber} via Google Form.`,
                        linkUrl: '/rooms',
                      },
                    });

                    roomChangeRequestsCount++;
                  }
                } else {
                  errors.push(`Row ${rowIndex} (${fullName}): Target Room ${requestedRoomNumber} not found.`);
                  validationErrorCount++;
                }
              }
            }
          }
        } else {
          // ZERO CHANGES DETECTED -> SKIP
          skippedCount++;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      status: errors.length === 0 ? 'SUCCESS' : 'SUCCESS_WITH_WARNINGS',
      rowsScanned,
      newCount,
      updatedCount,
      changesDetectedCount,
      roomChangeRequestsCount,
      skippedCount,
      validationErrorCount,
      systemErrorCount,
      errors,
      durationMs,
      syncedAt: new Date().toISOString(),
      diagnostics: diagnostics.slice(0, 20),
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    systemErrorCount++;

    try {
      await prisma.notification.create({
        data: {
          type: 'ALERT',
          title: 'Google Sheets Synchronization Failed',
          message: `Google Sheets sync encountered an error: ${err.message}`,
          linkUrl: '/registrations',
        },
      });
    } catch (_) {}

    return {
      success: false,
      status: 'ERROR',
      rowsScanned,
      newCount,
      updatedCount,
      changesDetectedCount,
      roomChangeRequestsCount,
      skippedCount,
      validationErrorCount,
      systemErrorCount,
      errors: [err.message],
      durationMs,
      syncedAt: new Date().toISOString(),
    };
  } finally {
    isSyncRunning = false;
  }
}
