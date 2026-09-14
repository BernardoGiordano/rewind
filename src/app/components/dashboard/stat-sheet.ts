import { ChangeDetectionStrategy, Component, HostListener, inject, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroCalendarDays,
  heroChartBar,
  heroClock,
  heroEllipsisHorizontalCircle,
  heroFire,
  heroHeart,
  heroMicrophone,
  heroMoon,
  heroMusicalNote,
  heroRadio,
  heroSparkles,
  heroSquare3Stack3d,
  heroTrophy,
} from '@ng-icons/heroicons/outline';
import type { StatType } from '../../models/stats';
import { StatNavigator } from './stat-navigator';

/** Mobile adapter over {@link StatNavigator}: the stat list as a bottom sheet. */
@Component({
  selector: 'app-stat-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({
      heroMusicalNote,
      heroEllipsisHorizontalCircle,
      heroMicrophone,
      heroSquare3Stack3d,
      heroSparkles,
      heroClock,
      heroChartBar,
      heroCalendarDays,
      heroFire,
      heroMoon,
      heroArrowPath,
      heroTrophy,
      heroRadio,
      heroHeart,
    }),
  ],
  template: `
    <div class="fixed inset-0 z-50 medium-up:hidden">
      <div class="absolute inset-0 bg-black/40" (click)="close.emit()" aria-hidden="true"></div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a statistic"
        class="absolute inset-x-0 bottom-0 max-h-[75dvh] flex flex-col rounded-t-2xl bg-white dark:bg-slate-800 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700"
      >
        <div class="flex-none pt-2 pb-1 flex justify-center" aria-hidden="true">
          <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <h2
          class="flex-none px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Songs statistics
        </h2>

        <ul role="list" class="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          @for (def of stats(); track def.type) {
            <li>
              <button
                type="button"
                (click)="pick(def.type)"
                [attr.aria-current]="current() === def.type ? 'true' : null"
                class="cursor-pointer w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-colors"
                [class]="
                  current() === def.type
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                "
              >
                <ng-icon [name]="def.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
                {{ def.label }}
              </button>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class StatSheet {
  private readonly nav = inject(StatNavigator);

  readonly close = output<void>();

  readonly stats = this.nav.list;
  readonly current = this.nav.current;

  pick(type: StatType): void {
    this.nav.select(type);
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
