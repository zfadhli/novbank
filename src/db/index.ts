// ---------------------------------------------------------------------------
// Database — Connection & migration helpers
// ---------------------------------------------------------------------------

import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { DatabaseError } from '../errors';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema>;

let _db: Db | null = null;

/**
 * Initialise (or return the existing) database connection.
 *
 * Lazily creates the underlying libSQL client and wraps it with Drizzle.
 * The database file is created automatically by libSQL if it doesn't exist.
 */
export function initDb(dbPath: string): Db {
  if (_db) return _db;

  try {
    const client: Client = createClient({
      url: `file:${dbPath}`,
    });

    _db = drizzle(client, { schema });
    return _db;
  } catch (cause) {
    throw new DatabaseError('Failed to initialise database', {
      cause: cause instanceof Error ? cause : undefined,
      context: { dbPath },
      operation: 'initDb',
    });
  }
}

/**
 * Close the database connection and reset the singleton.
 */
export async function closeDb(): Promise<void> {
  if (!_db) return;
  try {
    const client = (_db as unknown as { session: { client: Client } }).session.client;
    // libSQL client.close() is on the Client interface
    if (
      'close' in client &&
      typeof (client as unknown as { close: () => void }).close === 'function'
    ) {
      (client as unknown as { close: () => void }).close();
    }
  } catch {
    // Swallow close errors — best effort
  } finally {
    _db = null;
  }
}

/**
 * Run the SQL statements needed to create tables.
 *
 * This is a lightweight migration strategy: CREATE TABLE IF NOT EXISTS.
 * For production, use `drizzle-kit generate` + `drizzle-kit migrate`.
 */
export async function migrate(db: Db): Promise<void> {
  try {
    await db.run(sqlCreateNovels);
    await db.run(sqlCreateChapters);
    await db.run(sqlCreateDownloads);
  } catch (cause) {
    throw new DatabaseError('Migration failed', {
      cause: cause instanceof Error ? cause : undefined,
      operation: 'migrate',
    });
  }
}

/**
 * Reset the module-level state (useful for testing between runs).
 */
export function resetDb(): void {
  if (_db) {
    try {
      const client = (_db as unknown as { session: { client: Client } }).session.client;
      if (
        'close' in client &&
        typeof (client as unknown as { close: () => void }).close === 'function'
      ) {
        (client as unknown as { close: () => void }).close();
      }
    } catch {
      // ignore
    }
  }
  _db = null;
}

// ─── Raw SQL for table creation ──────────────────────────────────────────────

const sqlCreateNovels = `
  CREATE TABLE IF NOT EXISTS novels (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    author     TEXT NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    cover_url  TEXT,
    description TEXT,
    genres     TEXT NOT NULL DEFAULT '[]',
    status     TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('ongoing','completed','hiatus','unknown')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

const sqlCreateChapters = `
  CREATE TABLE IF NOT EXISTS chapters (
    id            TEXT PRIMARY KEY,
    novel_id      TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    number        INTEGER NOT NULL,
    title         TEXT NOT NULL,
    source_url    TEXT NOT NULL,
    content       TEXT,
    downloaded_at INTEGER,
    UNIQUE(novel_id, number)
  );
`;

const sqlCreateDownloads = `
  CREATE TABLE IF NOT EXISTS downloads (
    id                 TEXT PRIMARY KEY,
    novel_id           TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','downloading','completed','failed','cancelled')),
    total_chapters     INTEGER NOT NULL DEFAULT 0,
    downloaded_chapters INTEGER NOT NULL DEFAULT 0,
    error              TEXT,
    created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;
