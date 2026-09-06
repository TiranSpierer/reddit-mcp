import { RedditError, type ErrorCode, type RedditDebugResponse } from "./types.js";

const BASE_URL = "https://www.reddit.com";
const OAUTH_BASE_URL = "https://oauth.reddit.com";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const CLIENT_ID = process.env.REDDIT_CLIENT_ID?.trim() || "";
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
const HAS_OAUTH = Boolean(CLIENT_ID && CLIENT_SECRET);
const USER_AGENT = "reddit-cli/1.0 (github.com/TiranSpierer/reddit-cli)";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const BOOTSTRAP_URL = `${BASE_URL}/r/popular/hot.atom`;
const CHALLENGE_MARKER = 'name="js_challenge"';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function joinSetCookies(headers: Headers, existing = ""): string {
  const values = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : headers.get("set-cookie") ? [headers.get("set-cookie")!] : [];
  const pairs = values.map((value) => value.split(";")[0]).filter(Boolean);
  return [existing, ...pairs].filter(Boolean).join("; ");
}

function debugResponse(response: Response, body: string): RedditDebugResponse {
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries([...response.headers.entries()].filter(([name]) => name.toLowerCase() !== "set-cookie")),
    body,
  };
}

function responseError(code: ErrorCode, message: string, response: Response, body: string): RedditError {
  return new RedditError(code, message, debugResponse(response, body));
}

function parseJson<T>(response: Response, body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw responseError("NETWORK_ERROR", `Reddit returned invalid JSON (HTTP ${response.status})`, response, body);
  }
}

interface OAuthToken { accessToken: string; expiresAt: number }
let oauthToken: OAuthToken | null = null;
let oauthTokenPromise: Promise<OAuthToken> | null = null;

async function fetchOAuthToken(): Promise<OAuthToken> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
    });
  } catch (error) {
    throw new RedditError("NETWORK_ERROR", `OAuth token request failed: ${String(error)}`);
  }
  const body = await response.text();
  if (!response.ok) throw responseError("NETWORK_ERROR", `OAuth token request returned HTTP ${response.status}`, response, body);
  const data = parseJson<{ access_token: string; expires_in: number }>(response, body);
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 - 30_000 };
}

async function ensureOAuthToken(): Promise<string> {
  if (oauthToken && Date.now() < oauthToken.expiresAt) return oauthToken.accessToken;
  if (!oauthTokenPromise) {
    oauthTokenPromise = fetchOAuthToken().then((token) => {
      oauthToken = token;
      return token;
    }).finally(() => { oauthTokenPromise = null; });
  }
  return (await oauthTokenPromise).accessToken;
}

interface RateLimitState { remaining: number; resetAt: number }

