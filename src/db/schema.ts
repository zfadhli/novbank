// ---------------------------------------------------------------------------
// Drizzle ORM schema — SQLite tables for novbank
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    genres: text('genres').notNull().default('[]'), // JSON array stored as text
    status: text('status', {
      enum: ['ongoing', 'completed', 'hiatus', 'unknown'],
    })
      .notNull()
      .default('unknown'),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex('idx_novels_source_url').on(table.sourceUrl),
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
    downloadedAt: integer('downloaded_at', { mode: 'number' }),
  },
  (table) => ({
    novelChapterIdx: uniqueIndex('idx_chapters_novel_chapter').on(table.novelId, table.number),
  }),
);

// ─── Downloads table (job tracking) ──────────────────────────────────────────

export const downloadsTable = sqliteTable('downloads', {
  id: text('id').primaryKey(),
  novelId: text('novel_id')
    .notNull()
    .references(() => novelsTable.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['pending', 'downloading', 'completed', 'failed', 'cancelled'],
  })
    .notNull()
    .default('pending'),
  totalChapters: integer('total_chapters').notNull().default(0),
  downloadedChapters: integer('downloaded_chapters').notNull().default(0),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// ─── Types for insert / select ───────────────────────────────────────────────

export type NovelInsert = typeof novelsTable.$inferInsert;
export type NovelSelect = typeof novelsTable.$inferSelect;

export type ChapterInsert = typeof chaptersTable.$inferInsert;
export type ChapterSelect = typeof chaptersTable.$inferSelect;

export type DownloadInsert = typeof downloadsTable.$inferInsert;
export type DownloadSelect = typeof downloadsTable.$inferSelect;
