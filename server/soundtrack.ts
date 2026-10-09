import type { Database } from 'better-sqlite3';

type Range = { startTs: number; endTs: number } | null;

/** A song the recap plays. `duration` is in seconds. */
export type SoundtrackSong = {
  id: string;
  title: string;
  artist: string;
  album_id: string;
  duration: number;
};

export type Soundtrack = Partial<Record<string, SoundtrackSong>>;

const SONG_COLUMNS = 'mf.id, mf.title, mf.artist, mf.album_id, mf.duration';
// Song orders end on the id, as the cards' do, so a tie breaks the same way.
const BY_MINUTES = 'SUM(mf.duration) DESC, mf.id';
const BY_PLAYS = 'COUNT(*) DESC, SUM(mf.duration) DESC, mf.id';

const HOUR = `CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER)`;
const MONTH = `strftime('%Y-%m', s.submission_time, 'unixepoch')`;
const WEEKDAY = `strftime('%w', s.submission_time, 'unixepoch')`;
const DAY = `date(s.submission_time, 'unixepoch')`;
const GENRE = `g.value->>'$.value'`;

/**
 * One song per stat slide, tied to what the slide shows over the range.
 *
 * A slide that ranks songs plays its #1 row. A slide that ranks something else plays
 * the most-played song inside its #1 entry: the top artist, album, genre or decade,
 * the busiest hour, weekday or month, or the longest streak. Entries are ranked the
 * way the cards rank them. A slide with nothing to show gets no song.
 */
export function soundtrackFor(db: Database, uid: string, range: Range): Soundtrack {
  const songs = new SongQuery(db, uid, range);
  const top = songs.top(BY_MINUTES);

  const result: Soundtrack = {
    summary: top,
    'top-songs': top,
    'top-artists': songs.within(
      'mf.artist_id',
      songs.topKey('mf.artist_id', 'SUM(mf.duration) DESC'),
    ),
    'top-albums': songs.within('mf.album_id', songs.topKey('mf.album_id', 'SUM(mf.duration) DESC')),
    'top-genres': songs.inGenre(songs.topGenre()),
    'favorite-decades': songs.inDecade(songs.topDecade()),
    recap: top,
  };

  // These slides exist only for a bounded range.
  if (range) {
    const streak = songs.longestStreak();
    Object.assign(result, {
      'listening-clock': songs.within(HOUR, songs.topKey(HOUR, 'COUNT(*) DESC')),
      'monthly-trends': songs.within(MONTH, songs.topKey(MONTH, 'COUNT(*) DESC')),
      'day-of-week': songs.within(WEEKDAY, songs.topKey(WEEKDAY, 'COUNT(*) DESC')),
      streak: streak
        ? songs.top(BY_PLAYS, ` AND ${DAY} BETWEEN ? AND ?`, [streak.start, streak.end])
        : undefined,
      'late-night': songs.top(BY_PLAYS, ` AND ${HOUR} BETWEEN 0 AND 4`),
      'on-repeat': songs.onRepeat(),
      'song-of-month': songs.songOfMonths(),
    });
  }

  return result;
}

/** Queries over one user's scrobbles in one range. */
class SongQuery {
  readonly #db: Database;
  readonly #uid: string;
  readonly #range: Range;

  constructor(db: Database, uid: string, range: Range) {
    this.#db = db;
    this.#uid = uid;
    this.#range = range;
  }

  /** The first song by `order` among scrobbles matching `filter`, skipping missing files. */
  top(order: string, filter = '', params: unknown[] = []): SoundtrackSong | undefined {
    return this.#get<SoundtrackSong>(
      `SELECT ${SONG_COLUMNS}
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ?${this.#rangeSql()} AND COALESCE(mf.missing, 0) = 0${filter}
      GROUP BY mf.id ORDER BY ${order} LIMIT 1`,
      [...this.#params(), ...params],
    );
  }

  /** The most-played song whose `key` expression equals `value`. */
  within(key: string, value: unknown): SoundtrackSong | undefined {
    if (value === undefined || value === null) return undefined;
    return this.top(BY_PLAYS, ` AND ${key} = ?`, [value]);
  }

