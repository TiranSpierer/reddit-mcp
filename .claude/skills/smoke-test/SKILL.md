---
description: Smoke test the reddit-mcp server. Run this after making changes to source files in src/ to verify all 6 MCP tools still work correctly. Covers happy paths and edge cases.
---

Build, register, smoke-test, and clean up the reddit-mcp MCP server. This exercises all 6 tools with happy paths and edge cases via a Claude subprocess.

## Step 1: Build

Run from the repository root. Stop and report if it fails.

```bash
npm run build
```

## Step 2: Register MCP server

Remove any stale test registration, then register using the repo's current path:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
claude mcp remove reddit-mcp-dev -s project 2>/dev/null || true
claude mcp add reddit-mcp-dev -s project -- node "$REPO_ROOT/dist/index.js"
```

## Step 3: Run smoke tests

Run the test suite via `claude -p` so the newly registered MCP server is available in the subprocess. Execute this command:

```bash
claude -p --model sonnet --allowedTools "mcp__reddit-mcp-dev" <<'TESTPROMPT'
You are a test runner for the reddit-mcp-dev MCP server. Run each test by calling the specified tool. For each test output exactly one line:
  PASS: <test-name>
  FAIL: <test-name> - <reason>

Do not output explanations between test results.

HAPPY PATH TESTS:

1. search_reddit
   Call search_reddit with query="javascript" limit=2
   PASS if posts array is non-empty

2. search_subreddits
   Call search_subreddits with query="programming" limit=2
   PASS if subreddits array is non-empty

3. get_subreddit_info
   Call get_subreddit_info with subreddit="node"
   PASS if response contains name and subscribers

4. get_subreddit_posts
   Call get_subreddit_posts with subreddit="javascript" sort="top" time="week" limit=2
   PASS if posts array is non-empty

5. search_subreddit_posts
   Call search_subreddit_posts with subreddit="javascript" query="react" limit=2
   PASS if posts array is non-empty

6. get_post
   Use the first post ID from test 1 results. Call get_post with that post_id and comment_limit=2.
   PASS if response has title and comments object

EDGE CASE TESTS:

7. nonexistent_subreddit
   Call get_subreddit_info with subreddit="thissubredditdoesnotexist99999"
   PASS if it returns a NOT_FOUND error

8. nonexistent_post
   Call get_post with post_id="zzzzzzzzzzz"
   PASS if it returns a NOT_FOUND error

9. empty_search
   Call search_reddit with query="asjkdhqwuiey8283746xyz" limit=3
   PASS if posts array is empty and no error thrown

10. pagination
    Call search_reddit with query="python" limit=2. Note the "after" cursor.
    Call search_reddit again with query="python" limit=2 and that after cursor.
    PASS if second call returns different post IDs than the first

11. post_id_t3_format
    Take the post ID used in test 6. Call get_post with post_id="t3_<that-id>" comment_limit=1.
    PASS if it returns the same post (matching title) as test 6

After all tests, output exactly:
SUMMARY: X/11 passed
TESTPROMPT
```

## Step 4: Evaluate and clean up

Parse the subprocess output for the SUMMARY line.

**All 11 passed:** Clean up and report success.
```bash
claude mcp remove reddit-mcp-dev -s project
```
Report: "All 11 smoke tests passed. Cleaned up reddit-mcp-dev registration."

**Any failures:** Do NOT remove the MCP server. Report which tests failed and why. Tell the user:
"MCP server left registered as `reddit-mcp-dev` for debugging. Run `claude mcp remove reddit-mcp-dev -s project` when done."
