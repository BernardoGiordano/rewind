// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSort, rankBy } from '../server/sort.ts';

describe('parseSort', () => {
  it('defaults to plays when the param is missing', () => {
    expect(parseSort(undefined)).toBe('plays');
    expect(parseSort('')).toBe('plays');
  });

  it('accepts plays and time', () => {
    expect(parseSort('plays')).toBe('plays');
    expect(parseSort('time')).toBe('time');
  });

  it('refuses any other value, including a repeated param', () => {
    expect(() => parseSort('minutes')).toThrow();
    expect(() => parseSort(['time', 'plays'])).toThrow();
  });
});

describe('rankBy', () => {
  it('leads with the sorted figure and breaks ties on the other', () => {
    expect(rankBy('plays')).toBe('COUNT(*) DESC, SUM(mf.duration) DESC');
    expect(rankBy('time')).toBe('SUM(mf.duration) DESC, COUNT(*) DESC');
    expect(rankBy('time', 'plays', 'duration')).toBe('duration DESC, plays DESC');
  });
});
