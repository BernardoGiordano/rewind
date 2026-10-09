import {
  formatDayMonth,
  formatDayMonthYear,
  formatMonth,
  parseIsoDate,
  toIsoDate,
} from '../utils/format.js';

/** @import { I18n, ParamReader, RangeParams, RangePreset, StatRange } from './types.js' */

/** @type {StatRange} */
export const ALL_TIME = { kind: 'all-time' };

const YEAR = /^\d{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {StatRange} a @param {StatRange} b @returns {boolean} */
export function sameRange(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year;
  if (a.kind === 'custom' && b.kind === 'custom') return a.from === b.from && a.to === b.to;
  return true;
}

/** @param {StatRange} range @returns {RangeParams} */
export function rangeToParams(range) {
  return {
    year: range.kind === 'year' ? range.year : null,
    from: range.kind === 'custom' ? range.from : null,
    to: range.kind === 'custom' ? range.to : null,
    range: range.kind === 'all-time' ? 'all-time' : null,
  };
}

/**
 * The range a URL carries, or null when it carries none. Malformed values count as none.
 *
 * @param {ParamReader} params
 * @returns {StatRange | null}
 */
export function rangeFromParams(params) {
  const from = params.get('from');
  const to = params.get('to');
  if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to)) {
    return { kind: 'custom', from, to };
  }

  const year = params.get('year');
  if (year && YEAR.test(year)) return { kind: 'year', year };

  if (params.get('range') === 'all-time') return ALL_TIME;
  return null;
}

/**
 * Whether a URL already carries `target`, so the sync can skip a redundant navigation.
 *
 * @param {Record<string, unknown>} current
 * @param {RangeParams} target
 * @returns {boolean}
 */
export function paramsMatch(current, target) {
  const keys = /** @type {(keyof RangeParams)[]} */ (Object.keys(target));
  return keys.every((key) => (current[key] ?? null) === target[key]);
}

/**
 * `search` with each key of `params` set, or removed where its value is null.
 *
 * @param {URLSearchParams} search
 * @param {Readonly<Record<string, string | null>>} params
 * @returns {URLSearchParams}
 */
export function mergeParams(search, params) {
  const next = new URLSearchParams(search);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/** @param {StatRange} range @param {I18n} i18n @param {Date} [today] @returns {string} */
export function rangeLabel(range, i18n, today = startOfToday()) {
  if (range.kind === 'all-time') return i18n.t('range.allTime');
  if (range.kind === 'year') return range.year;
  return customRangeLabel(range.from, range.to, i18n, today);
}

/**
 * Label for the 48 px rail, where the full one does not fit.
 *
 * @param {StatRange} range
 * @param {I18n} i18n
 * @returns {string}
 */
export function rangeShortLabel(range, i18n) {
  if (range.kind === 'all-time') return i18n.t('range.short.allTime');
  if (range.kind === 'year') return range.year;
  return i18n.t('range.short.custom');
}

/**
 * The relative windows people reach for, resolved against `today`.
 *
 * @param {Date} [today]
 * @returns {RangePreset[]}
 */
export function rangePresets(today = startOfToday()) {
  /** @param {Date} from @param {Date} to @returns {StatRange} */
  const custom = (from, to) => ({
    kind: 'custom',
    from: toIsoDate(from),
    to: toIsoDate(to),
  });
  const year = today.getFullYear();
  const month = today.getMonth();

  return [
    { labelKey: 'range.preset.allTime', range: ALL_TIME },
    { labelKey: 'range.preset.lastWeek', range: custom(shiftDays(today, -7), today) },
    { labelKey: 'range.preset.last30Days', range: custom(shiftDays(today, -30), today) },
    {
      labelKey: 'range.preset.lastMonth',
      range: custom(new Date(year, month - 1, 1), new Date(year, month, 0)),
    },
  ];
}

/**
 * Filename-safe form of the range, for exported cards.
 *
 * @param {StatRange} range
 * @returns {string}
 */
export function rangeSlug(range) {
  if (range.kind === 'all-time') return 'all-time';
  if (range.kind === 'year') return range.year;
  return `${range.from}_${range.to}`;
}

/**
 * Names a custom range the way a person would: the rolling and calendar windows
 * people actually pick get a word, everything else gets its dates.
 *
 * @param {string} fromIso
 * @param {string} toIso
 * @param {I18n} i18n
 * @param {Date} [today]
 * @returns {string}
 */
export function customRangeLabel(fromIso, toIso, i18n, today = startOfToday()) {
  const { t, locale } = i18n;
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const currentYear = today.getFullYear();

  // Rolling 7-day window ending today or yesterday
  const sevenAgo = shiftDays(today, -7);
  const yesterday = shiftDays(today, -1);
  const eightAgo = shiftDays(today, -8);
  if (
    (sameDate(from, sevenAgo) && sameDate(to, today)) ||
    (sameDate(from, eightAgo) && sameDate(to, yesterday))
  ) {
    return t('range.lastWeek');
  }

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  if (sameDate(from, lastMonthStart) && sameDate(to, lastMonthEnd)) return t('range.lastMonth');

  // Any full calendar month
  if (
    from.getDate() === 1 &&
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  ) {
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    if (sameDate(to, monthEnd)) return formatMonth(from, locale, from.getFullYear() !== currentYear);
  }

  if (from.getFullYear() === to.getFullYear()) {
    const span = { from: formatDayMonth(from, locale), to: formatDayMonth(to, locale) };
    const year = from.getFullYear();
    if (year === currentYear) return t('range.span', span);
    return t('range.spanInYear', { ...span, year: String(year) });
  }
  return t('range.span', {
    from: formatDayMonthYear(from, locale),
    to: formatDayMonthYear(to, locale),
  });
}

/** @returns {Date} */
function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** @param {Date} from @param {number} days @returns {Date} */
function shiftDays(from, days) {
  const out = new Date(from);
  out.setDate(out.getDate() + days);
  return out;
}

/** @param {Date} a @param {Date} b @returns {boolean} */
function sameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
