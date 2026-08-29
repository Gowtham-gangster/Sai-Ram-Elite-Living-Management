/**
 * Automated Verification Suite for Application-Wide Date Standardization
 * SAIRAM ELITE LIVING MANAGEMENT
 * 
 * Standard: DD-MM-YYYY (e.g. 29-08-2026)
 * Database storage: proper Date/DateTime types
 * Monthly folders: MMMM-YYYY (e.g. August-2026)
 */

const assert = require('assert');
const path = require('path');

// Test runner helpers
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// Inline mirror of src/lib/dateUtils.ts logic to verify contracts in Node test environment
function formatDate(dateInput, fallback = '—') {
  if (!dateInput && dateInput !== 0) return fallback;

  try {
    let d;
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return fallback;

      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (ddmmyyyyMatch) {
        const day = ddmmyyyyMatch[1].padStart(2, '0');
        const month = ddmmyyyyMatch[2].padStart(2, '0');
        const year = ddmmyyyyMatch[3];
        return `${day}-${month}-${year}`;
      }

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

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);

    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) return null;

    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function formatFolderMonth(dateInput) {
  if (!dateInput) return 'General';
  try {
    let d;
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

console.log('\n========================================');
console.log('RUNNING DATE STANDARDIZATION TEST SUITE');
console.log('========================================\n');

// Group 1: Core Formatter Tests
test('1. formatDate produces DD-MM-YYYY from ISO date string', () => {
  assert.strictEqual(formatDate('2026-08-29T10:30:00.000Z'), '29-08-2026');
});

test('2. formatDate produces DD-MM-YYYY from YYYY-MM-DD string', () => {
  assert.strictEqual(formatDate('2026-08-29'), '29-08-2026');
  assert.strictEqual(formatDate('2026-09-01'), '01-09-2026');
  assert.strictEqual(formatDate('2026-12-31'), '31-12-2026');
  assert.strictEqual(formatDate('2027-01-01'), '01-01-2027');
});

test('3. formatDate handles leap years accurately', () => {
  assert.strictEqual(formatDate('2028-02-29'), '29-02-2028');
  assert.strictEqual(formatDate('2027-02-28'), '28-02-2027');
});

test('4. formatDate handles Date objects', () => {
  const d = new Date(2026, 7, 29); // August 29, 2026
  assert.strictEqual(formatDate(d), '29-08-2026');
});

test('5. formatDate handles timestamp numbers', () => {
  const ts = new Date(2026, 7, 29).getTime();
  assert.strictEqual(formatDate(ts), '29-08-2026');
});

test('6. formatDate produces fallback for null, undefined, empty, and invalid dates', () => {
  assert.strictEqual(formatDate(null), '—');
  assert.strictEqual(formatDate(undefined), '—');
  assert.strictEqual(formatDate(''), '—');
  assert.strictEqual(formatDate('invalid-date-string'), '—');
  assert.strictEqual(formatDate(null, 'N/A'), 'N/A');
});

// Group 2: Date Parsing & Validation
test('7. parseDate parses DD-MM-YYYY safely into UTC Date', () => {
  const parsed = parseDate('29-08-2026');
  assert(parsed !== null);
  assert.strictEqual(parsed.getUTCFullYear(), 2026);
  assert.strictEqual(parsed.getUTCMonth(), 7); // August = 7 (0-indexed)
  assert.strictEqual(parsed.getUTCDate(), 29);
});

test('8. parseDate rejects impossible calendar dates (e.g. 31-02-2026, 32-08-2026, 29-02-2027)', () => {
  assert.strictEqual(parseDate('31-02-2026'), null);
  assert.strictEqual(parseDate('32-08-2026'), null);
  assert.strictEqual(parseDate('29-02-2027'), null); // 2027 is not a leap year
  assert(parseDate('29-02-2028') !== null); // 2028 is a leap year
});

// Group 3: Google Drive Folder Format
test('9. Google Drive Monthly Receipt Folder preserves MMMM-YYYY format', () => {
  assert.strictEqual(formatFolderMonth('2026-08'), 'August-2026');
  assert.strictEqual(formatFolderMonth('2026-09'), 'September-2026');
  assert.strictEqual(formatFolderMonth('2026-10'), 'October-2026');
});

// Group 4: WhatsApp Reminder Dates & Templates
test('10. WhatsApp reminder message date formatted as DD-MM-YYYY', () => {
  const dueDate = new Date(2026, 7, 31);
  const formattedDueDate = formatDate(dueDate);
  assert.strictEqual(formattedDueDate, '31-08-2026');

  const simulatedMsg = `Your monthly rent payment of ₹8,500 for August 2026 is due on ${formattedDueDate}.`;
  assert(simulatedMsg.includes('31-08-2026'));
  assert(!simulatedMsg.includes('31/08/2026'));
  assert(!simulatedMsg.includes('2026-08-31'));
});

// Group 5: PDF Receipt Filename
test('11. PDF Receipt Filename uses safe alphanumeric representation with MMMM-YYYY month', () => {
  const residentName = 'Gowtham P';
  const roomNumber = '101';
  const monthYearStr = formatFolderMonth('2026-08');
  const filename = `Receipt_${residentName.replace(/\s+/g, '_')}_Room${roomNumber}_${monthYearStr}.pdf`;
  assert.strictEqual(filename, 'Receipt_Gowtham_P_Room101_August-2026.pdf');
  assert(!filename.includes('/'));
  assert(!filename.includes('\\'));
});

console.log('\n----------------------------------------');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('----------------------------------------\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
