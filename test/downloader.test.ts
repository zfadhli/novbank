// ---------------------------------------------------------------------------
// NovelDownloader unit tests
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { resetDb } from '../src/db';
import { NovelDownloader } from '../src/downloader';
import { NotFoundError, NovelDownloadError, ValidationError } from '../src/errors';
import { cleanupDb, createTestDownloader, tempDbPath } from './setup';

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe('NovelDownloader lifecycle', () => {
  let downloader: NovelDownloader;

  afterEach(async () => {
    if (downloader) {
      await downloader.close();
    }
    resetDb();
  });

  it('should initialise and close without error', async () => {
    downloader = await createTestDownloader('lifecycle-1.db');
    expect(downloader).toBeInstanceOf(NovelDownloader);
    // Should not throw on close
    await downloader.close();
  });

  it('should throw ValidationError if used before init', async () => {
    const d = new NovelDownloader({ dbPath: tempDbPath('no-init.db') });
    try {
      // Must use type assertion since TS may flag the promise
      await (d as unknown as { listNovels(): Promise<unknown> }).listNovels();
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
    // Clean up internal state
    resetDb();
  });

  it('should be safe to call init() multiple times', async () => {
    downloader = new NovelDownloader({ dbPath: tempDbPath('multi-init.db') });
    await downloader.init();
    await downloader.init(); // second call — should be no-op
    await downloader.close();
  });
});

// ─── Database operations ─────────────────────────────────────────────────────

describe('NovelDownloader DB operations', () => {
  let downloader: NovelDownloader;
  const dbName = 'db-ops.db';

  beforeEach(async () => {
    downloader = await createTestDownloader(dbName);
  });

  afterEach(async () => {
    await downloader.close();
    cleanupDb(tempDbPath(dbName));
    resetDb();
  });

  it('should list novels (empty)', async () => {
    const novels = await downloader.listNovels();
    expect(novels).toBeArray();
    expect(novels.length).toBe(0);
  });

  it('should return null for non-existent download status', async () => {
    const status = await downloader.getDownloadStatus('00000000-0000-0000-0000-000000000000');
    expect(status).toBeNull();
  });

  it('should throw NotFoundError for unknown novel', async () => {
    try {
      await downloader.getNovel('nonexistent-id');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });
});

// ─── Error classes ───────────────────────────────────────────────────────────

describe('NovelDownloadError hierarchy', () => {
  it('should be catchable with instanceof NovelDownloadError', () => {
    try {
      throw new NotFoundError('test error', {
        resourceType: 'novel',
        resourceId: '123',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err).toBeInstanceOf(NovelDownloadError);
      expect(err).toBeInstanceOf(Error);
      const e = err as NotFoundError;
      expect(e.resourceType).toBe('novel');
      expect(e.resourceId).toBe('123');
      expect(e.name).toBe('NotFoundError');
    }
  });

  it('should carry context metadata', () => {
    const err = new NotFoundError('Not found', {
      context: { additionalInfo: 'test' },
      resourceType: 'chapter',
    });
    expect(err.context).toHaveProperty('resourceType', 'chapter');
    expect(err.context).toHaveProperty('additionalInfo', 'test');
  });
});
