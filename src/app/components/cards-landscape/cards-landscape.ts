import { Component, computed } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';
import { CoverComponent } from '../cover';
import { PanCoverComponent } from '../pan-cover';

@Component({
  selector: 'app-cards-landscape',
  imports: [CardShellComponent, CoverComponent, PanCoverComponent, SlicePipe, DecimalPipe],
  templateUrl: './cards-landscape.html',
})
export class CardsLandscape extends CardsBase {
  readonly peakHour = computed(() => {
    const clock = this.listeningClock();
    if (clock.length === 0) return null;
    return clock.reduce((max, h) => (h.plays > max.plays ? h : max), clock[0]);
  });
}
