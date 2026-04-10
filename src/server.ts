import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import BetterSqlite3 from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
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

function getDb(): Database {
  return new BetterSqlite3(resolveDbPath(), { readonly: true });
}

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

const userId = () => process.env['NAVIDROME_USER_ID'] ?? '';

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
  const token = createHash('md5').update(apiKey + salt).digest('hex');
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

app.get('/api/config', (_req, res) => {
  const url = getNavidromeUrl();
  const user = getNavidromeUser();
  const apiKey = getNavidromeApiKey();
  console.log('[config] NAVIDROME_URL:', url ?? '(not set)');
  console.log('[config] NAVIDROME_USER:', user ?? '(not set)');
  console.log('[config] NAVIDROME_API_KEY:', apiKey ? '(set)' : '(not set)');
  res.json({ coverArtAvailable: isCoverArtAvailable() });
});

// --- /api/cover/:id — proxy to Navidrome getCoverArt ---

app.get('/api/cover/:id', (req, res) => {
  const baseUrl = getNavidromeUrl();
  const user = getNavidromeUser();
  const apiKey = getNavidromeApiKey();

  if (!baseUrl || !user || !apiKey) {
    console.error('[cover] Not configured — missing NAVIDROME_URL, NAVIDROME_USER or NAVIDROME_API_KEY');
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

  console.log('[cover] Fetching:', coverUrl.replace(/&t=[^&]+/, '&t=***').replace(/&s=[^&]+/, '&s=***'));

  const requester = coverUrl.startsWith('https') ? httpsRequest : httpRequest;
  const proxyReq = requester(coverUrl, (proxyRes) => {
    console.log('[cover] Response status:', proxyRes.statusCode, 'content-type:', proxyRes.headers['content-type']);
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
    const rows = queryAll<{ year: string }>(db, `
      SELECT DISTINCT strftime('%Y', submission_time, 'unixepoch') AS year
      FROM scrobbles
      WHERE user_id = ?
      ORDER BY year DESC
    `, [userId()]);
    db.close();
    res.json(rows.map(r => r.year));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Stats router ---
app.get('/api/stats/:type', (req, res) => {
  const statType = req.params['type'];
  const yearParam = req.query['year'] as string | undefined;
  const year = yearParam ? parseInt(yearParam, 10) : null;

  try {
    const db = getDb();
    const uid = userId();
    let result: unknown;

    switch (statType) {
      case 'summary':
        result = getSummary(db, uid, year);
        break;
      case 'top-songs':
        result = getTopSongs(db, uid, year);
        break;
      case 'top-artists':
        result = getTopArtists(db, uid, year);
        break;
      case 'top-albums':
        result = getTopAlbums(db, uid, year);
        break;
      case 'top-genres':
        result = getTopGenres(db, uid, year);
        break;
      case 'listening-clock':
        result = year ? getListeningClock(db, uid, year) : [];
        break;
      case 'monthly-trends':
        result = year ? getMonthlyTrends(db, uid, year) : [];
        break;
      case 'day-of-week':
        result = year ? getDayOfWeek(db, uid, year) : [];
        break;
      case 'streak':
        result = year ? getStreak(db, uid, year) : [];
        break;
      case 'late-night':
        result = year ? getLateNight(db, uid, year) : [];
        break;
      case 'on-repeat':
        result = year ? getOnRepeat(db, uid, year) : [];
        break;
      case 'song-of-month':
        result = year ? getSongOfMonth(db, uid, year) : [];
        break;
      case 'favorite-decades':
        result = getFavoriteDecades(db, uid, year);
        break;
      case 'recap':
        result = getRecap(db, uid, year);
        break;
      default:
        db.close();
        res.status(404).json({ error: `Unknown stat type: ${statType}` });
        return;
    }

    db.close();
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Query functions ---

function getSummary(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryOne(db, `
      SELECT
        COUNT(*) AS total_plays,
        COUNT(DISTINCT mf.id) AS unique_songs,
        COUNT(DISTINCT mf.artist) AS unique_artists,
        COUNT(DISTINCT mf.album_id) AS unique_albums,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
        ROUND(SUM(mf.duration) / 86400.0, 1) AS total_days
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    `, [uid, startTs, endTs]);
  }
  return queryOne(db, `
    SELECT
      COUNT(*) AS total_plays,
      COUNT(DISTINCT mf.id) AS unique_songs,
      COUNT(DISTINCT mf.artist) AS unique_artists,
      COUNT(DISTINCT mf.album_id) AS unique_albums,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
      ROUND(SUM(mf.duration) / 86400.0, 1) AS total_days
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
  `, [uid]);
}

function getTopSongs(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryAll(db, `
      SELECT mf.title, mf.artist, mf.album, COUNT(*) AS plays,
        ROUND(mf.duration * COUNT(*) / 60.0, 1) AS total_minutes,
        mf.album_id, mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.id ORDER BY plays DESC LIMIT 5
    `, [uid, startTs, endTs]);
  }
  return queryAll(db, `
    SELECT mf.title, mf.artist, mf.album, COUNT(*) AS plays,
      ROUND(mf.duration * COUNT(*) / 60.0, 1) AS total_minutes,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
    GROUP BY mf.id ORDER BY plays DESC LIMIT 5
  `, [uid]);
}

function getTopArtists(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryAll(db, `
      SELECT mf.artist, COUNT(*) AS plays, COUNT(DISTINCT mf.id) AS unique_tracks,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
        mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.artist ORDER BY plays DESC LIMIT 5
    `, [uid, startTs, endTs]);
  }
  return queryAll(db, `
    SELECT mf.artist, COUNT(*) AS plays, COUNT(DISTINCT mf.id) AS unique_tracks,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours,
      mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
    GROUP BY mf.artist ORDER BY plays DESC LIMIT 5
  `, [uid]);
}

function getTopAlbums(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryAll(db, `
      SELECT mf.album, mf.album_artist, COUNT(*) AS plays,
        ROUND(SUM(mf.duration) / 60.0, 1) AS total_minutes,
        mf.album_id, mf.artist_id
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      GROUP BY mf.album_id ORDER BY plays DESC LIMIT 5
    `, [uid, startTs, endTs]);
  }
  return queryAll(db, `
    SELECT mf.album, mf.album_artist, COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 60.0, 1) AS total_minutes,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ?
    GROUP BY mf.album_id ORDER BY plays DESC LIMIT 5
  `, [uid]);
}

function getTopGenres(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryAll(db, `
      SELECT g.value->>'$.value' AS genre, COUNT(*) AS plays,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id,
        json_each(json_extract(mf.tags, '$.genre')) AS g
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
        AND g.value->>'$.value' IS NOT NULL AND TRIM(g.value->>'$.value') != ''
      GROUP BY 1 ORDER BY plays DESC LIMIT 5
    `, [uid, startTs, endTs]);
  }
  return queryAll(db, `
    SELECT g.value->>'$.value' AS genre, COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id,
      json_each(json_extract(mf.tags, '$.genre')) AS g
    WHERE s.user_id = ?
      AND g.value->>'$.value' IS NOT NULL AND TRIM(g.value->>'$.value') != ''
    GROUP BY 1 ORDER BY plays DESC LIMIT 5
  `, [uid]);
}

function getListeningClock(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
    SELECT CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER) AS hour,
      COUNT(*) AS plays,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY hour ORDER BY hour
  `, [uid, startTs, endTs]);
}

function getMonthlyTrends(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
    SELECT strftime('%Y-%m', s.submission_time, 'unixepoch') AS month,
      COUNT(*) AS plays,
      COUNT(DISTINCT mf.id) AS unique_songs,
      COUNT(DISTINCT mf.artist) AS unique_artists,
      ROUND(SUM(mf.duration) / 3600.0, 1) AS hours
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY month ORDER BY month
  `, [uid, startTs, endTs]);
}

function getDayOfWeek(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
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
    GROUP BY strftime('%w', s.submission_time, 'unixepoch') ORDER BY plays DESC
  `, [uid, startTs, endTs]);
}

function getStreak(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
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
    FROM numbered GROUP BY streak_group ORDER BY streak_days DESC LIMIT 5
  `, [uid, startTs, endTs]);
}

