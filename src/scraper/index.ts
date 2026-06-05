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
}

/**
 * Scraper — handles HTTP requests to freewebnovel.com.
 *
 * Uses impit with Chrome TLS fingerprint to avoid bot detection.
 * Rate-limited to be a good citizen.
 */
export class Scraper {
  private readonly config: ScraperConfig;
  private readonly client: Impit;
  private lastRequestTime = 0;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.client = new Impit({
      browser: 'chrome',
    });
  }

  /**
   * Fetch raw HTML from a URL.
   * Throws `NetworkError` on failure.
   */
  async fetchHtml(url: string): Promise<string> {
    await this.rateLimit();

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
