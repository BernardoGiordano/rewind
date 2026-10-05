import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronDoubleLeft,
  heroChevronDoubleRight,
  heroChevronLeft,
  heroChevronRight,
} from '@ng-icons/heroicons/outline';
import { MONTH_FULL, MONTH_SHORT, parseIsoDate, toIsoDate } from '../../utils/format';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  isToday: boolean;
  disabled: boolean;
}

/**
 * An inline range calendar. Two clicks mark the ends, a third starts over, and
 * nothing leaves the component until the user applies the selection.
 */
@Component({
  selector: 'app-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block select-none' },
  imports: [NgIcon],
  providers: [
    provideIcons({
      heroChevronDoubleLeft,
      heroChevronDoubleRight,
      heroChevronLeft,
      heroChevronRight,
    }),
  ],
  template: `
    <!-- Month navigation -->
    <div class="flex items-center gap-0.5 mb-2">
      <button
        type="button"
        (click)="shiftMonths(-12)"
        class="cursor-pointer flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors"
        aria-label="Previous year"
        title="Previous year"
      >
        <ng-icon name="heroChevronDoubleLeft" class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        (click)="shiftMonths(-1)"
        class="cursor-pointer flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors"
        aria-label="Previous month"
        title="Previous month"
      >
        <ng-icon name="heroChevronLeft" class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <span class="flex-1 text-center text-sm font-semibold text-ink" aria-live="polite">
        {{ monthLabel() }}
      </span>
      <button
        type="button"
        (click)="shiftMonths(1)"
        [disabled]="atLatestMonth()"
        class="cursor-pointer flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
        aria-label="Next month"
        title="Next month"
      >
        <ng-icon name="heroChevronRight" class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        (click)="shiftMonths(12)"
        [disabled]="atLatestMonth()"
        class="cursor-pointer flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
        aria-label="Next year"
        title="Next year"
      >
        <ng-icon name="heroChevronDoubleRight" class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>

    <!-- Weekdays -->
    <div class="grid grid-cols-7 mb-1" aria-hidden="true">
      @for (w of weekdays; track w) {
        <div
          class="text-[10px] font-semibold uppercase tracking-wider text-ink-faint text-center py-1"
        >
          {{ w }}
        </div>
      }
    </div>

    <!-- Days. No column gap, so a selected range reads as one band. -->
    <div class="grid grid-cols-7 gap-y-1" (mouseleave)="hoverIso.set(null)">
      @for (cell of cells(); track cell.iso) {
        <div class="h-8" [class]="bandClass(cell)">
          <button
            type="button"
            (click)="pick(cell)"
            (mouseenter)="hover(cell)"
            [disabled]="cell.disabled"
            [attr.aria-label]="formatDate(cell.iso)"
            [attr.aria-pressed]="cell.isStart || cell.isEnd"
            class="relative w-full h-full rounded-md text-xs font-medium tabular-nums transition-colors"
            [class]="dayClass(cell)"
          >
            {{ cell.day }}
            @if (cell.isToday) {
              <span
                class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                [class]="cell.isStart || cell.isEnd ? 'bg-on-selected' : 'bg-accent'"
                aria-hidden="true"
              ></span>
            }
          </button>
        </div>
      }
    </div>

    <!-- Ends of the selection. The one the next click sets is outlined. -->
    <div class="mt-3 grid grid-cols-2 gap-2">
      @for (end of ends(); track end.label) {
        <div
          class="rounded-lg px-3 py-2 border transition-colors"
          [class]="end.next ? 'border-ink-muted bg-surface-raised' : 'border-edge-raised bg-fill'"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-faint leading-none">
            {{ end.label }}
          </p>
          <p
            class="mt-1 text-sm font-medium tabular-nums truncate"
            [class]="end.value ? 'text-ink' : 'text-ink-faint'"
          >
            {{ end.value ? formatDate(end.value) : 'Pick a day' }}
          </p>
        </div>
      }
    </div>

    <div class="mt-3 flex items-center justify-end gap-2">
      @if (start()) {
        <button
          type="button"
          (click)="reset()"
          class="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors"
        >
          Reset
        </button>
      }
      <button
        type="button"
        (click)="apply()"
        [disabled]="!canApply()"
        class="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium bg-selected text-on-selected hover:opacity-90 disabled:opacity-30 disabled:cursor-default transition-opacity"
      >
        Apply range
      </button>
    </div>
  `,
})
export class DateRangePicker {
  /** The range already in force, shown until the user starts a new one. */
  readonly initialFrom = input<string | null>(null);
  readonly initialTo = input<string | null>(null);

