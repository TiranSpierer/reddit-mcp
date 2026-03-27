// ─── Raw Reddit API types ────────────────────────────────────────────────────
// Only the fields we actually use. Reddit responses have 80+ fields per object.

export interface RawPost {
  id: string;
  name: string; // fullname e.g. "t3_abc123" — used as pagination cursor
  title: string;
  subreddit: string;
  permalink: string; // e.g. "/r/programming/comments/abc123/title/"
  url: string; // external link target; equals full permalink URL for text posts
  author: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  edited: number | false;
  link_flair_text: string | null;
  over_18: boolean; // NOTE: posts use over_18 (with underscore)
  spoiler: boolean;
  locked: boolean;
  archived: boolean;
  is_self: boolean;
  is_video: boolean;
  selftext: string;
  all_awardings: Array<{ name: string; count: number }>;
  crosspost_parent?: string;
  crosspost_parent_list?: Array<{ selftext: string; url: string }>;
}

export interface RawSubreddit {
  id: string;
  display_name: string; // e.g. "programming"
  title: string;
  public_description: string; // short blurb
  description: string; // full markdown sidebar
  subscribers: number;
  active_user_count: number;
  created_utc: number;
  over18: boolean; // NOTE: subreddits use over18 (no underscore)
  url: string; // e.g. "/r/programming/"
  subreddit_type: string; // "public" | "private" | "restricted" | "archived" | ...
}

export interface RawRule {
  short_name: string;
  description: string;
}

export interface RawRulesResponse {
  rules: RawRule[];
}

export interface RawComment {
  id: string;
  name: string; // fullname e.g. "t1_xyz"
  author: string;
  body: string;
  score: number;
  created_utc: number;
  edited: number | false;
  depth: number;
  replies: RawListing<RawComment | RawMoreStub> | ""; // empty string when no replies
}

export interface RawMoreStub {
  count: number;
  id: string;
  children: string[];
}

export interface RawListing<T> {
  kind: "Listing";
  data: {
    children: Array<{ kind: string; data: T }>;
    after: string | null;
    before: string | null;
  };
}

// Comments endpoint uniquely returns a 2-element array
export type CommentsResponse = [RawListing<RawPost>, RawListing<RawComment | RawMoreStub>];

// ─── Clean output types (match TOOLS.md exactly) ─────────────────────────────

export interface PostSummary {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  external_url: string;
  author: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  flair: string | null;
  nsfw: boolean;
  locked: boolean;
  archived: boolean;
  body_snippet: string;
}

export interface PostFull {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  external_url: string;
  author: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  edited_utc: number | null;
  flair: string | null;
  nsfw: boolean;
  locked: boolean;
  archived: boolean;
  is_video: boolean;
  body: string;
  awards: Array<{ name: string; count: number }>;
  comments?: {
    items: Comment[];
    more_count: number;
  };
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  edited_utc: number | null;
  depth: number;
  replies: Comment[];
  more_replies: number;
}

export interface SubredditSummary {
  name: string;
  display_name: string;
  title: string;
  description: string;
  subscribers: number;
  active_users: number;
  type: "public" | "private" | "restricted";
  nsfw: boolean;
}

export interface SubredditFull {
  name: string;
  display_name: string;
  title: string;
  description: string;
  description_long: string;
  subscribers: number;
  active_users: number;
  created_utc: number;
  type: "public" | "private" | "restricted";
  nsfw: boolean;
  url: string;
  rules: Array<{ short_name: string; description: string }>;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SUBREDDIT_PRIVATE"
  | "SUBREDDIT_BANNED"
  | "SUBREDDIT_QUARANTINED"
  | "NETWORK_ERROR";

export class RedditError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RedditError";
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function normalizeSubreddit(input: string): string {
  return input.replace(/^r\//, "").trim();
}

export function extractPostId(input: string): string {
  // Full permalink URL: match /comments/{id}/ segment
  const urlMatch = input.match(/\/comments\/([a-z0-9]+)/i);
  if (urlMatch) return urlMatch[1];
  // Fullname: t3_abc123
  if (input.startsWith("t3_")) return input.slice(3);
  // Bare ID
  return input.trim();
}

export function normalizeSubredditType(raw: string): "public" | "private" | "restricted" {
  if (raw === "private" || raw === "employees_only" || raw === "gold_only") return "private";
  if (raw === "restricted" || raw === "gold_restricted" || raw === "archived") return "restricted";
  return "public";
}

function resolveUrl(url: string): string {
  if (url.startsWith("/")) return "https://www.reddit.com" + url;
  return url;
}

export function toPostSummary(raw: RawPost): PostSummary {
  const base = "https://www.reddit.com";
  return {
    id: raw.id,
    title: raw.title,
    subreddit: raw.subreddit,
    permalink: base + raw.permalink,
    external_url: raw.is_self ? base + raw.permalink : resolveUrl(raw.url),
    author: raw.author,
    score: raw.score,
    upvote_ratio: raw.upvote_ratio,
    num_comments: raw.num_comments,
    created_utc: raw.created_utc,
    flair: raw.link_flair_text,
    nsfw: raw.over_18,
    locked: raw.locked,
    archived: raw.archived,
    body_snippet: raw.is_self ? raw.selftext.slice(0, 300) : "",
  };
}

export function toPostFull(raw: RawPost): Omit<PostFull, "comments"> {
  const base = "https://www.reddit.com";
  return {
    id: raw.id,
    title: raw.title,
    subreddit: raw.subreddit,
    permalink: base + raw.permalink,
    external_url: raw.is_self ? base + raw.permalink : resolveUrl(raw.url),
    author: raw.author,
    score: raw.score,
    upvote_ratio: raw.upvote_ratio,
    num_comments: raw.num_comments,
    created_utc: raw.created_utc,
    edited_utc: raw.edited === false ? null : raw.edited,
    flair: raw.link_flair_text,
    nsfw: raw.over_18,
    locked: raw.locked,
    archived: raw.archived,
    is_video: raw.is_video,
    body: raw.selftext || raw.crosspost_parent_list?.[0]?.selftext || "",
    awards: raw.all_awardings.map((a) => ({ name: a.name, count: a.count })),
  };
}

export function toSubredditSummary(raw: RawSubreddit): SubredditSummary {
  return {
    name: raw.display_name,
    display_name: `r/${raw.display_name}`,
    title: raw.title,
    description: raw.public_description,
    subscribers: raw.subscribers,
    active_users: raw.active_user_count,
    type: normalizeSubredditType(raw.subreddit_type),
    nsfw: raw.over18,
  };
}