  /** The value of `key` that ranks first by `order` over the range, the lowest value on a tie. */
  topKey(key: string, order: string): unknown {
    return this.#get<{ value: unknown }>(
      `SELECT ${key} AS value
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ?${this.#rangeSql()}
      GROUP BY 1 ORDER BY ${order}, 1 LIMIT 1`,
      this.#params(),
    )?.value;
  }

  topGenre(): string | undefined {
    return this.#get<{ value: string }>(
      `SELECT ${GENRE} AS value
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id,
        json_each(json_extract(mf.tags, '$.genre')) AS g
      WHERE s.user_id = ?${this.#rangeSql()}
        AND ${GENRE} IS NOT NULL AND TRIM(${GENRE}) != ''
      GROUP BY 1 ORDER BY SUM(mf.duration) DESC, 1 LIMIT 1`,
      this.#params(),
    )?.value;
  }

  inGenre(genre: string | undefined): SoundtrackSong | undefined {
    if (genre === undefined) return undefined;
    const filter = ` AND EXISTS (SELECT 1 FROM json_each(json_extract(mf.tags, '$.genre')) AS g
      WHERE ${GENRE} = ?)`;
    return this.top(BY_PLAYS, filter, [genre]);
  }

  /** All time ranks decades by play counts, as the card does, because scrobbles start late. */
  topDecade(): number | undefined {
    if (this.#range) {
      return this.#get<{ value: number }>(
        `SELECT (mf.year / 10) * 10 AS value
        FROM scrobbles s
        JOIN media_file mf ON s.media_file_id = mf.id
        WHERE s.user_id = ?${this.#rangeSql()} AND mf.year > 0
        GROUP BY 1 ORDER BY SUM(mf.duration) DESC, 1 LIMIT 1`,
        this.#params(),
      )?.value;
    }
    return this.#get<{ value: number }>(
      `SELECT (mf.year / 10) * 10 AS value
      FROM annotation a
      JOIN media_file mf ON a.item_id = mf.id
      WHERE a.item_type = 'media_file' AND a.user_id = ? AND a.play_count > 0 AND mf.year > 0
      GROUP BY 1 ORDER BY SUM(mf.duration * a.play_count) DESC, 1 LIMIT 1`,
      [this.#uid],
    )?.value;
  }

  inDecade(decade: number | undefined): SoundtrackSong | undefined {
    if (decade === undefined) return undefined;
    return this.top(BY_PLAYS, ' AND mf.year >= ? AND mf.year < ?', [decade, decade + 10]);
  }

  /** Ordered like the streak card, so its first row is this one. */
  longestStreak(): { start: string; end: string } | undefined {
    return this.#get<{ start: string; end: string }>(
      `WITH days AS (
        SELECT DISTINCT ${DAY} AS day
        FROM scrobbles s
        WHERE s.user_id = ?${this.#rangeSql()}
      ),
      numbered AS (
        SELECT day, julianday(day) - ROW_NUMBER() OVER (ORDER BY day) AS streak_group
        FROM days
      )
      SELECT MIN(day) AS start, MAX(day) AS end
      FROM numbered GROUP BY streak_group
      ORDER BY COUNT(*) DESC, MIN(day) DESC LIMIT 1`,
      this.#params(),
    );
  }

  /** The song played most times in a single day, at least three. */
  onRepeat(): SoundtrackSong | undefined {
    return this.#get<SoundtrackSong>(
      `SELECT ${SONG_COLUMNS}
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ?${this.#rangeSql()} AND COALESCE(mf.missing, 0) = 0
      GROUP BY ${DAY}, mf.id HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC, ${DAY} DESC, mf.id LIMIT 1`,
      this.#params(),
    );
  }

  /** The song that tops the most months, then the one with the most plays in those months. */
  songOfMonths(): SoundtrackSong | undefined {
    return this.#get<SoundtrackSong>(
      `WITH monthly AS (
        SELECT mf.id AS id, COUNT(*) AS plays,
          ROW_NUMBER() OVER (PARTITION BY ${MONTH} ORDER BY COUNT(*) DESC) AS rn
        FROM scrobbles s
        JOIN media_file mf ON s.media_file_id = mf.id
        WHERE s.user_id = ?${this.#rangeSql()}
        GROUP BY ${MONTH}, mf.id
      )
      SELECT ${SONG_COLUMNS}
      FROM monthly m
      JOIN media_file mf ON mf.id = m.id
      WHERE m.rn = 1 AND COALESCE(mf.missing, 0) = 0
      GROUP BY mf.id ORDER BY COUNT(*) DESC, SUM(m.plays) DESC, mf.id LIMIT 1`,
      this.#params(),
    );
  }

  #rangeSql(): string {
    return this.#range ? ' AND s.submission_time >= ? AND s.submission_time < ?' : '';
  }

  /** The user, then the range bounds when there is a range. */
  #params(): unknown[] {
    return this.#range ? [this.#uid, this.#range.startTs, this.#range.endTs] : [this.#uid];
  }

  #get<T>(sql: string, params: unknown[]): T | undefined {
    return this.#db.prepare(sql).get(...params) as T | undefined;
  }
}
