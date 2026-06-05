// ---------------------------------------------------------------------------
// Basic usage — download a novel and query the database
// ---------------------------------------------------------------------------
// Run with:
//   bun run examples/basic-usage.ts
// ---------------------------------------------------------------------------

import {
  NetworkError,
  NotFoundError,
  NovelDownloadError,
  NovelDownloader,
  ParseError,
} from '../src/index';

// ─── 1. Create the downloader ────────────────────────────────────────────────

const dl = new NovelDownloader({
  dbPath: './data/novels.db',
  requestDelayMs: 1500, // be polite to the server
  maxConcurrency: 2, // download 2 chapters at a time
  onProgress: (event) => {
    const bar = progressBar(event.downloadedChapters, event.totalChapters);
    const pct =
      event.totalChapters > 0
        ? Math.round((event.downloadedChapters / event.totalChapters) * 100)
        : 0;
    console.log(
      `  [${event.status}] ${event.novelTitle}: ${bar} ${pct}%` +
        ` (${event.downloadedChapters}/${event.totalChapters})`,
    );
  },
});

// ─── 2. Lifecycle ────────────────────────────────────────────────────────────

try {
  await dl.init();
  console.log('✓ Database connected\n');

  // ─── 3. Search ──────────────────────────────────────────────────────────

  console.log('Searching for "martial peak"...');
  const searchResults = await dl.search('martial peak');
  console.log(`  Found ${searchResults.totalResults} results\n`);

  for (const preview of searchResults.novels.slice(0, 3)) {
    console.log(`  • ${preview.title} — ${preview.author}`);
  }
  console.log();

  // ─── 4. Fetch novel metadata ────────────────────────────────────────────

  const novelUrl = 'https://freewebnovel.com/martial-peak.html';
  console.log(`Fetching novel: ${novelUrl}`);

  const novel = await dl.fetchAndSaveNovel(novelUrl);
  console.log(`  ✓ Saved "${novel.title}" by ${novel.author}`);
  console.log(`  ✓ ${novel.genres.length > 0 ? novel.genres.join(', ') : 'No genres'}`);
  console.log(`  ✓ Status: ${novel.status}\n`);

  // ─── 5. Query saved data ────────────────────────────────────────────────

  console.log('Listing saved novels...');
  const savedNovels = await dl.listNovels();
  for (const n of savedNovels) {
    const chapters = await dl.listChapters(n.id);
    console.log(`  • ${n.title} — ${chapters.length} chapters`);
  }
  console.log();

  // ─── 6. Download first 5 chapters ───────────────────────────────────────

  console.log('Downloading chapters 1–5...');
  const result = await dl.downloadNovel(novel.id, {
    fromChapter: 1,
    toChapter: 5,
  });

  console.log(`\n  ✓ Downloaded: ${result.downloadedChapters}`);
  console.log(`  ✓ Skipped:   ${result.skippedChapters}`);
  console.log(`  ✓ Failed:    ${result.failedChapters}`);
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  ✗ Chapter ${err.chapterNumber}: ${err.error}`);
    }
  }
  console.log();

  // ─── 7. Download status ─────────────────────────────────────────────────

  const status = await dl.getDownloadStatus(novel.id);
  if (status) {
    console.log(`Download status: ${status.status}`);
    console.log(`  Progress: ${status.downloadedChapters}/${status.totalChapters}`);
  }
} catch (err) {
  if (err instanceof NetworkError) {
    console.error(`✗ Network error (HTTP ${err.statusCode}): ${err.url}`);
  } else if (err instanceof ParseError) {
    console.error(`✗ Parse error at ${err.url}: selector "${err.selector}"`);
  } else if (err instanceof NotFoundError) {
    console.error(`✗ Not found: ${err.resourceType} #${err.resourceId}`);
  } else if (err instanceof NovelDownloadError) {
    console.error(`✗ Novbank error: ${err.message}`, err.context);
  } else {
    console.error('✗ Unexpected error:', err);
  }
  process.exit(1);
} finally {
  await dl.close();
  console.log('\n✓ Connection closed');
}

// ─── Helper: simple progress bar ─────────────────────────────────────────────

function progressBar(current: number, total: number, width = 20): string {
  if (total === 0) return `[${'·'.repeat(width)}]`;
  const filled = Math.min(Math.round((current / total) * width), width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'·'.repeat(empty)}]`;
}
