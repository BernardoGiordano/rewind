import { inject, signal, token } from '@srljs/core';

import { rangeSlug } from '../../models/range.js';
import { REWIND_RANGE } from '../../shell/rewind-range.js';
import { STAT_NAVIGATOR } from './stat-navigator.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/** @typedef {'portrait' | 'square' | 'landscape'} CardMode */

const CARD_MODE_KEY = 'rewind.cardMode';

/**
 * Each card aspect with the outline its rail button draws, as SVG rect x, y, width, height.
 *
 * @type {readonly { id: CardMode, labelKey: string, rect: readonly [number, number, number, number] }[]}
 */
export const CARD_MODES = [
  { id: 'portrait', labelKey: 'dashboard.cardModes.portrait', rect: [7, 3, 10, 18] },
  { id: 'square', labelKey: 'dashboard.cardModes.square', rect: [5, 5, 14, 14] },
  { id: 'landscape', labelKey: 'dashboard.cardModes.landscape', rect: [3, 6, 18, 12] },
];

/** @type {InjectionToken<DashboardState>} */
export const DASHBOARD = token('Dashboard');

/**
 * What the dashboard shares with the controls it hands to the Shell: the card aspect
 * and the export of the card on screen.
 */
export class DashboardState {
  cardMode = signal(readCardMode());

  /** @param {CardMode} mode */
  selectCardMode(mode) {
    this.cardMode.value = mode;
    localStorage.setItem(CARD_MODE_KEY, mode);
  }

  /** Render the card on screen to a PNG and download it. */
  async exportCard() {
    const card = document.querySelector('app-cards-landscape, app-cards-square, app-cards-portrait');
    if (!(card instanceof HTMLElement)) return;

    const { default: html2canvas } = await import('../../../vendor/html2canvas-pro.esm.js');
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      ignoreElements: (element) => element.classList.contains('export-ignore'),
      onclone: (doc) => {
        doc.querySelectorAll('.export-show').forEach((node) => {
          if (node instanceof HTMLElement) node.style.opacity = '1';
        });
      },
    });

    const link = document.createElement('a');
    link.download = `navidrome-rewind-${inject(STAT_NAVIGATOR).current.value}-${rangeSlug(inject(REWIND_RANGE).current.value)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}

/** @returns {CardMode} */
function readCardMode() {
  const stored = localStorage.getItem(CARD_MODE_KEY);
  return stored === 'square' || stored === 'landscape' ? stored : 'portrait';
}
