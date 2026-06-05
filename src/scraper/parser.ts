// ---------------------------------------------------------------------------
// HTML parser — extracts structured data from freewebnovel.com pages
// ---------------------------------------------------------------------------
// Pure functions (no IO). Each takes an HTML string and returns parsed data.
// Keep these focused — the downloader orchestrates when to call them.
// ---------------------------------------------------------------------------

import { type HTMLElement, parse as parseHtml } from 'node-html-parser';
import { ParseError } from '../errors';
import type { NovelPreview } from '../types';
import { normalizeWhitespace } from '../utils/text';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function queryOne(root: HTMLElement, selector: string, ctx?: { url?: string }): HTMLElement {
  const el = root.querySelector(selector);
  if (!el) {
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

function attr(el: HTMLElement, name: string): string | null {
  return (el.getAttribute(name) as string | null) ?? null;
}

function text(el: HTMLElement): string {
  return normalizeWhitespace(el.textContent ?? '');
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
  const root = parseHtml(html);

  // Site-specific selectors — adjust if the HTML structure differs
  const cards = root.querySelectorAll('.novel-item, .novel-list .item, article');
  const novels: NovelPreview[] = [];

  for (const card of cards) {
    try {
      const linkEl = card.querySelector('a');
      if (!linkEl) continue;
      const titleEl = card.querySelector('h3 a, h2 a, .title a') ?? linkEl;
      const authorEl = card.querySelector('.author, .info .author');
      const coverEl = card.querySelector('img');

      const href = attr(linkEl, 'href');
      if (!href) continue;

      novels.push({
        title: text(titleEl),
        author: authorEl ? text(authorEl) : 'Unknown',
        sourceUrl: href.startsWith('http')
          ? href
          : `${baseUrl.replace(/\/+$/, '')}${href.startsWith('/') ? '' : '/'}${href}`,
        coverUrl: coverEl ? (attr(coverEl, 'src') ?? null) : null,
        status: 'unknown',
      });
    } catch {}
  }

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
} {
  const root = parseHtml(html);

  const titleEl = queryOne(root, 'h1, .title, .novel-title');
  const authorEl = root.querySelector('.author, .info .author');
  const coverEl = root.querySelector('.cover img, .novel-cover img');
  const descEl = root.querySelector('.description, .synopsis, .novel-desc');
  const genreEls = root.querySelectorAll('.genre a, .genres a, .tags a');
  const statusEl = root.querySelector('.status, .novel-status');

  const genres: string[] = [];
  for (const el of genreEls) {
    const g = text(el);
    if (g) genres.push(g);
  }

  return {
    title: text(titleEl),
    author: authorEl ? text(authorEl) : 'Unknown',
    coverUrl: coverEl ? (attr(coverEl, 'src') ?? null) : null,
    description: descEl ? text(descEl) || null : null,
    genres,
    status: statusEl ? text(statusEl).toLowerCase() : 'unknown',
  };
}

/**
 * Parse the chapter list from the novel detail page.
 * Returns an unordered array of { number, title, url } objects.
 */
export function parseChapterList(
  html: string,
  baseUrl: string,
): Array<{ number: number; title: string; url: string }> {
  const root = parseHtml(html);

  // Try common selectors for chapter list containers
  const container =
    root.querySelector('.chapter-list, .chapters, #chapters, .list-chapter') ?? root;
  const links = container.querySelectorAll('a');

  const chapters: Array<{ number: number; title: string; url: string }> = [];

  for (const link of links) {
    const href = attr(link, 'href');
    if (!href) continue;

    const chapterText = text(link);
    if (!chapterText) continue;

    // Try to extract chapter number from URL or text
    const urlMatch = href.match(/chapter[_-]?(\d+)/i);
    const textMatch = chapterText.match(/(?:chapter|ch\.?)\s*(\d+)/i);
    const numStr = urlMatch?.[1] ?? textMatch?.[1];
    if (!numStr) continue;

    const number = Number.parseInt(numStr, 10);
    if (!Number.isFinite(number)) continue;

    const url = href.startsWith('http')
      ? href
      : `${baseUrl.replace(/\/+$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;

    chapters.push({ number, title: chapterText, url });
  }

  return chapters;
}

/**
 * Parse a single chapter page and extract its text content.
 */
export function parseChapterContent(html: string, url: string): { content: string; title: string } {
  const root = parseHtml(html);

  const titleEl = root.querySelector('h1, .chapter-title, .title');
  const contentEl =
    root.querySelector('#chapter-content, .chapter-content, .content, article') ?? root;

  if (!contentEl) {
    throw new ParseError('Could not find chapter content element', {
      url,
      selector: '#chapter-content, .chapter-content, .content, article',
    });
  }

  return {
    title: titleEl ? text(titleEl) : 'Untitled',
    content: contentEl.innerHTML ?? '',
  };
}
