// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import Database from 'better-sqlite3';
import type { Server } from 'node:http';
import { libraryRouter } from '../src/server/library';

let db: Database.Database;
let server: Server;
let upstream: Server;
let base: string;
let submissions: URLSearchParams[];
let recordLimit: number;
let authenticated: boolean;
let configured: boolean;

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

beforeEach(async () => {
  db = new Database(':memory:');
  db.exec(`CREATE TABLE user (id TEXT, is_admin INTEGER);
    CREATE TABLE user_library (user_id TEXT, library_id INTEGER);
    CREATE TABLE media_file (id TEXT, title TEXT, artist TEXT, artist_id TEXT, album TEXT,
      album_id TEXT, album_artist TEXT, album_artist_id TEXT, duration REAL, disc_number INTEGER,
      track_number INTEGER, missing INTEGER, library_id INTEGER, year INTEGER,
      order_artist_name TEXT, order_album_name TEXT);
    CREATE TABLE artist (id TEXT, name TEXT, large_image_url TEXT);
    CREATE TABLE scrobbles (user_id TEXT, media_file_id TEXT, submission_time INTEGER);
    INSERT INTO artist VALUES ('artist', 'Artist', ''),
      ('private', 'Private', 'https://example.test/private.jpg');
    INSERT INTO user VALUES ('listener', 0), ('other', 0);
    INSERT INTO user_library VALUES ('listener', 1), ('other', 2);
    INSERT INTO media_file VALUES
      ('b', 'Second', 'Artist feat. Guest', 'artist', 'Album', 'album', 'Artist', 'artist', 120, 2, 1, 0, 1, 1999, 'artist', 'album'),
      ('a', 'First', 'Artist', 'artist', 'Album', 'album', 'Artist', 'artist', 180, 1, 1, 0, 1, 1999, 'artist', 'album'),
      ('secret', 'Hidden', 'Private', 'private', 'Private', 'private', 'Private', 'private', 30, 1, 1, 0, 2, 2001, 'private', 'private'),
      ('missing', 'Gone', 'Artist', 'artist', 'Album', 'album', 'Artist', 'artist', 30, 1, 2, 1, 1, 1999, 'artist', 'album');
    INSERT INTO scrobbles VALUES ('other', 'a', 100);`);
  submissions = [];
  recordLimit = Infinity;
  authenticated = true;
  configured = true;
  const remote = express();
  remote.use(express.text({ type: 'application/x-www-form-urlencoded' }));
  remote.post('/rest/scrobble.view', (req, res) => {
    const params = new URLSearchParams(req.body);
    submissions.push(params);
    const ids = params.getAll('id');
    const times = params.getAll('time');
    ids
      .slice(0, recordLimit)
      .forEach((id, i) =>
        db
          .prepare('INSERT INTO scrobbles VALUES (?, ?, ?)')
          .run('listener', id, Number(times[i]) / 1000),
      );
    res.json({ 'subsonic-response': { status: 'ok' } });
  });
  const remoteAddress = await listen(remote);
  upstream = remoteAddress.server;
  const app = express();
  app.use(
    '/api/library',
    libraryRouter({
      getDb: () => db,
      requireAuth: (_req, res) => {
        if (!authenticated) {
          res.status(401).end();
          return null;
        }
        return { uid: 'listener', username: 'listener', password: 'test' };
      },
      getUrl: () => (configured ? remoteAddress.url : null),
      authParams: (user) => new URLSearchParams({ u: user }),
    }),
  );
  const local = await listen(app);
  server = local.server;
  base = local.url;
});

