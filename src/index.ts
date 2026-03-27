#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { searchReddit, searchSubredditPosts } from "./tools/search.js";
import { searchSubreddits, getSubredditInfo, getSubredditPosts } from "./tools/subreddits.js";
import { getPost } from "./tools/posts.js";
import { RedditError } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "reddit-mcp",
  version: "1.0.0",
});

// ─── Resource: API behavior reference ────────────────────────────────────────

server.resource(
  "api-behavior",
  "reddit://api-behavior",
  { mimeType: "text/markdown" },
  () => ({
    contents: [
      {
        uri: "reddit://api-behavior",
        mimeType: "text/markdown",
        text: readFileSync(join(__dirname, "../docs/api-behavior.md"), "utf-8"),
      },
    ],
  })
);

// ─── Tool handler wrapper ─────────────────────────────────────────────────────

function handleError(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (err instanceof RedditError) {
    return {
      content: [{ type: "text", text: `${err.code}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

server.registerTool(
  "search_reddit",
  {
    description:
      "Search posts across all of Reddit. Use this to find discussions about an error, problem, or topic. Returns post summaries with scores and comment counts.",
    inputSchema: {
      query: z.string().describe("Search query string"),
      sort: z
        .enum(["relevance", "hot", "top", "new", "comments"])
        .optional()
        .describe("Ranking method (default: relevance)"),
      time: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time window, applies when sort is 'top' (default: all)"),
      limit: z.number().min(1).max(100).optional().describe("Number of results (default: 25)"),
      after: z.string().optional().describe("Pagination cursor from a previous response"),
    },
  },
  async (args) => {
    try {
      const result = await searchReddit(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

server.registerTool(
  "search_subreddits",
  {
    description:
      "Search for subreddits by name or topic. Use this to discover which communities cover a subject before searching within them.",
    inputSchema: {
      query: z.string().describe("Search query"),
      limit: z.number().min(1).max(100).optional().describe("Number of results (default: 25)"),
      after: z.string().optional().describe("Pagination cursor"),
    },
  },
  async (args) => {
    try {
      const result = await searchSubreddits(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

server.registerTool(
  "get_subreddit_info",
  {
    description:
      "Get metadata and rules for a subreddit. Useful for understanding a community's scope and topic focus before searching within it.",
    inputSchema: {
      subreddit: z.string().describe("Subreddit name, with or without r/ prefix"),
    },
  },
  async (args) => {
    try {
      const result = await getSubredditInfo(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

server.registerTool(
  "get_subreddit_posts",
  {
    description:
      "Browse the posts feed of a subreddit. Useful for seeing what problems or topics people are currently discussing in a community.",
    inputSchema: {
      subreddit: z.string().describe("Subreddit name"),
      sort: z
        .enum(["hot", "new", "top", "rising", "controversial"])
        .optional()
        .describe("Feed type (default: hot)"),
      time: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time window, applies to top and controversial (default: day)"),
      limit: z.number().min(1).max(100).optional().describe("Number of results (default: 25)"),
      after: z.string().optional().describe("Pagination cursor"),
    },
  },
  async (args) => {
    try {
      const result = await getSubredditPosts(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

server.registerTool(
  "search_subreddit_posts",
  {
    description:
      "Search posts within a specific subreddit. More targeted than search_reddit when you already know which community is relevant (e.g. search r/node for an Express error).",
    inputSchema: {
      subreddit: z.string().describe("Subreddit to restrict search to"),
      query: z.string().describe("Search query"),
      sort: z
        .enum(["relevance", "hot", "top", "new", "comments"])
        .optional()
        .describe("Ranking method (default: relevance)"),
      time: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time window (default: all)"),
      limit: z.number().min(1).max(100).optional().describe("Number of results (default: 25)"),
      after: z.string().optional().describe("Pagination cursor"),
    },
  },
  async (args) => {
    try {
      const result = await searchSubredditPosts(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

server.registerTool(
  "get_post",
  {
    description:
      "Get a Reddit post's full content and its comment tree. Use this after finding a relevant post via search to read the full discussion and solutions. Accepts a post ID, t3_ fullname, or full permalink URL.",
    inputSchema: {
      post_id: z
        .string()
        .describe("Post ID (e.g. abc123), fullname (t3_abc123), or full Reddit permalink URL"),
      include_comments: z
        .boolean()
        .optional()
        .describe("Whether to include the comment tree (default: true)"),
      comment_sort: z
        .enum(["best", "top", "new", "controversial", "old", "qa"])
        .optional()
        .describe("Comment sort order (default: best)"),
      comment_limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max top-level comments to return (default: 20)"),
      comment_depth: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("Max reply nesting depth (default: 3)"),
      comment_id: z
        .string()
        .optional()
        .describe(
          "If provided, return only this comment's subtree. Use the id from more_replies to drill into a thread."
        ),
    },
  },
  async (args) => {
    try {
      const result = await getPost(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return handleError(err);
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
