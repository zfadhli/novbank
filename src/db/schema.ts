// ---------------------------------------------------------------------------
// Drizzle ORM schema — SQLite tables for novbank
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ─── Novels table ────────────────────────────────────────────────────────────

export const novelsTable = sqliteTable(
  'novels',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    sourceUrl: text('source_url').notNull(),
    coverUrl: text('cover_url'),
    description: text('description'),
    status: text('status', {
      enum: ['ongoing', 'completed', 'hiatus', 'unknown'],
    })
      .notNull()
      .default('unknown'),
    type: text('type', {
      enum: ['english', 'korean', 'chinese', 'japanese', 'unknown'],
    })
      .notNull()
      .default('unknown'),
    chapterCount: integer('chapter_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex('idx_novels_source_url').on(table.sourceUrl),
    titleIdx: index('idx_novels_title').on(table.title),
    authorIdx: index('idx_novels_author').on(table.author),
    statusIdx: index('idx_novels_status').on(table.status),
  }),
);

// ─── Genres table ────────────────────────────────────────────────────────────

export const genresTable = sqliteTable('genres', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
});

// ─── Novel ↔ Genre pivot table ───────────────────────────────────────────────

export const novelGenresTable = sqliteTable(
  'novel_genres',
  {
    novelId: text('novel_id')
      .notNull()
      .references(() => novelsTable.id, { onDelete: 'cascade' }),
    genreId: text('genre_id')
      .notNull()
      .references(() => genresTable.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.novelId, table.genreId] }),
    genreIdx: index('idx_novel_genres_genre').on(table.genreId),
  }),
);

// ─── Chapters table ──────────────────────────────────────────────────────────

export const chaptersTable = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novelsTable.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    sourceUrl: text('source_url').notNull(),
    content: text('content'),
    wordCount: integer('word_count'),
    downloadedAt: integer('downloaded_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    novelChapterIdx: uniqueIndex('idx_chapters_novel_chapter').on(table.novelId, table.number),
  }),
);

// ─── Downloads table (job tracking) ──────────────────────────────────────────

export const downloadsTable = sqliteTable(
  'downloads',
  {
    id: text('id').primaryKey(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novelsTable.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'downloading', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    requestedFrom: integer('requested_from'),
    requestedTo: integer('requested_to'),
    overwrite: integer('overwrite', { mode: 'boolean' }).notNull().default(false),
    totalChapters: integer('total_chapters').notNull().default(0),
    downloadedChapters: integer('downloaded_chapters').notNull().default(0),
    failedChapters: integer('failed_chapters').notNull().default(0),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    downloadNovelIdx: index('idx_downloads_novel').on(table.novelId),
    downloadStatusIdx: index('idx_downloads_status').on(table.status),
  }),
);

// ─── Types for insert / select ───────────────────────────────────────────────

export type NovelInsert = typeof novelsTable.$inferInsert;
export type NovelSelect = typeof novelsTable.$inferSelect;

export type ChapterInsert = typeof chaptersTable.$inferInsert;
export type ChapterSelect = typeof chaptersTable.$inferSelect;

export type DownloadInsert = typeof downloadsTable.$inferInsert;
export type DownloadSelect = typeof downloadsTable.$inferSelect;

export type GenreInsert = typeof genresTable.$inferInsert;
export type GenreSelect = typeof genresTable.$inferSelect;
