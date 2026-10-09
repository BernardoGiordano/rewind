// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ALL_TIME,
  customRangeLabel,
  paramsMatch,
  rangeFromParams,
  rangeLabel,
  rangePresets,
  rangeShortLabel,
  rangeSlug,
  rangeToParams,
  sameRange,
} from '../web/src/models/range.js';
import type { StatRange } from '../web/src/models/types.js';

const reader = (params: Record<string, string>) => ({
  get: (name: string) => params[name] ?? null,
});

const YEAR: StatRange = { kind: 'year', year: '2024' };
const CUSTOM: StatRange = { kind: 'custom', from: '2024-03-01', to: '2024-03-31' };

describe('sameRange', () => {
  it('matches identical ranges of every kind', () => {
    expect(sameRange(ALL_TIME, { kind: 'all-time' })).toBe(true);
    expect(sameRange(YEAR, { kind: 'year', year: '2024' })).toBe(true);
    expect(sameRange(CUSTOM, { kind: 'custom', from: '2024-03-01', to: '2024-03-31' })).toBe(true);
  });

  it('separates different kinds', () => {
    expect(sameRange(ALL_TIME, YEAR)).toBe(false);
    expect(sameRange(YEAR, CUSTOM)).toBe(false);
  });

  it('separates different values of the same kind', () => {
    expect(sameRange(YEAR, { kind: 'year', year: '2023' })).toBe(false);
    expect(sameRange(CUSTOM, { kind: 'custom', from: '2024-03-01', to: '2024-04-30' })).toBe(false);
  });
});

describe('rangeToParams', () => {
  it('nulls the params the kind does not use, so a merge clears them', () => {
    expect(rangeToParams(YEAR)).toEqual({ year: '2024', from: null, to: null, range: null });
    expect(rangeToParams(CUSTOM)).toEqual({
      year: null,
      from: '2024-03-01',
      to: '2024-03-31',
      range: null,
    });
    expect(rangeToParams(ALL_TIME)).toEqual({
      year: null,
      from: null,
      to: null,
      range: 'all-time',
    });
  });
});

describe('rangeFromParams', () => {
  it('reads each kind back', () => {
    expect(rangeFromParams(reader({ year: '2024' }))).toEqual(YEAR);
    expect(rangeFromParams(reader({ from: '2024-03-01', to: '2024-03-31' }))).toEqual(CUSTOM);
    expect(rangeFromParams(reader({ range: 'all-time' }))).toEqual(ALL_TIME);
  });

  it('prefers a custom range over a year', () => {
    const params = reader({ year: '2024', from: '2023-01-01', to: '2023-12-31' });
    expect(rangeFromParams(params)).toEqual({
      kind: 'custom',
      from: '2023-01-01',
      to: '2023-12-31',
    });
  });

  it('round-trips every kind', () => {
    for (const range of [ALL_TIME, YEAR, CUSTOM]) {
      const params = rangeToParams(range);
      const read = rangeFromParams({ get: (name) => params[name as keyof typeof params] });
      expect(read).toEqual(range);
    }
  });

  it('returns null when the URL carries no range', () => {
    expect(rangeFromParams(reader({}))).toBeNull();
    expect(rangeFromParams(reader({ stat: 'top-songs' }))).toBeNull();
  });

  it('rejects malformed values rather than passing them to the API', () => {
    expect(rangeFromParams(reader({ year: 'last' }))).toBeNull();
    expect(rangeFromParams(reader({ year: '24' }))).toBeNull();
    expect(rangeFromParams(reader({ from: '2024-03-01', to: 'tomorrow' }))).toBeNull();
    expect(rangeFromParams(reader({ range: 'forever' }))).toBeNull();
  });

  it('needs both ends of a custom range', () => {
    expect(rangeFromParams(reader({ from: '2024-03-01' }))).toBeNull();
    expect(rangeFromParams(reader({ to: '2024-03-31' }))).toBeNull();
  });
});

