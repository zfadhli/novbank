// ---------------------------------------------------------------------------
// Scraper — HTTP fetch layer
// ---------------------------------------------------------------------------
// Uses `impit` for TLS fingerprint customization (avoid bot detection)
// with the same Response API as the standard fetch.
// ---------------------------------------------------------------------------

import { Impit } from 'impit';
import { NetworkError } from '../errors';

export interface ScraperConfig {
  baseUrl: string;
  requestDelayMs: number;
  jitterMs?: number;
}

/**
 * Scraper — handles HTTP requests to freewebnovel.com.
 *
 * Uses impit with Chrome TLS fingerprint to avoid bot detection.
 * Rate-limited with jitter to avoid looking like a bot.
 * Retries failed requests with exponential backoff.
 */
export class Scraper {
  private readonly config: ScraperConfig;
  private readonly client: Impit;
  private lastRequestTime = 0;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.client = new Impit({
      browser: 'chrome',
    });
  }

  /**
   * Fetch raw HTML from a URL, with retry and backoff.
   * Throws `NetworkError` if all retries are exhausted.
   */
  async fetchHtml(url: string, retries = 3): Promise<string> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.rateLimit();
        return await this.fetchOnce(url);
      } catch (err) {
        if (attempt === retries - 1) throw err;

        const isRateLimit = err instanceof NetworkError && err.statusCode === 429;
        const isServerError = err instanceof NetworkError && (err.statusCode ?? 0) >= 500;
        const isTimeout =
          err instanceof NetworkError && (err.cause as Error)?.name === 'TimeoutError';

        if (isRateLimit || isServerError || isTimeout) {
          const backoff = (attempt + 1) * 5_000;
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          // Transient network error — short wait
          await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
        }
      }
    }

    throw new Error('unreachable');
  }

  /**
   * Dispose of the scraper.
   */
  dispose(): void {
    // No-op
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /**
   * Enforce at least `requestDelayMs` (+ random jitter) between consecutive requests.
   * Unlike a promise queue, this truly serializes every call regardless of concurrency.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const baseDelay = this.config.requestDelayMs;
    const jitter = Math.random() * (this.config.jitterMs ?? 500);
    const totalDelay = baseDelay + jitter;

    if (elapsed < totalDelay) {
      await new Promise<void>((r) => setTimeout(r, totalDelay - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Execute a single HTTP request without retry logic.
   */
  private async fetchOnce(url: string): Promise<string> {
    let response: { ok: boolean; status: number; statusText: string; text(): Promise<string> };

    try {
      response = await this.client.fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
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

    return response.text();
  }
}
