# Changelog

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

[0.1.0]: https://github.com/zfadhli/novbank/compare/v0.0.0...v0.1.0
