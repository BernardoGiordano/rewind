import type { Database } from 'better-sqlite3';
import express from 'express';
import { createHash } from 'node:crypto';

type Auth = { uid: string; username: string; password: string };
type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  album_id: string;
  artist_id: string;
  duration: number;
  disc_number: number;
  track_number: number;
};
type Entry = Track & { time: number };
type Named = { id: string; name: string; cover_id: string };
type Dependencies = {
  getDb: () => Database;
  requireAuth: (req: express.Request, res: express.Response) => Auth | null;
  getUrl: () => string | null;
  authParams: (user: string, password: string) => URLSearchParams;
};

// Catalog visibility is independent of whether the user has listened to a track.
const scope = `COALESCE(mf.missing, 0) = 0 AND (
  EXISTS (SELECT 1 FROM user_library ul WHERE ul.library_id = mf.library_id AND ul.user_id = @uid)
  OR EXISTS (SELECT 1 FROM user u WHERE u.id = @uid AND u.is_admin = 1))`;
const trackColumns = `mf.id, mf.title, mf.artist, mf.album, mf.album_id, mf.artist_id,
  mf.duration, mf.disc_number, mf.track_number`;

function planScrobbles(tracks: Track[], finishedAt: number, now = Date.now()): Entry[] {
  if (!Number.isSafeInteger(finishedAt) || finishedAt < 0 || finishedAt > now) {
    throw new Error('Choose a valid date and time in the past.');
  }
  if (!tracks.length || tracks.length > 1000) throw new Error('Select between 1 and 1000 songs.');
  let cursor = Math.floor(finishedAt / 1000) * 1000;
  const entries: Entry[] = [];
  for (const track of [...tracks].reverse()) {
    if (!Number.isFinite(track.duration) || track.duration <= 0) {
      throw new Error(
        'Track duration is missing. Scrobble this song separately with a valid timestamp.',
      );
    }
    // Subsonic timestamps describe when listening started.
    cursor -= Math.max(1, Math.round(track.duration)) * 1000;
    if (cursor < 0) throw new Error('Listening would start before 1970.');
    entries.push({ ...track, time: cursor });
  }
  return entries.reverse();
}

/**
 * Names and artwork for the artist or album being browsed, so the client can
 * label a drill-down from ids alone instead of carrying them through the URL.
 */
function describeContext(
  db: Database,
  uid: string,
  artistId: string,
  albumId: string,
): { artist?: Named; album?: Named & { artist: string; artist_id: string } } {
  const context: { artist?: Named; album?: Named & { artist: string; artist_id: string } } = {};
  if (artistId) {
    const row = db
      .prepare(
        `SELECT CASE WHEN COUNT(*) > 0 THEN COALESCE(
             (SELECT a.name FROM artist a WHERE a.id = @artist), MAX(mf.artist)) END AS name,
           COALESCE(
           (SELECT a.id FROM artist a WHERE a.id = @artist AND a.large_image_url <> ''),
           MIN(mf.album_id)) AS cover_id
         FROM media_file mf
         WHERE ${scope} AND (mf.artist_id = @artist OR mf.album_artist_id = @artist)`,
      )
      .get({ uid, artist: artistId }) as Named | undefined;
    if (row?.name) context.artist = { id: artistId, name: row.name, cover_id: row.cover_id };
  }
  if (albumId) {
    const row = db
      .prepare(
        `SELECT MAX(mf.album) AS name, MAX(mf.album_artist) AS artist,
           MAX(mf.album_artist_id) AS artist_id, mf.album_id AS cover_id
         FROM media_file mf WHERE ${scope} AND mf.album_id = @album`,
      )
      .get({ uid, album: albumId }) as (Named & { artist: string; artist_id: string }) | undefined;
    if (row?.name) context.album = { ...row, id: albumId };
  }
  return context;
}

