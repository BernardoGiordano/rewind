/**
 * The shapes the API returns and the dashboard passes around. Modules reach them with
 * `@import`, so the browser never loads this file.
 */

/** The window of listening history a range-aware section reads. */
export type StatRange =
  | { kind: 'all-time' }
  | { kind: 'year'; year: string }
  | { kind: 'custom'; from: string; to: string };

/**
 * The range as query params, `null` where the param does not apply, so one object both
 * writes the current range and clears the params belonging to the other kinds.
 */
export interface RangeParams {
  year: string | null;
  from: string | null;
  to: string | null;
  range: string | null;
}

/** Anything with a `get`, so this reads a `URLSearchParams` and a plain map alike. */
export interface ParamReader {
  get(name: string): string | null;
}

/** A one-click window the period panel offers next to the years. */
export interface RangePreset {
  labelKey: string;
  range: StatRange;
}

/**
 * Translation for code that builds text outside a template. The browser passes srl's
 * `t` and the active locale; tests pass a bundle of their own.
 */
export interface I18n {
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  locale: string;
}

export interface TopSong {
  title: string;
  artist: string;
  album: string;
  plays: number;
  total_minutes: number;
  album_id: string;
  artist_id: string;
}

export interface TopArtist {
  artist: string;
  plays: number;
  unique_tracks: number;
  total_hours: number;
  artist_id: string;
}

export interface TopAlbum {
  album: string;
  album_artist: string;
  plays: number;
  total_minutes: number;
  album_id: string;
  artist_id: string;
}

export interface TopGenre {
  genre: string;
  plays: number;
  total_hours: number;
}

export interface ListeningSummary {
  total_plays: number;
  unique_songs: number;
  unique_artists: number;
  unique_albums: number;
  total_hours: number;
  total_days: number;
}

export interface ListeningClock {
  hour: number;
  plays: number;
  total_hours: number;
}

export interface MonthlyTrend {
  month: string;
  plays: number;
  unique_songs: number;
  unique_artists: number;
  hours: number;
}

export interface DayOfWeek {
  day: string;
  plays: number;
  total_hours: number;
}

export interface ListeningStreak {
  streak_start: string;
  streak_end: string;
  streak_days: number;
}

export interface LateNightTrack {
  title: string;
  artist: string;
  late_night_plays: number;
  album_id: string;
  artist_id: string;
}

export interface OnRepeatEntry {
  the_date: string;
  title: string;
  artist: string;
  artist_id: string;
  plays_that_day: number;
}

export interface SongOfMonth {
  month: string;
  title: string;
  artist: string;
  plays: number;
  album_id: string;
  artist_id: string;
}

export interface FavoriteDecade {
  decade: number;
  total_plays: number;
  unique_artists: number;
  total_hours: number;
}

export interface RecapData {
  top_artist: TopArtist;
  top_artists: TopArtist[];
  top_songs: TopSong[];
  total_minutes: number;
  top_genre: string;
}

export type StatType =
  | 'summary'
  | 'top-songs'
  | 'top-artists'
  | 'top-albums'
  | 'top-genres'
  | 'listening-clock'
  | 'monthly-trends'
  | 'day-of-week'
  | 'streak'
  | 'late-night'
  | 'on-repeat'
  | 'song-of-month'
  | 'favorite-decades'
  | 'recap';

/** Each stat's response, keyed by the stat that returns it. */
export interface StatData {
  summary: ListeningSummary | null;
  'top-songs': TopSong[];
  'top-artists': TopArtist[];
  'top-albums': TopAlbum[];
  'top-genres': TopGenre[];
  'listening-clock': ListeningClock[];
  'monthly-trends': MonthlyTrend[];
  'day-of-week': DayOfWeek[];
  streak: ListeningStreak[];
  'late-night': LateNightTrack[];
  'on-repeat': OnRepeatEntry[];
  'song-of-month': SongOfMonth[];
  'favorite-decades': FavoriteDecade[];
  recap: RecapData | null;
}

export interface StatDefinition {
  type: StatType;
  labelKey: string;
  icon: string;
  gradient: string;
  yearOnly: boolean;
}

export interface ArtistHeatmapDay {
  day: string;
  plays: number;
}

export interface ArtistTopTrack {
  id: string;
  title: string;
  album: string;
  album_id: string;
  plays: number;
  total_minutes: number;
}

export interface ArtistTopAlbum {
  album: string;
  album_id: string;
  plays: number;
  unique_tracks: number;
  total_minutes: number;
}

export interface ArtistClockHour {
  hour: number;
  plays: number;
}

export interface ArtistDayOfWeek {
  day: string;
  plays: number;
}

export interface ArtistRankPoint {
  month: string;
  plays: number;
  rnk: number;
}

export interface ArtistSongOfMonth {
  month: string;
  title: string;
  album_id: string;
  plays: number;
}

export interface ArtistRecentScrobble {
  title: string;
  album: string;
  album_id: string;
  played_at: number;
}

export interface ArtistDetail {
  artist_id: string;
  artist: string | null;
  plays: number;
  unique_tracks: number;
  total_hours: number;
  rank: number | null;
  total_artists: number | null;
  share_pct: number;
  first_scrobble: number | null;
  last_scrobble: number | null;
  lifetime_plays: number;
  lifetime_unique_tracks: number;
  played_tracks: number;
  library_tracks: number;
  heatmap: ArtistHeatmapDay[];
  top_tracks: ArtistTopTrack[];
  top_albums: ArtistTopAlbum[];
  listening_clock: ArtistClockHour[];
  day_of_week: ArtistDayOfWeek[];
  rank_trajectory: ArtistRankPoint[];
  song_of_month: ArtistSongOfMonth[];
  recent_scrobbles: ArtistRecentScrobble[];
}
