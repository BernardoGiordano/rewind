import { STAT_DEFINITIONS } from '../../models/stats.js';

/** @import { StatDefinition, StatType } from '../../models/types.js' */

/** Query param carrying the selection, so a single card can be linked to. */
export const STAT_PARAM = 'stat';

/**
 * Stats a range can show. All-time has no calendar to bucket year-only stats into.
 *
 * @param {readonly StatDefinition[]} defs
 * @param {boolean} allTime
 * @returns {StatDefinition[]}
 */
export function statsForRange(defs, allTime) {
  return defs.filter((d) => !d.yearOnly || !allTime);
}

/**
 * The stat `delta` places from `current`, wrapping at both ends.
 *
 * @param {readonly StatDefinition[]} list
 * @param {StatType} current
 * @param {number} delta
 * @returns {StatType}
 */
export function stepStat(list, current, delta) {
  if (list.length === 0) return current;
  const at = list.findIndex((d) => d.type === current);
  const from = at >= 0 ? at : 0;
  const next = (((from + delta) % list.length) + list.length) % list.length;
  return list[next]?.type ?? current;
}

/**
 * @param {string | null | undefined} value
 * @returns {value is StatType}
 */
export function isStatType(value) {
  return value !== null && value !== undefined && STAT_DEFINITIONS.some((d) => d.type === value);
}