function getLateNight(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
    SELECT mf.title, mf.artist, COUNT(*) AS late_night_plays,
      mf.album_id, mf.artist_id
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
      AND CAST(strftime('%H', s.submission_time, 'unixepoch') AS INTEGER) BETWEEN 0 AND 4
    GROUP BY mf.id ORDER BY late_night_plays DESC LIMIT 5
  `, [uid, startTs, endTs]);
}

function getOnRepeat(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
    SELECT date(s.submission_time, 'unixepoch') AS the_date,
      mf.title, mf.artist, COUNT(*) AS plays_that_day
    FROM scrobbles s
    JOIN media_file mf ON s.media_file_id = mf.id
    WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
    GROUP BY the_date, mf.id HAVING COUNT(*) >= 3
    ORDER BY plays_that_day DESC LIMIT 6
  `, [uid, startTs, endTs]);
}

function getSongOfMonth(db: Database, uid: string, year: number) {
  const { startTs, endTs } = yearBounds(year);
  return queryAll(db, `
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
  `, [uid, startTs, endTs]);
}

function getFavoriteDecades(db: Database, uid: string, year: number | null) {
  if (year) {
    const { startTs, endTs } = yearBounds(year);
    return queryAll(db, `
      SELECT (mf.year / 10) * 10 AS decade, COUNT(*) AS total_plays,
        COUNT(DISTINCT mf.artist) AS unique_artists,
        ROUND(SUM(mf.duration) / 3600.0, 1) AS total_hours
      FROM scrobbles s
      JOIN media_file mf ON s.media_file_id = mf.id
      WHERE s.user_id = ? AND s.submission_time >= ? AND s.submission_time < ?
        AND mf.year > 0
      GROUP BY decade ORDER BY total_plays DESC LIMIT 5
    `, [uid, startTs, endTs]);
  }
  return queryAll(db, `
    SELECT (mf.year / 10) * 10 AS decade, SUM(a.play_count) AS total_plays,
      COUNT(DISTINCT mf.artist) AS unique_artists,
      ROUND(SUM(mf.duration * a.play_count) / 3600.0, 1) AS total_hours
    FROM annotation a
    JOIN media_file mf ON a.item_id = mf.id
    WHERE a.item_type = 'media_file' AND a.user_id = ? AND a.play_count > 0 AND mf.year > 0
    GROUP BY decade ORDER BY total_plays DESC LIMIT 5
  `, [uid]);
}

function getRecap(db: Database, uid: string, year: number | null) {
  const topArtists = getTopArtists(db, uid, year) as Array<{ artist: string; plays: number; unique_tracks: number; total_hours: number; artist_id: string }>;
  const topSongs = getTopSongs(db, uid, year) as Array<{ title: string; artist: string; album: string; plays: number; total_minutes: number; album_id: string; artist_id: string }>;
  const summary = getSummary(db, uid, year) as { total_hours: number };
  const topGenres = getTopGenres(db, uid, year) as Array<{ genre: string; plays: number; total_hours: number }>;

  return {
    top_artist: topArtists[0] ?? null,
    top_artists: topArtists,
    top_songs: topSongs,
    total_minutes: Math.round((summary?.total_hours ?? 0) * 60),
    top_genre: topGenres[0]?.genre ?? 'Unknown',
  };
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
    console.log('Cover art:        ', isCoverArtAvailable() ? '✓ enabled' : '✗ disabled (set NAVIDROME_URL, NAVIDROME_USER, NAVIDROME_API_KEY)');
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
