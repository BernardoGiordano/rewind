import { Component } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';
import { CoverComponent } from '../cover';
import { PanCoverComponent } from '../pan-cover';

@Component({
  selector: 'app-cards-portrait',
  imports: [CardShellComponent, CoverComponent, PanCoverComponent, SlicePipe],
  templateUrl: './cards-portrait.html',
})
export class CardsPortrait extends CardsBase {}
