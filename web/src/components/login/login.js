import { defineComponent, inject, navigate, queryParams, signal, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { AppLocalePicker } from '../locale-picker/locale-picker.js';
import { AUTH } from '../../services/auth.js';
import { THEME } from '../../services/theme.js';
import { errorKey } from '../../utils/api-error.js';

/** The sign-in screen, for servers that let each user sign in with Navidrome credentials. */
export class Login extends SignalElement {
  #auth = inject(AUTH);
  #theme = inject(THEME);

  username = signal('');
  password = signal('');
  showPassword = signal(false);
  submitting = signal(false);
  /** A message key, so the error follows a language change. */
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
      this.error.value = 'login.missingCredentials';
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
        this.error.value = errorKey(cause, 'login.failed');
      },
    );
  }
}

await defineComponent({
  tag: 'app-login',
  element: Login,
  module: import.meta.url,
  uses: [AppIcon, AppLocalePicker],
});
