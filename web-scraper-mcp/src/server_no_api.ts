#!/usr/bin/env node
/**
 * No-API MCP server.
 *
 * Unlike index.ts, this server does NOT call the Anthropic API and needs no
 * ANTHROPIC_API_KEY. It only fetches and cleans pages, returning the content to
 * the MCP host (e.g. Claude Code). The host's own model performs the intelligent
 * extraction. This makes it a "scraping capability" for whatever LLM is already
 * driving the session.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { logger } from "./utils/logger.js";
import { Scraper, type ScrapeMethod } from "./scraper.js";
import { cleanHtml } from "./utils/html_cleaner.js";
import { collectLinks } from "./tools/extract_links.js";

const SERVER_NAME = "web-scraper-fetch";
const SERVER_VERSION = "1.0.0";
const MAX_CHARS = 200_000;

const TOOLS: Tool[] = [
  {
    name: "fetch_page",
    description:
      "Fetch a web page and return its cleaned, boilerplate-stripped text plus the page " +
      "title. Auto-detects JS-rendered pages (Puppeteer) vs static pages (Cheerio). " +
      "No AI extraction is performed — YOU (the calling model) read the returned text and " +
      "extract whatever the user asked for. Use this for 'scrape X for Y' requests.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch." },
        force_puppeteer: {
          type: "boolean",
          description: "Force a full headless-browser render (for heavily dynamic sites).",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "fetch_links",
    description:
      "Fetch a web page and return every link as absolute URLs paired with their anchor " +
      "text. No filtering is performed — YOU filter the returned list by the user's intent " +
      "(e.g. 'only blog posts', 'product pages', 'next page').",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch links from." },
        force_puppeteer: {
          type: "boolean",
          description: "Force a full headless-browser render.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "fetch_raw",
    description:
      "Fetch a web page and return its cleaned HTML (scripts/styles/nav/footer removed) " +
      "instead of plain text. Use when the HTML structure matters for extraction " +
      "(tables, nested attributes, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch." },
        force_puppeteer: {
          type: "boolean",
          description: "Force a full headless-browser render.",
        },
      },
      required: ["url"],
    },
  },
];

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;
  logger.info(`Tool call: ${name}`, { args: a });

  try {
    if (typeof a.url !== "string" || a.url.trim() === "") {
      throw new Error("'url' is required and must be a non-empty string.");
    }
    const forceMethod: ScrapeMethod | undefined =
      a.force_puppeteer === true ? "puppeteer" : undefined;

    const result = await runTool(name, a.url, forceMethod);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: result.success === false,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Tool '${name}' threw`, { error: errorMessage });
    return {
      content: [
        { type: "text", text: JSON.stringify({ success: false, error: errorMessage, tool: name }, null, 2) },
      ],
      isError: true,
    };
  }
});

async function runTool(
  name: string,
  url: string,
  forceMethod?: ScrapeMethod
): Promise<Record<string, unknown>> {
  // A fresh scraper per call keeps the process lean; Puppeteer launches lazily
  // and only when actually needed.
  const scraper = new Scraper(forceMethod ? { forceMethod } : {});
  try {
    const fetched = await scraper.fetchPage(url);

    const base = {
      url,
      final_url: fetched.finalUrl,
      status: fetched.status,
      scrape_method: fetched.method,
      duration_ms: fetched.durationMs,
    };

    if (fetched.blocked) {
      return {
        success: false,
        ...base,
        error: `Page appears to be blocked: ${fetched.blockReason}`,
      };
    }

    switch (name) {
      case "fetch_page": {
        const { text, title } = cleanHtml(fetched.html, MAX_CHARS);
        return { success: true, ...base, title, text };
      }
      case "fetch_links": {
        const links = collectLinks(fetched.html, fetched.finalUrl);
        return { success: true, ...base, link_count: links.length, links };
      }
      case "fetch_raw": {
        const { html, title } = cleanHtml(fetched.html, MAX_CHARS);
        return { success: true, ...base, title, html };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } finally {
    await scraper.close();
  }
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} running on stdio (no API key required)`);
}

main().catch((err) => {
  logger.error("Fatal error starting server", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
