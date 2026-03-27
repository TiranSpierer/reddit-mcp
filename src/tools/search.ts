import { reddit } from "../client.js";
import {
  type RawPost,
  type RawListing,
  type PostSummary,
  toPostSummary,
  normalizeSubreddit,
} from "../types.js";

export interface SearchRedditArgs {
  query: string;
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  after?: string;
}

export interface SearchResult {
  posts: PostSummary[];
  after: string | null;
}

export async function searchReddit(args: SearchRedditArgs): Promise<SearchResult> {
  const data = await reddit.get<RawListing<RawPost>>("/search.json", {
    q: args.query,
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
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

export interface SearchSubredditPostsArgs {
  subreddit: string;
  query: string;
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  after?: string;
}

export async function searchSubredditPosts(args: SearchSubredditPostsArgs): Promise<SearchResult> {
  const sub = normalizeSubreddit(args.subreddit);
  const data = await reddit.get<RawListing<RawPost>>(`/r/${sub}/search.json`, {
    q: args.query,
    restrict_sr: 1,
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
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
