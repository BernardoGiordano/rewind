import { defineComponent } from '@srljs/core';

import { AppCardShell } from '../card-shell.js';
import { CardsBase } from '../cards-base.js';
import { AppCover } from '../cover.js';
import { AppPanCover } from '../pan-cover.js';

/** The stat cards across the full width, with room for tables and charts. */
export class AppCardsLandscape extends CardsBase {}

await defineComponent({
  tag: 'app-cards-landscape',
  element: AppCardsLandscape,
  module: import.meta.url,
  uses: [AppCardShell, AppCover, AppPanCover],
});