export function libraryRouter(deps: Dependencies): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/', (req, res) => {
    const auth = deps.requireAuth(req, res);
    if (!auth) return;
    try {
      const kind = req.query['kind'] ?? 'artists';
      if (!['artists', 'albums', 'songs'].includes(String(kind)))
        throw new Error('Invalid library view.');
      const offset = Number(req.query['offset'] ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid page.');
      const search = String(req.query['q'] ?? '').slice(0, 200);
      const params = {
        uid: auth.uid,
        q: `%${search.replace(/[\\%_]/g, '\\$&')}%`,
        artist: String(req.query['artist'] ?? ''),
        album: String(req.query['album'] ?? ''),
      };
      const where = `${scope} AND (@artist = '' OR mf.artist_id = @artist OR mf.album_artist_id = @artist)
        AND (@album = '' OR mf.album_id = @album)
        AND (mf.title LIKE @q ESCAPE '\\' OR mf.artist LIKE @q ESCAPE '\\' OR mf.album LIKE @q ESCAPE '\\')`;
      // `sort_key` mirrors Navidrome's own ordering columns, which strip leading
      // articles so "The Beatles" files under B.
      // Navidrome serves a generic placeholder for artists it has no image for,
      // so those fall back to one of the artist's own album covers.
      const artistCover = `COALESCE(
        (SELECT a.id FROM artist a WHERE a.id = mf.artist_id AND a.large_image_url <> ''),
        MIN(mf.album_id)) AS cover_id`;
      // A track's artist credit can carry guests ("X feat. Y"); the artist row holds
      // the main name, as in the listening stats.
      const artistName = `COALESCE((SELECT a.name FROM artist a WHERE a.id = mf.artist_id),
        MAX(mf.artist)) AS title`;
      const select =
        kind === 'artists'
          ? `mf.artist_id AS id, ${artistName}, COUNT(*) AS songs,
             COUNT(DISTINCT mf.album_id) AS albums, SUM(mf.duration) AS duration,
             SUM(COALESCE(p.n, 0)) AS plays, MIN(mf.order_artist_name) AS sort_key,
             ${artistCover}`
          : kind === 'albums'
            ? `mf.album_id AS id, MAX(mf.album) AS title, MAX(mf.album_artist) AS artist,
               MAX(mf.album_artist_id) AS artist_id, COUNT(*) AS songs,
               SUM(mf.duration) AS duration, MAX(NULLIF(mf.year, 0)) AS year,
               SUM(COALESCE(p.n, 0)) AS plays, MIN(mf.order_album_name) AS sort_key,
               mf.album_id AS cover_id`
            : `${trackColumns}, COALESCE(p.n, 0) AS plays, mf.order_artist_name AS sort_key,
               mf.album_id AS cover_id`;
      const group =
        kind === 'artists'
          ? ' GROUP BY mf.artist_id'
          : kind === 'albums'
            ? ' GROUP BY mf.album_id'
            : '';
      // Play counts come from one grouped pass over the user's scrobbles rather
      // than a correlated subquery per row.
      const plays = `LEFT JOIN (SELECT media_file_id, COUNT(*) AS n FROM scrobbles
        WHERE user_id = @uid GROUP BY media_file_id) p ON p.media_file_id = mf.id`;
      const base = `SELECT ${select} FROM media_file mf ${plays} WHERE ${where}${group}`;
      const db = deps.getDb();
      const total = (db.prepare(`SELECT COUNT(*) AS n FROM (${base})`).get(params) as { n: number })
        .n;
      const order =
        kind === 'songs'
          ? params.album
            ? 'disc_number, track_number, id'
            : 'sort_key COLLATE NOCASE, album COLLATE NOCASE, disc_number, track_number, id'
          : 'sort_key COLLATE NOCASE, title COLLATE NOCASE, id';
      const items = db
        .prepare(`${base} ORDER BY ${order} LIMIT 50 OFFSET @offset`)
        .all({ ...params, offset });
      res.json({
        items,
        total,
        canScrobble: !!deps.getUrl(),
        context: describeContext(db, params.uid, params.artist, params.album),
      });
    } catch {
      res.status(400).json({ error: 'Could not load this library view.' });
    }
  });

  function prepare(uid: string, body: Record<string, unknown>): Entry[] {
    if (
      !body ||
      !['song', 'album'].includes(String(body['kind'])) ||
      typeof body['id'] !== 'string'
    ) {
      throw new Error('Select a song or album.');
    }
    const column = body['kind'] === 'album' ? 'album_id' : 'id';
    const tracks = deps
      .getDb()
      .prepare(
        `SELECT ${trackColumns} FROM media_file mf
      WHERE ${scope} AND mf.${column} = @id ORDER BY mf.disc_number, mf.track_number, mf.id`,
      )
      .all({ uid, id: body['id'] }) as Track[];
    if (!tracks.length) throw new Error('This selection is no longer available.');
    const time = body['finishedAt'];
    if (typeof time !== 'number') throw new Error('Choose a valid date and time.');
    if (body['kind'] === 'song') {
      if (!Number.isSafeInteger(time) || time < 0 || time > Date.now())
        throw new Error('Choose a valid date and time in the past.');
      return [{ ...tracks[0], time: Math.floor(time / 1000) * 1000 }];
    }
    return planScrobbles(tracks, time);
  }

  // Retain uncertain attempts too: a transport failure is not proof that nothing was written.
  const attempts = new Map<string, { fingerprint: string; result: unknown | null }>();
  const pending = new Set<string>();
  router.post('/scrobbles/preview', (req, res) => {
    const auth = deps.requireAuth(req, res);
    if (!auth) return;
    try {
      res.json({ entries: prepare(auth.uid, req.body) });
    } catch (error) {
      res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Invalid selection.' });
    }
  });

  router.post('/scrobbles', async (req, res) => {
    const auth = deps.requireAuth(req, res);
    if (!auth) return;
    // JSON-only writes plus a same-origin browser check protect both cookie and transparent auth.
    if (!req.is('application/json') || req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'Cross-site submissions are not allowed.' });
      return;
    }
    const baseUrl = deps.getUrl();
    if (!baseUrl) {
      res.status(503).json({ error: 'Configure NAVIDROME_URL to add scrobbles.' });
      return;
    }
    let entries: Entry[];
    try {
      entries = prepare(auth.uid, req.body);
      if (
        !Array.isArray(req.body.entries) ||
        req.body.entries.length !== entries.length ||
        !entries.every(
          (entry, index) =>
            req.body.entries[index]?.id === entry.id &&
            req.body.entries[index]?.time === entry.time,
        )
      ) {
        throw new Error('The selection changed. Preview it again before submitting.');
      }
    } catch (error) {
      res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Invalid selection.' });
      return;
    }
    const requestId = req.body.requestId;
    if (typeof requestId !== 'string' || !/^[\w-]{16,80}$/.test(requestId)) {
      res.status(400).json({ error: 'Invalid submission identifier.' });
      return;
    }
    const key = `${auth.uid}:${requestId}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(entries.map(({ id, time }) => ({ id, time }))))
      .digest('hex');
    const previous = attempts.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint || !previous.result) {
        res
          .status(409)
          .json({ error: 'Submission already in progress or identifier already used.' });
      } else res.json(previous.result);
      return;
    }
    if (pending.has(auth.uid)) {
      res.status(409).json({ error: 'Wait for your current submission to finish.' });
      return;
    }
    if (attempts.size >= 10000) {
      res
        .status(503)
        .json({ error: 'Submission capacity reached. Restart Rewind before adding more.' });
      return;
    }
    const exists = (entry: Entry) =>
      !!deps
        .getDb()
        .prepare(
          `SELECT 1 FROM scrobbles
      WHERE user_id = ? AND media_file_id = ? AND submission_time = ? LIMIT 1`,
        )
        .get(auth.uid, entry.id, entry.time / 1000);
    if (entries.some(exists)) {
      res.status(409).json({
        error:
          'A scrobble already exists at one of these timestamps. Review listening history before adding more.',
      });
      return;
    }
    attempts.set(key, { fingerprint, result: null });
    pending.add(auth.uid);
    try {
      const params = deps.authParams(auth.username, auth.password);
      params.set('submission', 'true');
      for (const entry of entries) {
        params.append('id', entry.id);
        params.append('time', String(entry.time));
      }
      let accepted = false;
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/scrobble.view`, {
          method: 'POST',
          body: params,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        const body = (await response.json()) as { 'subsonic-response'?: { status?: string } };
        accepted = response.ok && body['subsonic-response']?.status === 'ok';
      } catch {
        /* Verify the database even if the response was lost. */
      }
      let confirmed: Entry[] = [];
      for (let pass = 0; pass < 5; pass++) {
        confirmed = entries.filter(exists);
        if (confirmed.length === entries.length) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const result = {
        status: confirmed.length === entries.length ? 'confirmed' : 'uncertain',
        confirmed: confirmed.length,
        total: entries.length,
        accepted,
        message:
          confirmed.length === entries.length
            ? `Added ${entries.length} scrobble${entries.length === 1 ? '' : 's'} to Navidrome.`
            : `Verified ${confirmed.length} of ${entries.length} scrobbles. Check listening history before trying again; some writes may still have succeeded.`,
      };
      attempts.set(key, { fingerprint, result });
      res.json(result);
    } catch {
      const result = {
        status: 'uncertain',
        confirmed: 0,
        total: entries.length,
        message: 'Could not verify this submission. Check listening history before trying again.',
      };
      attempts.set(key, { fingerprint, result });
      res.json(result);
    } finally {
      pending.delete(auth.uid);
    }
  });
  return router;
}
