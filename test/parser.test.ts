// ---------------------------------------------------------------------------
// Parser unit tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { ParseError } from '../src/errors';
import {
  parseChapterContent,
  parseChapterList,
  parseNovelDetail,
  parseSearchResults,
} from '../src/scraper/parser';
import { mockChapterHtml, mockNovelHtml, mockSearchHtml } from './setup';

const BASE_URL = 'https://freewebnovel.com';

// ─── Search results ──────────────────────────────────────────────────────────

describe('parseSearchResults', () => {
  it('should parse search results HTML', () => {
    const result = parseSearchResults(mockSearchHtml(), BASE_URL);
    expect(result.novels.length).toBeGreaterThan(0);
    expect(result.novels[0]?.title).toBe('Novel One');
    expect(result.novels[0]?.author).toBe('Author One');
    expect(result.novels[0]?.sourceUrl).toContain('novel-one.html');
  });

  it('should return empty array for invalid HTML', () => {
    const result = parseSearchResults('<html><body>No results</body></html>', BASE_URL);
    expect(result.novels).toBeArray();
    expect(result.novels.length).toBe(0);
  });
});

// ─── Novel detail ────────────────────────────────────────────────────────────

describe('parseNovelDetail', () => {
  it('should parse novel metadata', () => {
    const result = parseNovelDetail(mockNovelHtml(), BASE_URL);
    expect(result.title).toBe('The Test Novel');
    expect(result.author).toBe('Test Author');
    expect(result.coverUrl).toContain('test.jpg');
    expect(result.description).toContain('testing purposes');
    expect(result.genres).toContain('Fantasy');
    expect(result.genres).toContain('Adventure');
    expect(result.status).toContain('ongoing');
    expect(result.novelType).toBe('english');
  });

  it('should throw ParseError on completely empty HTML', () => {
    expect(() => parseNovelDetail('<html></html>', BASE_URL)).toThrow(ParseError);
  });
});

// ─── Chapter list ────────────────────────────────────────────────────────────

describe('parseChapterList', () => {
  it('should parse chapter links from novel page', () => {
    const chapters = parseChapterList(mockNovelHtml(), BASE_URL, `${BASE_URL}/test-novel.html`);
    expect(chapters.length).toBe(2);
    expect(chapters[0]?.number).toBe(1);
    expect(chapters[0]?.title).toContain('Chapter 1');
    expect(chapters[1]?.number).toBe(2);
  });
});

// ─── Chapter content ─────────────────────────────────────────────────────────

describe('parseChapterContent', () => {
  it('should parse chapter title and content HTML', () => {
    const url = `${BASE_URL}/test-novel/chapter-1.html`;
    const result = parseChapterContent(mockChapterHtml(1), url);
    expect(result.title).toContain('Chapter 1');
    expect(result.content).toContain('content of chapter 1');
  });

  it('should preserve paragraph structure', () => {
    const url = `${BASE_URL}/test-novel/chapter-5.html`;
    const result = parseChapterContent(mockChapterHtml(5), url);
    expect(result.content).toContain('<p>');
    expect(result.content).toContain('</p>');
  });
});
