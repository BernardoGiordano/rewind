import { ApiClient, inject, navigate, token } from '@srljs/core';

import { AUTH } from './auth.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/** @type {InjectionToken<ApiClient>} */
export const API = token('Api');

/**
 * The client every service calls `/api` through.
 *
 * A 401 from the API means the session is gone. The transport forgets the user and
 * sends the page to the login screen, keeping the URL to come back to, unless the
 * failing call was the sign-in itself or the page already is the login screen.
 *
 * @returns {ApiClient}
 */
export function createApi() {
  return new ApiClient('/api', { fetch: signedOutRedirect });
}

/**
 * @param {string | URL | Request} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
async function signedOutRedirect(input, init) {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const path = new URL(input instanceof Request ? input.url : input, location.origin).pathname;
  inject(AUTH).clearLocal();
  const onLogin = location.pathname.startsWith('/login');
  if (!path.startsWith('/api/auth/') && !onLogin) {
    const here = location.pathname + location.search;
    void navigate(`/login?redirect=${encodeURIComponent(here)}`);
  }
  return response;
}
