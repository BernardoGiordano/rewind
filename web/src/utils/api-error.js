import { ApiError, t } from '@srljs/core';

/**
 * The message key for a failed API call.
 *
 * The server names each failure it expects with a code in `error`, and the bundles hold
 * a sentence for each under `errors.`. A code with no sentence, a network failure and
 * anything else read as `fallbackKey`. A screen keeps the key rather than the sentence,
 * so the message follows a language change.
 *
 * @param {unknown} cause
 * @param {string} fallbackKey
 * @returns {string}
 */
export function errorKey(cause, fallbackKey) {
  if (!(cause instanceof ApiError)) return fallbackKey;
  const key = `errors.${cause.code}`;
  return t(key) === key ? fallbackKey : key;
}
