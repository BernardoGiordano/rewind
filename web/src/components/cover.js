import { defineComponent, inject, signal, SignalElement } from '@srljs/core';

import { NAVIDROME } from '../services/navidrome.js';

/** An album or artist cover that fills its frame, or nothing when it cannot load. */
export class AppCover extends SignalElement {
  static properties = {
    coverId: { attribute: false },
    size: { type: Number },
    eager: { type: Boolean },
  };

  /** @type {string | null | undefined} */
  coverId = undefined;
  size = 150;
  eager = false;

  /** A cover that failed to load leaves its tinted placeholder instead of a broken image. */
  #failedSrc = signal(/** @type {string | null} */ (null));

  get src() {
    return inject(NAVIDROME).coverUrl(this.coverId ?? '', this.size);
  }

  get visible() {
    return inject(NAVIDROME).coverArtAvailable.value && !!this.coverId && this.#failedSrc.value !== this.src;
  }

  failed() {
    this.#failedSrc.value = this.src;
  }
}

await defineComponent({ tag: 'app-cover', element: AppCover, module: import.meta.url });
