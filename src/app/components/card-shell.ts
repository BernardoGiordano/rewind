import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
  template: `
    <div
      [class]="'card-container aspect-[9/16] w-full max-w-sm mx-auto rounded-3xl overflow-hidden relative flex flex-col bg-gradient-to-br ' + gradient()"
    >
      <div class="px-6 pt-6 flex items-center justify-between">
        <span class="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase">Navidrome Wrapped</span>
        <span class="text-white/80 text-sm font-bold bg-white/10 px-3 py-1 rounded-full">{{ yearLabel() }}</span>
      </div>

      <div class="flex-1 flex flex-col px-6 pt-4 pb-6 overflow-hidden">
        <ng-content />
      </div>

      <div class="px-6 pb-6">
        <div class="flex items-center gap-2 text-white/40">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <span class="text-xs font-medium tracking-wider uppercase">Navidrome Wrapped</span>
        </div>
      </div>
    </div>
  `,
})
export class CardShellComponent {
  gradient = input.required<string>();
  yearLabel = input.required<string>();
}
