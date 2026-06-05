# Changelog

## [0.4.0] - 2026-06-05

### Added

- **Markdown content**: Chapter content is now saved as proper Markdown (via turndown) instead of plain stripped text, preserving bold, italic, headings, and lists
- **Range gap-filling**: When downloading a chapter range that extends beyond what's stored in the DB, the missing chapters are automatically discovered and inserted

### Changed

- **Clean chapter titles**: Numeric prefixes are stripped from chapter titles (e.g. "Chapter 1 - 01 - World Without Hope" becomes "World Without Hope"); falls back to the original title if stripping yields an empty string

## [0.3.0] - 2026-06-05

### Changed

- **ID generation**: Replace hand-rolled hex ID generator with proper ULID library for time-ordered unique identifiers
- **Download tracking**: Persist request range (fromChapter/toChapter), overwrite flag, and separate failed_chapters counter
- **Chapter count**: Denormalize chapter_count on novels table for O(1) status queries

## [0.2.0] - 2026-06-05

### Changed

- **scraper**: Replace node-html-parser with cheerio for HTML parsing, replace Bun fetch with impit for TLS fingerprint customization
- **rate limiter**: Fix race condition where concurrent requests bypassed the delay by switching to promise-queue serialization
- **chapter saving**: Remove pre-save of all chapters in `fetchAndSaveNovel`; `downloadNovel` now scrapes and saves only the requested chapter range

### Fixed

- **parser selectors**: Novel detail fields (author, genres, cover, description, status) were empty because CSS selectors didn't match freewebnovel.com's HTML structure
- **queryOne**: Returned all matched elements instead of only the first, causing title text to concatenate section headers ("6 Latest Chapters", "Chapter List", etc.)
- **chapter content parser**: Content selector missed the `#article` container used by freewebnovel.com
- **foreign key constraint**: Re-fetching an existing novel caused `SQLITE_CONSTRAINT_FOREIGNKEY` because chapter inserts used a stale local ID instead of the existing novel's ID
- **database init**: Auto-create parent directory in `initDb()` to prevent "Unable to open connection" errors

### Added

- **CLI download**: Accept URL or bare slug (e.g. `slime-evolution`) — auto-resolves to full URL and fetches novel before downloading
- **CLI error display**: Individual chapter failure messages now shown in download summary
- **examples**: Basic usage script, full CLI tool, and Bun.serve API server with REST endpoints

## [0.1.0] - 2026-06-05

### Added

- **NovelDownloader class** — main orchestration API with lifecycle (`init`, `close`), search, fetch, download, and query methods
- **Novel fetching & persistence** — scrape novel metadata and chapter lists from freewebnovel.com, upsert into SQLite via Drizzle ORM + libSQL
- **Chapter download engine** — batch download chapter content with configurable concurrency, range selection, and overwrite support
- **Progress reporting** — `onProgress` callback for real-time download status updates
- **SQLite schema** — `novels`, `chapters`, and `downloads` tables with unique constraints, cascade deletes, and Drizzle typed schema
- **Hierarchical error classes** — `NovelDownloadError`, `NetworkError`, `ParseError`, `DatabaseError`, `NotFoundError`, `ValidationError` with structured context metadata
- **HTML parser** — pure functions for parsing search results, novel detail pages, chapter lists, and chapter content from freewebnovel.com
- **Rate-limited HTTP scraper** — Bun-native fetch wrapper with configurable delay between requests
- **URL utilities** — slug extraction, chapter number parsing, URL resolution
- **Text utilities** — HTML-to-plaintext conversion, whitespace normalization, UUID v7-like ID generation
- **Full test suite** — 15 tests (36 assertions) covering lifecycle, DB operations, error hierarchy, and HTML parsing with mock fixtures
- **Biome config** — strict linting and formatting rules
- **GitHub Actions CI** — typecheck, lint, test on push/PR; automated npm publish on version tags
- **Project conventions** — `AGENTS.md` with emoji conventional commits, branch naming, pre-commit gates, and knowledge graph workflow

[0.4.0]: https://github.com/zfadhli/novbank/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/zfadhli/novbank/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/zfadhli/novbank/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zfadhli/novbank/compare/v0.0.0...v0.1.0
