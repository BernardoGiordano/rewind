export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatNum(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

export function padHour(h: number): string {
  return String(h).padStart(2, '0');
}

// "2025-01" → "Jan"
export function formatYearMonth(yearMonth: string): string {
  const [, m] = yearMonth.split('-');
  return MONTH_SHORT[parseInt(m, 10) - 1] ?? yearMonth;
}

// "2025-01" → "Jan 25"
export function formatYearMonthWithYear(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1] ?? m} ${y.slice(2)}`;
}
