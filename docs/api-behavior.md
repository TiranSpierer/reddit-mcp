# Reddit API Behavior Reference

This server uses Reddit's public JSON API (`www.reddit.com/*.json`) — no OAuth credentials required.

---

## Rate Limits

| Property | Value |
|---|---|
| Requests allowed | **100 per 10-minute window** |
| Bucket scope | **Per IP address** (shared across all apps on the same host) |
| Reset | Rolling window — `x-ratelimit-reset` header gives seconds until reset |

### Headers on every response

```
x-ratelimit-used: 43
x-ratelimit-remaining: 57.0
x-ratelimit-reset: 312        ← seconds until the window resets
```

`used + remaining = 100` always.

### When you hit the limit

- HTTP **429** with an **empty body**
- No `Retry-After` header — read `x-ratelimit-reset` from the 429 response headers
- Wait that many seconds, then retry

---

## User-Agent Requirement

Reddit hard-blocks requests with a `curl/*` User-Agent or no User-Agent at all. Every request must include a descriptive header:

```
User-Agent: reddit-mcp/1.0 (github.com/your-username/reddit-mcp)
```

---

## Base URL

```
https://www.reddit.com
```

All endpoints use `www.reddit.com`, not `oauth.reddit.com`. Append `.json` to any Reddit URL path.

---

## Endpoints

### Search posts across Reddit
```
GET /search.json?q={query}&sort={sort}&t={time}&limit={limit}&after={cursor}
```

### Search subreddits
```
GET /subreddits/search.json?q={query}&limit={limit}&after={cursor}
```

### Subreddit metadata
```
GET /r/{subreddit}/about.json
```

### Subreddit posts feed
```
GET /r/{subreddit}/{sort}.json?t={time}&limit={limit}&after={cursor}
```
Where `{sort}` is one of: `hot`, `new`, `top`, `rising`, `controversial`

### Search within a subreddit
```
GET /r/{subreddit}/search.json?q={query}&restrict_sr=1&sort={sort}&t={time}&limit={limit}&after={cursor}
```

### Post with comments
```
GET /r/{subreddit}/comments/{post_id}.json?sort={sort}&limit={limit}&depth={depth}
```

Or without subreddit (Reddit resolves it):
```
GET /comments/{post_id}.json?sort={sort}&limit={limit}&depth={depth}
```

---

## Response Quirks

### Comments endpoint returns an array

`GET /comments/{id}.json` returns a **2-element array**, not an object:
```json
[
  { "kind": "Listing", "data": { ... } },   // index 0: the post
  { "kind": "Listing", "data": { ... } }    // index 1: top-level comments
]
```

All other endpoints return a single `{ "kind": "Listing", "data": { ... } }` object.

### "Load more" stubs in comment trees

When a comment has more replies than were returned, you'll see a stub object instead of a comment:
```json
{
  "kind": "more",
  "data": {
    "count": 42,          // number of replies hidden
    "id": "t1_xyz123",    // use this as comment_id param to fetch the subtree
    "children": ["abc", "def"]
  }
}
```

Filter these out when building the comment tree and surface `count` as `more_replies`.

### Deleted / removed content

- Deleted by user: `author` = `"[deleted]"`, `body`/`selftext` = `"[deleted]"`
- Removed by moderator: `author` = `"[deleted]"`, `body`/`selftext` = `"[removed]"`
- Both are valid responses — not errors.

### NSFW / quarantined subreddits

Quarantined subreddits return an empty listing without auth. Return `SUBREDDIT_QUARANTINED` error rather than empty results to avoid confusing the caller.

### Pagination cursors

- The `after` cursor is a Reddit fullname: `t3_abc123` for posts, `t5_abc123` for subreddits
- Cursors are **short-lived** — do not cache for more than a few minutes
- An absent or `null` `after` in the response means no more pages

---

## Common Errors

| Scenario | Reddit response | Error code to surface |
|---|---|---|
| Subreddit doesn't exist | 404 or empty listing | `NOT_FOUND` |
| Subreddit is private | 403 with `"reason": "private"` | `SUBREDDIT_PRIVATE` |
| Subreddit is banned | 404 with `"reason": "banned"` | `SUBREDDIT_BANNED` |
| Quarantined subreddit | 200 but empty listing | `SUBREDDIT_QUARANTINED` |
| Rate limit exceeded | 429, empty body | `RATE_LIMITED` |
| Post not found | 404 | `NOT_FOUND` |
| Network / timeout | fetch throws | `NETWORK_ERROR` |

---

## Parameter Reference

### `sort` for post listings and search
`relevance` `hot` `top` `new` `comments`

### `sort` for comment trees
`best` `top` `new` `controversial` `old` `qa`

### `t` (time filter) — only applies when `sort` is `top` or `controversial`
`hour` `day` `week` `month` `year` `all`

### `limit`
1–100. Reddit ignores values above 100 and returns 100.

### `depth` (comments only)
Controls nesting depth of replies. Reddit's default is 3; max useful value is ~10.
