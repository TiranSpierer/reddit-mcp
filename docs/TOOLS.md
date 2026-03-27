# Reddit MCP Server — Tool Design Spec

Read-only. No API key required. Uses Reddit's public JSON API (`*.reddit.com/*.json`).

**Primary use case:** Given a problem or error, find relevant Reddit discussions and read the solutions people found. Search first, read deep.

---

## Tools

### 1. `search_reddit`

Search posts across all of Reddit.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | yes | Search query string |
| `sort` | `"relevance" \| "hot" \| "top" \| "new" \| "comments"` | no | Ranking method (default: `relevance`) |
| `time` | `"hour" \| "day" \| "week" \| "month" \| "year" \| "all"` | no | Time window, applies when sort is `top` (default: `all`) |
| `limit` | `number` | no | Number of results, 1–100 (default: `25`) |
| `after` | `string` | no | Pagination cursor (`t3_xxxx` fullname from a previous response) |

**Returns**

Array of post summaries + pagination cursor:
```ts
{
  posts: {
    id: string            // e.g. "abc123"
    title: string
    subreddit: string     // e.g. "programming"
    permalink: string     // full Reddit URL
    external_url: string  // link post target, or same as permalink for text posts
    author: string
    score: number
    upvote_ratio: number  // 0.0–1.0
    num_comments: number
    created_utc: number   // Unix timestamp
    flair: string | null
    nsfw: boolean
    locked: boolean       // no new comments allowed
    archived: boolean     // very old post, also no new comments
    body_snippet: string  // first ~300 chars of selftext, empty for link posts
  }[]
  after: string | null    // cursor for next page, null = no more results
}
```

---

### 2. `search_subreddits`

Search for subreddits by name or topic. Useful for identifying which community to target before searching within it.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | yes | Search query |
| `limit` | `number` | no | Number of results, 1–100 (default: `25`) |
| `after` | `string` | no | Pagination cursor (`t5_xxxx` fullname) |

**Returns**

```ts
{
  subreddits: {
    name: string          // e.g. "programming"
    display_name: string  // e.g. "r/programming"
    title: string         // e.g. "Computer Programming"
    description: string   // short public description
    subscribers: number
    active_users: number  // users active in the last 15 min
    type: "public" | "private" | "restricted"
    nsfw: boolean
  }[]
  after: string | null
}
```

---

### 3. `get_subreddit_info`

Get metadata and rules for a subreddit. Useful for understanding a community's scope and whether it's the right place to look.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `subreddit` | `string` | yes | Subreddit name, with or without `r/` prefix |

**Returns**

```ts
{
  name: string
  display_name: string
  title: string
  description: string        // short public description
  description_long: string   // full sidebar text (markdown)
  subscribers: number
  active_users: number
  created_utc: number
  type: "public" | "private" | "restricted"
  nsfw: boolean
  url: string
  rules: {
    short_name: string
    description: string
  }[]
}
```

---

### 4. `get_subreddit_posts`

Browse the posts feed of a subreddit. Useful for seeing what problems people are currently discussing in a community.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `subreddit` | `string` | yes | Subreddit name |
| `sort` | `"hot" \| "new" \| "top" \| "rising" \| "controversial"` | no | Feed type (default: `hot`) |
| `time` | `"hour" \| "day" \| "week" \| "month" \| "year" \| "all"` | no | Time window, applies to `top` and `controversial` (default: `day`) |
| `limit` | `number` | no | 1–100 (default: `25`) |
| `after` | `string` | no | Pagination cursor |

**Returns**

Same shape as `search_reddit` results.

---

### 5. `search_subreddit_posts`

Search posts within a specific subreddit. More targeted than `search_reddit` when you already know which community is relevant.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `subreddit` | `string` | yes | Subreddit to restrict search to |
| `query` | `string` | yes | Search query |
| `sort` | `"relevance" \| "hot" \| "top" \| "new" \| "comments"` | no | (default: `relevance`) |
| `time` | `"hour" \| "day" \| "week" \| "month" \| "year" \| "all"` | no | (default: `all`) |
| `limit` | `number` | no | 1–100 (default: `25`) |
| `after` | `string` | no | Pagination cursor |

**Returns**

Same shape as `search_reddit` results.

---

### 6. `get_post`

Get a post's full content and its comment tree in one call.

**Params**

| Name | Type | Required | Description |
|---|---|---|---|
| `post_id` | `string` | yes | Post ID (e.g. `abc123`), fullname (`t3_abc123`), or full Reddit permalink URL |
| `include_comments` | `boolean` | no | Whether to include the comment tree (default: `true`) |
| `comment_sort` | `"best" \| "top" \| "new" \| "controversial" \| "old" \| "qa"` | no | Comment sort order (default: `best`) |
| `comment_limit` | `number` | no | Max top-level comments to return, 1–100 (default: `20`) |
| `comment_depth` | `number` | no | Max reply nesting depth, 1–10 (default: `3`) |
| `comment_id` | `string` | no | If provided, return only this comment's subtree — use when drilling into a "load more" node |

**Returns**

```ts
{
  id: string
  title: string
  subreddit: string
  permalink: string
  external_url: string
  author: string
  score: number
  upvote_ratio: number
  num_comments: number
  created_utc: number
  edited_utc: number | null
  flair: string | null
  nsfw: boolean
  locked: boolean
  archived: boolean
  is_video: boolean
  body: string              // full selftext (markdown), empty for link posts
  awards: {
    name: string
    count: number
  }[]

  // only present when include_comments is true
  comments?: {
    items: Comment[]
    more_count: number      // top-level comments not returned in this response
  }
}

type Comment = {
  id: string
  author: string
  body: string              // markdown text
  score: number
  created_utc: number
  edited_utc: number | null
  depth: number             // 0 = top-level
  replies: Comment[]
  more_replies: number      // replies not loaded at this node — use comment_id to expand
}
```

---

## Pagination notes

- All list tools return an `after` cursor (a Reddit fullname like `t3_abc123`).
- Pass it as `after` on the next call to get the next page. `null` means no more results.

## Error shape

All tools throw with a structured error on failure:
```ts
{
  code: "NOT_FOUND" | "RATE_LIMITED" | "SUBREDDIT_PRIVATE" | "SUBREDDIT_BANNED" | "NETWORK_ERROR"
  message: string
}
```

---

## Workflow summary

| Goal | Tool(s) |
|---|---|
| Find threads about an error or problem | `search_reddit` |
| Find which community covers a topic | `search_subreddits` |
| Understand a community's scope | `get_subreddit_info` |
| See what problems people are raising in a community | `get_subreddit_posts` |
| Search for a problem within a known community | `search_subreddit_posts` |
| Read a thread and its solutions | `get_post` |
| Drill into a deep reply chain | `get_post` with `comment_id` |
