import { Component } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';

@Component({
  selector: 'app-cards-square',
  imports: [CardShellComponent, SlicePipe],
  templateUrl: './cards-square.html',
})
export class CardsSquare extends CardsBase {}
