import { Component } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';
import { CoverComponent } from '../cover';

@Component({
  selector: 'app-cards-portrait',
  imports: [CardShellComponent, CoverComponent, SlicePipe],
  templateUrl: './cards-portrait.html',
})
export class CardsPortrait extends CardsBase {}
