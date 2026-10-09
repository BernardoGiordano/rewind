import { inject } from '@srljs/core';

import { AUTH } from '../services/auth.js';

/** @import { RouteMatch } from '@core/navigation/types.js' */

/**
 * Signed-in visitors pass. Anyone else goes to the login screen, which brings them
 * back here afterwards.
 *
 * @param {RouteMatch} match
 * @returns {Promise<true | string>}
 */
export async function authGuard(match) {
  if (await signedIn()) return true;
  const query = match.query.toString();
  const here = query === '' ? match.pathname : `${match.pathname}?${query}`;
  return `/login?redirect=${encodeURIComponent(here)}`;
}

/**
 * The login screen is for signed-out visitors only.
 *
 * @returns {Promise<true | string>}
 */
export async function loginGuard() {
  return (await signedIn()) ? '/' : true;
}

/** @returns {Promise<boolean>} */
async function signedIn() {
  const auth = inject(AUTH);
  if (!auth.bootstrapped.value) await auth.bootstrap().catch(() => null);
  return auth.isAuthenticated.value;
}
