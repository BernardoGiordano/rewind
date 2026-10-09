// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { soundtrackFor } from '../server/soundtrack.ts';

const YEAR_2025 = {
  startTs: Date.UTC(2025, 0, 1) / 1000,
  endTs: Date.UTC(2026, 0, 1) / 1000,
};

/** Seconds since the epoch for a UTC time in January 2025. */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2025, 0, day, hour, minute) / 1000;

const genre = (name: string) => JSON.stringify({ genre: [{ value: name }] });

let db: Database.Database;

const ids = (soundtrack: ReturnType<typeof soundtrackFor>) =>
  Object.fromEntries(Object.entries(soundtrack).map(([stat, song]) => [stat, song?.id]));

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(`CREATE TABLE media_file (id TEXT, title TEXT, artist TEXT, artist_id TEXT,
      album_id TEXT, duration REAL, missing INTEGER, year INTEGER, tags TEXT);
    CREATE TABLE scrobbles (user_id TEXT, media_file_id TEXT, submission_time INTEGER);
    CREATE TABLE annotation (item_id TEXT, item_type TEXT, user_id TEXT, play_count INTEGER);`);

  const song = db.prepare('INSERT INTO media_file VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  song.run('long', 'Long', 'A', 'a', 'x', 600, 0, 1995, genre('Metal'));
  song.run('short', 'Short', 'B', 'b', 'y', 100, 0, 2015, genre('Pop'));
  song.run('other', 'Other', 'B', 'b', 'y', 120, 0, 2015, genre('Pop'));
  song.run('gone', 'Gone', 'B', 'b', 'y', 1000, 1, 2015, genre('Pop'));

  const scrobble = db.prepare(`INSERT INTO scrobbles VALUES ('listener', ?, ?)`);

  // Long has the most minutes, Short repeats one night, Other owns the afternoons.
  scrobble.run('long', at(6, 10));
  scrobble.run('long', at(6, 10, 10));
  for (let i = 0; i < 4; i++) scrobble.run('short', at(7, 2, i * 5));
  for (let day = 8; day <= 12; day++) scrobble.run('other', at(day, 15));
  scrobble.run('gone', at(8, 16));

  db.prepare(`INSERT INTO annotation VALUES ('long', 'media_file', 'listener', 50)`).run();
});

describe('soundtrackFor', () => {
  it('plays the first row of a slide that ranks songs, skipping missing files', () => {
    const songs = ids(soundtrackFor(db, 'listener', YEAR_2025));

    expect(songs['top-songs']).toBe('long');
    expect(songs['summary']).toBe('long');
    expect(songs['recap']).toBe('long');
    expect(songs['late-night']).toBe('short');
    expect(songs['on-repeat']).toBe('short');
  });

  it("plays the most-played song inside the slide's top entry", () => {
    const songs = ids(soundtrackFor(db, 'listener', YEAR_2025));

    // B outlistens A, counting the missing file, so its own most-played song plays.
    expect(songs['top-artists']).toBe('other');
    expect(songs['top-albums']).toBe('other');
    expect(songs['top-genres']).toBe('other');
    expect(songs['favorite-decades']).toBe('other');
    expect(songs['listening-clock']).toBe('other');
    expect(songs['streak']).toBe('other');
    expect(songs['song-of-month']).toBe('other');
  });

  it('ranks all-time decades by play counts and leaves out year-only slides', () => {
    const songs = ids(soundtrackFor(db, 'listener', null));

    expect(songs['favorite-decades']).toBe('long');
    expect(songs).not.toHaveProperty('listening-clock');
    expect(songs).not.toHaveProperty('on-repeat');
  });

  it('has no song for a range without listens', () => {
    const empty = { startTs: Date.UTC(2024, 0, 1) / 1000, endTs: Date.UTC(2025, 0, 1) / 1000 };
    expect(Object.values(soundtrackFor(db, 'listener', empty)).filter(Boolean)).toEqual([]);
  });
});
