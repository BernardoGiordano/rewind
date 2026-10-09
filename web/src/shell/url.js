import { navigate, navigationSettled } from '@srljs/core';

import { mergeParams } from '../models/range.js';

/** The last query update, so each one starts from the URL the previous one wrote. */
let queue = Promise.resolve();

/**
 * Merge `params` into the URL on screen and replace its history entry. A null value
 * removes its key.
 *
 * Updates run one after another, each once no navigation is in flight, and each reads
 * the address bar the previous one left. Two callers in a row, such as the range and
 * the stat changing together, therefore merge instead of the second undoing the
 * first. `applies` re-checks the page, because the user may have left it meanwhile.
 *
 * @param {Readonly<Record<string, string | null>>} params
 * @param {(path: string) => boolean} applies
 * @returns {Promise<void>}
 */
export function replaceQuery(params, applies) {
  const run = queue.then(() => apply(params, applies));
  queue = run.catch(() => {});
  return run;
}

/**
 * @param {Readonly<Record<string, string | null>>} params
 * @param {(path: string) => boolean} applies
 */
async function apply(params, applies) {
  await navigationSettled();
  const path = location.pathname;
  if (!applies(path)) return;

  const current = new URLSearchParams(location.search);
  const next = mergeParams(current, params);
  if (next.toString() === current.toString()) return;

  const query = next.toString();
  await navigate(query === '' ? path : `${path}?${query}`, { replace: true });
}
