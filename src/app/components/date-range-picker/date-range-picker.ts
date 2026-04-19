import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronLeft, heroChevronRight } from '@ng-icons/heroicons/outline';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ heroChevronLeft, heroChevronRight })],
  template: `
    <div class="w-72 p-3 select-none">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <button
          type="button"
          (click)="prevMonth()"
          class="cursor-pointer p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Previous month"
        >
          <ng-icon name="heroChevronLeft" class="w-4 h-4" aria-hidden="true" />
        </button>
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {{ monthLabel() }}
        </span>
        <button
          type="button"
          (click)="nextMonth()"
          class="cursor-pointer p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Next month"
        >
          <ng-icon name="heroChevronRight" class="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <!-- Weekday header -->
      <div class="grid grid-cols-7 gap-0.5 mb-1">
        @for (w of weekdays; track w) {
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center py-1">{{ w }}</div>
        }
      </div>

      <!-- Days grid -->
      <div class="grid grid-cols-7 gap-0.5">
        @for (cell of cells(); track cell.iso) {
          <button
            type="button"
            (click)="onCellClick(cell)"
            (mouseenter)="onCellHover(cell)"
            [disabled]="cell.disabled"
            class="relative h-8 text-xs font-medium rounded-md transition-colors"
            [class]="cellClass(cell)"
          >
            <span class="relative z-10">{{ cell.day }}</span>
          </button>
        }
      </div>

      <!-- Footer -->
      <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
        <span class="text-slate-500 dark:text-slate-400">
          @if (pendingStart()) {
            @if (hoverIso(); as h) {
              {{ formatShort(pendingStart()!) }} – {{ formatShort(h) }}
            } @else {
              Pick end date
            }
          } @else {
            Pick start date
          }
        </span>
        <button
          type="button"
          (click)="clear()"
          class="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  `,
})
export class DateRangePicker {
  readonly initialFrom = input<string | null>(null);
  readonly initialTo = input<string | null>(null);

  readonly rangeSelected = output<{ from: string; to: string }>();
  readonly cleared = output<void>();

  readonly weekdays = WEEKDAYS;

  private readonly today = new Date();
  private readonly todayIso = toIso(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());

  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth());

  readonly pendingStart = signal<string | null>(null);
  readonly committedStart = signal<string | null>(null);
  readonly committedEnd = signal<string | null>(null);
  readonly hoverIso = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => {
      const f = this.initialFrom();
      const t = this.initialTo();
      if (f && t) {
        this.committedStart.set(f);
        this.committedEnd.set(t);
        const d = parseIso(f);
        this.viewYear.set(d.getFullYear());
        this.viewMonth.set(d.getMonth());
      }
    });
  }

  readonly monthLabel = computed(() => `${MONTH_NAMES[this.viewMonth()]} ${this.viewYear()}`);

  readonly cells = computed<DayCell[]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const first = new Date(y, m, 1);
    // Monday = 0 .. Sunday = 6
    const firstDow = (first.getDay() + 6) % 7;
    const start = new Date(y, m, 1 - firstDow);

    const pendingS = this.pendingStart();
    const cs = this.committedStart();
    const ce = this.committedEnd();
    const hover = this.hoverIso();

    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;
    if (pendingS) {
      const a = pendingS;
      const b = hover ?? pendingS;
      rangeStart = a < b ? a : b;
      rangeEnd = a < b ? b : a;
    } else if (cs && ce) {
      rangeStart = cs;
      rangeEnd = ce;
    }

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate());
      const inMonth = d.getMonth() === m;
      const inRange = !!(rangeStart && rangeEnd && iso >= rangeStart && iso <= rangeEnd);
      cells.push({
        iso,
        day: d.getDate(),
        inMonth,
        isStart: iso === rangeStart,
        isEnd: iso === rangeEnd,
        inRange,
        isToday: iso === this.todayIso,
        disabled: iso > this.todayIso,
      });
    }
    return cells;
  });

  cellClass(cell: DayCell): string {
    const classes: string[] = ['cursor-pointer'];
    if (cell.disabled) {
      return 'text-slate-300 dark:text-slate-600 cursor-not-allowed';
    }
    if (cell.isStart || cell.isEnd) {
      classes.push('bg-slate-900 dark:bg-white text-white dark:text-slate-900');
    } else if (cell.inRange) {
      classes.push('bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white');
    } else if (cell.inMonth) {
      classes.push('text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700');
    } else {
      classes.push('text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700');
    }
    if (cell.isToday && !cell.isStart && !cell.isEnd) {
      classes.push('ring-1 ring-slate-400 dark:ring-slate-500');
    }
    return classes.join(' ');
  }

  onCellClick(cell: DayCell): void {
    if (cell.disabled) return;
    const pending = this.pendingStart();
    if (!pending) {
      this.pendingStart.set(cell.iso);
      this.committedStart.set(null);
      this.committedEnd.set(null);
      return;
    }
    const from = pending < cell.iso ? pending : cell.iso;
    const to = pending < cell.iso ? cell.iso : pending;
    this.pendingStart.set(null);
    this.hoverIso.set(null);
    this.committedStart.set(from);
    this.committedEnd.set(to);
    this.rangeSelected.emit({ from, to });
  }

  onCellHover(cell: DayCell): void {
    if (!this.pendingStart() || cell.disabled) return;
    this.hoverIso.set(cell.iso);
  }

  prevMonth(): void {
    const m = this.viewMonth();
    if (m === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.set(m - 1);
    }
  }

  nextMonth(): void {
    const m = this.viewMonth();
    if (m === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.set(m + 1);
    }
  }

  clear(): void {
    this.pendingStart.set(null);
    this.committedStart.set(null);
    this.committedEnd.set(null);
    this.hoverIso.set(null);
    this.cleared.emit();
  }

  formatShort(iso: string): string {
    const d = parseIso(iso);
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  }
}
