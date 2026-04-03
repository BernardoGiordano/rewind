import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import initSqlJs from 'sql.js';
import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

interface TrackRow {
  title: string;
  artist: string;
  album: string;
  play_count: number;
  track_duration_min: number;
  total_min_listened: number;
}

function resolveDbPath(): string {
  // Local dev: navidrome.db in the project root (cwd), e.g. when running from the repo
  const localPath = join(process.cwd(), 'navidrome.db');
  if (existsSync(localPath)) return localPath;
  // Docker / production: explicit env var or default mount point
  return process.env['DB_PATH'] ?? '/data/navidrome.db';
}

app.get('/api/top-tracks', async (_req, res) => {
  const userId = process.env['NAVIDROME_USER_ID'] ?? 'faf22e0b-63e8-4216-b35d-7a2c33043f99';
  try {
    const SQL = await initSqlJs();
    const fileBuffer = readFileSync(resolveDbPath());
    const db = new SQL.Database(fileBuffer);

    const stmt = db.prepare(
      `SELECT
        mf.title,
        mf.artist,
        mf.album,
        a.play_count,
        ROUND(mf.duration / 60.0, 1) AS track_duration_min,
        ROUND(mf.duration * a.play_count / 60.0, 1) AS total_min_listened
      FROM annotation a
      JOIN media_file mf ON a.item_id = mf.id
      WHERE a.item_type = 'media_file'
        AND a.user_id = ?
        AND a.play_count > 0
      ORDER BY a.play_count DESC
      LIMIT 5`,
    );
    stmt.bind([userId]);

    const rows: TrackRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as TrackRow);
    }
    stmt.free();
    db.close();

    res.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
