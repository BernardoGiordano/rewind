import { MONTH_FULL, MONTH_SHORT, parseIsoDate } from '../utils/format';

/** The window of listening history a range-aware section reads. */
export type StatRange =
  | { kind: 'all-time' }
  | { kind: 'year'; year: string }
  | { kind: 'custom'; from: string; to: string };

export const ALL_TIME: StatRange = { kind: 'all-time' };

/**
 * The range as query params, `null` where the param does not apply.
 *
 * Angular's router drops null values, so the same object both writes the
 * current range and clears the params belonging to the other kinds.
 */
export interface RangeParams {
  year: string | null;
  from: string | null;
  to: string | null;
  range: string | null;
}

const YEAR = /^\d{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Anything with a `get`, so this reads an Angular ParamMap and a plain map alike. */
export interface ParamReader {
  get(name: string): string | null;
}

export function sameRange(a: StatRange, b: StatRange): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year;
  if (a.kind === 'custom' && b.kind === 'custom') return a.from === b.from && a.to === b.to;
  return true;
}

export function rangeToParams(range: StatRange): RangeParams {
  return {
    year: range.kind === 'year' ? range.year : null,
    from: range.kind === 'custom' ? range.from : null,
    to: range.kind === 'custom' ? range.to : null,
    range: range.kind === 'all-time' ? 'all-time' : null,
  };
}

/** The range a URL carries, or null when it carries none. Malformed values count as none. */
export function rangeFromParams(params: ParamReader): StatRange | null {
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

/** Whether a URL already carries `target`, so the sync can skip a redundant navigation. */
export function paramsMatch(current: Record<string, unknown>, target: RangeParams): boolean {
  const keys = Object.keys(target) as (keyof RangeParams)[];
  return keys.every((key) => (current[key] ?? null) === target[key]);
}

export function rangeLabel(range: StatRange, today = startOfToday()): string {
  if (range.kind === 'all-time') return 'All Time';
  if (range.kind === 'year') return range.year;
  return customRangeLabel(range.from, range.to, today);
}

/** Label for the 48 px rail, where the full one does not fit. */
export function rangeShortLabel(range: StatRange): string {
  if (range.kind === 'all-time') return 'All';
  if (range.kind === 'year') return range.year;
  return 'Custom';
}

/** Filename-safe form of the range, for exported cards. */
export function rangeSlug(range: StatRange): string {
  if (range.kind === 'all-time') return 'all-time';
  if (range.kind === 'year') return range.year;
  return `${range.from}_${range.to}`;
}

/**
 * Names a custom range the way a person would: the rolling and calendar windows
 * people actually pick get a word, everything else gets its dates.
 */
export function customRangeLabel(fromIso: string, toIso: string, today = startOfToday()): string {
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
    return 'Last Week';
  }

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  if (sameDate(from, lastMonthStart) && sameDate(to, lastMonthEnd)) return 'Last Month';

  // Any full calendar month
  if (
    from.getDate() === 1 &&
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  ) {
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    if (sameDate(to, monthEnd)) {
      const year = from.getFullYear();
      return year === currentYear
        ? MONTH_FULL[from.getMonth()]
        : `${MONTH_FULL[from.getMonth()]} ${year}`;
    }
  }

  const short = (d: Date) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  const withYear = (d: Date) => `${short(d)}, ${d.getFullYear()}`;

  if (from.getFullYear() === to.getFullYear()) {
    const year = from.getFullYear();
    if (year === currentYear) return `${short(from)} – ${short(to)}`;
    return `${short(from)} – ${short(to)}, ${year}`;
  }
  return `${withYear(from)} – ${withYear(to)}`;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function shiftDays(from: Date, days: number): Date {
  const out = new Date(from);
  out.setDate(out.getDate() + days);
  return out;
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
