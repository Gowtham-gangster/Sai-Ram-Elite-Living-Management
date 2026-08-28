export interface ResidentStats {
  totalResidents: number;
  activeResidents: number;
  noticePeriodResidents: number;
  checkedOutResidents: number;
  studentsCount: number;
  professionalsCount: number;
}

/**
 * Aggregates resident statistics across active, notice period, and checked-out statuses
 */
export function getResidentStatistics(residents: any[]): ResidentStats {
  let totalResidents = residents.length;
  let activeResidents = 0;
  let noticePeriodResidents = 0;
  let checkedOutResidents = 0;
  let studentsCount = 0;
  let professionalsCount = 0;

  for (const res of residents) {
    const status = (res.status || '').toUpperCase();
    if (status === 'ACTIVE') {
      activeResidents++;
    } else if (status === 'NOTICE_PERIOD') {
      noticePeriodResidents++;
    } else if (status === 'CHECKED_OUT' || status === 'CHECKED OUT' || status === 'VACATED') {
      checkedOutResidents++;
    }

    const occupation = (res.occupationType || res.occupation || '').toUpperCase();
    if (occupation.includes('STUDENT')) {
      studentsCount++;
    } else if (occupation.includes('PROFESSIONAL') || occupation.includes('WORKING')) {
      professionalsCount++;
    }
  }

  return {
    totalResidents,
    activeResidents,
    noticePeriodResidents,
    checkedOutResidents,
    studentsCount,
    professionalsCount,
  };
}

/**
 * Utility to securely mask Aadhaar number (e.g. "XXXX XXXX 1234")
 */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return 'Not Provided';
  const clean = aadhaar.replace(/\s+/g, '');
  if (clean.length < 4) return 'XXXX';
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
}
