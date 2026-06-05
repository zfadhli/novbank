// ---------------------------------------------------------------------------
// Test setup — shared helpers and mocks
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { NovelDownloader } from '../src/downloader';

/** Create a temporary database path for testing. */
export function tempDbPath(name = 'test.db'): string {
  const dir = join(import.meta.dir, '..', '.test-tmp');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, name);
}

/** Clean up a test database file. */
export function cleanupDb(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // ignore
  }
}

/** Create an initialised NovelDownloader pointing at a temp DB. */
export async function createTestDownloader(dbName?: string): Promise<NovelDownloader> {
  const dbPath = tempDbPath(dbName ?? `test-${Date.now()}.db`);
  const downloader = new NovelDownloader({
    dbPath,
    baseUrl: 'https://freewebnovel.com',
    requestDelayMs: 100,
    maxConcurrency: 2,
  });
  await downloader.init();
  return downloader;
}

/** Sample HTML of a novel detail page (minimal mock). */
export function mockNovelHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Test Novel</title></head>
<body>
  <div class="m-info">
    <div class="m-imgtxt">
      <div class="pic">
        <img src="/covers/test.jpg" />
      </div>
      <div class="txt">
        <div class="item">
          <span class="glyphicon glyphicon-user" title="Author"></span>
          <div class="right"><a href="/author/TestAuthor" class="a1">Test Author</a></div>
        </div>
        <div class="item">
          <span class="glyphicon glyphicon-th-list" title="Genre"></span>
          <div class="right">
            <a href="/genre/fantasy">Fantasy</a>
            <a href="/genre/adventure">Adventure</a>
          </div>
        </div>
        <div class="item">
          <span class="glyphicon glyphicon-globe" title="Original Language"></span>
          <div class="right"><span class="s1"><a href="/sort/latest-release/english-novel">English Novel</a></span></div>
        </div>
        <div class="item">
          <span class="glyphicon glyphicon-time" title="Status"></span>
          <div class="right"><span class="s1 s2">Ongoing</span></div>
        </div>
      </div>
    </div>
    <div class="m-desc">
      <h1 class="tit">The Test Novel</h1>
      <div class="txt">
        <div class="inner">
          <p>A novel used for testing purposes.</p>
        </div>
      </div>
    </div>
  </div>
  <ul class="ul-list5" id="idData">
    <li><a href="/test-novel/chapter-1.html">Chapter 1: The Beginning</a></li>
    <li><a href="/test-novel/chapter-2.html">Chapter 2: The Middle</a></li>
  </ul>
</body>
</html>`;
}

/** Sample HTML of a chapter page (minimal mock). */
export function mockChapterHtml(number: number): string {
  return `<!DOCTYPE html>
<html>
<head><title>Chapter ${number}</title></head>
<body>
  <span class="chapter">Chapter ${number}: Test Content</span>
  <div class="txt">
    <div id="article">
      <h4>Chapter ${number}: Test Content</h4>
      <p>This is the content of chapter ${number}.</p>
      <p>It has multiple paragraphs for testing.</p>
      <br/>
      <p>End of chapter.</p>
    </div>
  </div>
</body>
</html>`;
}

/** Sample HTML of search results. */
export function mockSearchHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Search Results</title></head>
<body>
  <div class="novel-list">
    <div class="item">
      <h3><a href="/novel-one.html">Novel One</a></h3>
      <div class="author">Author One</div>
      <img src="/covers/one.jpg" />
    </div>
    <div class="item">
      <h3><a href="/novel-two.html">Novel Two</a></h3>
      <div class="author">Author Two</div>
    </div>
  </div>
</body>
</html>`;
}
