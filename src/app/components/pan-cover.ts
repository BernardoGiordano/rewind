import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavidromeService } from '../services/navidrome.service';

const FOCUS_KEY = 'rewind.coverFocus';

/** Pointer travel that turns a press into a drag, so a plain click still opens the artist. */
const DRAG_THRESHOLD_PX = 4;

/** Where a cover is anchored inside its frame, as background-position percentages. */
export interface CoverFocus {
  x: number;
  y: number;
}

const CENTRE: CoverFocus = { x: 50, y: 50 };

/** Remembers each cover's framing in the browser, keyed by cover id. */
@Injectable({ providedIn: 'root' })
export class CoverFocusStore {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly focus = signal<Record<string, CoverFocus>>(this.read());

  get(id: string): CoverFocus {
    return this.focus()[id] ?? CENTRE;
  }

  set(id: string, focus: CoverFocus): void {
    this.focus.update((all) => ({ ...all, [id]: focus }));
    if (!this.browser) return;
    try {
      localStorage.setItem(FOCUS_KEY, JSON.stringify(this.focus()));
    } catch {
      /* Framing is a convenience; losing it is harmless. */
    }
  }

  private read(): Record<string, CoverFocus> {
    if (!this.browser) return {};
    try {
      return JSON.parse(localStorage.getItem(FOCUS_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }
}

/**
 * A cover that fills its frame and can be dragged to choose the crop.
 *
 * It paints the image as a CSS background so the card export, which ignores
 * `object-position`, keeps the same framing. Overlays drawn above it need
 * `pointer-events-none` so the drag reaches it.
 */
@Component({
  selector: 'app-pan-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'group/pan absolute inset-0 block touch-none',
    '[class.cursor-grab]': 'pannable() && !dragging()',
    '[class.cursor-grabbing]': 'dragging()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(click)': 'onClick($event)',
  },
  template: `
    @if (src(); as url) {
      <div
        class="w-full h-full bg-cover bg-no-repeat"
        [style.background-image]="'url(' + url + ')'"
        [style.background-position]="position()"
      ></div>
      @if (pannable()) {
        <span
          class="export-ignore absolute top-2 right-2 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[0.7em] font-medium pointer-events-none transition-opacity"
          [class]="dragging() ? 'opacity-100' : 'opacity-0 group-hover/pan:opacity-100'"
          aria-hidden="true"
        >
          Drag to reframe
        </span>
      }
    }
  `,
})
export class PanCoverComponent {
  private readonly navidrome = inject(NavidromeService);
  private readonly store = inject(CoverFocusStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly id = input<string | null | undefined>();
  readonly size = input<number>(600);

  readonly src = computed(() => {
    const id = this.id();
    return id && this.navidrome.coverArtAvailable()
      ? this.navidrome.coverUrl(id, this.size())
      : null;
  });

  readonly dragging = signal(false);

  /** The live framing: the stored one, or the one under the pointer while dragging. */
  private readonly draft = signal<CoverFocus | null>(null);
  private readonly natural = signal<{ width: number; height: number } | null>(null);

  readonly focus = computed(() => this.draft() ?? this.store.get(this.id() ?? ''));
  readonly position = computed(() => `${this.focus().x}% ${this.focus().y}%`);
  readonly pannable = computed(() => this.natural() !== null);

  private press: { x: number; y: number; focus: CoverFocus; pointer: number } | null = null;
  private moved = false;

  constructor() {
    // The crop math needs the image's own proportions.
    effect((onCleanup) => {
      const url = this.src();
      this.natural.set(null);
      if (!url || typeof Image === 'undefined') return;

      const image = new Image();
      image.onload = () =>
        this.natural.set({ width: image.naturalWidth, height: image.naturalHeight });
      image.src = url;
      onCleanup(() => (image.onload = null));
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.pannable() || event.button !== 0) return;

    // Keeps the card's swipe-to-next from reading a reframe as navigation.
    event.stopPropagation();

    this.press = {
      x: event.clientX,
      y: event.clientY,
      focus: this.focus(),
      pointer: event.pointerId,
    };
    this.moved = false;
    this.host.nativeElement.setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    const press = this.press;
    const natural = this.natural();
    if (!press || !natural || event.pointerId !== press.pointer) return;

    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!this.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    this.moved = true;
    this.dragging.set(true);

    // The image is scaled to cover the frame; only the overflow on each axis can move.
    const frame = this.host.nativeElement.getBoundingClientRect();
    const scale = Math.max(frame.width / natural.width, frame.height / natural.height);
    const spareX = natural.width * scale - frame.width;
    const spareY = natural.height * scale - frame.height;

    this.draft.set({
      x: spareX > 1 ? clamp(press.focus.x - (dx / spareX) * 100) : press.focus.x,
      y: spareY > 1 ? clamp(press.focus.y - (dy / spareY) * 100) : press.focus.y,
    });
  }

  onPointerUp(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointer) return;
    event.stopPropagation();

    this.press = null;
    this.dragging.set(false);
    const draft = this.draft();
    const id = this.id();
    if (draft && id) this.store.set(id, round(draft));
    this.draft.set(null);
  }

  /** A drag ends with a click on the same element; that click must not open the artist. */
  onClick(event: MouseEvent): void {
    if (!this.moved) return;
    this.moved = false;
    event.stopPropagation();
  }
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round(focus: CoverFocus): CoverFocus {
  return { x: Math.round(focus.x * 10) / 10, y: Math.round(focus.y * 10) / 10 };
}
