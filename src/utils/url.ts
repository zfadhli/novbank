// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Resolve a possibly-relative URL against the base.
 * Mimics the browser's native `new URL(href, base)`.
 */
export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    // If both fail, return href as-is
    return href;
  }
}

/**
 * Extract the novel slug from a freewebnovel.com URL.
 *
 * Examples:
 *   https://freewebnovel.com/novel-name.html      → "novel-name"
 *   https://freewebnovel.com/novel-name/chapter-1  → "novel-name"
 */
export function extractNovelSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .replace(/\.html$/, '')
      .split('/')
      .filter(Boolean);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract the chapter number from a chapter URL.
 *
 * Examples:
 *   https://freewebnovel.com/novel-name/chapter-1.html    → 1
 *   https://freewebnovel.com/novel-name/chapter-123.html  → 123
 */
export function extractChapterNumber(url: string): number | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/chapter[_-]?(\d+)/i);
    if (match?.[1]) {
      const num = Number.parseInt(match[1], 10);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a novel detail URL from a slug.
 */
export function buildNovelUrl(slug: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/${slug}.html`;
}

/**
 * Build a chapter URL from a novel slug and chapter number.
 */
export function buildChapterUrl(slug: string, chapterNumber: number, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/${slug}/chapter-${chapterNumber}.html`;
}

/**
 * Check if a URL belongs to the configured source domain.
 */
export function isSourceUrl(url: string, baseUrl: string): boolean {
  try {
    const sourceHost = new URL(baseUrl).hostname;
    const targetHost = new URL(url).hostname;
    return sourceHost === targetHost;
  } catch {
    return false;
  }
}