class RedditClient {
  private rateLimit: RateLimitState = { remaining: 100, resetAt: 0 };
  private cookies: string | null = null;
  private cookiePromise: Promise<string> | null = null;

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const cleanPath = path.endsWith(".json") ? path : `${path}.json`;
    const url = new URL(cleanPath, HAS_OAUTH ? OAUTH_BASE_URL : BASE_URL);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    if (this.rateLimit.remaining <= 0) {
      const wait = Math.max(0, this.rateLimit.resetAt - Date.now());
      if (wait) await sleep(wait);
    }
    return HAS_OAUTH ? this.fetchOAuth<T>(url.toString(), false) : this.fetchAnonymous<T>(url.toString(), false);
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining !== null) this.rateLimit.remaining = Number(remaining);
    if (reset !== null) this.rateLimit.resetAt = Date.now() + Number(reset) * 1000;
  }

  private async fetchOAuth<T>(url: string, retried: boolean): Promise<T> {
    const token = await ensureOAuthToken();
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } });
    } catch (error) {
      throw new RedditError("NETWORK_ERROR", `Network request failed: ${String(error)}`);
    }
    this.updateRateLimit(response.headers);
    const body = await response.text();
    if (response.ok) return parseJson<T>(response, body);
    if (response.status === 401 && !retried) {
      oauthToken = null;
      return this.fetchOAuth<T>(url, true);
    }
    if (response.status === 429 && !retried) {
      await sleep(Number(response.headers.get("x-ratelimit-reset") ?? 10) * 1000);
      return this.fetchOAuth<T>(url, true);
    }
    if (response.status === 429) throw responseError("RATE_LIMITED", "Reddit rate limit exceeded after retry", response, body);
    if (response.status === 403) {
      const reason = (() => { try { return (JSON.parse(body) as { reason?: string }).reason; } catch { return undefined; } })();
      if (reason === "private") throw responseError("SUBREDDIT_PRIVATE", "This subreddit is private", response, body);
      if (reason === "banned") throw responseError("SUBREDDIT_BANNED", "This subreddit has been banned", response, body);
      throw responseError("REDDIT_ACCESS_BLOCKED", `Reddit denied access (HTTP ${response.status})`, response, body);
    }
    if (response.status === 404) throw responseError("NOT_FOUND", `Not found: ${url}`, response, body);
    throw responseError("NETWORK_ERROR", `Unexpected HTTP ${response.status}`, response, body);
  }

  private async ensureCookies(): Promise<string> {
    if (this.cookies) return this.cookies;
    if (!this.cookiePromise) {
      this.cookiePromise = this.solveKnownChallenge().then((cookies) => {
        this.cookies = cookies;
        return cookies;
      }).finally(() => { this.cookiePromise = null; });
    }
    return this.cookiePromise;
  }

  private async solveKnownChallenge(): Promise<string> {
    let initial: Response;
    try {
      initial = await fetch(BOOTSTRAP_URL, { headers: BROWSER_HEADERS, redirect: "follow" });
    } catch (error) {
      throw new RedditError("NETWORK_ERROR", `Reddit bootstrap failed: ${String(error)}`);
    }
    const body = await initial.text();
    const cookies = joinSetCookies(initial.headers);
    if (!body.includes(CHALLENGE_MARKER)) return cookies;
    const seed = body.match(/\("([0-9a-f]+)"\)/)?.[1];
    const token = body.match(/name="jsc_token"\s+value="([^"]+)"/)?.[1];
    if (!seed || !token) {
      throw responseError("REDDIT_ACCESS_BLOCKED", "Reddit changed its access challenge", initial, body);
    }
    const url = new URL(initial.url || BOOTSTRAP_URL);
    url.searchParams.set("solution", seed + seed);
    url.searchParams.set("jsc_token", token);
    url.searchParams.set("js_challenge", "1");
    url.searchParams.set("jsc_orig_r", "");
    let solved: Response;
    try {
      solved = await fetch(url, { headers: { ...BROWSER_HEADERS, Referer: initial.url, Cookie: cookies }, redirect: "follow" });
    } catch (error) {
      throw new RedditError("NETWORK_ERROR", `Challenge submission failed: ${String(error)}`);
    }
    const solvedBody = await solved.text();
    if (!solved.ok || solvedBody.includes(CHALLENGE_MARKER)) {
      throw responseError("REDDIT_ACCESS_BLOCKED", `Reddit challenge failed (HTTP ${solved.status})`, solved, solvedBody);
    }
    return joinSetCookies(solved.headers, cookies);
  }

  private async fetchAnonymous<T>(url: string, retried: boolean): Promise<T> {
    const cookies = await this.ensureCookies();
    let response: Response;
    try {
      response = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookies }, redirect: "follow" });
    } catch (error) {
      throw new RedditError("NETWORK_ERROR", `Network request failed: ${String(error)}`);
    }
    this.updateRateLimit(response.headers);
    const body = await response.text();
    if (response.ok) return parseJson<T>(response, body);
    if (response.status === 429 && !retried) {
      await sleep(Number(response.headers.get("x-ratelimit-reset") ?? 10) * 1000);
      return this.fetchAnonymous<T>(url, true);
    }
    if (response.status === 429) throw responseError("RATE_LIMITED", "Reddit rate limit exceeded after retry", response, body);
    if (response.status === 403 && !retried) {
      this.cookies = null;
      return this.fetchAnonymous<T>(url, true);
    }
    if (response.status === 403) {
      const reason = (() => { try { return (JSON.parse(body) as { reason?: string }).reason; } catch { return undefined; } })();
      if (reason === "private") throw responseError("SUBREDDIT_PRIVATE", "This subreddit is private", response, body);
      if (reason === "banned") throw responseError("SUBREDDIT_BANNED", "This subreddit has been banned", response, body);
      throw responseError("REDDIT_ACCESS_BLOCKED", `Reddit denied access (HTTP ${response.status})`, response, body);
    }
    if (response.status === 404) throw responseError("NOT_FOUND", `Not found: ${url}`, response, body);
    throw responseError("NETWORK_ERROR", `Unexpected HTTP ${response.status}`, response, body);
  }
}

export const reddit = new RedditClient();
