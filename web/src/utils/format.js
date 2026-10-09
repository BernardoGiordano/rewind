/**
 * Date formatting for an explicit locale. Models pass the locale they are given, and
 * templates reach these through `template-globals.js`, which passes the active one.
 */

/** Day names as the API sends them, in `Date#getDay` order. */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The patterns this app writes dates in. */
const DATE_STYLES = /** @type {const} */ ({
  month: { month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  monthShort: { month: 'short' },
  monthShortYear: { month: 'short', year: '2-digit' },
  dayMonth: { month: 'short', day: 'numeric' },
  dayMonthYear: { month: 'short', day: 'numeric', year: 'numeric' },
  weekday: { weekday: 'long' },
  weekdayShort: { weekday: 'short' },
});

/** @typedef {keyof typeof DATE_STYLES} DateStyle */

/**
 * Formatters by locale and style. Building one per call is measurable in a list.
 *
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const formats = new Map();

/**
 * @param {Date} date
 * @param {DateStyle} style
 * @param {string} locale
 * @returns {string}
 */
function format(date, style, locale) {
  const key = `${locale}|${style}`;
  let formatter = formats.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, DATE_STYLES[style]);
    formats.set(key, formatter);
  }
  return formatter.format(date);
}

/**
 * Upper-cases the first letter, so a label that starts with a month or a weekday reads
 * as a label in languages that write those in lower case.
 *
 * @param {string} text
 * @param {string} locale
 * @returns {string}
 */
function capitalize(text, locale) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

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
 * @param {string} locale
 * @returns {string}
 */
export function formatYearMonth(yearMonth, locale) {
  return formatMonthShort(parseIsoDate(`${yearMonth}-01`), locale);
}

/**
 * The month of `date` abbreviated, such as `"Jan"`.
 *
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
export function formatMonthShort(date, locale) {
  return capitalize(format(date, 'monthShort', locale), locale);
}

/**
 * `"2025-01"` as `"Jan 25"`.
 *
 * @param {string} yearMonth
 * @param {string} locale
 * @returns {string}
 */
export function formatYearMonthWithYear(yearMonth, locale) {
  return capitalize(format(parseIsoDate(`${yearMonth}-01`), 'monthShortYear', locale), locale);
}

/**
 * The month of `date`, such as `"March"`, or `"March 2024"` with its year.
 *
 * @param {Date} date
 * @param {string} locale
 * @param {boolean} withYear
 * @returns {string}
 */
export function formatMonth(date, locale, withYear) {
  return capitalize(format(date, withYear ? 'monthYear' : 'month', locale), locale);
}

/**
 * `"Mar 2"`.
 *
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
export function formatDayMonth(date, locale) {
  return format(date, 'dayMonth', locale);
}

/**
 * `"Mar 2, 2024"`.
 *
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
export function formatDayMonthYear(date, locale) {
  return format(date, 'dayMonthYear', locale);
}

/**
 * Weekday names from Monday, cut to `length` letters when given, as a calendar header
 * writes them.
 *
 * @param {string} locale
 * @param {number} [length]
 * @returns {string[]}
 */
export function weekdayNames(locale, length) {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const name = format(dayOfWeek(day), 'weekdayShort', locale);
    return capitalize(length === undefined ? name : name.slice(0, length), locale);
  });
}

/**
 * A day name the API sent, in `locale`. An unknown name comes back as it is.
 *
 * @param {string} name
 * @param {string} locale
 * @param {boolean} [short]
 * @returns {string}
 */
export function formatDayName(name, locale, short = false) {
  const day = DAY_NAMES.indexOf(name);
  if (day < 0) return name;
  return capitalize(format(dayOfWeek(day), short ? 'weekdayShort' : 'weekday', locale), locale);
}

/**
 * A date that falls on `day`, in `Date#getDay` numbering.
 *
 * @param {number} day
 * @returns {Date}
 */
function dayOfWeek(day) {
  // 7 January 2024 was a Sunday.
  return new Date(2024, 0, 7 + day);
}