afterEach(async () => {
  await Promise.all(
    [server, upstream].map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
  db.close();
});

const selection = { kind: 'album', id: 'album', finishedAt: Date.UTC(2020, 0, 1, 12) };
async function post(path: string, body: unknown, headers = {}) {
  return fetch(base + '/api/library' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
async function prepared() {
  const preview = await post('/scrobbles/preview', selection);
  expect(preview.status).toBe(200);
  const { entries } = await preview.json();
  return {
    ...selection,
    requestId: 'test-request-123456789',
    entries: entries.map(({ id, time }: { id: string; time: number }) => ({ id, time })),
  };
}

describe('library and manual scrobbles', () => {
  it('browses unplayed music without exposing other libraries or users listening counts', async () => {
    const response = await fetch(base + '/api/library?kind=songs');
    const data = await response.json();
    expect(data.total).toBe(2);
    expect(data.items.map((item: { id: string; plays: number }) => [item.id, item.plays])).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
    const artists = await (await fetch(base + '/api/library?kind=artists')).json();
    expect(artists.total).toBe(1);
    // A guest credit on one track does not rename the artist.
    expect(artists.items[0].title).toBe('Artist');
    expect((await (await fetch(base + '/api/library?kind=albums')).json()).items[0].songs).toBe(2);
  });
  it('names the drill-down context from ids alone and hides inaccessible ones', async () => {
    const album = await (await fetch(base + '/api/library?kind=songs&album=album')).json();
    expect(album.context).toEqual({
      album: {
        id: 'album',
        name: 'Album',
        artist: 'Artist',
        artist_id: 'artist',
        cover_id: 'album',
      },
    });
    const artist = await (await fetch(base + '/api/library?kind=albums&artist=artist')).json();
    // No artist image, so the cover falls back to one of the artist's albums.
    expect(artist.context.artist).toEqual({ id: 'artist', name: 'Artist', cover_id: 'album' });
    const other = await (await fetch(base + '/api/library?kind=albums&artist=private')).json();
    expect(other.context).toEqual({});
  });
  it('requires authentication and rejects inaccessible selections', async () => {
    expect(
      (await post('/scrobbles/preview', { ...selection, kind: 'song', id: 'secret' })).status,
    ).toBe(400);
    authenticated = false;
    expect((await fetch(base + '/api/library')).status).toBe(401);
    expect((await post('/scrobbles', {})).status).toBe(401);
  });
  it('orders album discs and assigns start times ending at the selected instant', async () => {
    const body = await prepared();
    expect(body.entries).toEqual([
      { id: 'a', time: selection.finishedAt - 300000 },
      { id: 'b', time: selection.finishedAt - 120000 },
    ]);
    const result = await (await post('/scrobbles', body)).json();
    expect(result).toMatchObject({ status: 'confirmed', confirmed: 2, total: 2 });
    expect(submissions[0].getAll('time')).toEqual(
      body.entries.map((e: { time: number }) => String(e.time)),
    );
    expect(submissions[0].get('submission')).toBe('true');
    expect(submissions[0].get('u')).toBe('listener');
    expect((await (await post('/scrobbles', body)).json()).status).toBe('confirmed');
    expect(submissions).toHaveLength(1);
    expect(
      (await post('/scrobbles', { ...body, requestId: 'different-request-1234' })).status,
    ).toBe(409);
  });
  it('uses exactly the chosen timestamp for a single song, including unknown durations', async () => {
    db.prepare('UPDATE media_file SET duration = 0 WHERE id = ?').run('a');
    const response = await post('/scrobbles/preview', { ...selection, kind: 'song', id: 'a' });
    expect((await response.json()).entries[0].time).toBe(selection.finishedAt);
    expect((await post('/scrobbles/preview', selection)).status).toBe(400);
  });
  it('rejects invalid dates, changed albums, cross-site writes and missing configuration', async () => {
    for (const finishedAt of [null, -1, Date.now() + 60000, '2020-01-01']) {
      expect((await post('/scrobbles/preview', { ...selection, finishedAt })).status).toBe(400);
    }
    const body = await prepared();
    expect((await post('/scrobbles', body, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    configured = false;
    expect((await post('/scrobbles', body)).status).toBe(503);
    configured = true;
    db.prepare('UPDATE media_file SET duration = 90 WHERE id = ?').run('a');
    expect((await post('/scrobbles', body)).status).toBe(400);
    expect(submissions).toHaveLength(0);
  });
  it('reports partial recording as uncertain even when Navidrome returns success, without retrying', async () => {
    recordLimit = 1;
    const body = await prepared();
    const result = await (await post('/scrobbles', body)).json();
    expect(result).toMatchObject({ status: 'uncertain', confirmed: 1, total: 2 });
    expect(await (await post('/scrobbles', body)).json()).toEqual(result);
    expect(submissions).toHaveLength(1);
  });
  it('escapes search wildcards and validates pagination', async () => {
    expect((await (await fetch(base + '/api/library?kind=songs&q=%25')).json()).total).toBe(0);
    expect((await fetch(base + '/api/library?offset=-1')).status).toBe(400);
  });
});
