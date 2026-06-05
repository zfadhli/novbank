// ---------------------------------------------------------------------------
// Novbank — Core type definitions
// ---------------------------------------------------------------------------

/** Unique identifier for a novel (UUID v7). */
export type NovelId = string & { readonly __brand: 'NovelId' };

/** Unique identifier for a chapter (UUID v7). */
export type ChapterId = string & { readonly __brand: 'ChapterId' };

/** Unique identifier for a download job. */
export type DownloadId = string & { readonly __brand: 'DownloadId' };

// ─── Novel ───────────────────────────────────────────────────────────────────

export interface Novel {
  /** Internal UUID. */
  id: NovelId;
  /** Novel title. */
  title: string;
  /** Author name(s). */
  author: string;
  /** Canonical URL on freewebnovel.com. */
  sourceUrl: string;
  /** URL to the cover image, if available. */
  coverUrl: string | null;
  /** Synopsis / description. */
  description: string | null;
  /** Genre labels (e.g. ["Fantasy", "Adventure"]). */
  genres: string[];
  /** Publication status on the source site. */
  status: NovelStatus;
  /** Language/category type (english, korean, chinese, japanese, or unknown). */
  novelType: NovelType;
  /** Total number of chapters for this novel. */
  chapterCount: number;
  /** Timestamp (epoch seconds) when this record was created. */
  createdAt: number;
  /** Timestamp (epoch seconds) when this record was last updated. */
  updatedAt: number;
}

export type NovelStatus = 'ongoing' | 'completed' | 'hiatus' | 'unknown';
export type NovelType = 'english' | 'korean' | 'chinese' | 'japanese' | 'unknown';

// ─── Chapter ─────────────────────────────────────────────────────────────────

export interface Chapter {
  /** Internal UUID. */
  id: ChapterId;
  /** Foreign key → Novel.id. */
  novelId: NovelId;
  /** Chapter number (1-based). */
  number: number;
  /** Chapter title (may differ from "Chapter N"). */
  title: string;
  /** Canonical URL on freewebnovel.com. */
  sourceUrl: string;
  /** Downloaded HTML content (plain-text stripped). */
  content: string | null;
  /** Word count of the downloaded content, or null if not yet downloaded. */
  wordCount: number | null;
  /** Timestamp (epoch seconds) when content was downloaded, or null. */
  downloadedAt: number | null;
}

// ─── Download ────────────────────────────────────────────────────────────────

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface Download {
  id: DownloadId;
  novelId: NovelId;
  status: DownloadStatus;
  requestedFrom: number | null;
  requestedTo: number | null;
  overwrite: boolean;
  totalChapters: number;
  downloadedChapters: number;
  failedChapters: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface DownloaderConfig {
  /**
   * SQLite database path (relative or absolute).
   * Default: `"./data/novels.db"`
   */
  dbPath?: string;
  /**
   * Base URL for the source website.
   * Default: `"https://freewebnovel.com"`
   */
  baseUrl?: string;
  /**
   * Delay between requests in milliseconds (rate limiting).
   * Default: `1000`
   */
  requestDelayMs?: number;
  /**
   * Maximum number of concurrent chapter downloads.
   * Default: `3`
   */
  maxConcurrency?: number;
  /**
   * Optional callback for progress events.
   */
  onProgress?: ProgressCallback;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface ProgressEvent {
  novelId: NovelId;
  novelTitle: string;
  status: DownloadStatus;
  totalChapters: number;
  downloadedChapters: number;
  currentChapter?: {
    number: number;
    title: string;
  };
  error?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  novels: NovelPreview[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
}

export interface NovelPreview {
  title: string;
  author: string;
  sourceUrl: string;
  coverUrl: string | null;
  chaptersCount?: number;
  status?: NovelStatus;
}

// ─── Download options ────────────────────────────────────────────────────────

export interface DownloadOptions {
  /** Inclusive chapter range — start chapter number. */
  fromChapter?: number;
  /** Inclusive chapter range — end chapter number. */
  toChapter?: number;
  /** Whether to overwrite already-downloaded chapters. */
  overwrite?: boolean;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface DownloadResult {
  novelId: NovelId;
  novelTitle: string;
  totalChapters: number;
  downloadedChapters: number;
  skippedChapters: number;
  failedChapters: number;
  errors: Array<{ chapterNumber: number; error: string }>;
}