describe('paramsMatch', () => {
  it('accepts a URL already carrying the range', () => {
    expect(paramsMatch({ year: '2024', stat: 'summary' }, rangeToParams(YEAR))).toBe(true);
  });

  it('rejects a URL with a stale param of another kind', () => {
    expect(paramsMatch({ year: '2024', range: 'all-time' }, rangeToParams(YEAR))).toBe(false);
  });

  it('rejects a URL missing the range', () => {
    expect(paramsMatch({}, rangeToParams(YEAR))).toBe(false);
  });
});

describe('rangeLabel', () => {
  const today = new Date(2026, 8, 14);

  it('names all-time and a year', () => {
    expect(rangeLabel(ALL_TIME)).toBe('All Time');
    expect(rangeLabel(YEAR)).toBe('2024');
  });

  it('names a rolling week ending today or yesterday', () => {
    expect(customRangeLabel('2026-09-07', '2026-09-14', today)).toBe('Last Week');
    expect(customRangeLabel('2026-09-06', '2026-09-13', today)).toBe('Last Week');
  });

  it('names the previous calendar month', () => {
    expect(customRangeLabel('2026-08-01', '2026-08-31', today)).toBe('Last Month');
  });

  it('names a full month, adding the year only when it is not this one', () => {
    expect(customRangeLabel('2026-03-01', '2026-03-31', today)).toBe('March');
    expect(customRangeLabel('2024-03-01', '2024-03-31', today)).toBe('March 2024');
  });

  it('falls back to dates, adding the year only when it is not this one', () => {
    expect(customRangeLabel('2026-03-02', '2026-03-20', today)).toBe('Mar 2 – Mar 20');
    expect(customRangeLabel('2024-03-02', '2024-03-20', today)).toBe('Mar 2 – Mar 20, 2024');
  });

  it('carries both years across a boundary', () => {
    expect(customRangeLabel('2024-12-20', '2025-01-10', today)).toBe('Dec 20, 2024 – Jan 10, 2025');
  });
});

describe('rangeShortLabel', () => {
  it('fits the rail', () => {
    expect(rangeShortLabel(ALL_TIME)).toBe('All');
    expect(rangeShortLabel(YEAR)).toBe('2024');
    expect(rangeShortLabel(CUSTOM)).toBe('Custom');
  });
});

describe('rangeSlug', () => {
  it('names an exported file', () => {
    expect(rangeSlug(ALL_TIME)).toBe('all-time');
    expect(rangeSlug(YEAR)).toBe('2024');
    expect(rangeSlug(CUSTOM)).toBe('2024-03-01_2024-03-31');
  });
});

describe('rangePresets', () => {
  const today = new Date(2026, 2, 15);

  it('resolves each window against today', () => {
    const ranges = Object.fromEntries(rangePresets(today).map((p) => [p.label, p.range]));
    expect(ranges['All time']).toEqual(ALL_TIME);
    expect(ranges['Last week']).toEqual({ kind: 'custom', from: '2026-03-08', to: '2026-03-15' });
    expect(ranges['Last 30 days']).toEqual({
      kind: 'custom',
      from: '2026-02-13',
      to: '2026-03-15',
    });
    expect(ranges['Last month']).toEqual({ kind: 'custom', from: '2026-02-01', to: '2026-02-28' });
  });

  it('labels each window the way the rest of the app names it', () => {
    const labels = rangePresets(today).map((p) => rangeLabel(p.range, today));
    expect(labels).toEqual(['All Time', 'Last Week', 'Feb 13 – Mar 15', 'Last Month']);
  });

  it('reaches back across a year boundary in January', () => {
    const january = new Date(2026, 0, 10);
    const lastMonth = rangePresets(january).find((p) => p.label === 'Last month')!.range;
    expect(lastMonth).toEqual({ kind: 'custom', from: '2025-12-01', to: '2025-12-31' });
  });
});
