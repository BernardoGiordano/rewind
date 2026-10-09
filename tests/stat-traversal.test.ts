// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { STAT_DEFINITIONS } from '../web/src/models/stats.js';
import type { StatDefinition } from '../web/src/models/types.js';
import {
  isStatType,
  statsForRange,
  stepStat,
} from '../web/src/components/dashboard/stat-traversal.js';

const list = (...types: string[]): StatDefinition[] =>
  types.map((type) => STAT_DEFINITIONS.find((d) => d.type === type)!);

describe('statsForRange', () => {
  it('hides year-only stats on all-time', () => {
    const shown = statsForRange(STAT_DEFINITIONS, true);
    expect(shown.every((d) => !d.yearOnly)).toBe(true);
    expect(shown.length).toBeLessThan(STAT_DEFINITIONS.length);
  });

  it('shows every stat on a bounded range', () => {
    expect(statsForRange(STAT_DEFINITIONS, false)).toHaveLength(STAT_DEFINITIONS.length);
  });

  it('keeps the declared order', () => {
    const shown = statsForRange(STAT_DEFINITIONS, true).map((d) => d.type);
    const expected = STAT_DEFINITIONS.filter((d) => !d.yearOnly).map((d) => d.type);
    expect(shown).toEqual(expected);
  });
});

describe('stepStat', () => {
  const three = list('summary', 'top-songs', 'top-artists');

  it('steps forward', () => {
    expect(stepStat(three, 'summary', 1)).toBe('top-songs');
  });

  it('steps back', () => {
    expect(stepStat(three, 'top-songs', -1)).toBe('summary');
  });

  it('wraps past the end', () => {
    expect(stepStat(three, 'top-artists', 1)).toBe('summary');
  });

  it('wraps before the start', () => {
    expect(stepStat(three, 'summary', -1)).toBe('top-artists');
  });

  it('treats a stat outside the list as position zero', () => {
    expect(stepStat(three, 'streak', 1)).toBe('top-songs');
  });

  it('returns the current stat for an empty list', () => {
    expect(stepStat([], 'summary', 1)).toBe('summary');
  });

  it('returns the only stat in a single-entry list', () => {
    expect(stepStat(list('summary'), 'summary', 1)).toBe('summary');
  });

  it('visits every stat exactly once per lap', () => {
    const all = statsForRange(STAT_DEFINITIONS, false);
    const seen: string[] = [];
    let current = all[0].type;
    for (let i = 0; i < all.length; i++) {
      seen.push(current);
      current = stepStat(all, current, 1);
    }
    expect(new Set(seen).size).toBe(all.length);
    expect(current).toBe(all[0].type);
  });
});

describe('isStatType', () => {
  it('accepts a defined stat', () => {
    expect(isStatType('top-albums')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isStatType('nope')).toBe(false);
    expect(isStatType(null)).toBe(false);
    expect(isStatType(undefined)).toBe(false);
  });
});
