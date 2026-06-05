// ---------------------------------------------------------------------------
// HTML parser — extracts structured data from freewebnovel.com pages
// ---------------------------------------------------------------------------
// Pure functions (no IO). Each takes an HTML string and returns parsed data.
// Keep these focused — the downloader orchestrates when to call them.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { ParseError } from '../errors';
import type { NovelPreview } from '../types';
import { cleanChapterTitle, normalizeWhitespace } from '../utils/text';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function queryOne(
  $: cheerio.CheerioAPI,
  selector: string,
  ctx?: { url?: string },
): cheerio.Cheerio<AnyNode> {
  const el = $(selector).first();
  if (el.length === 0) {
    const errorContext: Record<string, unknown> = { selector };
    if (ctx?.url) errorContext.url = ctx.url;
    throw new ParseError(`Selector "${selector}" matched no elements`, {
      context: errorContext,
      selector,
      url: ctx?.url,
    });
  }
  return el;
}

function attr(el: cheerio.Cheerio<AnyNode>, name: string): string | null {
  return (el.attr(name) as string | null) ?? null;
}

function text(el: cheerio.Cheerio<AnyNode>): string {
  return normalizeWhitespace(el.text());
}

// ─── Page parsers ────────────────────────────────────────────────────────────

/**
 * Parse the novel-list / search-results page.
 * Expected structure: a container with article or list-item cards.
 */
export function parseSearchResults(
  html: string,
  baseUrl: string,
): { novels: NovelPreview[]; totalResults: number; totalPages: number } {
  const $ = cheerio.load(html);

  // Site-specific selectors — adjust if the HTML structure differs
  const cards = $('.novel-item, .novel-list .item, article');
  const novels: NovelPreview[] = [];

  cards.each((_, card) => {
    const $card = $(card);

    try {
      const $linkEl = $card.find('a').first();
      if ($linkEl.length === 0) return;

      const $titleEl = $card.find('h3 a, h2 a, .title a').first();
      const $authorEl = $card.find('.author, .info .author').first();
      const $coverEl = $card.find('img').first();

      const href = attr($linkEl, 'href');
      if (!href) return;

      novels.push({
        title: $titleEl.length > 0 ? text($titleEl) : text($linkEl),
        author: $authorEl.length > 0 ? text($authorEl) : 'Unknown',
        sourceUrl: href.startsWith('http')
          ? href
          : `${baseUrl.replace(/\/+$/, '')}${href.startsWith('/') ? '' : '/'}${href}`,
        coverUrl: $coverEl.length > 0 ? (attr($coverEl, 'src') ?? null) : null,
        status: 'unknown',
      });
    } catch {
      // Skip malformed cards
    }
  });

  // Attempt to read pagination
  const totalResults = novels.length; // best-effort; site may show totals
  const totalPages = 1;

  return { novels, totalResults, totalPages };
}

/**
 * Parse the novel detail page.
 * Returns raw data (not yet a full `Novel` — the downloader assembles it).
 */
export function parseNovelDetail(
  html: string,
  _baseUrl: string,
): {
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  genres: string[];
  status: string;
  novelType: string;
} {
  const $ = cheerio.load(html);

  const $titleEl = queryOne($, '.m-desc h1.tit, .g-tit h3.tit, h1, .title, .novel-title');
  const $authorEl = $('.m-imgtxt [href^="/author/"], .author, .info .author').first();
  const $coverEl = $('.m-imgtxt .pic img, .cover img, .novel-cover img').first();
  const $descEl = $('.m-desc .txt .inner, .description, .synopsis, .novel-desc').first();
  const $genreEls = $('.m-imgtxt [href^="/genre/"], .genre a, .genres a, .tags a');
  const $statusEl = $(
    '.m-imgtxt .item:has(.glyphicon-time) .right, .status, .novel-status',
  ).first();
  const $typeEl = $('.m-imgtxt .item:has(.glyphicon-globe) .right').first();

  const genres: string[] = [];
  $genreEls.each((_, el) => {
    const g = text($(el));
    if (g) genres.push(g);
  });

  return {
    title: text($titleEl),
    author: $authorEl.length > 0 ? text($authorEl) : 'Unknown',
    coverUrl: $coverEl.length > 0 ? (attr($coverEl, 'src') ?? null) : null,
    description: $descEl.length > 0 ? text($descEl) || null : null,
    genres,
    status: $statusEl.length > 0 ? text($statusEl).toLowerCase() : 'unknown',
    novelType: $typeEl.length > 0 ? mapNovelType(text($typeEl)) : 'unknown',
  };
}

/**
 * Parse the chapter list from the novel detail page.
 * Returns an unordered array of { number, title, url } objects.
 */
export function parseChapterList(
  html: string,
  _baseUrl: string,
  sourcePageUrl: string,
): Array<{ number: number; title: string; url: string }> {
  const $ = cheerio.load(html);

  // Try known selectors for the chapter list container
  const $container = $('#idData, .chapter-list, .chapters, #chapters, .list-chapter');
  const $links = $container.length > 0 ? $container.find('a') : $('a');

  const chapters: Array<{ number: number; title: string; url: string }> = [];

  $links.each((_, link) => {
    const $link = $(link);
    const href = attr($link, 'href');
    if (!href) return;

    const chapterText = text($link);
    if (!chapterText) return;

    // Try to extract chapter number from URL or text
    const urlMatch = href.match(/chapter[_-]?(\d+)/i);
    const textMatch = chapterText.match(/(?:chapter|ch\.?)\s*(\d+)/i);
    const numStr = urlMatch?.[1] ?? textMatch?.[1];
    if (!numStr) return;

    const number = Number.parseInt(numStr, 10);
    if (!Number.isFinite(number)) return;

    // Resolve relative URLs against the novel page URL (not the site root)
    const url = href.startsWith('http') ? href : new URL(href, sourcePageUrl).href;

    chapters.push({ number, title: cleanChapterTitle(chapterText), url });
  });

  return chapters;
}

/**
 * Parse a single chapter page and extract its text content.
 */
export function parseChapterContent(html: string, url: string): { content: string; title: string } {
  const $ = cheerio.load(html);

  const $titleEl = $('.chapter, #article h4, h1, .chapter-title, .title').first();
  const $contentEl = $('#article, #chapter-content, .chapter-content, .content, article').first();

  if ($contentEl.length === 0) {
    throw new ParseError('Could not find chapter content element', {
      url,
      selector: '#chapter-content, .chapter-content, .content, article',
    });
  }

  return {
    title: $titleEl.length > 0 ? text($titleEl) : 'Untitled',
    content: $contentEl.html() ?? '',
  };
}

// ─── Novel type mapping ──────────────────────────────────────────────────────

/**
 * Map a display name like "English Novel" or "Korean Novel" to a short type key.
 */
function mapNovelType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('english')) return 'english';
  if (lower.includes('korean')) return 'korean';
  if (lower.includes('chinese')) return 'chinese';
  if (lower.includes('japanese')) return 'japanese';
  return 'unknown';
}
