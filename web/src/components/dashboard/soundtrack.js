import { computed, currentPath, effect, signal, token, untracked } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { SoundtrackSong, SoundtrackSongs, StatRange, StatType } from '../../models/types.js' */
/** @import { NavidromeService } from '../../services/navidrome.js' */
/** @import { RewindRange } from '../../shell/rewind-range.js' */
/** @import { StatNavigator } from './stat-navigator.js' */

const ENABLED_KEY = 'rewind.music';
const VOLUME_KEY = 'rewind.musicVolume';
const DEFAULT_VOLUME = 0.5;

/** The dashboard path. Music plays only there. */
const HOST_PATH = '/';

/** How long a slide stays before its song starts, so skipping through slides stays quiet. */
const SWITCH_DELAY_MS = 300;

const CROSSFADE_MS = 1200;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 400;
const FADE_STEP_MS = 50;

/** Songs at least this long start past their intro, a quarter of the way in, at most a minute. */
const SKIP_INTRO_MIN_SECONDS = 90;
const SKIP_INTRO_MAX_SECONDS = 60;

/** Events that count as an interaction for the browser's autoplay rules. */
const ACTIVATION_EVENTS = ['keydown', 'mousedown', 'pointerup', 'touchend'];

/** @type {InjectionToken<Soundtrack>} */
export const SOUNDTRACK = token('Soundtrack');

/**
 * Music behind the recap, one song per slide.
 *
 * Each slide plays a song tied to what it shows, which the server picks. Moving to
 * another slide crossfades to its song, and a slide without one keeps the music going.
 * A song that ends starts over. Music plays while the dashboard is on screen, unless
 * the user muted it. Browsers refuse sound until the page has had an interaction, so
 * a refused start tries again on the next one.
 */
export class Soundtrack {
  #navidrome;

  /** Two players, so one song fades out while the next fades in. */
  #decks = [new Deck(), new Deck()];
  #front = 0;

  /** The user's choice, kept across visits. */
  #enabled = signal(localStorage.getItem(ENABLED_KEY) !== 'false');
  #volume = signal(readVolume());
  #songs = signal(/** @type {SoundtrackSongs} */ ({}));
  #song = signal(/** @type {SoundtrackSong | null} */ (null));
  #playing = signal(false);

  /** The range and history version the songs answer. */
  #songsKey = /** @type {string | null} */ (null);

  /** @type {AbortController | null} */
  #request = null;

  /** Whether the dashboard wants sound right now. */
  #wanted = false;

  /** Whether the browser refused the last start for want of an interaction. */
  #blocked = false;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #switchTimer;

