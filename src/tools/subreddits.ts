import { reddit } from "../client.js";
import {
  type RawPost,
  type RawSubreddit,
  type RawListing,
  type RawRulesResponse,
  type PostSummary,
  type SubredditSummary,
  type SubredditFull,
  toPostSummary,
  toSubredditSummary,
  normalizeSubreddit,
  normalizeSubredditType,
  RedditError,
} from "../types.js";

// ─── search_subreddits ────────────────────────────────────────────────────────

export interface SearchSubredditsArgs {
  query: string;
  limit?: number;
  after?: string;
}

export interface SearchSubredditsResult {
  subreddits: SubredditSummary[];
  after: string | null;
}

export async function searchSubreddits(args: SearchSubredditsArgs): Promise<SearchSubredditsResult> {
  const data = await reddit.get<RawListing<RawSubreddit>>("/subreddits/search.json", {
    q: args.query,
    limit: args.limit ?? 25,
    after: args.after,
  });
  return {
    subreddits: data.data.children
      .filter((c) => c.kind === "t5")
      .map((c) => toSubredditSummary(c.data)),
    after: data.data.after,
  };
}

// ─── get_subreddit_info ───────────────────────────────────────────────────────

export interface GetSubredditInfoArgs {
  subreddit: string;
}

export async function getSubredditInfo(args: GetSubredditInfoArgs): Promise<SubredditFull> {
  const sub = normalizeSubreddit(args.subreddit);

  const aboutRes = await reddit.get<{ kind: string; data: RawSubreddit }>(`/r/${sub}/about.json`);
  const raw = aboutRes.data;

  // Detect quarantined subreddits — Reddit returns 200 with subreddit_type "private"
  // but the quarantine field is set. We surface a clear error rather than empty data.
  if ((raw as unknown as Record<string, unknown>)["quarantine"] === true) {
    throw new RedditError("SUBREDDIT_QUARANTINED", `r/${sub} is quarantined`);
  }

  const rulesRes = await reddit.get<RawRulesResponse>(`/r/${sub}/about/rules.json`);

  return {
    name: raw.display_name,
    display_name: `r/${raw.display_name}`,
    title: raw.title,
    description: raw.public_description,
    description_long: raw.description,
    subscribers: raw.subscribers,
    active_users: raw.active_user_count,
    created_utc: raw.created_utc,
    type: normalizeSubredditType(raw.subreddit_type),
    nsfw: raw.over18,
    url: `https://www.reddit.com${raw.url}`,
    rules: (rulesRes.rules ?? []).map((r) => ({
      short_name: r.short_name,
      description: r.description,
    })),
  };
}

// ─── get_subreddit_posts ──────────────────────────────────────────────────────

export interface GetSubredditPostsArgs {
  subreddit: string;
  sort?: "hot" | "new" | "top" | "rising" | "controversial";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  after?: string;
}

export interface GetSubredditPostsResult {
  posts: PostSummary[];
  after: string | null;
}

export async function getSubredditPosts(args: GetSubredditPostsArgs): Promise<GetSubredditPostsResult> {
  const sub = normalizeSubreddit(args.subreddit);
  const sort = args.sort ?? "hot";
  const data = await reddit.get<RawListing<RawPost>>(`/r/${sub}/${sort}.json`, {
    t: args.time ?? "day",
    limit: args.limit ?? 25,
    after: args.after,
  });
  return {
    posts: data.data.children
      .filter((c) => c.kind === "t3")
      .map((c) => toPostSummary(c.data)),
    after: data.data.after,
  };
}
