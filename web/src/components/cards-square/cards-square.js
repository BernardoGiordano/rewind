import { defineComponent } from '@srljs/core';

import { AppCardShell } from '../card-shell.js';
import { CardsBase } from '../cards-base.js';
import { AppCover } from '../cover.js';
import { AppPanCover } from '../pan-cover.js';

/** The stat cards in a square frame. */
export class AppCardsSquare extends CardsBase {}

await defineComponent({
  tag: 'app-cards-square',
  element: AppCardsSquare,
  module: import.meta.url,
  uses: [AppCardShell, AppCover, AppPanCover],
});
