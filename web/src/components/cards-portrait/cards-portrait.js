import { defineComponent } from '@srljs/core';

import { AppCardShell } from '../card-shell.js';
import { CardsBase } from '../cards-base.js';
import { AppCover } from '../cover.js';
import { AppPanCover } from '../pan-cover.js';

/** The stat cards in a 9:16 frame, the shape a story takes. */
export class AppCardsPortrait extends CardsBase {}

await defineComponent({
  tag: 'app-cards-portrait',
  element: AppCardsPortrait,
  module: import.meta.url,
  uses: [AppCardShell, AppCover, AppPanCover],
});
