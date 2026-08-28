/**
 * Standard formatters for currency, dates, and sharing types
 */

export function formatSharingType(type?: string | null): string {
  if (!type) return '';
  const upper = type.toUpperCase();
  if (upper === 'DORMITORY') return '5 Sharing';
  if (upper === 'SINGLE') return 'Single';
  if (upper === 'DOUBLE') return '2 Sharing';
  if (upper === 'TRIPLE') return '3 Sharing';
  if (upper === 'FOUR_SHARE') return '4 Sharing';
  return type.replace('_', ' ');
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatIndianDate(dateInput?: string | Date | null): string {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
