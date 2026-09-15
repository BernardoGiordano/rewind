import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChartBarSquare,
  heroChevronRight,
  heroMagnifyingGlass,
  heroPlus,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { CoverComponent } from '../cover';
import { NavidromeService } from '../../services/navidrome.service';

export type LibraryKind = 'artists' | 'albums' | 'songs';

type Item = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  album_id?: string;
  artist_id?: string;
  cover_id?: string;
  songs?: number;
  albums?: number;
  plays?: number;
  duration?: number;
  year?: number | null;
  disc_number?: number;
  track_number?: number;
};
type Entry = Item & { time: number; duration: number };
type Selection = { kind: 'song' | 'album'; id: string; title: string };
type Named = { id: string; name: string; cover_id: string };
type Context = { artist?: Named; album?: Named & { artist: string; artist_id: string } };

const PAGE_SIZE = 50;

const TABS: { key: LibraryKind; label: string }[] = [
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'songs', label: 'Songs' },
];

@Component({
  selector: 'app-library',
  host: { class: 'block h-full' },
  templateUrl: './library.html',
  styleUrl: './library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CoverComponent, DatePipe, NgIcon],
  providers: [
    provideIcons({
      heroChartBarSquare,
      heroChevronRight,
      heroMagnifyingGlass,
      heroPlus,
      heroXMark,
    }),
  ],
})
export class Library {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navidrome = inject(NavidromeService);

  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('scrobbleDialog');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly tabs = TABS;
  readonly pageSize = PAGE_SIZE;

