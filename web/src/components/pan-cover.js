import { computed, defineComponent, inject, signal, SignalElement, token } from '@srljs/core';

import { NAVIDROME } from '../services/navidrome.js';
import { watch } from '../utils/watch.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */

const FOCUS_KEY = 'rewind.coverFocus';

/** Pointer travel that turns a press into a drag, so a plain click still opens the artist. */
const DRAG_THRESHOLD_PX = 4;

/**
 * Where a cover is anchored inside its frame, as background-position percentages.
 *
 * @typedef {{ x: number, y: number }} CoverFocus
 */

/** @type {CoverFocus} */
const CENTRE = { x: 50, y: 50 };

/** @type {InjectionToken<CoverFocusStore>} */
export const COVER_FOCUS = token('CoverFocus');

/** Remembers each cover's framing in the browser, keyed by cover id. */
export class CoverFocusStore {
  #focus = signal(readFocus());

  /** @param {string} id @returns {CoverFocus} */
  get(id) {
    return this.#focus.value[id] ?? CENTRE;
  }

  /** @param {string} id @param {CoverFocus} focus */
  set(id, focus) {
    this.#focus.value = { ...this.#focus.value, [id]: focus };
    try {
      localStorage.setItem(FOCUS_KEY, JSON.stringify(this.#focus.value));
    } catch {
      /* Framing is a convenience; losing it is harmless. */
    }
  }
}

/** @returns {Record<string, CoverFocus>} */
function readFocus() {
  try {
    return /** @type {Record<string, CoverFocus> | null} */ (JSON.parse(localStorage.getItem(FOCUS_KEY) ?? '{}')) ?? {};
  } catch {
    return {};
  }
}

/**
 * A cover that fills its frame and can be dragged to choose the crop.
 *
 * It paints the image as a CSS background so the card export, which ignores
 * `object-position`, keeps the same framing. Overlays drawn above it need
 * `pointer-events-none` so the drag reaches it.
 */
export class AppPanCover extends SignalElement {
  #coverId = signal(/** @type {string | null | undefined} */ (undefined));
  #size = signal(600);

  dragging = signal(false);

  /** The live framing: the stored one, or the one under the pointer while dragging. */
  #draft = signal(/** @type {CoverFocus | null} */ (null));
  #natural = signal(/** @type {{ width: number, height: number } | null} */ (null));

  /** @type {{ x: number, y: number, focus: CoverFocus, pointer: number } | null} */
  #press = null;
  #moved = false;

  #src = computed(() => {
    const id = this.#coverId.value;
    const navidrome = inject(NAVIDROME);
    return id && navidrome.coverArtAvailable.value ? navidrome.coverUrl(id, this.#size.value) : null;
  });

  #focus = computed(() => this.#draft.value ?? inject(COVER_FOCUS).get(this.#coverId.value ?? ''));

  /** @returns {string | null | undefined} */
  get coverId() {
    return this.#coverId.value;
  }

  set coverId(id) {
    this.#coverId.value = id;
  }

  get size() {
    return this.#size.value;
  }

  set size(size) {
    this.#size.value = size;
  }

  get src() {
    return this.#src.value;
  }

  get backgroundImage() {
    return `url(${this.#src.value ?? ''})`;
  }

  get position() {
    const focus = this.#focus.value;
    return `${focus.x}% ${focus.y}%`;
  }

  get pannable() {
    return this.#natural.value !== null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('group/pan', 'absolute', 'inset-0', 'block', 'touch-none');

    const listen = { signal: this.lifetime };
    this.addEventListener('pointerdown', (event) => this.#onPointerDown(event), listen);
    this.addEventListener('pointermove', (event) => this.#onPointerMove(event), listen);
    this.addEventListener('pointerup', (event) => this.#onPointerUp(event), listen);
    this.addEventListener('pointercancel', (event) => this.#onPointerUp(event), listen);
    this.addEventListener('click', (event) => this.#onClick(event), listen);

    // The crop math needs the image's own proportions.
    watch(this, () => {
      const url = this.#src.value;
      this.#natural.value = null;
      if (!url) return;

      const image = new Image();
      image.onload = () => {
        this.#natural.value = { width: image.naturalWidth, height: image.naturalHeight };
      };
      image.src = url;
      return () => {
        image.onload = null;
      };
    });

    watch(this, () => {
      this.classList.toggle('cursor-grab', this.pannable && !this.dragging.value);
      this.classList.toggle('cursor-grabbing', this.dragging.value);
    });
  }

  /** @param {PointerEvent} event */
  #onPointerDown(event) {
    if (!this.pannable || event.button !== 0) return;

    // Keeps the card's swipe-to-next from reading a reframe as navigation.
    event.stopPropagation();

    this.#press = {
      x: event.clientX,
      y: event.clientY,
      focus: this.#focus.value,
      pointer: event.pointerId,
    };
    this.#moved = false;
    this.setPointerCapture(event.pointerId);
  }

  /** @param {PointerEvent} event */
  #onPointerMove(event) {
    const press = this.#press;
    const natural = this.#natural.value;
    if (!press || !natural || event.pointerId !== press.pointer) return;

    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!this.#moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    this.#moved = true;
    this.dragging.value = true;

    // The image is scaled to cover the frame; only the overflow on each axis can move.
    const frame = this.getBoundingClientRect();
    const scale = Math.max(frame.width / natural.width, frame.height / natural.height);
    const spareX = natural.width * scale - frame.width;
    const spareY = natural.height * scale - frame.height;

    this.#draft.value = {
      x: spareX > 1 ? clamp(press.focus.x - (dx / spareX) * 100) : press.focus.x,
      y: spareY > 1 ? clamp(press.focus.y - (dy / spareY) * 100) : press.focus.y,
    };
  }

  /** @param {PointerEvent} event */
  #onPointerUp(event) {
    const press = this.#press;
    if (!press || event.pointerId !== press.pointer) return;
    event.stopPropagation();

    this.#press = null;
    this.dragging.value = false;
    const draft = this.#draft.value;
    const id = this.#coverId.value;
    if (draft && id) inject(COVER_FOCUS).set(id, round(draft));
    this.#draft.value = null;
  }

  /**
   * A drag ends with a click on the same element; that click must not open the artist.
   *
   * @param {MouseEvent} event
   */
  #onClick(event) {
    if (!this.#moved) return;
    this.#moved = false;
    event.stopPropagation();
  }
}

/** @param {number} value @returns {number} */
function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

/** @param {CoverFocus} focus @returns {CoverFocus} */
function round(focus) {
  return { x: Math.round(focus.x * 10) / 10, y: Math.round(focus.y * 10) / 10 };
}

await defineComponent({ tag: 'app-pan-cover', element: AppPanCover, module: import.meta.url });
