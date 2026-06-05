#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// CLI tool — search, fetch, download, and list novels from the command line
// ---------------------------------------------------------------------------
// Run with:
//   bun run examples/cli.ts search "martial peak"
//   bun run examples/cli.ts fetch https://freewebnovel.com/martial-peak.html
//   bun run examples/cli.ts download slime-evolution --from 1 --to 10
//   bun run examples/cli.ts download https://freewebnovel.com/slime-evolution.html --from 1 --to 10
//   bun run examples/cli.ts list
//   bun run examples/cli.ts status <novel-id>
// ---------------------------------------------------------------------------

import { NovelDownloadError, NovelDownloader } from '../src/index';

// ─── Parse arguments ─────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

if (!command || command === '--help' || command === '-h') {
  console.log(`
  novbank — novel downloader CLI

  Usage:
    search <query>          Search for novels
    fetch <url>             Fetch and save novel metadata
    download <url-or-slug> [options] Download all chapters for a novel
    list                    List saved novels
    status <id>             Show download status
    help                    Show this message

  Options (download):
    --from <n>  Start chapter (default: 1)
    --to <n>    End chapter (default: 50, use --to all for no limit)
    --latest    Download the next 50 chapters after the last downloaded one
    --overwrite Re-download already saved chapters
  `);
  process.exit(0);
}

// ─── Options parser ──────────────────────────────────────────────────────────

function parseFlags(args: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i] as string;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { positional, flags };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const dl = new NovelDownloader({
  dbPath: './data/novels.db',
  requestDelayMs: 1500,
  maxConcurrency: 3,
  onProgress: (ev) => {
    if (ev.status === 'downloading') {
      const pct =
        ev.totalChapters > 0 ? Math.round((ev.downloadedChapters / ev.totalChapters) * 100) : 0;
      process.stdout.write(
        `\r  Downloading: ${pct}% (${ev.downloadedChapters}/${ev.totalChapters})`,
      );
    }
  },
});

await dl.init();

try {
  switch (command) {
    // ── search ────────────────────────────────────────────────────────────
    case 'search': {
      const query = args.join(' ');
      if (!query) {
        console.error('✗ Usage: search <query>');
        process.exit(1);
      }

      console.log(`🔍 Searching for "${query}"...\n`);
      const results = await dl.search(query);

      if (results.novels.length === 0) {
        console.log('  No results found.');
        break;
      }

      for (const novel of results.novels) {
        console.log(`  • ${novel.title}`);
        console.log(`    Author: ${novel.author}`);
        console.log(`    URL:    ${novel.sourceUrl}`);
        console.log();
      }
      console.log(`  ${results.novels.length} result(s) on page ${results.currentPage}`);
      break;
    }

    // ── fetch ─────────────────────────────────────────────────────────────
    case 'fetch': {
      const url = args[0];
      if (!url) {
        console.error('✗ Usage: fetch <url>');
        process.exit(1);
      }

      console.log(`📥 Fetching ${url}...`);
      const novel = await dl.fetchAndSaveNovel(url);

      console.log(`\n  ✓ "${novel.title}"`);
      console.log(`    Author:  ${novel.author}`);
      console.log(`    Status:  ${novel.status}`);
      console.log(`    Genres:  ${novel.genres.join(', ') || '(none)'}`);
      console.log(`    ID:      ${novel.id}`);
      break;
    }

    // ── download ──────────────────────────────────────────────────────────
    case 'download': {
      const { positional, flags } = parseFlags(args);
      const identifier = positional[0];
      if (!identifier) {
        console.error('✗ Usage: download <url-or-slug> [--from n] [--to n] [--overwrite]');
        process.exit(1);
      }

      // Accept a full URL or a bare slug
      const BASE = 'https://freewebnovel.com';
      const url =
        identifier.startsWith('http://') || identifier.startsWith('https://')
          ? identifier
          : `${BASE}/${identifier.replace(/\.html$/, '')}.html`;

      console.log(`📥 Fetching novel from ${url}...`);
      const novel = await dl.fetchAndSaveNovel(url);
      console.log(`  ✓ "${novel.title}" saved (ID: ${novel.id})\n`);

      // Determine the chapter range to download
      let fromChapter: number | undefined;
      let toChapter: number | undefined;

      if (flags.latest === true) {
        // Pick up where we left off: next 50 chapters after the last downloaded one
        const chapters = await dl.listChapters(novel.id);
        const maxDownloaded = Math.max(
          0,
          ...chapters.filter((c) => c.content !== null).map((c) => c.number),
        );
        fromChapter = maxDownloaded + 1;
        toChapter = fromChapter + 49;
      } else {
        fromChapter = flags.from ? Number(flags.from) : undefined;
        toChapter =
          flags.to === 'all' || flags.to === true ? undefined : flags.to ? Number(flags.to) : 50;
      }

      console.log(
        `⬇️  Downloading chapters ${fromChapter ?? 1}${toChapter ? `-${toChapter}` : '+'}...`,
      );
      const result = await dl.downloadNovel(novel.id, {
        fromChapter,
        toChapter,
        overwrite: flags.overwrite === true,
      });

      console.log('\n  ✓ Done!');
      console.log(`    Downloaded: ${result.downloadedChapters}`);
      console.log(`    Skipped:    ${result.skippedChapters}`);
      console.log(`    Failed:     ${result.failedChapters}`);
      if (result.errors.length > 0) {
        console.log('');
        for (const err of result.errors) {
          console.log(`  ✗ ${err.error}`);
        }
      }
      break;
    }

    // ── list ──────────────────────────────────────────────────────────────
    case 'list': {
      console.log('📚 Saved novels:\n');
      const novels = await dl.listNovels();

      if (novels.length === 0) {
        console.log('  No novels saved yet. Use `fetch` or `download` first.');
        break;
      }

      for (const novel of novels) {
        const chapters = await dl.listChapters(novel.id);
        const downloaded = chapters.filter((c) => c.content !== null).length;
        console.log(`  • ${novel.title}`);
        console.log(`    ID:    ${novel.id}`);
        console.log(`    Chaps: ${downloaded}/${chapters.length} downloaded`);
        console.log();
      }
      break;
    }

    // ── status ────────────────────────────────────────────────────────────
    case 'status': {
      const novelId = args[0];
      if (!novelId) {
        console.error('✗ Usage: status <id>');
        process.exit(1);
      }

      const status = await dl.getDownloadStatus(novelId);
      if (!status) {
        console.log('  No download record found for this novel.');
        break;
      }

      console.log('📊 Download status:\n');
      console.log(`  Status:           ${status.status}`);
      console.log(`  Progress:         ${status.downloadedChapters}/${status.totalChapters}`);
      console.log(`  Error:            ${status.error ?? '(none)'}`);
      console.log(`  Created:          ${new Date(status.createdAt * 1000).toISOString()}`);
      console.log(`  Last updated:     ${new Date(status.updatedAt * 1000).toISOString()}`);
      break;
    }

    default: {
      console.error(`✗ Unknown command: "${command}". Use --help for usage.`);
      process.exit(1);
    }
  }
} catch (err) {
  if (err instanceof NovelDownloadError) {
    console.error(`\n✗ ${err.name}: ${err.message}`);
  } else {
    console.error('\n✗ Unexpected error:', err);
  }
  process.exit(1);
} finally {
  await dl.close();
}
