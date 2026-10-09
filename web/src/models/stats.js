/** @import { StatDefinition } from './types.js' */

/** @type {StatDefinition[]} */
export const STAT_DEFINITIONS = [
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
