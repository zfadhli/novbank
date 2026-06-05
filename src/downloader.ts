// ---------------------------------------------------------------------------
// NovelDownloader — main orchestrator class
// ---------------------------------------------------------------------------
// The primary public API. Consumers create one instance and call methods on it.
// Handles the workflow: fetch → parse → persist → report.
// ---------------------------------------------------------------------------

import { and, eq, inArray } from 'drizzle-orm';
import { type Db, closeDb, initDb, migrate } from './db';
import {
  chaptersTable,
  downloadsTable,
  genresTable,
  novelGenresTable,
  novelsTable,
} from './db/schema';
import { DatabaseError, NotFoundError, ValidationError } from './errors';
import { Scraper } from './scraper';
import {
  parseChapterContent,
  parseChapterList,
  parseNovelDetail,
  parseSearchResults,
} from './scraper/parser';
import type {
  Chapter,
  ChapterId,
  Download,
  DownloadId,
  DownloadOptions,
  DownloadResult,
  DownloaderConfig,
  Novel,
  NovelId,
  NovelPreview,
  ProgressEvent,
  SearchResult,
} from './types';
import { generateId, htmlToMarkdown } from './utils/text';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  dbPath: './data/novels.db',
  baseUrl: 'https://freewebnovel.com',
  requestDelayMs: 1_000,
  maxConcurrency: 3,
} as const satisfies Partial<DownloaderConfig>;

// ─── Main class ──────────────────────────────────────────────────────────────

export class NovelDownloader {
  private readonly config: Required<DownloaderConfig>;
  private readonly scraper: Scraper;
  private db: Db | null = null;
  private initialised = false;

