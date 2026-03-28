---
name: smoke-test
description: Smoke test the reddit-mcp server. Run this after making changes to source files in src/ to verify all 6 MCP tools still work correctly. Covers happy paths and edge cases.
---

## Step 1: Build and restart

```bash
npm run build && pkill -f "node.*reddit-mcp/dist/index.js"
```

Stop and report if the build fails. 
The kill forces Claude Code to respawn the MCP server with the fresh build.

## Step 2: Run smoke tests

Call each tool via `mcp__reddit-mcp-dev__*` directly. For each test output exactly one line:
- `PASS: <test-name>`
- `FAIL: <test-name> - <reason>`

### Happy paths

1. **search_reddit** — `search_reddit(query="javascript", limit=2)`. PASS if posts list is non-empty.
2. **search_subreddits** — `search_subreddits(query="programming", limit=2)`. PASS if subreddits list is non-empty.
3. **get_subreddit_info** — `get_subreddit_info(subreddit="node")`. PASS if response contains name and subscribers.
4. **get_subreddit_posts** — `get_subreddit_posts(subreddit="javascript", sort="top", time="week", limit=2)`. PASS if posts list is non-empty.
5. **search_subreddit_posts** — `search_subreddit_posts(subreddit="javascript", query="react", limit=2)`. PASS if posts list is non-empty.
6. **get_post** — Use the first post ID from test 1. `get_post(post_id=<id>, comment_limit=2)`. PASS if response has title and comments.

### Edge cases

7. **nonexistent_subreddit** — `get_subreddit_info(subreddit="thissubredditdoesnotexist99999")`. PASS if NOT_FOUND error.
8. **nonexistent_post** — `get_post(post_id="zzzzzzzzzzz")`. PASS if NOT_FOUND error.
9. **empty_search** — `search_reddit(query="asjkdhqwuiey8283746xyz", limit=3)`. PASS if posts list is empty and no error.
10. **pagination** — `search_reddit(query="python", limit=2)`, note the `after` cursor, call again with that cursor. PASS if second call returns different post IDs.
11. **post_id_t3_format** — Take the post ID from test 6, call `get_post(post_id="t3_<id>", comment_limit=1)`. PASS if same post title as test 6.

## Step 3: Report

Output: `SUMMARY: X/11 passed`

If any failures, report which tests failed and why.
