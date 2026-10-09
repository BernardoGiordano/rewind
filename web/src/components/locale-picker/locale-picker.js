import { availableLocales, computed, defineComponent, setLocale, SignalElement } from '@srljs/core';

/**
 * The language switch. `compact` drops the visible label for tight chrome, such as the
 * sign-in screen's top bar. srl stores the choice and re-renders the page in place.
 */
export class AppLocalePicker extends SignalElement {
  static properties = { compact: { type: Boolean } };

  compact = false;

  /** Each language named in itself, capitalized as a menu entry. */
  languages = computed(() =>
    availableLocales.value.map(({ code, label }) => ({
      code,
      label: label.charAt(0).toLocaleUpperCase(code) + label.slice(1),
    })),
  );

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block');
  }

  /** @param {string} code */
  choose(code) {
    void setLocale(code);
  }
}

await defineComponent({
  tag: 'app-locale-picker',
  element: AppLocalePicker,
  module: import.meta.url,
});