  constructor(config?: DownloaderConfig) {
    this.config = {
      dbPath: config?.dbPath ?? DEFAULTS.dbPath,
      baseUrl: config?.baseUrl ?? DEFAULTS.baseUrl,
      requestDelayMs: config?.requestDelayMs ?? DEFAULTS.requestDelayMs,
      maxConcurrency: config?.maxConcurrency ?? DEFAULTS.maxConcurrency,
      onProgress: config?.onProgress ?? (() => {}),
    };

    this.scraper = new Scraper({
      baseUrl: this.config.baseUrl,
      requestDelayMs: this.config.requestDelayMs,
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Initialise the database connection and run migrations.
   * Must be called before any data-access methods.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (this.initialised) return;
    this.db = initDb(this.config.dbPath);
    await migrate(this.db);
    this.initialised = true;
  }

  /**
   * Close the database connection and release resources.
   * Call this when you're done with the downloader.
   */
  async close(): Promise<void> {
    this.scraper.dispose();
    await closeDb();
    this.db = null;
    this.initialised = false;
  }

  // ── Search ─────────────────────────────────────────────────────────────

  /**
   * Search for novels on the source site.
   */
  async search(query: string, _page = 1): Promise<SearchResult> {
    const url = `${this.config.baseUrl}/search?q=${encodeURIComponent(query)}&page=${_page}`;
    const html = await this.scraper.fetchHtml(url);
    const parsed = parseSearchResults(html, this.config.baseUrl);
    return {
      novels: parsed.novels,
      totalResults: parsed.totalResults,
      currentPage: _page,
      totalPages: parsed.totalPages,
    };
  }

  // ── Novel operations ───────────────────────────────────────────────────

  /**
   * Fetch novel metadata from the source and save to the database.
   * If the novel already exists (by sourceUrl), it is updated in place.
   *
   * Returns the saved `Novel`.
   */
  async fetchAndSaveNovel(sourceUrl: string): Promise<Novel> {
    this.ensureInit();

    const html = await this.scraper.fetchHtml(sourceUrl);
    const detail = parseNovelDetail(html, this.config.baseUrl);

    const novelId = generateId();
    const now = Math.floor(Date.now() / 1000);

    const novel: Novel = {
      id: novelId as NovelId,
      title: detail.title,
      author: detail.author,
      sourceUrl,
      coverUrl: detail.coverUrl,
      description: detail.description,
      genres: detail.genres,
      status: mapStatus(detail.status),
      novelType: detail.novelType as Novel['novelType'],
      chapterCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Upsert novel
    const db = this.assertDb();
    try {
      const existing = await db
        .select({ id: novelsTable.id })
        .from(novelsTable)
        .where(eq(novelsTable.sourceUrl, sourceUrl))
        .limit(1);

      if (existing.length > 0) {
        const existingId = existing[0]?.id;
        if (!existingId) throw new Error('Inconsistent state: novel row has no id');
        await db
          .update(novelsTable)
          .set({
            title: novel.title,
            author: novel.author,
            coverUrl: novel.coverUrl,
            description: novel.description,
            status: novel.status,
            type: novel.novelType,
            updatedAt: now,
          })
          .where(eq(novelsTable.id, existingId));
        novel.id = existingId as NovelId;
      } else {
        await db.insert(novelsTable).values({
          id: novelId,
          title: novel.title,
          author: novel.author,
          sourceUrl: novel.sourceUrl,
          coverUrl: novel.coverUrl,
          description: novel.description,
          status: novel.status,
          type: novel.novelType,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (cause) {
      throw new DatabaseError('Failed to save novel', {
        cause: cause instanceof Error ? cause : undefined,
        context: { sourceUrl },
        operation: 'fetchAndSaveNovel',
      });
    }

    // Save genres to the normalized pivot table
    await saveGenres(db, novel.id, novel.genres);

    // Compute chapter count from the parsed list (chapters are saved on demand by downloadNovel)
    const chapters = parseChapterList(html, this.config.baseUrl, sourceUrl);
    novel.chapterCount = chapters.length;
    await db
      .update(novelsTable)
      .set({ chapterCount: chapters.length })
      .where(eq(novelsTable.id, novel.id));

    return novel;
  }

  // ── Download ───────────────────────────────────────────────────────────

  /**
   * Download all (or a range of) chapters for a novel and save content to DB.
   *
   * The novel must already exist in the database (call `fetchAndSaveNovel` first).
   *
   * Progress is reported via the `onProgress` callback passed in the config.
   */
  async downloadNovel(novelId: string, options?: DownloadOptions): Promise<DownloadResult> {
    this.ensureInit();
    const db = this.assertDb();

    // Validate novel exists
    const novelRows = await db
      .select()
      .from(novelsTable)
      .where(eq(novelsTable.id, novelId))
      .limit(1);

    if (novelRows.length === 0) {
      throw new NotFoundError(`Novel not found: ${novelId}`, {
        resourceType: 'novel',
        resourceId: novelId,
      });
    }

    const novel = novelRows[0] as typeof novelsTable.$inferSelect;

    // Fetch chapters from DB — if none exist, scrape the novel page to get the list
    let chapterRows = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.novelId, novelId))
      .orderBy(chaptersTable.number);

    if (chapterRows.length === 0) {
      // Scrape the novel page to discover the chapter list
      const html = await this.scraper.fetchHtml(novel.sourceUrl);
      const allChapters = parseChapterList(html, this.config.baseUrl, novel.sourceUrl);

      // Determine which chapters to save (respecting the requested range)
      const from = options?.fromChapter ?? 1;
      const to = options?.toChapter ?? Number.POSITIVE_INFINITY;
      const wanted = allChapters.filter((c) => c.number >= from && c.number <= to);

      // Insert only the chapters in the requested range
      for (const ch of wanted) {
        await db
          .insert(chaptersTable)
          .values({
            id: generateId(),
            novelId: novel.id,
            number: ch.number,
            title: ch.title,
            sourceUrl: ch.url,
            content: null,
            downloadedAt: null,
          })
          .onConflictDoNothing({ target: [chaptersTable.novelId, chaptersTable.number] });
      }

      // Re-query to get the inserted rows
      chapterRows = await db
        .select()
        .from(chaptersTable)
        .where(eq(chaptersTable.novelId, novelId))
        .orderBy(chaptersTable.number);
    }

    // If chapters exist but the requested range extends beyond what's stored,
    // scrape the novel page and insert only the missing chapters
    const maxInDb = chapterRows.length > 0 ? Math.max(...chapterRows.map((c) => c.number)) : 0;
    const requestedTo = options?.toChapter ?? Number.POSITIVE_INFINITY;

    if (chapterRows.length > 0 && requestedTo > maxInDb && Number.isFinite(requestedTo)) {
      const html = await this.scraper.fetchHtml(novel.sourceUrl);
      const allChapters = parseChapterList(html, this.config.baseUrl, novel.sourceUrl);

      const missing = allChapters.filter((c) => c.number > maxInDb && c.number <= requestedTo);

      for (const ch of missing) {
        await db
          .insert(chaptersTable)
          .values({
            id: generateId(),
            novelId: novel.id,
            number: ch.number,
            title: ch.title,
            sourceUrl: ch.url,
            content: null,
            downloadedAt: null,
          })
          .onConflictDoNothing({ target: [chaptersTable.novelId, chaptersTable.number] });
      }

      if (missing.length > 0) {
        chapterRows = await db
          .select()
          .from(chaptersTable)
          .where(eq(chaptersTable.novelId, novelId))
          .orderBy(chaptersTable.number);
      }
    }

    // Apply range and overwrite filters
    if (options?.fromChapter) {
      chapterRows = chapterRows.filter((c) => c.number >= (options.fromChapter ?? 0));
    }
    if (options?.toChapter) {
      chapterRows = chapterRows.filter(
        (c) => c.number <= (options.toChapter ?? Number.POSITIVE_INFINITY),
      );
    }
    if (!options?.overwrite) {
      chapterRows = chapterRows.filter((c) => c.content === null);
    }

    const totalToDownload = chapterRows.length;
    const errors: Array<{ chapterNumber: number; error: string }> = [];
    let downloadedCount = 0;
    const skippedCount = 0;

    // Create or update download tracking record
    const existingDownload = await db
      .select({ id: downloadsTable.id })
      .from(downloadsTable)
      .where(eq(downloadsTable.novelId, novelId as NovelId))
      .limit(1);

    if (existingDownload.length > 0) {
      await db
        .update(downloadsTable)
        .set({
          status: 'downloading',
          requestedFrom: options?.fromChapter ?? null,
          requestedTo: options?.toChapter ?? null,
          overwrite: options?.overwrite ?? false,
          totalChapters: totalToDownload,
          downloadedChapters: 0,
          failedChapters: 0,
          error: null,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(downloadsTable.novelId, novelId as NovelId));
    } else {
      await db.insert(downloadsTable).values({
        id: generateId(),
        novelId: novel.id,
        status: 'downloading',
        requestedFrom: options?.fromChapter ?? null,
        requestedTo: options?.toChapter ?? null,
        overwrite: options?.overwrite ?? false,
        totalChapters: totalToDownload,
        downloadedChapters: 0,
        failedChapters: 0,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });
    }

    this.emitProgress(novel, 'downloading', totalToDownload, downloadedCount);

    // Process with concurrency limit
    const concurrency = this.config.maxConcurrency;
    const chunks = chunkArray(chapterRows, concurrency);

    for (const batch of chunks) {
      const batchResults = await Promise.allSettled(
        batch.map(async (ch) => {
          try {
            await this.downloadSingleChapter(ch, novelId as NovelId);
            return ch.number;
          } catch (err) {
            throw { chapter: ch.number, cause: err };
          }
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          downloadedCount++;
        } else {
          const reason = result.reason as { chapter: number; cause: unknown };
          errors.push({
            chapterNumber: reason.chapter,
            error: reason.cause instanceof Error ? reason.cause.message : String(reason.cause),
          });
        }
      }

      this.emitProgress(novel, 'downloading', totalToDownload, downloadedCount);
    }

    // Final status
    const finalStatus = errors.length > 0 ? 'failed' : 'completed';
    await db
      .update(downloadsTable)
      .set({
        status: finalStatus,
        downloadedChapters: downloadedCount,
        failedChapters: errors.length,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(downloadsTable.novelId, novelId as NovelId));

    this.emitProgress(novel, finalStatus, totalToDownload, downloadedCount);

    return {
      novelId: novelId as NovelId,
      novelTitle: novel.title,
      totalChapters: totalToDownload,
      downloadedChapters: downloadedCount,
      skippedChapters: skippedCount,
      failedChapters: errors.length,
      errors,
    };
  }

  // ── Query helpers ──────────────────────────────────────────────────────

  /** List all saved novels. */
  async listNovels(): Promise<Novel[]> {
    this.ensureInit();
    const db = this.assertDb();
    const rows = await db.select().from(novelsTable).orderBy(novelsTable.updatedAt);
    const novels = rows.map((r) => r as typeof novelsTable.$inferSelect);
    // Batch-load genres for all novels
    const novelsWithGenres = await attachGenres(db, novels);
    return novelsWithGenres.map(rowToNovel);
  }

  /** Get a single novel by ID. */
  async getNovel(novelId: string): Promise<Novel> {
    this.ensureInit();
    const db = this.assertDb();
    const rows = await db.select().from(novelsTable).where(eq(novelsTable.id, novelId)).limit(1);

    if (rows.length === 0) {
      throw new NotFoundError(`Novel not found: ${novelId}`, {
        resourceType: 'novel',
        resourceId: novelId,
      });
    }

    const novelsWithGenres = await attachGenres(db, [rows[0] as typeof novelsTable.$inferSelect]);
    return rowToNovel(
      novelsWithGenres[0] as typeof novelsTable.$inferSelect & { genres: string[] },
    );
  }

  /** List chapters for a novel. */
  async listChapters(novelId: string): Promise<Chapter[]> {
    this.ensureInit();
    const db = this.assertDb();
    const rows = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.novelId, novelId))
      .orderBy(chaptersTable.number);

    return rows.map(rowToChapter);
  }

  /** Get download status for a novel. */
  async getDownloadStatus(novelId: string): Promise<Download | null> {
    this.ensureInit();
    const db = this.assertDb();
    const rows = await db
      .select()
      .from(downloadsTable)
      .where(eq(downloadsTable.novelId, novelId))
      .limit(1);

    if (rows.length === 0) return null;
    return rowToDownload(rows[0] as typeof downloadsTable.$inferSelect);
  }

  // ── Private ────────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (!this.initialised) {
      throw new ValidationError(
        'NovelDownloader not initialised. Call await downloader.init() first.',
        { field: 'initialised', value: false },
      );
    }
  }

  private assertDb(): Db {
    if (!this.db) {
      throw new DatabaseError('Database not connected', { operation: 'assertDb' });
    }
    return this.db;
  }

  private async downloadSingleChapter(
    ch: typeof chaptersTable.$inferSelect,
    novelId: NovelId,
  ): Promise<void> {
    const html = await this.scraper.fetchHtml(ch.sourceUrl);
    const parsed = parseChapterContent(html, ch.sourceUrl);
    const markdown = htmlToMarkdown(parsed.content);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    const db = this.assertDb();
    await db
      .update(chaptersTable)
      .set({
        content: markdown,
        wordCount,
        downloadedAt: Math.floor(Date.now() / 1000),
      })
      .where(and(eq(chaptersTable.id, ch.id), eq(chaptersTable.novelId, novelId)));
  }

  private emitProgress(
    novel: typeof novelsTable.$inferSelect,
    status: ProgressEvent['status'],
    totalChapters: number,
    downloadedChapters: number,
  ): void {
    const cb = this.config.onProgress;
    if (!cb) return;

    const event: ProgressEvent = {
      novelId: novel.id as NovelId,
      novelTitle: novel.title,
      status,
      totalChapters,
      downloadedChapters,
    };
    cb(event);
  }
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapStatus(raw: string): Novel['status'] {
  const lower = raw.toLowerCase();
  if (lower.includes('ongoing') || lower.includes('连载')) return 'ongoing';
  if (lower.includes('completed') || lower.includes('完本')) return 'completed';
  if (lower.includes('hiatus') || lower.includes('暂停')) return 'hiatus';
  return 'unknown';
}

/** Attach genre names to an array of novel rows. */
async function attachGenres(
  db: Db,
  novelRows: (typeof novelsTable.$inferSelect)[],
): Promise<Array<typeof novelsTable.$inferSelect & { genres: string[] }>> {
  if (novelRows.length === 0) return [];

  const novelIds = novelRows.map((r) => r.id);

  // Fetch all novel-genre links for these novels
  const links = await db
    .select({ novelId: novelGenresTable.novelId, genreSlug: novelGenresTable.genreId })
    .from(novelGenresTable)
    .where(inArray(novelGenresTable.novelId, novelIds));

  if (links.length === 0) {
    return novelRows.map((r) => ({ ...r, genres: [] }));
  }

  // Fetch genre names for all linked genre slugs
  const genreSlugs = [...new Set(links.map((l) => l.genreSlug))];
  const genreRows = await db
    .select({ slug: genresTable.slug, name: genresTable.name })
    .from(genresTable)
    .where(inArray(genresTable.slug, genreSlugs));

  const genreNameBySlug = new Map(genreRows.map((g) => [g.slug, g.name]));

  // Build novelId → genre names map
  const genresByNovel = new Map<string, string[]>();
  for (const link of links) {
    const list = genresByNovel.get(link.novelId) ?? [];
    const name = genreNameBySlug.get(link.genreSlug);
    if (name) list.push(name);
    genresByNovel.set(link.novelId, list);
  }

  return novelRows.map((r) => ({
    ...r,
    genres: genresByNovel.get(r.id) ?? [],
  }));
}

/** Save genre names to the normalized genre + pivot tables. */
async function saveGenres(db: Db, novelId: string, genreNames: string[]): Promise<void> {
  for (const name of genreNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    // Use the slug as the genre ID for simplicity
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) continue;

    await db
      .insert(genresTable)
      .values({ id: slug, name: trimmed, slug })
      .onConflictDoNothing({ target: genresTable.id });

    await db.insert(novelGenresTable).values({ novelId, genreId: slug }).onConflictDoNothing();
  }
}

function rowToNovel(row: typeof novelsTable.$inferSelect & { genres: string[] }): Novel {
  return {
    id: row.id as NovelId,
    title: row.title,
    author: row.author,
    sourceUrl: row.sourceUrl,
    coverUrl: row.coverUrl,
    description: row.description,
    genres: row.genres,
    status: row.status as Novel['status'],
    novelType: row.type as Novel['novelType'],
    chapterCount: row.chapterCount as number,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
  };
}

function rowToChapter(row: typeof chaptersTable.$inferSelect): Chapter {
  return {
    id: row.id as ChapterId,
    novelId: row.novelId as NovelId,
    number: row.number,
    title: row.title,
    sourceUrl: row.sourceUrl,
    content: row.content,
    wordCount: row.wordCount as number | null,
    downloadedAt: row.downloadedAt as number | null,
  };
}

function rowToDownload(row: typeof downloadsTable.$inferSelect): Download {
  return {
    id: row.id as DownloadId,
    novelId: row.novelId as NovelId,
    status: row.status as Download['status'],
    requestedFrom: row.requestedFrom as number | null,
    requestedTo: row.requestedTo as number | null,
    overwrite: Boolean(row.overwrite),
    totalChapters: row.totalChapters,
    downloadedChapters: row.downloadedChapters,
    failedChapters: row.failedChapters,
    error: row.error,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
