import { computed, defineComponent, signal, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { MONTH_FULL, MONTH_SHORT, parseIsoDate, toIsoDate } from '../../utils/format.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * @typedef {object} DayCell
 * @property {string} iso
 * @property {number} day
 * @property {boolean} inMonth
 * @property {boolean} isStart
 * @property {boolean} isEnd
 * @property {boolean} inRange
 * @property {boolean} isToday
 * @property {boolean} disabled
 */

/**
 * An inline range calendar. Two clicks mark the ends, a third starts over, and
 * nothing leaves the component until the user applies the selection.
 */
export class AppDateRangePicker extends SignalElement {
  static properties = {
    initialFrom: { attribute: false },
    initialTo: { attribute: false },
  };

  /**
   * The range already in force, shown until the user starts a new one.
   *
   * @type {string | null}
   */
  initialFrom = null;

  /** @type {string | null} */
  initialTo = null;

  weekdays = WEEKDAYS;

  #todayIso = toIsoDate(new Date());

  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth());

  start = signal(/** @type {string | null} */ (null));
  end = signal(/** @type {string | null} */ (null));
  hoverIso = signal(/** @type {string | null} */ (null));

  /** The initial range as last applied, so `canApply` compares against what is in force. */
  #initial = signal(/** @type {{ from: string | null, to: string | null }} */ ({ from: null, to: null }));

  monthLabel = computed(() => `${MONTH_FULL[this.viewMonth.value] ?? ''} ${this.viewYear.value}`);

  atLatestMonth = computed(() => {
    const today = new Date();
    return (
      this.viewYear.value > today.getFullYear() ||
      (this.viewYear.value === today.getFullYear() && this.viewMonth.value >= today.getMonth())
    );
  });

  canApply = computed(() => {
    const from = this.start.value;
    const to = this.end.value;
    const initial = this.#initial.value;
    return !!from && !!to && (from !== initial.from || to !== initial.to);
  });

  ends = computed(() => {
    const awaitingEnd = !!this.start.value && !this.end.value;
    return [
      { label: 'From', value: this.start.value, next: !awaitingEnd },
      { label: 'To', value: this.end.value, next: awaitingEnd },
    ];
  });

  /** The span to paint: the committed range, or the start stretched to the hovered day. */
  #span = computed(() => {
    const from = this.start.value;
    if (!from) return null;
    const to = this.end.value ?? this.hoverIso.value ?? from;
    return from <= to ? [from, to] : [to, from];
  });

  cells = computed(() => {
    const y = this.viewYear.value;
    const m = this.viewMonth.value;

    // Weeks start on Monday.
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const span = this.#span.value;

    /** @type {DayCell[]} */
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(y, m, 1 - firstDow + i);
      const iso = toIsoDate(date);
      cells.push({
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === m,
        isStart: iso === span?.[0],
        isEnd: iso === span?.[1],
        inRange: !!span && iso >= (span[0] ?? '') && iso <= (span[1] ?? ''),
        isToday: iso === this.#todayIso,
        disabled: iso > this.#todayIso,
      });
    }
    return cells;
  });

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block', 'select-none');
  }

  /** @param {Map<PropertyKey, unknown>} changed */
  willUpdate(changed) {
    super.willUpdate(changed);
    if (!changed.has('initialFrom') && !changed.has('initialTo')) return;
    const from = this.initialFrom;
    const to = this.initialTo;
    this.#initial.value = { from, to };
    if (!from || !to) return;
    this.start.value = from;
    this.end.value = to;
    this.#showMonthOf(to);
  }

  /**
   * The tinted band behind a range, rounded only where it starts and stops.
   *
   * @param {DayCell} cell
   * @returns {string}
   */
  bandClass(cell) {
    if (!cell.inRange || (cell.isStart && cell.isEnd)) return '';
    if (cell.isStart) return 'bg-fill-strong rounded-l-md';
    if (cell.isEnd) return 'bg-fill-strong rounded-r-md';
    return 'bg-fill-strong';
  }

  /** @param {DayCell} cell @returns {string} */
  dayClass(cell) {
    if (cell.disabled) return 'text-ink-faint/40 cursor-default';
    if (cell.isStart || cell.isEnd) return 'cursor-pointer bg-selected text-on-selected';
    if (cell.inRange) return 'cursor-pointer text-ink hover:bg-fill-raised';
    if (cell.inMonth) return 'cursor-pointer text-ink-soft hover:bg-fill-strong';
    return 'cursor-pointer text-ink-faint hover:bg-fill-strong';
  }

  /** @param {DayCell} cell */
  pick(cell) {
    if (cell.disabled) return;
    const from = this.start.value;
    if (!from || this.end.value) {
      this.start.value = cell.iso;
      this.end.value = null;
      return;
    }
    if (cell.iso < from) {
      this.start.value = cell.iso;
      this.end.value = from;
    } else {
      this.end.value = cell.iso;
    }
    this.hoverIso.value = null;
  }

  /** @param {DayCell} cell */
  hover(cell) {
    if (this.start.value && !this.end.value && !cell.disabled) this.hoverIso.value = cell.iso;
  }

  clearHover() {
    this.hoverIso.value = null;
  }

  /** @param {number} delta */
  shiftMonths(delta) {
    const target = new Date(this.viewYear.value, this.viewMonth.value + delta, 1);
    const today = new Date();
    const latest = new Date(today.getFullYear(), today.getMonth(), 1);
    const clamped = target > latest ? latest : target;
    this.viewYear.value = clamped.getFullYear();
    this.viewMonth.value = clamped.getMonth();
  }

  reset() {
    this.start.value = null;
    this.end.value = null;
    this.hoverIso.value = null;
  }

  apply() {
    const from = this.start.value;
    const to = this.end.value;
    if (from && to) this.#select({ from, to });
  }

  /** @param {string | null} iso @returns {string} */
  endLabel(iso) {
    return iso ? this.formatDate(iso) : 'Pick a day';
  }

  /** @param {string} iso @returns {string} */
  formatDate(iso) {
    const d = parseIsoDate(iso);
    return `${MONTH_SHORT[d.getMonth()] ?? ''} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /** @param {{ from: string, to: string }} range */
  #select(range) {
    this.dispatchEvent(new CustomEvent('range-selected', { detail: range }));
  }

  /** @param {string} iso */
  #showMonthOf(iso) {
    const d = parseIsoDate(iso);
    this.viewYear.value = d.getFullYear();
    this.viewMonth.value = d.getMonth();
  }
}

await defineComponent({
  tag: 'app-date-range-picker',
  element: AppDateRangePicker,
  module: import.meta.url,
  uses: [AppIcon],
});
