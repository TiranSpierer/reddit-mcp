# reddit-mcp

Read-only Reddit MCP server. Search Reddit and read discussions without an API key.

Built for the use case of researching errors and problems — search across Reddit or within specific communities, then read the full thread and solutions.

## Install

```bash
claude mcp add reddit-mcp -s user -- npx -y git+https://github.com/TiranSpierer/reddit-mcp.git
```

---

<details>
<summary><strong>Tools</strong></summary>

| Tool | Description |
|---|---|
| `search_reddit` | Search posts across all of Reddit |
| `search_subreddits` | Find communities by topic |
| `get_subreddit_info` | Subreddit metadata and rules |
| `get_subreddit_posts` | Browse a subreddit feed (hot/new/top/rising/controversial) |
| `search_subreddit_posts` | Search posts within a specific subreddit |
| `get_post` | Read a post's full content and comment tree |

See [docs/TOOLS.md](docs/TOOLS.md) for full parameter and return type documentation.

</details>

<details>
<summary><strong>Usage examples</strong></summary>

- Search Reddit broadly or within specific communities
- Discover which subreddits cover a topic
- Browse what a community is currently discussing
- Read a full post and its comment thread
- Paginate through results and drill into nested reply chains

While originally designed for researching errors and technical problems, it works for any read-only Reddit use case — news, opinions, recommendations, community sentiment, or anything else people discuss on Reddit.

</details>

<details>
<summary><strong>Rate limits</strong></summary>

100 requests per 10 minutes (Reddit's standard limit). The server tracks rate limit headers automatically and backs off when the limit is approached.

</details>

<details>
<summary><strong>Local development</strong></summary>

```bash
npm install
npm run build
```

Then add it to Claude pointing at the local dist:
```bash
claude mcp add reddit-mcp-dev -s user -- node /path/to/reddit-mcp/dist/index.js
```

</details>
