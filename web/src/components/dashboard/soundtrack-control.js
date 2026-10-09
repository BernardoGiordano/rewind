import { computed, defineComponent, inject, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { SOUNDTRACK } from './soundtrack.js';

/** Mutes the recap's music. The volume slider slides out on hover. */
export class SoundtrackControl extends SignalElement {
  #soundtrack = inject(SOUNDTRACK);

  available = this.#soundtrack.available;
  playing = this.#soundtrack.playing;
  song = this.#soundtrack.song;

  /** The slider's value, which an input holds as text. */
  volume = computed(() => String(this.#soundtrack.volume.value));

  toggle() {
    this.#soundtrack.toggle();
  }

  /** @param {Event} event */
  setVolume(event) {
    if (event.target instanceof HTMLInputElement)
      this.#soundtrack.setVolume(Number(event.target.value));
  }
}

await defineComponent({
  tag: 'app-soundtrack-control',
  element: SoundtrackControl,
  module: import.meta.url,
  uses: [AppIcon],
});
