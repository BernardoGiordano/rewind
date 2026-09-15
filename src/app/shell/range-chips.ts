import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import type { StatRange } from '../models/range';
import { RewindRange } from './rewind-range';

/**
 * The range chips, drawn once and mounted wherever a surface offers the choice:
 * the Shell's rail panel, its compact menu and the dashboard sidebar.
 */
@Component({
  selector: 'app-range-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap gap-2">
      <button type="button" (click)="choose({ kind: 'all-time' })" [class]="chipClass(isAllTime())">
        All Time
      </button>

      @for (y of years(); track y) {
        <button
          type="button"
          (click)="choose({ kind: 'year', year: y })"
          [class]="chipClass(isYear(y))"
        >
          {{ y }}
        </button>
      }

      <button
        type="button"
        (click)="openPicker()"
        [attr.aria-expanded]="pickerOpen()"
        [class]="chipClass(isCustom())"
      >
        {{ isCustom() ? label() : 'Custom…' }}
      </button>
    </div>
  `,
})
export class RangeChips {
  private readonly range = inject(RewindRange);

  /** Fires when the user picks a range, so a menu hosting the chips can close itself. */
  readonly chosen = output<void>();

  readonly years = this.range.years;
  readonly label = this.range.label;
  readonly pickerOpen = this.range.pickerOpen;

  readonly isAllTime = computed(() => this.range.current().kind === 'all-time');
  readonly isCustom = computed(() => this.range.current().kind === 'custom');

  isYear(year: string): boolean {
    const current = this.range.current();
    return current.kind === 'year' && current.year === year;
  }

  choose(range: StatRange): void {
    this.range.set(range);
    this.chosen.emit();
  }

  openPicker(): void {
    this.range.openPicker();
  }

  chipClass(selected: boolean): string {
    const base = 'cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium transition-colors';
    return selected
      ? `${base} bg-selected text-on-selected`
      : `${base} bg-surface-raised text-ink-soft hover:bg-fill-raised border border-edge-raised`;
  }
}
