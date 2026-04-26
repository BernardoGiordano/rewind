import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import type { Database } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

function resolveDbPath(): string {
  const localPath = join(process.cwd(), 'navidrome.db');
  if (existsSync(localPath)) return localPath;
  return process.env['DB_PATH'] ?? '/data/navidrome.db';
}

let db: Database | null = null;

function getDb(): Database {
  if (!db || !db.open) {
    db = new BetterSqlite3(resolveDbPath(), { readonly: true });
  }
  return db;
}

process.on('exit', () => db?.close());
process.on('SIGINT', () => {
  db?.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  db?.close();
  process.exit(0);
});

function queryAll<T>(db: Database, sql: string, params: (string | number | null)[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

function queryOne<T>(db: Database, sql: string, params: (string | number | null)[] = []): T | null {
  return (db.prepare(sql).get(...params) as T) ?? null;
}

function yearBounds(year: number): { startTs: number; endTs: number } {
  const startTs = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
  const endTs = Math.floor(new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000);
  return { startTs, endTs };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function customBounds(from: string, to: string): { startTs: number; endTs: number } {
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    throw new Error('Invalid date format; expected YYYY-MM-DD');
  }
  const startTs = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const toDate = new Date(`${to}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const endTs = Math.floor(toDate.getTime() / 1000);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    throw new Error('Invalid date range');
  }
  return { startTs, endTs };
}

type Range = { startTs: number; endTs: number } | null;

function resolveRange(
  yearParam: string | undefined,
  fromParam: string | undefined,
  toParam: string | undefined,
): Range {
  if (fromParam && toParam) return customBounds(fromParam, toParam);
  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!Number.isFinite(y)) throw new Error('Invalid year');
    return yearBounds(y);
  }
  return null;
}

let cachedUserId: string | null = null;
function userId(db: Database): string {
  if (cachedUserId !== null) return cachedUserId;
  const user = process.env['NAVIDROME_USER'];
  if (!user) {
    throw new Error('NAVIDROME_USER is not set');
  }
  const row = queryOne<{ id: string }>(db, `SELECT id FROM user WHERE user_name = ?`, [user]);
  if (!row) {
    throw new Error(`No Navidrome user found with user_name='${user}'`);
  }
  cachedUserId = row.id;
  return cachedUserId;
}

// --- Navidrome Subsonic API config ---

function getNavidromeUrl(): string | null {
  return process.env['NAVIDROME_URL'] ?? null;
}

function getNavidromeUser(): string | null {
  return process.env['NAVIDROME_USER'] ?? null;
}

function getNavidromeApiKey(): string | null {
  return process.env['NAVIDROME_API_KEY'] ?? null;
}

/** Build Subsonic auth params using token-based auth (salt + md5). */
function buildSubsonicAuthParams(user: string, apiKey: string): URLSearchParams {
  const salt = Math.random().toString(36).substring(2, 10);
  const token = createHash('md5')
    .update(apiKey + salt)
    .digest('hex');
  const params = new URLSearchParams({
    u: user,
    t: token,
    s: salt,
    v: '1.16.1',
    c: 'navidrome-rewind',
    f: 'json',
  });
  return params;
}

function isCoverArtAvailable(): boolean {
  return !!(getNavidromeUrl() && getNavidromeUser() && getNavidromeApiKey());
}

// --- /api/config ---

function noCache(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

app.get('/api/config', (_req, res) => {
  const url = getNavidromeUrl();
  const user = getNavidromeUser();
  const apiKey = getNavidromeApiKey();
  console.log('[config] NAVIDROME_URL:', url ?? '(not set)');
  console.log('[config] NAVIDROME_USER:', user ?? '(not set)');
  console.log('[config] NAVIDROME_API_KEY:', apiKey ? '(set)' : '(not set)');
  noCache(res);
  res.json({ coverArtAvailable: isCoverArtAvailable() });
});

// --- /api/cover/:id — proxy to Navidrome getCoverArt ---

app.get('/api/cover/:id', (req, res) => {
  const baseUrl = getNavidromeUrl();
  const user = getNavidromeUser();
  const apiKey = getNavidromeApiKey();

  if (!baseUrl || !user || !apiKey) {
    console.error(
      '[cover] Not configured — missing NAVIDROME_URL, NAVIDROME_USER or NAVIDROME_API_KEY',
    );
    res.status(503).json({ error: 'Navidrome API not configured' });
    return;
  }

  const coverId = req.params['id'];
  const size = (req.query['size'] as string) ?? '150';
  const authParams = buildSubsonicAuthParams(user, apiKey);
  authParams.set('id', coverId);
  authParams.set('size', size);

  const cleanBase = baseUrl.replace(/\/$/, '');
  const coverUrl = `${cleanBase}/rest/getCoverArt?${authParams.toString()}`;

  console.log(
    '[cover] Fetching:',
    coverUrl.replace(/&t=[^&]+/, '&t=***').replace(/&s=[^&]+/, '&s=***'),
  );

  const requester = coverUrl.startsWith('https') ? httpsRequest : httpRequest;
  const proxyReq = requester(coverUrl, (proxyRes) => {
    console.log(
      '[cover] Response status:',
      proxyRes.statusCode,
      'content-type:',
      proxyRes.headers['content-type'],
    );
    const contentType = proxyRes.headers['content-type'] ?? 'image/jpeg';
    if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        console.error('[cover] Upstream error body:', Buffer.concat(chunks).toString());
      });
      res.status(502).json({ error: `Upstream returned ${proxyRes.statusCode}` });
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[cover] Proxy request error:', err.message);
    res.status(502).json({ error: 'Failed to fetch cover art' });
  });
  proxyReq.end();
});

// --- Available years ---
app.get('/api/years', (_req, res) => {
  try {
    const db = getDb();
    const rows = queryAll<{ year: string }>(
      db,
      `
      SELECT DISTINCT strftime('%Y', submission_time, 'unixepoch') AS year
      FROM scrobbles
      WHERE user_id = ?
      ORDER BY year DESC
    `,
      [userId(db)],
    );
    noCache(res);
    res.json(rows.map((r) => r.year));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Stats router ---
app.get('/api/stats/:type', (req, res) => {
  const statType = req.params['type'];
  const yearParam = req.query['year'] as string | undefined;
  const fromParam = req.query['from'] as string | undefined;
  const toParam = req.query['to'] as string | undefined;

  try {
    const range = resolveRange(yearParam, fromParam, toParam);
    const db = getDb();
    const uid = userId(db);
    let result: unknown;

    switch (statType) {
      case 'summary':
        result = getSummary(db, uid, range);
        break;
      case 'top-songs':
        result = getTopSongs(db, uid, range);
        break;
      case 'top-artists':
        result = getTopArtists(db, uid, range);
        break;
      case 'top-albums':
        result = getTopAlbums(db, uid, range);
        break;
      case 'top-genres':
        result = getTopGenres(db, uid, range);
        break;
      case 'listening-clock':
        result = range ? getListeningClock(db, uid, range) : [];
        break;
      case 'monthly-trends':
        result = range ? getMonthlyTrends(db, uid, range) : [];
        break;
      case 'day-of-week':
        result = range ? getDayOfWeek(db, uid, range) : [];
        break;
      case 'streak':
        result = range ? getStreak(db, uid, range) : [];
        break;
      case 'late-night':
        result = range ? getLateNight(db, uid, range) : [];
        break;
      case 'on-repeat':
        result = range ? getOnRepeat(db, uid, range) : [];
        break;
      case 'song-of-month':
        result = range ? getSongOfMonth(db, uid, range) : [];
        break;
      case 'favorite-decades':
        result = getFavoriteDecades(db, uid, range);
        break;
      case 'recap':
        result = getRecap(db, uid, range);
        break;
      default:
        res.status(404).json({ error: `Unknown stat type: ${statType}` });
        return;
    }

    noCache(res);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Query functions ---

function getSummary(db: Database, uid: string, range: Range) {
  if (range) {
    return queryOne(
      db,
      `
      SELECT
        COUNT(*) AS total_plays,
        COUNT(DISTINCT mf.id) AS unique_songs,
        COUNT(DISTINCT mf.artist_id) AS unique_artists,
        COUNT(DISTINCT mf.album_id) AS unique_albums,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
        ROUND(SUM(mf.duration) / 86400.0, 1) AS total_days
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryOne(
    db,
    `
    SELECT
      COUNT(*) AS total_plays,
      COUNT(DISTINCT mf.id) AS unique_songs,
      COUNT(DISTINCT mf.artist_id) AS unique_artists,
      COUNT(DISTINCT mf.album_id) AS unique_albums,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
      ROUND(SUM(mf.duration) / 86400.0, 1) AS total_days
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
  `,
    [uid],
  );
}

function getTopSongs(db: Database, uid: string, range: Range) {
  if (range) {
    return queryAll(
      db,
      `
      SELECT mf.title, mf.artist, mf.album, COUNT(*) AS plays,
        ROUND(mf.duration * COUNT(*) / 60.0, 1) AS total_minutes,
        mf.album_id, mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.id ORDER BY total_minutes DESC LIMIT 100
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryAll(
    db,
    `
    SELECT mf.title, mf.artist, mf.album, COUNT(*) AS plays,
      ROUND(mf.duration * COUNT(*) / 60.0, 1) AS total_minutes,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
    GROUP BY mf.id ORDER BY total_minutes DESC LIMIT 100
  `,
    [uid],
  );
}

function getTopArtists(db: Database, uid: string, range: Range) {
  if (range) {
    return queryAll(
      db,
      `
      SELECT COALESCE(a.name, mf.artist) AS artist,
        COUNT(*) AS plays,
        COUNT(DISTINCT mf.id) AS unique_tracks,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
        mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      LEFT JOIN artist a ON a.id = mf.artist_id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.artist_id ORDER BY total_hours DESC LIMIT 100
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryAll(
    db,
    `
    SELECT COALESCE(a.name, mf.artist) AS artist,
      COUNT(*) AS plays,
      COUNT(DISTINCT mf.id) AS unique_tracks,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
      mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    LEFT JOIN artist a ON a.id = mf.artist_id
    WHERE s.user_id = ?
    GROUP BY mf.artist_id ORDER BY total_hours DESC LIMIT 100
  `,
    [uid],
  );
}

function getTopAlbums(db: Database, uid: string, range: Range) {
  if (range) {
    return queryAll(
      db,
      `
      SELECT mf.album, mf.album_artist, COUNT(*) AS plays,
        ROUND(SUM(mf.duration) / 60.0, 1) AS total_minutes,
        mf.album_id, mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.album_id ORDER BY total_minutes DESC LIMIT 100
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryAll(
    db,
    `
    SELECT mf.album, mf.album_artist, COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 60.0, 1) AS total_minutes,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
    GROUP BY mf.album_id ORDER BY total_minutes DESC LIMIT 100
  `,
    [uid],
  );
}

function getTopGenres(db: Database, uid: string, range: Range) {
  if (range) {
    return queryAll(
      db,
      `
      SELECT g.value->>'$.value' AS genre, COUNT(*) AS plays,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id,
        json_each(json_extract(mf.tags, '$.genre')) AS g
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
        AND g.value->>'$.value' IS NOT NULL AND TRIM(g.value->>'$.value') != ''
      GROUP BY 1 ORDER BY total_hours DESC LIMIT 100
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryAll(
    db,
    `
    SELECT g.value->>'$.value' AS genre, COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id,
      json_each(json_extract(mf.tags, '$.genre')) AS g
    WHERE s.user_id = ?
      AND g.value->>'$.value' IS NOT NULL AND TRIM(g.value->>'$.value') != ''
    GROUP BY 1 ORDER BY total_hours DESC LIMIT 100
  `,
    [uid],
  );
}

function getListeningClock(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    SELECT CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER) AS hour,
      COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY hour ORDER BY hour
  `,
    [uid, startTs, endTs],
  );
}

function getMonthlyTrends(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    SELECT strftime('%Y-%m', s.submission_time, 'unixepoch') AS month,
      COUNT(*) AS plays,
      COUNT(DISTINCT mf.id) AS unique_songs,
      COUNT(DISTINCT mf.artist_id) AS unique_artists,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY month ORDER BY month
  `,
    [uid, startTs, endTs],
  );
}

function getDayOfWeek(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    SELECT
      CASE CAST(strftime('%w', s.submission_time, 'unixepoch') AS INTEGER)
        WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END AS day,
      COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY strftime('%w', s.submission_time, 'unixepoch')
    ORDER BY ((CAST(strftime('%w', s.submission_time, 'unixepoch') AS INTEGER) + 6) % 7) ASC
  `,
    [uid, startTs, endTs],
  );
}

function getStreak(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    WITH daily_plays AS (
      SELECT DISTINCT date(s.submission_time, 'unixepoch') AS play_date
      FROM scrobbles s
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    ),
    numbered AS (
      SELECT play_date,
        julianday(play_date) - ROW_NUMBER() OVER (ORDER BY play_date) AS streak_group
      FROM daily_plays
    )
    SELECT MIN(play_date) AS streak_start, MAX(play_date) AS streak_end,
      COUNT(*) AS streak_days
    FROM numbered GROUP BY streak_group ORDER BY streak_days DESC LIMIT 100
  `,
    [uid, startTs, endTs],
  );
}

function getLateNight(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    SELECT mf.title, mf.artist, COUNT(*) AS late_night_plays,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      AND CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER) BETWEEN 0 AND 4
    GROUP BY mf.id ORDER BY late_night_plays DESC LIMIT 100
  `,
    [uid, startTs, endTs],
  );
}

function getOnRepeat(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    SELECT date(s.submission_time, 'unixepoch') AS the_date,
      mf.title, mf.artist, COUNT(*) AS plays_that_day
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY the_date, mf.id HAVING COUNT(*) >= 3
    ORDER BY plays_that_day DESC LIMIT 100
  `,
    [uid, startTs, endTs],
  );
}

function getSongOfMonth(db: Database, uid: string, range: NonNullable<Range>) {
  const { startTs, endTs } = range;
  return queryAll(
    db,
    `
    WITH monthly_counts AS (
      SELECT strftime('%Y-%m', s.submission_time, 'unixepoch') AS month,
        mf.title, mf.artist, COUNT(*) AS plays,
        mf.album_id, mf.artist_id,
        ROW_NUMBER() OVER (
          PARTITION BY strftime('%Y-%m', s.submission_time, 'unixepoch')
          ORDER BY COUNT(*) DESC
        ) AS rn
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY month, mf.id
    )
    SELECT month, title, artist, plays, album_id, artist_id FROM monthly_counts WHERE rn = 1 ORDER BY month
  `,
    [uid, startTs, endTs],
  );
}

function getFavoriteDecades(db: Database, uid: string, range: Range) {
  if (range) {
    return queryAll(
      db,
      `
      SELECT (mf.year / 10) * 10 AS decade, COUNT(*) AS total_plays,
        COUNT(DISTINCT mf.artist_id) AS unique_artists,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
        AND mf.year > 0
      GROUP BY decade ORDER BY total_hours DESC LIMIT 100
    `,
      [uid, range.startTs, range.endTs],
    );
  }
  return queryAll(
    db,
    `
    SELECT (mf.year / 10) * 10 AS decade, SUM(a.play_count) AS total_plays,
      COUNT(DISTINCT mf.artist_id) AS unique_artists,
      ROUND(SUM(mf.duration * a.play_count) / 3600.0, 1) AS total_hours
    FROM annotation a
    JOIN media_file mf ON a.item_id = mf.id
    WHERE a.item_type = 'media_file' AND a.user_id = ? AND a.play_count > 0 AND mf.year > 0
    GROUP BY decade ORDER BY total_hours DESC LIMIT 100
  `,
    [uid],
  );
}

function getRecap(db: Database, uid: string, range: Range) {
  const topArtists = getTopArtists(db, uid, range) as Array<{
    artist: string;
    plays: number;
    unique_tracks: number;
    total_hours: number;
    artist_id: string;
  }>;
  const topSongs = getTopSongs(db, uid, range) as Array<{
    title: string;
    artist: string;
    album: string;
    plays: number;
    total_minutes: number;
    album_id: string;
    artist_id: string;
  }>;
  const summary = getSummary(db, uid, range) as { total_hours: number };
  const topGenres = getTopGenres(db, uid, range) as Array<{
    genre: string;
    plays: number;
    total_hours: number;
  }>;

  return {
    top_artist: topArtists[0] ?? null,
    top_artists: topArtists,
    top_songs: topSongs,
    total_minutes: Math.round((summary?.total_hours ?? 0) * 60),
    top_genre: topGenres[0]?.genre ?? 'Unknown',
  };
}

// --- /api/artist/:id — combined artist detail payload ---
app.get('/api/artist/:id', (req, res) => {
  const artistId = req.params['id'];
  const yearParam = req.query['year'] as string | undefined;
  const fromParam = req.query['from'] as string | undefined;
  const toParam = req.query['to'] as string | undefined;

  try {
    const range = resolveRange(yearParam, fromParam, toParam);
    const db = getDb();
    const uid = userId(db);

    const profile = getArtistProfile(db, uid, artistId, range);
    if (!profile.artist) {
      res.status(404).json({ error: 'Artist not found' });
      return;
    }

    const result = {
      ...profile,
      heatmap: getArtistHeatmap(db, uid, artistId, range),
      top_tracks: getArtistTopTracks(db, uid, artistId, range),
      top_albums: getArtistTopAlbums(db, uid, artistId, range),
      listening_clock: getArtistClock(db, uid, artistId, range),
      day_of_week: getArtistDayOfWeek(db, uid, artistId, range),
      rank_trajectory: getArtistRankTrajectory(db, uid, artistId, range),
      song_of_month: getArtistSongOfMonth(db, uid, artistId, range),
      recent_scrobbles: getArtistRecentScrobbles(db, uid, artistId),
    };

    noCache(res);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

function rangeClause(range: Range, alias = 's'): { sql: string; params: number[] } {
  if (!range) return { sql: '', params: [] };
  return {
    sql: ` AND ${alias}.submission_time >= ? AND ${alias}.submission_time < ?`,
    params: [range.startTs, range.endTs],
  };
}

function getArtistProfile(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  const inRange = queryOne<{
    artist: string | null;
    plays: number;
    unique_tracks: number;
    total_hours: number;
  }>(
    db,
    `
    SELECT COALESCE((SELECT a.name FROM artist a WHERE a.id = mf.artist_id), MAX(mf.artist)) AS artist,
      COUNT(*) AS plays,
      COUNT(DISTINCT mf.id) AS unique_tracks,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
  `,
    [uid, artistId, ...rc.params],
  );

  const overall = queryOne<{ total_plays: number }>(
    db,
    `
    SELECT COUNT(*) AS total_plays
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?${rc.sql}
  `,
    [uid, ...rc.params],
  );

  const rank = queryOne<{ rnk: number; total_artists: number }>(
    db,
    `
    WITH ranked AS (
      SELECT mf.artist_id, SUM(mf.duration) AS total_duration,
        RANK() OVER (ORDER BY SUM(mf.duration) DESC) AS rnk
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ?${rc.sql}
      GROUP BY mf.artist_id
    )
    SELECT rnk,
      (SELECT COUNT(*) FROM ranked) AS total_artists
    FROM ranked WHERE artist_id = ?
  `,
    [uid, ...rc.params, artistId],
  );

  // Always-scoped (ignore range) — first/last scrobble across full history
  const lifetime = queryOne<{
    first_scrobble: number | null;
    last_scrobble: number | null;
    lifetime_plays: number;
    lifetime_unique_tracks: number;
  }>(
    db,
    `
    SELECT MIN(s.submission_time) AS first_scrobble,
      MAX(s.submission_time) AS last_scrobble,
      COUNT(*) AS lifetime_plays,
      COUNT(DISTINCT mf.id) AS lifetime_unique_tracks
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?
  `,
    [uid, artistId],
  );

  // Fallback name if not in range but exists in library
  let artistName = inRange?.artist ?? null;
  if (!artistName) {
    const anyRow = queryOne<{ artist: string }>(
      db,
      `
      SELECT COALESCE((SELECT a.name FROM artist a WHERE a.id = mf.artist_id), mf.artist) AS artist
      FROM media_file mf WHERE mf.artist_id = ? LIMIT 1
    `,
      [artistId],
    );
    artistName = anyRow?.artist ?? null;
  }

  // Library depth: tracks the user has ever played vs. total tracks by artist in library
  const libraryDepth = queryOne<{ played_tracks: number; library_tracks: number }>(
    db,
    `
    SELECT
      (SELECT COUNT(DISTINCT mf.id)
        FROM scrobbles s JOIN media_file mf ON s.media_file_id = mf.id
        WHERE s.user_id = ? AND mf.artist_id = ?) AS played_tracks,
      (SELECT COUNT(*) FROM media_file mf WHERE mf.artist_id = ?) AS library_tracks
  `,
    [uid, artistId, artistId],
  );

  const totalPlaysAll = overall?.total_plays ?? 0;
  const sharePct = totalPlaysAll > 0 && inRange ? (inRange.plays / totalPlaysAll) * 100 : 0;

  return {
    artist_id: artistId,
    artist: artistName,
    plays: inRange?.plays ?? 0,
    unique_tracks: inRange?.unique_tracks ?? 0,
    total_hours: inRange?.total_hours ?? 0,
    rank: rank?.rnk ?? null,
    total_artists: rank?.total_artists ?? null,
    share_pct: Math.round(sharePct * 100) / 100,
    first_scrobble: lifetime?.first_scrobble ?? null,
    last_scrobble: lifetime?.last_scrobble ?? null,
    lifetime_plays: lifetime?.lifetime_plays ?? 0,
    lifetime_unique_tracks: lifetime?.lifetime_unique_tracks ?? 0,
    played_tracks: libraryDepth?.played_tracks ?? 0,
    library_tracks: libraryDepth?.library_tracks ?? 0,
  };
}

function getArtistHeatmap(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    SELECT date(s.submission_time, 'unixepoch') AS day, COUNT(*) AS plays
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
    GROUP BY day ORDER BY day
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistTopTracks(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    SELECT mf.id, mf.title, mf.album, mf.album_id,
      COUNT(*) AS plays,
      ROUND(mf.duration * COUNT(*) / 60.0, 1) AS total_minutes
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
    GROUP BY mf.id ORDER BY plays DESC, total_minutes DESC LIMIT 100
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistTopAlbums(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    SELECT mf.album, mf.album_id,
      COUNT(*) AS plays,
      COUNT(DISTINCT mf.id) AS unique_tracks,
      ROUND(SUM(mf.duration) / 60.0, 1) AS total_minutes
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
    GROUP BY mf.album_id ORDER BY plays DESC LIMIT 50
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistClock(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    SELECT CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER) AS hour,
      COUNT(*) AS plays
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
    GROUP BY hour ORDER BY hour
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistDayOfWeek(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    SELECT
      CASE CAST(strftime('%w', s.submission_time, 'unixepoch') AS INTEGER)
        WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END AS day,
      COUNT(*) AS plays
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
    GROUP BY strftime('%w', s.submission_time, 'unixepoch')
    ORDER BY ((CAST(strftime('%w', s.submission_time, 'unixepoch') AS INTEGER) + 6) % 7) ASC
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistRankTrajectory(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    WITH monthly AS (
      SELECT strftime('%Y-%m', s.submission_time, 'unixepoch') AS month,
        mf.artist_id, COUNT(*) AS plays
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ?${rc.sql}
      GROUP BY month, mf.artist_id
    ),
    ranked AS (
      SELECT month, artist_id, plays,
        RANK() OVER (PARTITION BY month ORDER BY plays DESC) AS rnk
      FROM monthly
    )
    SELECT month, plays, rnk FROM ranked WHERE artist_id = ? ORDER BY month
  `,
    [uid, ...rc.params, artistId],
  );
}

function getArtistSongOfMonth(db: Database, uid: string, artistId: string, range: Range) {
  const rc = rangeClause(range);
  return queryAll(
    db,
    `
    WITH monthly_counts AS (
      SELECT strftime('%Y-%m', s.submission_time, 'unixepoch') AS month,
        mf.title, mf.album_id, COUNT(*) AS plays,
        ROW_NUMBER() OVER (
          PARTITION BY strftime('%Y-%m', s.submission_time, 'unixepoch')
          ORDER BY COUNT(*) DESC
        ) AS rn
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND mf.artist_id = ?${rc.sql}
      GROUP BY month, mf.id
    )
    SELECT month, title, album_id, plays FROM monthly_counts WHERE rn = 1 ORDER BY month
  `,
    [uid, artistId, ...rc.params],
  );
}

function getArtistRecentScrobbles(db: Database, uid: string, artistId: string) {
  return queryAll(
    db,
    `
    SELECT mf.title, mf.album, mf.album_id, s.submission_time AS played_at
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND mf.artist_id = ?
    ORDER BY s.submission_time DESC LIMIT 25
  `,
    [uid, artistId],
  );
}

// --- Static files & Angular SSR ---

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

// --- Init & Start ---

async function bootstrap() {
  if (isMainModule(import.meta.url) || process.env['pm_id']) {
    const port = process.env['PORT'] || 4000;

    console.log('--- Navidrome Rewind ---');
    console.log('DB path:          ', resolveDbPath());
    console.log(
      'Cover art:        ',
      isCoverArtAvailable()
        ? '✓ enabled'
        : '✗ disabled (set NAVIDROME_URL, NAVIDROME_USER, NAVIDROME_API_KEY)',
    );
    if (isCoverArtAvailable()) {
      console.log('Navidrome URL:    ', getNavidromeUrl());
      console.log('Navidrome user:   ', getNavidromeUser());
    }
    console.log('------------------------');

    app.listen(port, (error) => {
      if (error) throw error;
      console.log(`Node Express server listening on http://localhost:${port}`);
    });
  }
}

bootstrap();

export const reqHandler = createNodeRequestHandler(app);