  readonly kind = signal<LibraryKind>('artists');
  readonly items = signal<Item[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly canScrobble = signal(false);

  /** Drill-down: the artist or album whose contents are listed, named by the server. */
  readonly artist = signal('');
  readonly album = signal('');
  readonly context = signal<Context>({});
  readonly focus = computed(() => this.context().album ?? this.context().artist ?? null);
  readonly focusIsAlbum = computed(() => !!this.context().album);
  /** The artist crumb, falling back to the album's own artist when browsing an album directly. */
  readonly artistCrumb = computed(() => {
    const { artist, album } = this.context();
    if (artist) return { id: artist.id, name: artist.name };
    if (album?.artist_id) return { id: album.artist_id, name: album.artist };
    return null;
  });

  readonly search = signal('');

  /** The standing hero is an introduction, so it yields once the user is searching or paging. */
  readonly heroCollapsed = computed(() => this.offset() > 0 || this.search().length > 0);

  /** Song rows read badly at full width, so the songs view takes a narrower measure. */
  readonly measure = computed(() => (this.kind() === 'songs' ? 'max-w-3xl' : 'max-w-7xl'));
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : this.offset() + 1));
  readonly rangeEnd = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  readonly hasPrevious = computed(() => this.offset() > 0);
  readonly hasNext = computed(() => this.offset() + PAGE_SIZE < this.total());

  // Scrobble dialog
  readonly selection = signal<Selection | null>(null);
  readonly entries = signal<Entry[]>([]);
  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly message = signal('');
  readonly failed = signal(false);
  readonly previewError = signal('');
  when = '';
  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  private requestId = '';
  private readonly loadVersion = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.navidrome.loadConfig();
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const kind = params.get('kind');
        this.kind.set(kind === 'albums' || kind === 'songs' ? kind : 'artists');
        this.artist.set(params.get('artist') ?? '');
        this.album.set(params.get('album') ?? '');
        this.search.set(params.get('q') ?? '');
        this.offset.set(Math.max(0, Number(params.get('offset') ?? 0) || 0));
        this.scroller()?.nativeElement.scrollTo({ top: 0 });
        this.load();
      });
    });
    this.destroyRef.onDestroy(() => this.clearSearchTimer());
  }

  load(): void {
    const version = this.loadVersion() + 1;
    this.loadVersion.set(version);
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<{ items: Item[]; total: number; canScrobble: boolean; context: Context }>(
        '/api/library',
        {
          params: {
            kind: this.kind(),
            q: this.search(),
            offset: this.offset(),
            artist: this.artist(),
            album: this.album(),
          },
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (version !== this.loadVersion()) return;
          this.items.set(data.items);
          this.total.set(data.total);
          this.canScrobble.set(data.canScrobble);
          this.context.set(data.context ?? {});
          this.loading.set(false);
        },
        error: () => {
          if (version !== this.loadVersion()) return;
          this.error.set('Could not load the library. Try again.');
          this.loading.set(false);
        },
      });
  }

  /** Each tab keeps whatever part of the drill-down still applies at its level. */
  browse(kind: LibraryKind): void {
    this.show(kind, kind === 'artists' ? '' : this.artist(), kind === 'songs' ? this.album() : '');
  }

  /** Open an item one level deeper: artist to its albums, album to its songs. */
  open(item: Item): void {
    if (this.kind() === 'artists') this.show('albums', item.id, '');
    else this.show('songs', this.artist(), item.id);
  }

  show(kind: LibraryKind, artist: string, album: string): void {
    void this.router.navigate(['/library'], {
      queryParams: {
        kind,
        q: this.search() || null,
        artist: artist || null,
        album: album || null,
      },
    });
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => this.applySearch(), 300);
  }

  clearSearch(): void {
    this.search.set('');
    this.clearSearchTimer();
    this.applySearch();
  }

  /** Search replaces the history entry so Back leaves the page, not each keystroke. */
  applySearch(): void {
    this.clearSearchTimer();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.search() || null, offset: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  page(offset: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { offset: offset || null },
      queryParamsHandling: 'merge',
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds || seconds <= 0) return '—';
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
  }

  // --- Scrobble dialog ---

  start(kind: 'song' | 'album', id: string, title: string): void {
    this.selection.set({ kind, id, title });
    const now = new Date();
    this.when = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    this.entries.set([]);
    this.message.set('');
    this.failed.set(false);
    this.previewError.set('');
    this.submitted.set(false);
    this.requestId =
      globalThis.crypto?.randomUUID?.() ??
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    this.dialog()?.nativeElement.showModal();
    this.preview();
  }

  changedTime(): void {
    this.entries.set([]);
    this.previewError.set('');
  }

  private body() {
    return { ...this.selection(), finishedAt: new Date(this.when).getTime() };
  }

  preview(): void {
    if (this.busy()) return;
    if (!this.when || !Number.isFinite(new Date(this.when).getTime())) {
      this.previewError.set('Choose a valid date and time.');
      return;
    }
    this.busy.set(true);
    this.entries.set([]);
    this.previewError.set('');
    this.http
      .post<{ entries: Entry[] }>('/api/library/scrobbles/preview', this.body())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.entries.set(data.entries);
          this.busy.set(false);
        },
        error: (error) => {
          this.previewError.set(error.error?.error ?? 'Could not preview scrobbles.');
          this.busy.set(false);
        },
      });
  }

  submit(): void {
    if (this.busy() || this.submitted() || !this.entries().length) return;
    this.busy.set(true);
    this.http
      .post<{ status: string; message: string }>('/api/library/scrobbles', {
        ...this.body(),
        requestId: this.requestId,
        entries: this.entries().map(({ id, time }) => ({ id, time })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.message.set(result.message);
          this.failed.set(result.status !== 'confirmed');
          this.submitted.set(true);
          this.busy.set(false);
          this.navidrome.historyChanged.next();
          this.load();
        },
        error: (error) => {
          this.message.set(
            error.error?.error ??
              'Submission outcome unknown. Check listening history before trying again.',
          );
          this.failed.set(true);
          this.submitted.set(true);
          this.busy.set(false);
          this.navidrome.historyChanged.next();
        },
      });
  }

  close(event?: Event): void {
    if (this.busy()) {
      event?.preventDefault();
      return;
    }
    this.dialog()?.nativeElement.close();
  }
}
