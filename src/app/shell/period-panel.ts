import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroXMark } from '@ng-icons/heroicons/outline';
import { type StatRange, rangePresets, sameRange } from '../models/range';
import { DateRangePicker } from '../components/date-range-picker/date-range-picker';
import { RewindRange } from './rewind-range';

/**
 * The one place the Rewind range is chosen: relative presets, the years with
 * listening history, and a calendar for anything else.
 */
@Component({
  selector: 'app-period-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [NgIcon, DateRangePicker],
  providers: [provideIcons({ heroCheck, heroXMark })],
  template: `
    <div class="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-edge-raised">
      <div class="min-w-0">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Listening period
        </h2>
        <p class="mt-0.5 text-lg font-bold text-ink truncate">{{ label() }}</p>
      </div>
      <button
        type="button"
        (click)="closed.emit()"
        aria-label="Close"
        class="cursor-pointer shrink-0 flex items-center justify-center w-8 h-8 -mr-2 rounded-lg text-ink-muted hover:bg-fill-raised hover:text-ink transition-colors"
      >
        <ng-icon name="heroXMark" class="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div class="flex flex-col medium-up:flex-row">
      <!-- Presets and years apply on click -->
      <div
        class="medium-up:w-48 shrink-0 p-3 medium-up:border-r border-b medium-up:border-b-0 border-edge-raised"
      >
        <h3 class="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Quick picks
        </h3>
        <ul role="list" class="grid grid-cols-2 medium-up:grid-cols-1 gap-0.5">
          @for (preset of presets(); track preset.label) {
            <li>
              <button
                type="button"
                (click)="choose(preset.range)"
                [attr.aria-pressed]="isCurrent(preset.range)"
                class="cursor-pointer w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-left transition-colors"
                [class]="
                  isCurrent(preset.range)
                    ? 'bg-fill-strong text-ink'
                    : 'text-ink-soft hover:bg-fill-raised hover:text-ink'
                "
              >
                {{ preset.label }}
                @if (isCurrent(preset.range)) {
                  <ng-icon name="heroCheck" class="w-4 h-4 shrink-0" aria-hidden="true" />
                }
              </button>
            </li>
          }
        </ul>

        @if (years().length) {
          <h3
            class="mt-4 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint"
          >
            Years
          </h3>
          <ul role="list" class="grid grid-cols-4 medium-up:grid-cols-3 gap-1 px-1">
            @for (y of years(); track y) {
              <li>
                <button
                  type="button"
                  (click)="choose({ kind: 'year', year: y })"
                  [attr.aria-pressed]="isYear(y)"
                  class="cursor-pointer w-full rounded-lg py-1.5 text-sm font-medium tabular-nums transition-colors"
                  [class]="
                    isYear(y)
                      ? 'bg-selected text-on-selected'
                      : 'border border-edge-raised text-ink-soft hover:bg-fill-raised hover:text-ink'
                  "
                >
                  {{ y }}
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <!-- Custom range applies on confirm -->
      <div class="flex-1 min-w-0 px-5 py-4 medium-up:w-80">
        <h3 class="pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Custom range
        </h3>
        <app-date-range-picker
          [initialFrom]="custom()?.from ?? null"
          [initialTo]="custom()?.to ?? null"
          (rangeSelected)="choose({ kind: 'custom', from: $event.from, to: $event.to })"
        />
      </div>
    </div>
  `,
})
export class PeriodPanel {
  private readonly range = inject(RewindRange);

  /** Fires after a choice and on the close button, so the host can dismiss the panel. */
  readonly closed = output<void>();

  readonly label = this.range.label;
  readonly years = this.range.years;
  readonly presets = computed(() => rangePresets());

  readonly custom = computed(() => {
    const current = this.range.current();
    return current.kind === 'custom' ? current : null;
  });

  isCurrent(range: StatRange): boolean {
    return sameRange(range, this.range.current());
  }

  isYear(year: string): boolean {
    return this.isCurrent({ kind: 'year', year });
  }

  choose(range: StatRange): void {
    this.range.set(range);
    this.closed.emit();
  }
}
