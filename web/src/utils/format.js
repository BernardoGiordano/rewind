export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** @param {string} iso @returns {Date} */
export function parseIsoDate(iso) {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** @param {Date} d @returns {string} */
export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @param {number} h @returns {string} */
export function padHour(h) {
  return String(h).padStart(2, '0');
}

/**
 * `"2025-01"` as `"Jan"`.
 *
 * @param {string} yearMonth
 * @returns {string}
 */
export function formatYearMonth(yearMonth) {
  const [, m = ''] = yearMonth.split('-');
  return MONTH_SHORT[parseInt(m, 10) - 1] ?? yearMonth;
}

/**
 * `"2025-01"` as `"Jan 25"`.
 *
 * @param {string} yearMonth
 * @returns {string}
 */
export function formatYearMonthWithYear(yearMonth) {
  const [y = '', m = ''] = yearMonth.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1] ?? m} ${y.slice(2)}`;
}

/**
 * A number with between `minFraction` and `maxFraction` fraction digits, grouped in
 * thousands as en-US writes it.
 *
 * @param {number} value
 * @param {number} minFraction
 * @param {number} maxFraction
 * @returns {string}
 */
export function formatDecimal(value, minFraction, maxFraction) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });
}
