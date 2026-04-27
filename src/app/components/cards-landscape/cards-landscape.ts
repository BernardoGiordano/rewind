import { Component, computed, output } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';

@Component({
  selector: 'app-cards-landscape',
  imports: [CardShellComponent, SlicePipe, DecimalPipe],
  templateUrl: './cards-landscape.html',
})
export class CardsLandscape extends CardsBase {
  readonly artistClick = output<string>();

  openArtist(artistId: string | null | undefined, event?: Event): void {
    if (!artistId) return;
    event?.stopPropagation();
    this.artistClick.emit(artistId);
  }

  readonly maxMonthPlays = computed(() => Math.max(...this.monthlyTrends().map((m) => m.plays), 1));

  readonly peakHour = computed(() => {
    const clock = this.listeningClock();
    if (clock.length === 0) return null;
    return clock.reduce((max, h) => (h.plays > max.plays ? h : max), clock[0]);
  });

  monthBarWidth(plays: number): number {
    return (plays / this.maxMonthPlays()) * 100;
  }
}
