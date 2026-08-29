/**
 * Strict Date Parser for Google Sheets & Google Forms
 * Handles Indian (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YY), ISO (YYYY-MM-DD),
 * textual dates ("24 August 2026", "10 july 2026"), and Excel serial numbers.
 * 
 * CRITICAL RULE:
 * Produces an exact UTC Midnight Date (YYYY-MM-DDT00:00:00.000Z)
 * ZERO timezone drift: 28/08/2026 -> 2026-08-28 (NOT 2026-08-27 or 2026-08-29).
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export interface ParsedDateResult {
  isValid: boolean;
  date: Date | null;
  isoDateString: string | null; // "YYYY-MM-DD"
  formattedDisplay: string | null; // "28 Aug 2026"
  rawInput: string;
  error?: string;
}

/**
 * Creates a UTC Date from year, month (1-12), day (1-31) without timezone shift
 */
export function createUtcDate(year: number, month: number, day: number): Date | null {
  // Validate basic ranges
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Validate day count for month (handles leap years)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return new Date(`${year}-${mm}-${dd}T00:00:00.000Z`);
}

/**
 * Format Date object to exact YYYY-MM-DD
 */
export function formatToIsoDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format Date object for display (e.g. 28-08-2026)
 */
export function formatToIndianDisplayDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${d}-${m}-${y}`;
}

/**
 * Main strict parser function
 */
export function parseGoogleSheetDate(rawVal: any): ParsedDateResult {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return {
      isValid: false,
      date: null,
      isoDateString: null,
      formattedDisplay: null,
      rawInput: '',
      error: 'Empty date value',
    };
  }

  // If already a Date object
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const y = rawVal.getUTCFullYear();
    const m = rawVal.getUTCMonth() + 1;
    const d = rawVal.getUTCDate();
    const utcDate = createUtcDate(y, m, d);
    if (utcDate) {
      return {
        isValid: true,
        date: utcDate,
        isoDateString: formatToIsoDateOnly(utcDate),
        formattedDisplay: formatToIndianDisplayDate(utcDate),
        rawInput: rawVal.toISOString(),
      };
    }
  }

  // If Excel/Sheets serial number (e.g. 46262 = 2026-08-28)
  if (typeof rawVal === 'number' && rawVal > 30000 && rawVal < 60000) {
    // Excel epoch: Dec 30, 1899
    const msPerDay = 86400 * 1000;
    const excelEpochMs = Date.UTC(1899, 11, 30);
    const targetMs = excelEpochMs + Math.round(rawVal) * msPerDay;
    const dObj = new Date(targetMs);
    const y = dObj.getUTCFullYear();
    const m = dObj.getUTCMonth() + 1;
    const d = dObj.getUTCDate();
    const utcDate = createUtcDate(y, m, d);
    if (utcDate) {
      return {
        isValid: true,
        date: utcDate,
        isoDateString: formatToIsoDateOnly(utcDate),
        formattedDisplay: formatToIndianDisplayDate(utcDate),
        rawInput: String(rawVal),
      };
    }
  }

  const str = String(rawVal).trim();

  // Pattern 1: ISO Format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const date = createUtcDate(y, m, d);
    if (date) {
      return {
        isValid: true,
        date,
        isoDateString: formatToIsoDateOnly(date),
        formattedDisplay: formatToIndianDisplayDate(date),
        rawInput: str,
      };
    }
  }

  // Pattern 2: Indian / European Format DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, D/M/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) {
      y = y + 2000; // e.g. 26 -> 2026
    }
    const date = createUtcDate(y, m, d);
    if (date) {
      return {
        isValid: true,
        date,
        isoDateString: formatToIsoDateOnly(date),
        formattedDisplay: formatToIndianDisplayDate(date),
        rawInput: str,
      };
    }
  }

  // Pattern 3: Textual Month (e.g. "24 August 2026", "10 july 2026", "5 th july 2026", "5th July")
  const textMatch = str.match(/^(\d{1,2})(?:st|nd|rd|th|\s*th)?\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?/i);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const monthStr = textMatch[2].toLowerCase();
    const monthNum = MONTH_NAMES[monthStr];
    let y = textMatch[3] ? parseInt(textMatch[3], 10) : 2026;
    if (y < 100) y += 2000;

    if (monthNum) {
      const date = createUtcDate(y, monthNum, d);
      if (date) {
        return {
          isValid: true,
          date,
          isoDateString: formatToIsoDateOnly(date),
          formattedDisplay: formatToIndianDisplayDate(date),
          rawInput: str,
        };
      }
    }
  }

  // Unparseable / Invalid date
  return {
    isValid: false,
    date: null,
    isoDateString: null,
    formattedDisplay: null,
    rawInput: str,
    error: `Unable to safely parse date string "${str}" without ambiguity.`,
  };
}