  /** Whether there is music to offer for the slide on screen. */
  available = computed(() => this.#navidrome.musicAvailable.value && this.#song.value !== null);

  playing = computed(() => this.#playing.value);
  song = computed(() => this.#song.value);
  volume = computed(() => this.#volume.value);

  /**
   * @param {NavidromeService} navidrome
   * @param {RewindRange} range
   * @param {StatNavigator} navigator
   */
  constructor(navidrome, range, navigator) {
    this.#navidrome = navidrome;

    effect(() => {
      const active =
        navidrome.musicAvailable.value && range.ready.value && currentPath.value === HOST_PATH;
      const current = range.current.value;
      const version = navidrome.historyVersion.value;
      untracked(() => {
        if (active) void this.#load(current, version);
      });
    });

    effect(() => {
      const songs = this.#songs.value;
      const stat = navigator.current.value;
      untracked(() => this.#follow(songs, stat));
    });

    const cued = computed(() => this.#song.value !== null);
    effect(() => {
      const wanted = this.#enabled.value && currentPath.value === HOST_PATH && cued.value;
      untracked(() => {
        this.#wanted = wanted;
        if (wanted) this.#resume();
        else this.#halt();
      });
    });

    // Only the front deck speaks for the music. The other one is fading out.
    for (const deck of this.#decks) {
      const audio = deck.audio;
      audio.addEventListener('play', () => deck === this.#deck && (this.#playing.value = true));
      audio.addEventListener('pause', () => deck === this.#deck && (this.#playing.value = false));
      audio.addEventListener('ended', () => deck === this.#deck && this.#replay());
      audio.addEventListener('error', () => deck === this.#deck && this.#recover());
    }

    for (const type of ACTIVATION_EVENTS) {
      document.addEventListener(type, (event) => this.#unlock(event), { capture: true });
    }
  }

  /** Mute or unmute, from a click, so the browser counts the start as the user's. */
  toggle() {
    if (this.#playing.value) {
      this.#setEnabled(false);
      return;
    }
    this.#setEnabled(true);
    this.#resume();
  }

  /** @param {number} value Between 0 and 1. */
  setVolume(value) {
    const volume = Math.min(Math.max(value, 0), 1);
    this.#volume.value = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
    if (!this.#wanted) return;
    this.#deck.stopFade();
    this.#deck.audio.volume = volume;
  }

  get #deck() {
    return this.#decks[this.#front];
  }

  /** @param {boolean} enabled */
  #setEnabled(enabled) {
    this.#enabled.value = enabled;
    localStorage.setItem(ENABLED_KEY, String(enabled));
  }

  /**
   * @param {StatRange} range
   * @param {number} version
   */
  async #load(range, version) {
    const key = `${JSON.stringify(range)}|${version}`;
    if (key === this.#songsKey) return;
    this.#songsKey = key;

    this.#request?.abort();
    const request = new AbortController();
    this.#request = request;

    /** @type {SoundtrackSongs} */
    let songs;
    try {
      songs = await this.#navidrome.getSoundtrack(range, request.signal);
    } catch {
      if (request.signal.aborted) return;
      this.#songsKey = null;
      songs = {};
    }
    if (!request.signal.aborted) this.#songs.value = songs;
  }

  /**
   * @param {SoundtrackSongs} songs
   * @param {StatType} stat
   */
  #follow(songs, stat) {
    clearTimeout(this.#switchTimer);
    const current = this.#song.value;
    const next = songFor(songs, stat, current);
    if (next?.id === current?.id) return;

    // The first song starts at once. Later ones wait for the slide to settle.
    if (current === null || next === null) this.#switchTo(next);
    else this.#switchTimer = setTimeout(() => this.#switchTo(next), SWITCH_DELAY_MS);
  }

  /** @param {SoundtrackSong | null} song */
  #switchTo(song) {
    const outgoing = this.#deck;
    this.#front = 1 - this.#front;
    const incoming = this.#deck;

    incoming.stop();
    if (song) this.#cue(incoming, song);
    this.#song.value = song;
    this.#announce(song);

    if (this.#wanted) {
      outgoing.fade(0, CROSSFADE_MS, () => outgoing.stop());
      this.#resume(CROSSFADE_MS);
    } else {
      outgoing.stop();
    }
    this.#playing.value = !incoming.audio.paused;
  }

  /**
   * @param {Deck} deck
   * @param {SoundtrackSong} song
   */
  #cue(deck, song) {
    const src = this.#navidrome.streamUrl(song.id, {
      offset: startOffset(song.duration),
      transcode: deck.transcoded,
    });
    deck.cue(song, src);
  }

  /**
   * Names the song to the operating system's media controls.
   *
   * @param {SoundtrackSong | null} song
   */
  #announce(song) {
    if (!('mediaSession' in navigator)) return;
    const navidrome = this.#navidrome;
    navigator.mediaSession.metadata = song
      ? new MediaMetadata({
          title: song.title,
          artist: song.artist,
          artwork: navidrome.coverArtAvailable.value
            ? [{ src: navidrome.coverUrl(song.album_id, 300), sizes: '300x300' }]
            : [],
        })
      : null;
  }

  /** @param {number} [fadeMs] */
  #resume(fadeMs = FADE_IN_MS) {
    const deck = this.#deck;
    const audio = deck.audio;
    if (!audio.getAttribute('src')) return;
    if (!audio.paused) {
      this.#playing.value = true;
      deck.fade(this.#volume.value, fadeMs);
      return;
    }

    deck.stopFade();
    audio.volume = 0;
    audio.play().then(
      () => {
        this.#blocked = false;
        if (this.#wanted && deck === this.#deck) deck.fade(this.#volume.value, fadeMs);
      },
      (error) => {
        const refused = error instanceof DOMException && error.name === 'NotAllowedError';
        if (refused && deck === this.#deck) this.#blocked = true;
      },
    );
  }

  /** Fades out, then pauses. The control shows silence from the start of the fade. */
  #halt() {
    const deck = this.#deck;
    if (deck.audio.paused) return;
    this.#playing.value = false;
    deck.fade(0, FADE_OUT_MS, () => deck.audio.pause());
  }

  /** The slide's song ended while the slide is still on screen. */
  #replay() {
    const deck = this.#deck;
    if (!deck.song) return;
    this.#cue(deck, deck.song);
    if (this.#wanted) this.#resume();
  }

  /** The browser could not decode the original file, so try it once as MP3. */
  #recover() {
    const deck = this.#deck;
    if (!deck.song || deck.transcoded) {
      this.#playing.value = false;
      return;
    }
    deck.transcoded = true;
    this.#cue(deck, deck.song);
    if (this.#wanted) this.#resume();
  }

  /** @param {Event} event */
  #unlock(event) {
    if (!this.#blocked || !this.#wanted) return;

    // The music control's own click decides whether to start.
    if (event.target instanceof Element && event.target.closest('app-soundtrack-control')) return;
    this.#resume();
  }
}

/** One audio element with the song it holds and its volume ramp. */
class Deck {
  audio = new Audio();

  /** @type {SoundtrackSong | null} */
  song = null;

  /** Whether the song streams as MP3, because the browser could not decode the original. */
  transcoded = false;

  /** @type {ReturnType<typeof setInterval> | undefined} */
  #fadeTimer;

  constructor() {
    // Nothing downloads until the song plays.
    this.audio.preload = 'none';
  }

  /**
   * @param {SoundtrackSong} song
   * @param {string} src
   */
  cue(song, src) {
    this.stopFade();
    this.song = song;
    this.audio.src = src;
  }

  stop() {
    this.stopFade();
    this.song = null;
    this.transcoded = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  /**
   * Ramps the volume on a timer rather than animation frames, which stop in a hidden tab.
   *
   * @param {number} target
   * @param {number} duration
   * @param {() => void} [done]
   */
  fade(target, duration, done) {
    this.stopFade();
    const audio = this.audio;
    const from = audio.volume;
    const start = performance.now();
    this.#fadeTimer = setInterval(() => {
      const progress = Math.min((performance.now() - start) / duration, 1);
      audio.volume = progress < 1 ? from + (target - from) * progress : target;
      if (progress < 1) return;
      this.stopFade();
      done?.();
    }, FADE_STEP_MS);
  }

  stopFade() {
    clearInterval(this.#fadeTimer);
  }
}

/**
 * The song for `stat`. A slide without its own song keeps the current one, if the
 * range's soundtrack has it, or plays the range's top song.
 *
 * @param {SoundtrackSongs} songs
 * @param {StatType} stat
 * @param {SoundtrackSong | null} current
 * @returns {SoundtrackSong | null}
 */
function songFor(songs, stat, current) {
  const own = songs[stat];
  if (own) return own;
  if (current && Object.values(songs).some((song) => song?.id === current.id)) return current;
  return songs.summary ?? null;
}

/** @returns {number} */
function readVolume() {
  const stored = localStorage.getItem(VOLUME_KEY);
  const volume = stored === null ? NaN : Number(stored);
  return volume >= 0 && volume <= 1 ? volume : DEFAULT_VOLUME;
}

/**
 * Where a song starts, in whole seconds.
 *
 * @param {number} duration In seconds.
 * @returns {number}
 */
function startOffset(duration) {
  if (!(duration >= SKIP_INTRO_MIN_SECONDS)) return 0;
  return Math.floor(Math.min(duration / 4, SKIP_INTRO_MAX_SECONDS));
}
