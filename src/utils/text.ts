// ---------------------------------------------------------------------------
// Text processing utilities
// ---------------------------------------------------------------------------

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
 * Generate a simple UUID v7 (time-ordered) string.
 *
 * NOTE: This is a simplified implementation; for production use
 * consider a dedicated UUID library. This provides enough
 * uniqueness for this use case.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const random = crypto.getRandomValues(new Uint8Array(10));
  const randomHex = Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${timestamp}-${randomHex}`;
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
