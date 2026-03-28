import { RedditError } from "./types.js";

const BASE_URL = "https://www.reddit.com";
const USER_AGENT = "reddit-mcp/1.0 (github.com/TiranSpierer/reddit-mcp)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RateLimitState {
  remaining: number;
  resetAt: number; // Date.now() ms at which the window resets
}

class RedditClient {
  private rateLimit: RateLimitState = { remaining: 100, resetAt: 0 };

  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    // Build URL
    const cleanPath = path.endsWith(".json") ? path : `${path}.json`;
    const url = new URL(cleanPath, BASE_URL);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    // Pre-check rate limit
    if (this.rateLimit.remaining <= 0) {
      const waitMs = Math.max(0, this.rateLimit.resetAt - Date.now());
      if (waitMs > 0) await sleep(waitMs);
    }

    return this.fetch<T>(url.toString(), false);
  }

  private async fetch<T>(url: string, isRetry: boolean): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Network request failed: ${String(err)}`);
    }

    // Update rate limit state from headers on every response
    this.updateRateLimit(response.headers);

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Handle error status codes
    if (response.status === 429) {
      if (isRetry) {
        throw new RedditError("RATE_LIMITED", "Rate limit exceeded after retry");
      }
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const waitSec = resetHeader ? parseInt(resetHeader, 10) : 10;
      await sleep(waitSec * 1000);
      return this.fetch<T>(url, true);
    }

    if (response.status === 403) {
      let reason = "";
      try {
        const body = await response.json() as { reason?: string };
        reason = body.reason ?? "";
      } catch {
        // ignore parse errors
      }
      if (reason === "private") {
        throw new RedditError("SUBREDDIT_PRIVATE", "This subreddit is private");
      }
      if (reason === "banned") {
        throw new RedditError("SUBREDDIT_BANNED", "This subreddit has been banned");
      }
      throw new RedditError("NOT_FOUND", `Access denied (${response.status})`);
    }

    if (response.status === 404) {
      throw new RedditError("NOT_FOUND", `Not found: ${url}`);
    }

    throw new RedditError("NETWORK_ERROR", `Unexpected HTTP ${response.status}`);
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining !== null) this.rateLimit.remaining = parseFloat(remaining);
    if (reset !== null) this.rateLimit.resetAt = Date.now() + parseInt(reset, 10) * 1000;
  }
}

export const reddit = new RedditClient();
