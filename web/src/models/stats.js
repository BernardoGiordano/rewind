/** @import { StatDefinition } from './types.js' */

/** @type {StatDefinition[]} */
export const STAT_DEFINITIONS = [
  { type: 'summary', labelKey: 'stats.summary', icon: 'heroMusicalNote', gradient: 'from-violet-600 to-indigo-950', yearOnly: false },
  { type: 'top-songs', labelKey: 'stats.topSongs', icon: 'heroEllipsisHorizontalCircle', gradient: 'from-emerald-500 to-teal-950', yearOnly: false },
  { type: 'top-artists', labelKey: 'stats.topArtists', icon: 'heroMicrophone', gradient: 'from-rose-500 to-pink-950', yearOnly: false },
  { type: 'top-albums', labelKey: 'stats.topAlbums', icon: 'heroSquare3Stack3d', gradient: 'from-sky-500 to-indigo-950', yearOnly: false },
  { type: 'top-genres', labelKey: 'stats.topGenres', icon: 'heroSparkles', gradient: 'from-amber-500 to-orange-950', yearOnly: false },
  { type: 'listening-clock', labelKey: 'stats.listeningClock', icon: 'heroClock', gradient: 'from-cyan-500 to-blue-950', yearOnly: true },
  { type: 'monthly-trends', labelKey: 'stats.monthlyTrends', icon: 'heroChartBar', gradient: 'from-lime-500 to-green-950', yearOnly: true },
  { type: 'day-of-week', labelKey: 'stats.dayOfWeek', icon: 'heroCalendarDays', gradient: 'from-orange-500 to-red-950', yearOnly: true },
  { type: 'streak', labelKey: 'stats.streak', icon: 'heroFire', gradient: 'from-red-500 to-rose-950', yearOnly: true },
  { type: 'late-night', labelKey: 'stats.lateNight', icon: 'heroMoon', gradient: 'from-indigo-500 to-slate-950', yearOnly: true },
  { type: 'on-repeat', labelKey: 'stats.onRepeat', icon: 'heroArrowPath', gradient: 'from-fuchsia-500 to-purple-950', yearOnly: true },
  { type: 'song-of-month', labelKey: 'stats.songOfMonth', icon: 'heroTrophy', gradient: 'from-yellow-500 to-amber-950', yearOnly: true },
  { type: 'favorite-decades', labelKey: 'stats.favoriteDecades', icon: 'heroRadio', gradient: 'from-teal-500 to-emerald-950', yearOnly: false },
  { type: 'recap', labelKey: 'stats.recap', icon: 'heroHeart', gradient: 'from-pink-500 to-violet-950', yearOnly: false },
];
