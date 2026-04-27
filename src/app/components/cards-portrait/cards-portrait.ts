import { Component } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';

@Component({
  selector: 'app-cards-portrait',
  imports: [CardShellComponent, SlicePipe],
  templateUrl: './cards-portrait.html',
})
export class CardsPortrait extends CardsBase {}
