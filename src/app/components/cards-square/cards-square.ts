import { Component } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardShellComponent } from '../card-shell';
import { CardsBase } from '../cards-base';
import { CoverComponent } from '../cover';

@Component({
  selector: 'app-cards-square',
  imports: [CardShellComponent, CoverComponent, SlicePipe],
  templateUrl: './cards-square.html',
})
export class CardsSquare extends CardsBase {}
