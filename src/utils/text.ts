// ---------------------------------------------------------------------------
// Text processing utilities
// ---------------------------------------------------------------------------

import TurndownService from 'turndown';
import { ulid } from 'ulid';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
});

/**
 * Strip HTML tags and decode common entities.
 * Produces plain text suitable for storage / display.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert HTML to Markdown using turndown.
 * Preserves formatting like bold, italic, headings, and lists.
 */
export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

/**
 * Strip the numeric prefix from a chapter title.
 *
 * "Chapter 1 - 01 - World Without Hope"   → "World Without Hope"
 * "Chapter 277 - New Equipment"           → "New Equipment"
 * "Chapter 1: The Beginning"              → "The Beginning"
 * "Ch. 5 - Title"                         → "Title"
 * "Chapter 1"                             → "Chapter 1"  (preserved as-is)
 */
export function cleanChapterTitle(raw: string): string {
  const cleaned = raw
    .replace(/^(?:Chapter|Ch\.?)\s*\d+\s*[-:.]?\s*(?:\d+\s*[-:.]?\s*)?/i, '')
    .trim();
  return cleaned || raw.trim();
}

/**
 * Normalise whitespace: collapse multiple spaces into one,
 * trim leading/trailing whitespace.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to `maxLen` characters, appending "…" if truncated.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

/**
 * Generate a time-ordered unique identifier (ULID).
 * 26-character Crockford base32, sortable by creation time.
 */
export function generateId(): string {
  return ulid();
}

/**
 * Safely parse a JSON string, returning `null` on failure.
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