  readonly rangeSelected = output<{ from: string; to: string }>();

  readonly weekdays = WEEKDAYS;

  private readonly todayIso = toIsoDate(new Date());

  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());

  readonly start = signal<string | null>(null);
  readonly end = signal<string | null>(null);
  readonly hoverIso = signal<string | null>(null);

  constructor() {
    effect(() => {
      const from = this.initialFrom();
      const to = this.initialTo();
      if (!from || !to) return;
      this.start.set(from);
      this.end.set(to);
      this.showMonthOf(to);
    });
  }

  readonly monthLabel = computed(() => `${MONTH_FULL[this.viewMonth()]} ${this.viewYear()}`);

  readonly atLatestMonth = computed(() => {
    const today = new Date();
    return (
      this.viewYear() > today.getFullYear() ||
      (this.viewYear() === today.getFullYear() && this.viewMonth() >= today.getMonth())
    );
  });

  readonly canApply = computed(() => {
    const from = this.start();
    const to = this.end();
    return !!from && !!to && (from !== this.initialFrom() || to !== this.initialTo());
  });

  readonly ends = computed(() => {
    const awaitingEnd = !!this.start() && !this.end();
    return [
      { label: 'From', value: this.start(), next: !awaitingEnd },
      { label: 'To', value: this.end(), next: awaitingEnd },
    ];
  });

  /** The span to paint: the committed range, or the start stretched to the hovered day. */
  private readonly span = computed<[string, string] | null>(() => {
    const from = this.start();
    if (!from) return null;
    const to = this.end() ?? this.hoverIso() ?? from;
    return from <= to ? [from, to] : [to, from];
  });

  readonly cells = computed<DayCell[]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();

    // Weeks start on Monday.
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const span = this.span();

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(y, m, 1 - firstDow + i);
      const iso = toIsoDate(date);
      cells.push({
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === m,
        isStart: iso === span?.[0],
        isEnd: iso === span?.[1],
        inRange: !!span && iso >= span[0] && iso <= span[1],
        isToday: iso === this.todayIso,
        disabled: iso > this.todayIso,
      });
    }
    return cells;
  });

  /** The tinted band behind a range, rounded only where it starts and stops. */
  bandClass(cell: DayCell): string {
    if (!cell.inRange || (cell.isStart && cell.isEnd)) return '';
    if (cell.isStart) return 'bg-fill-strong rounded-l-md';
    if (cell.isEnd) return 'bg-fill-strong rounded-r-md';
    return 'bg-fill-strong';
  }

  dayClass(cell: DayCell): string {
    if (cell.disabled) return 'text-ink-faint/40 cursor-default';
    if (cell.isStart || cell.isEnd) return 'cursor-pointer bg-selected text-on-selected';
    if (cell.inRange) return 'cursor-pointer text-ink hover:bg-fill-raised';
    if (cell.inMonth) return 'cursor-pointer text-ink-soft hover:bg-fill-strong';
    return 'cursor-pointer text-ink-faint hover:bg-fill-strong';
  }

  pick(cell: DayCell): void {
    if (cell.disabled) return;
    const from = this.start();
    if (!from || this.end()) {
      this.start.set(cell.iso);
      this.end.set(null);
      return;
    }
    if (cell.iso < from) {
      this.start.set(cell.iso);
      this.end.set(from);
    } else {
      this.end.set(cell.iso);
    }
    this.hoverIso.set(null);
  }

  hover(cell: DayCell): void {
    if (this.start() && !this.end() && !cell.disabled) this.hoverIso.set(cell.iso);
  }

  shiftMonths(delta: number): void {
    const target = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    const today = new Date();
    const latest = new Date(today.getFullYear(), today.getMonth(), 1);
    const clamped = target > latest ? latest : target;
    this.viewYear.set(clamped.getFullYear());
    this.viewMonth.set(clamped.getMonth());
  }

  reset(): void {
    this.start.set(null);
    this.end.set(null);
    this.hoverIso.set(null);
  }

  apply(): void {
    const from = this.start();
    const to = this.end();
    if (from && to) this.rangeSelected.emit({ from, to });
  }

  formatDate(iso: string): string {
    const d = parseIsoDate(iso);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  private showMonthOf(iso: string): void {
    const d = parseIsoDate(iso);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }
}
