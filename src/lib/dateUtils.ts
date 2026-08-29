/**
 * Centralized Date Utilities
 * SAIRAM ELITE LIVING MANAGEMENT
 * 
 * Standard display format: DD-MM-YYYY (e.g. 29-08-2026)
 * Canonical database storage: Date / DateTime / Timestamp
 * Monthly receipt folder format: MMMM-YYYY (e.g. August-2026)
 */

/**
 * Formats a Date object, ISO string, timestamp number, or YYYY-MM-DD into "DD-MM-YYYY".
 * Returns fallback (default "—") if date is null, undefined, or invalid.
 */
export function formatDate(
  dateInput?: string | Date | number | null,
  fallback = '—'
): string {
  if (!dateInput && dateInput !== 0) return fallback;

  try {
    let d: Date;

    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return fallback;

      // Handle DD-MM-YYYY or DD/MM/YYYY directly
      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (ddmmyyyyMatch) {
        const day = ddmmyyyyMatch[1].padStart(2, '0');
        const month = ddmmyyyyMatch[2].padStart(2, '0');
        const year = ddmmyyyyMatch[3];
        return `${day}-${month}-${year}`;
      }

      // Handle YYYY-MM-DD
      const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (yyyymmddMatch) {
        const year = yyyymmddMatch[1];
        const month = yyyymmddMatch[2].padStart(2, '0');
        const day = yyyymmddMatch[3].padStart(2, '0');
        return `${day}-${month}-${year}`;
      }

      d = new Date(trimmed);
    } else if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      return fallback;
    }

    if (isNaN(d.getTime())) return fallback;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Alias for backward compatibility
 */
export function formatIndianDate(
  dateInput?: string | Date | number | null,
  fallback = '—'
): string {
  return formatDate(dateInput, fallback);
}

/**
 * Formats a Date object or string for HTML5 <input type="date"> ("YYYY-MM-DD")
 */
export function formatDateForInput(dateInput?: string | Date | number | null): string {
  if (!dateInput && dateInput !== 0) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Validates whether a day, month, and year form a legitimate calendar date
 */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Checks if a given year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Safely parses a DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD string into a valid Date object.
 * Avoids browser-specific parsing issues.
 */
export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);

    if (!isValidDate(day, month, year)) return null;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }

  // Check YYYY-MM-DD
  const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);

    if (!isValidDate(day, month, year)) return null;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }

  // Fallback to standard ISO Date
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a billing month or folder name into "MMMM-YYYY" (e.g. "August-2026")
 * specifically for Google Drive receipt folder hierarchy.
 */
export function formatFolderMonth(dateInput?: string | Date | null): string {
  if (!dateInput) return 'General';
  try {
    let d: Date;
    if (typeof dateInput === 'string') {
      if (/^\d{4}-\d{2}$/.test(dateInput)) {
        const [year, month] = dateInput.split('-').map(Number);
        d = new Date(year, month - 1, 1);
      } else {
        d = new Date(dateInput);
      }
    } else {
      d = dateInput;
    }

    if (isNaN(d.getTime())) return 'General';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return 'General';
  }
}
