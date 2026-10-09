import { ApiError, defineComponent, inject, navigate, queryParams, signal, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { AUTH } from '../../services/auth.js';
import { THEME } from '../../services/theme.js';

/** The sign-in screen, for servers that let each user sign in with Navidrome credentials. */
export class Login extends SignalElement {
  #auth = inject(AUTH);
  #theme = inject(THEME);

  username = signal('');
  password = signal('');
  showPassword = signal(false);
  submitting = signal(false);
  error = signal(/** @type {string | null} */ (null));
  darkMode = this.#theme.dark;

  toggleDarkMode() {
    this.#theme.toggle();
  }

  togglePassword() {
    this.showPassword.value = !this.showPassword.value;
  }

  /** @param {string} value */
  setUsername(value) {
    this.username.value = value;
  }

  /** @param {string} value */
  setPassword(value) {
    this.password.value = value;
  }

  /** @param {Event} event */
  submit(event) {
    event.preventDefault();
    const username = this.username.value.trim();
    const password = this.password.value;
    if (!username || !password) {
      this.error.value = 'Please enter both username and password.';
      return;
    }
    this.error.value = null;
    this.submitting.value = true;
    this.#auth.login(username, password).then(
      () => {
        this.submitting.value = false;
        const redirect = queryParams.value.get('redirect') ?? '/';
        const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
        void navigate(safe);
      },
      (cause) => {
        this.submitting.value = false;
        this.error.value = loginError(cause);
      },
    );
  }
}

/**
 * The server's own reason when it gave one.
 *
 * @param {unknown} cause
 * @returns {string}
 */
function loginError(cause) {
  if (cause instanceof ApiError) {
    const body = /** @type {{ error?: unknown } | null | undefined} */ (cause.body);
    if (typeof body?.error === 'string') return body.error;
  }
  return cause instanceof Error ? cause.message : 'Login failed';
}

await defineComponent({ tag: 'app-login', element: Login, module: import.meta.url, uses: [AppIcon] });
