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

export interface StatDefinition {
  type: StatType;
  label: string;
  icon: string;
  gradient: string;
  yearOnly: boolean;
}

export const STAT_DEFINITIONS: StatDefinition[] = [
  { type: 'summary', label: 'Your Year in Music', icon: 'heroMusicalNote', gradient: 'from-violet-600 to-indigo-950', yearOnly: false },
  { type: 'top-songs', label: 'Top Songs', icon: 'heroEllipsisHorizontalCircle', gradient: 'from-emerald-500 to-teal-950', yearOnly: false },
  { type: 'top-artists', label: 'Top Artists', icon: 'heroMicrophone', gradient: 'from-rose-500 to-pink-950', yearOnly: false },
  { type: 'top-albums', label: 'Top Albums', icon: 'heroSquare3Stack3d', gradient: 'from-sky-500 to-indigo-950', yearOnly: false },
  { type: 'top-genres', label: 'Top Genres', icon: 'heroSparkles', gradient: 'from-amber-500 to-orange-950', yearOnly: false },
  { type: 'listening-clock', label: 'Listening Clock', icon: 'heroClock', gradient: 'from-cyan-500 to-blue-950', yearOnly: true },
  { type: 'monthly-trends', label: 'Monthly Trends', icon: 'heroChartBar', gradient: 'from-lime-500 to-green-950', yearOnly: true },
  { type: 'day-of-week', label: 'Day of the Week', icon: 'heroCalendarDays', gradient: 'from-orange-500 to-red-950', yearOnly: true },
  { type: 'streak', label: 'Listening Streak', icon: 'heroFire', gradient: 'from-red-500 to-rose-950', yearOnly: true },
  { type: 'late-night', label: 'Late Night Vibes', icon: 'heroMoon', gradient: 'from-indigo-500 to-slate-950', yearOnly: true },
  { type: 'on-repeat', label: 'On Repeat', icon: 'heroArrowPath', gradient: 'from-fuchsia-500 to-purple-950', yearOnly: true },
  { type: 'song-of-month', label: 'Song of the Month', icon: 'heroTrophy', gradient: 'from-yellow-500 to-amber-950', yearOnly: true },
  { type: 'favorite-decades', label: 'Favorite Decades', icon: 'heroRadio', gradient: 'from-teal-500 to-emerald-950', yearOnly: false },
  { type: 'recap', label: 'Your Recap', icon: 'heroHeart', gradient: 'from-pink-500 to-violet-950', yearOnly: false },
];
