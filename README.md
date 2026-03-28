# reddit-mcp

Read-only Reddit MCP server. Search Reddit and read discussions without an API key.

Search across Reddit or within specific communities, browse feeds, and read full discussion threads.

## Install

**Standard config** works in most tools:

```json
{
  "mcpServers": {
    "reddit-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/TiranSpierer/reddit-mcp.git"
      ]
    }
  }
}
```

<details>
<summary>Claude Code</summary>

Run in terminal:
```bash
claude mcp add reddit-mcp -s user -- npx -y git+https://github.com/TiranSpierer/reddit-mcp.git
```

</details>

<details>
<summary>VS Code / Copilot</summary>

Run in terminal:
```bash
code --add-mcp '{"name":"reddit-mcp","command":"npx","args":["-y","git+https://github.com/TiranSpierer/reddit-mcp.git"]}'
```

</details>

<details>
<summary>Codex</summary>

Run in terminal:
```bash
codex mcp add reddit-mcp npx "-y" "git+https://github.com/TiranSpierer/reddit-mcp.git"
```

</details>

<details>
<summary>Cursor</summary>

Follow the [Cursor MCP docs](https://cursor.com/docs/mcp). Use the standard config above.

</details>

<details>
<summary>Windsurf</summary>

Follow the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

<details>
<summary>Antigravity</summary>

Follow the [Antigravity MCP docs](https://antigravity.google/docs/mcp). Use the standard config above.

</details>

<details>
<summary>Cline</summary>

Follow the [Cline MCP docs](https://docs.cline.bot/mcp/configuring-mcp-servers). Add to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "reddit-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/TiranSpierer/reddit-mcp.git"
      ],
      "disabled": false
    }
  }
}
```

</details>

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

Register the dev server (run from repo root):
```bash
claude mcp add reddit-mcp-dev -s project -- node dist/index.js
```

After making changes, run `npm run build` and reload Claude for the new code to take effect.

</details>
