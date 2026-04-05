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
  | 'favorite-decades';

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
];
