import { computed, defineComponent } from '@srljs/core';

import { AppCardShell } from '../card-shell.js';
import { CardsBase } from '../cards-base.js';
import { AppCover } from '../cover.js';
import { AppPanCover } from '../pan-cover.js';

/** The stat cards across the full width, with room for tables and charts. */
export class AppCardsLandscape extends CardsBase {
  peakHour = computed(() => {
    const clock = this.listeningClock.value;
    const first = clock[0];
    if (first === undefined) return null;
    return clock.reduce((max, h) => (h.plays > max.plays ? h : max), first);
  });
}

await defineComponent({
  tag: 'app-cards-landscape',
  element: AppCardsLandscape,
  module: import.meta.url,
  uses: [AppCardShell, AppCover, AppPanCover],
});
