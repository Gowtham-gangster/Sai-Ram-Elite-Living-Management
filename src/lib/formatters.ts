/**
 * Standard formatters for currency, dates, and sharing types
 * SAIRAM ELITE LIVING MANAGEMENT
 */

export * from './dateUtils';

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
