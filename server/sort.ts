/** What ranked lists order by: play count or listening time. */
export type Sort = 'plays' | 'time';

export const DEFAULT_SORT: Sort = 'plays';

/** The `sort` query param. A missing one is the default, an unknown one an error. */
export function parseSort(value: unknown): Sort {
  if (value === undefined || value === '') return DEFAULT_SORT;
  if (value === 'plays' || value === 'time') return value;
  throw new Error('Invalid sort; expected plays or time');
}

/**
 * ORDER BY terms that rank groups by `sort`, highest first. The other figure breaks
 * ties, so a caller only appends its own key to make the order total.
 *
 * `plays` and `time` are the SQL for each figure over a group of scrobbles.
 */
export function rankBy(sort: Sort, plays = 'COUNT(*)', time = 'SUM(mf.duration)'): string {
  return sort === 'time' ? `${time} DESC, ${plays} DESC` : `${plays} DESC, ${time} DESC`;
}
