// ---------------------------------------------------------------------------
// Novbank — Public API entry point
// ---------------------------------------------------------------------------
//
// What gets exported from the library.
// Consumers import from 'novbank':
//
//   import { NovelDownloader, NovelDownloadError } from 'novbank';
//
// ---------------------------------------------------------------------------

// ─── Main class ──────────────────────────────────────────────────────────────

export { NovelDownloader } from './downloader';

// ─── Error classes ───────────────────────────────────────────────────────────

export {
  NovelDownloadError,
  NetworkError,
  ParseError,
  DatabaseError,
  NotFoundError,
  ValidationError,
  isNovelDownloadError,
} from './errors';

// ─── Types (re-exported for convenience) ─────────────────────────────────────

export type {
  Novel,
  Chapter,
  Download,
  Genre,
  DownloaderConfig,
  DownloadOptions,
  DownloadResult,
  SearchResult,
  NovelPreview,
  DownloadStatus,
  NovelStatus,
  NovelType,
  ProgressEvent,
  ProgressCallback,
  NovelId,
  ChapterId,
  DownloadId,
} from './types';

// ─── DB schema types (for advanced consumers who want raw access) ────────────

export type {
  NovelInsert,
  NovelSelect,
  ChapterInsert,
  ChapterSelect,
  DownloadInsert,
  DownloadSelect,
  GenreInsert,
  GenreSelect,
} from './db/schema';
