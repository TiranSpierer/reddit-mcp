# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A read-only MCP server that wraps Reddit's public JSON API (no API key required). Provides 6 tools for searching Reddit, discovering subreddits, browsing feeds, and reading full post/comment trees. Communicates over stdio and is launched as a subprocess by MCP clients.

## Commands

```bash
npm install          # Install deps + auto-builds via prepare script
npm run build        # Compile TypeScript (tsc) → dist/
npm run dev          # Watch mode (tsc --watch)
```

No linter or formatter is configured.

### Smoke Testing

Run `/smoke-test` to exercise all 6 tools with happy paths and edge cases. This is a project skill at `.claude/skills/smoke-test/SKILL.md` — Claude can also auto-invoke it after editing source files. It builds the project, temporarily registers the MCP server, runs 11 tests via a Claude subprocess, and cleans up on success. See [.claude/commands/smoke-test.md](.claude/commands/smoke-test.md).

To manually test, add as an MCP server:
```bash
claude mcp add reddit-mcp-dev -s project -- node "$(git rev-parse --show-toplevel)/dist/index.js"
```

## Architecture

**ES Modules project** (`"type": "module"`) using TypeScript (target ES2022, module ESNext). Output goes to `dist/`.

### Source Layout (src/)

- **index.ts** — Entry point. Creates `McpServer`, registers one resource (`reddit://api-behavior`) and all 6 tools with Zod input schemas, connects via `StdioServerTransport`. All tool handlers share the same error-handling pattern: `RedditError` → `{ isError: true }` response, anything else re-thrown.

- **client.ts** — Singleton `RedditClient` (exported as `reddit`). Appends `.json` to Reddit paths, uses native `fetch`. Handles rate limiting (tracks `x-ratelimit-*` headers, sleeps when exhausted, retries once on 429). Distinguishes private/banned subreddits on 403.

- **types.ts** — Two type layers: raw types matching Reddit's API shape (`RawPost`, `RawComment`, etc.) and clean output types returned to MCP clients (`PostSummary`, `PostFull`, `Comment`, etc.). Also contains `RedditError` (typed `code` field: `NOT_FOUND`, `RATE_LIMITED`, `SUBREDDIT_PRIVATE`, etc.) and helper functions (`normalizeSubreddit`, `extractPostId`, `toPostSummary`, etc.).

- **tools/search.ts** — `searchReddit`, `searchSubredditPosts` → return `{ posts: PostSummary[], after }`.
- **tools/subreddits.ts** — `searchSubreddits`, `getSubredditInfo` (two sequential requests: about + rules, with quarantine check), `getSubredditPosts`.
- **tools/posts.ts** — `getPost` with recursive `parseCommentTree` that counts truncated subtrees into `more_replies`/`more_count`. Supports focused subtree via `comment_id`.

### Key Patterns

- All Reddit API interaction goes through the singleton `reddit` client in `client.ts` — never call `fetch` directly.
- Rate limit: 100 requests per 10 minutes, tracked automatically by the client.
- The `bin` field in package.json points to `dist/index.js` (has shebang), enabling `npx` installation.

### Dependencies

Only two runtime deps: `@modelcontextprotocol/sdk` (MCP framework) and `zod` (input validation).
