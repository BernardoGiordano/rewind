import { STAT_DEFINITIONS, type StatDefinition, type StatType } from '../../models/stats';

/** Query param carrying the selection, so a single card can be linked to. */
export const STAT_PARAM = 'stat';

/** Stats a range can show. All-time has no calendar to bucket year-only stats into. */
export function statsForRange(defs: readonly StatDefinition[], allTime: boolean): StatDefinition[] {
  return defs.filter((d) => !d.yearOnly || !allTime);
}

/** The stat `delta` places from `current`, wrapping at both ends. */
export function stepStat(
  list: readonly StatDefinition[],
  current: StatType,
  delta: number,
): StatType {
  if (list.length === 0) return current;
  const at = list.findIndex((d) => d.type === current);
  const from = at >= 0 ? at : 0;
  const next = (((from + delta) % list.length) + list.length) % list.length;
  return list[next].type;
}

export function isStatType(value: string | null | undefined): value is StatType {
  return value !== null && value !== undefined && STAT_DEFINITIONS.some((d) => d.type === value);
}
