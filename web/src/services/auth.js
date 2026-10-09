import { ApiError, computed, inject, signal, token } from '@srljs/core';

import { API } from './api.js';
import { NAVIDROME } from './navidrome.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/**
 * @typedef {'env' | 'session'} AuthMode
 * @typedef {{ username: string, mode: AuthMode }} AuthUser
 */

/** @type {InjectionToken<AuthService>} */
export const AUTH = token('Auth');

/**
 * Who is signed in, as the server tells it. `env` mode signs in from the server's
 * configuration and has no session to end.
 */
export class AuthService {
  #user = signal(/** @type {AuthUser | null} */ (null));
  #bootstrapped = signal(false);

  /** @type {Promise<AuthUser | null> | null} */
  #pending = null;

  user = computed(() => this.#user.value);
  bootstrapped = computed(() => this.#bootstrapped.value);
  isAuthenticated = computed(() => this.#user.value !== null);
  canLogout = computed(() => this.#user.value?.mode === 'session');

  /**
   * Read the current user from the server, once at a time.
   *
   * @returns {Promise<AuthUser | null>}
   */
  bootstrap() {
    this.#pending ??= this.#fetchUser().finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  /** @returns {Promise<AuthUser | null>} */
  async #fetchUser() {
    try {
      const user = /** @type {AuthUser} */ (await inject(API).get('/auth/me'));
      this.#user.value = user;
      return user;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        this.#user.value = null;
        return null;
      }
      throw cause;
    } finally {
      this.#bootstrapped.value = true;
    }
  }

  /**
   * @param {string} username
   * @param {string} password
   * @returns {Promise<AuthUser>}
   */
  async login(username, password) {
    const user = /** @type {AuthUser} */ (
      await inject(API).post('/auth/login', { username, password })
    );
    this.#signedIn(user);
    return user;
  }

  /** @returns {Promise<void>} */
  async logout() {
    await inject(API).post('/auth/logout', {});
    this.#signedIn(null);
  }

  /** Forget a session-mode user locally, after a 401 from any endpoint. */
  clearLocal() {
    if (this.#user.value?.mode === 'session') this.#signedIn(null);
  }

  /** @param {AuthUser | null} user */
  #signedIn(user) {
    inject(NAVIDROME).forgetHistory();
    this.#user.value = user;
  }
}
