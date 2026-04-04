import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full',
    style: 'container-type: size',
  },
  template: `
    <div
      [class]="'w-full h-full overflow-hidden relative flex flex-col bg-gradient-to-br lg:rounded-xl ' + gradient()"
    >
      <div class="px-8 pt-8 flex items-center justify-between shrink-0">
        <span class="text-white/60 text-sm font-semibold tracking-[0.2em] uppercase">Navidrome Rewind</span>
        <span class="text-white/80 text-sm font-bold bg-white/10 px-3 py-1 rounded-full">{{ yearLabel() }}</span>
      </div>

      <div class="flex-1 flex flex-col px-8 pt-4 pb-6 overflow-hidden">
        <ng-content />
      </div>

      <div class="px-8 pb-6 shrink-0">
        <div class="flex items-center gap-2 text-white/40">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <span class="text-xs font-medium tracking-wider uppercase">Navidrome Rewind</span>
        </div>
      </div>
    </div>
  `,
})
export class CardShellComponent {
  gradient = input.required<string>();
  yearLabel = input.required<string>();
}
