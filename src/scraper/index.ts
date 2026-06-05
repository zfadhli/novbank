// ---------------------------------------------------------------------------
// Scraper — HTTP fetch layer
// ---------------------------------------------------------------------------
// Thin wrapper around Bun's built-in `fetch` with rate limiting,
// error handling, and retry logic.
// ---------------------------------------------------------------------------

import { NetworkError } from '../errors';
import type { ProgressCallback } from '../types';

export interface ScraperConfig {
  baseUrl: string;
  requestDelayMs: number;
  onProgress?: ProgressCallback;
}

/**
 * Scraper — handles HTTP requests to freewebnovel.com.
 *
 * Exposes simple `fetchHtml` and `fetchJson` methods.
 * Rate-limited to be a good citizen.
 */
export class Scraper {
  private readonly config: ScraperConfig;
  private lastRequestTime = 0;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Fetch raw HTML from a URL.
   * Throws `NetworkError` on failure.
   */
  async fetchHtml(url: string): Promise<string> {
    await this.rateLimit();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Novbank/0.1; +https://github.com/novbank)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (cause) {
      throw new NetworkError(`Failed to fetch ${url}`, {
        cause: cause instanceof Error ? cause : undefined,
        url,
        context: { url },
      });
    }

    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status} ${response.statusText} for ${url}`, {
        statusCode: response.status,
        url,
        context: { url },
      });
    }

    const text = await response.text();
    return text;
  }

  /**
   * Dispose of the scraper, clearing any pending rate-limit timer.
   */
  dispose(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  // ── Rate limiting ──────────────────────────────────────────────────────

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delay = this.config.requestDelayMs;

    if (elapsed < delay) {
      const waitMs = delay - elapsed;
      await new Promise<void>((resolve) => {
        this.pendingTimer = setTimeout(resolve, waitMs);
      });
    }

    this.lastRequestTime = Date.now();
  }
}
