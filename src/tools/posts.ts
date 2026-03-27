import { reddit } from "../client.js";
import {
  type RawPost,
  type RawComment,
  type RawMoreStub,
  type RawListing,
  type CommentsResponse,
  type PostFull,
  type Comment,
  toPostFull,
  extractPostId,
} from "../types.js";

// ─── Comment tree parser ──────────────────────────────────────────────────────

function parseCommentTree(
  children: Array<{ kind: string; data: RawComment | RawMoreStub }>,
  currentDepth = 0
): { items: Comment[]; moreCount: number } {
  const items: Comment[] = [];
  let moreCount = 0;

  for (const child of children) {
    if (child.kind === "more") {
      moreCount += (child.data as RawMoreStub).count;
      continue;
    }

    const raw = child.data as RawComment;
    const repliesData =
      raw.replies === "" || !raw.replies ? null : (raw.replies as RawListing<RawComment | RawMoreStub>);

    const nested = repliesData
      ? parseCommentTree(repliesData.data.children, currentDepth + 1)
      : { items: [], moreCount: 0 };

    items.push({
      id: raw.id,
      author: raw.author,
      body: raw.body,
      score: raw.score,
      created_utc: raw.created_utc,
      edited_utc: raw.edited === false ? null : raw.edited,
      depth: currentDepth,
      replies: nested.items,
      more_replies: nested.moreCount,
    });
  }

  return { items, moreCount };
}

// ─── get_post ─────────────────────────────────────────────────────────────────

export interface GetPostArgs {
  post_id: string;
  include_comments?: boolean;
  comment_sort?: "best" | "top" | "new" | "controversial" | "old" | "qa";
  comment_limit?: number;
  comment_depth?: number;
  comment_id?: string;
}

export async function getPost(args: GetPostArgs): Promise<PostFull> {
  const id = extractPostId(args.post_id);
  const includeComments = args.include_comments !== false; // default true

  if (!includeComments) {
    // Fetch post only — limit=0 minimises comment data, take index [0]
    const res = await reddit.get<CommentsResponse>(`/comments/${id}.json`, { limit: 0 });
    const rawPost = res[0].data.children[0]?.data;
    if (!rawPost) {
      const { RedditError: RE } = await import("../types.js");
      throw new RE("NOT_FOUND", `Post not found: ${args.post_id}`);
    }
    return toPostFull(rawPost);
  }

  // Fetch post + comments
  const params: Record<string, string | number | undefined> = {
    sort: args.comment_sort ?? "best",
    limit: args.comment_limit ?? 20,
    depth: args.comment_depth ?? 10,
  };
  if (args.comment_id) params["comment"] = args.comment_id;

  const res = await reddit.get<CommentsResponse>(`/comments/${id}.json`, params);

  const rawPost = res[0].data.children[0]?.data;
  if (!rawPost) {
    const { RedditError: RE } = await import("../types.js");
    throw new RE("NOT_FOUND", `Post not found: ${args.post_id}`);
  }

  const post = toPostFull(rawPost);
  const { items, moreCount } = parseCommentTree(res[1].data.children);

  return {
    ...post,
    comments: {
      items,
      more_count: moreCount,
    },
  };
}
