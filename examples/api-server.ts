// ---------------------------------------------------------------------------
// Hono API server — serves novel data and triggers downloads
// ---------------------------------------------------------------------------
// This file shows two approaches:
//   1. Bun.serve (zero-dependency, runs now)
//   2. Hono (commented out, add with `bun add hono`)
//
// Run with:
//   bun run examples/api-server.ts
//
// Then:
//   curl http://localhost:3000/api/novels
//   curl -X POST http://localhost:3000/api/novels/fetch \
//     -H 'Content-Type: application/json' \
//     -d '{"url":"https://freewebnovel.com/martial-peak.html"}'
// ---------------------------------------------------------------------------

import { NotFoundError, NovelDownloadError, NovelDownloader } from '../src/index';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FetchBody {
  url: string;
}

interface DownloadBody {
  fromChapter?: number;
  toChapter?: number;
  overwrite?: boolean;
}

// ─── App setup ───────────────────────────────────────────────────────────────

const dl = new NovelDownloader({
  dbPath: './data/novels.db',
  requestDelayMs: 1500,
  maxConcurrency: 3,
});

await dl.init();

// ─── Request router ──────────────────────────────────────────────────────────

function sendJson(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function sendError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

const server = Bun.serve({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),

  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    try {
      // ── Routes ────────────────────────────────────────────────────────

      // GET /api/novels
      if (method === 'GET' && path === '/api/novels') {
        const novels = await dl.listNovels();
        return sendJson({ data: novels, count: novels.length });
      }

      // GET /api/novels/:id
      const novelId = path.match(/^\/api\/novels\/([^/]+)$/)?.[1];
      if (method === 'GET' && novelId) {
        const novel = await dl.getNovel(novelId);
        return sendJson({ data: novel });
      }

      // GET /api/novels/:id/chapters
      const chaptersNovelId = path.match(/^\/api\/novels\/([^/]+)\/chapters$/)?.[1];
      if (method === 'GET' && chaptersNovelId) {
        const chapters = await dl.listChapters(chaptersNovelId);
        return sendJson({ data: chapters, count: chapters.length });
      }

      // POST /api/novels/fetch
      if (method === 'POST' && path === '/api/novels/fetch') {
        const body = (await req.json()) as FetchBody;
        if (!body.url) {
          return sendError('url is required', 400);
        }
        const novel = await dl.fetchAndSaveNovel(body.url);
        return sendJson({ data: novel }, 201);
      }

      // POST /api/novels/:id/download
      const downloadId = path.match(/^\/api\/novels\/([^/]+)\/download$/)?.[1];
      if (method === 'POST' && downloadId) {
        const body = (await req.json()) as DownloadBody;
        const result = await dl.downloadNovel(downloadId, {
          fromChapter: body.fromChapter,
          toChapter: body.toChapter,
          overwrite: body.overwrite,
        });
        return sendJson({ data: result });
      }

      // GET /api/novels/:id/status
      const statusId = path.match(/^\/api\/novels\/([^/]+)\/status$/)?.[1];
      if (method === 'GET' && statusId) {
        const download = await dl.getDownloadStatus(statusId);
        if (!download) {
          return sendJson({ data: null, message: 'No download record found' }, 200);
        }
        return sendJson({ data: download });
      }

      // Fallback 404
      return sendError('Not found', 404);
    } catch (err) {
      return handleError(err);
    }
  },
});

// ─── Error handler ───────────────────────────────────────────────────────────

function handleError(err: unknown): Response {
  if (err instanceof NotFoundError) {
    return sendError(err.message, 404);
  }
  if (err instanceof NovelDownloadError) {
    return sendError(err.message, 502);
  }
  console.error('Unhandled error:', err);
  return sendError('Internal server error', 500);
}

// ─── Server info ─────────────────────────────────────────────────────────────

console.log(`✓ Novbank API server running on http://localhost:${server.port}`);
console.log('');
console.log('  Endpoints:');
console.log('    GET  /api/novels');
console.log('    GET  /api/novels/:id');
console.log('    GET  /api/novels/:id/chapters');
console.log('    POST /api/novels/fetch        { "url": "..." }');
console.log('    POST /api/novels/:id/download  { "fromChapter": 1, "toChapter": 5 }');
console.log('    GET  /api/novels/:id/status');
console.log('');
console.log('  Examples:');
console.log('    curl http://localhost:3000/api/novels');
console.log('    curl -X POST http://localhost:3000/api/novels/fetch \\');
console.log('      -H "Content-Type: application/json" \\');
console.log('      -d \'{"url":"https://freewebnovel.com/martial-peak.html"}\'');
