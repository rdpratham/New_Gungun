#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { logger } from "./utils/logger.js";
import { sharedScraper } from "./scraper.js";
import { scrapeUrl } from "./tools/scrape_url.js";
import { scrapeMultipleUrls } from "./tools/scrape_multiple.js";
import { scrapePaginated } from "./tools/scrape_paginated.js";
import { extractLinks } from "./tools/extract_links.js";
import { scrapeAndSave, type SaveFormat } from "./tools/scrape_and_save.js";

const SERVER_NAME = "web-scraper-mcp";
const SERVER_VERSION = "1.0.0";

/** Tool catalog exposed over MCP. */
const TOOLS: Tool[] = [
  {
    name: "scrape_url",
    description:
      "Scrape a single web page and extract structured data described in plain English. " +
      "Auto-detects JS-rendered pages (Puppeteer) vs static pages (Cheerio). " +
      "Example query: 'get me all the job listings with salary'.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL of the page to scrape." },
        query: {
          type: "string",
          description:
            "Plain-English description of the data to extract (e.g. 'all product names and prices').",
        },
      },
      required: ["url", "query"],
    },
  },
  {
    name: "scrape_multiple_urls",
    description:
      "Scrape several URLs concurrently (max 5 at a time), then merge and intelligently " +
      "deduplicate the combined results. Use the same plain-English query across all URLs.",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "List of URLs to scrape.",
        },
        query: { type: "string", description: "Plain-English description of the data to extract." },
      },
      required: ["urls", "query"],
    },
  },
  {
    name: "scrape_paginated",
    description:
      "Scrape a page and automatically follow pagination (Next buttons, numbered pages, " +
      "rel=next links), combining results across all pages up to max_pages.",
    inputSchema: {
      type: "object",
      properties: {
        start_url: { type: "string", description: "The first page URL to start from." },
        query: { type: "string", description: "Plain-English description of the data to extract." },
        max_pages: {
          type: "number",
          description: "Maximum number of pages to follow (default 10).",
        },
      },
      required: ["start_url", "query"],
    },
  },
  {
    name: "extract_links",
    description:
      "Extract all links from a page and filter them by intent using a plain-English " +
      "description (e.g. 'only product links', 'only links to blog posts').",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL of the page to extract links from." },
        filter_description: {
          type: "string",
          description: "Plain-English description of which links to keep.",
        },
      },
      required: ["url", "filter_description"],
    },
  },
  {
    name: "scrape_and_save",
    description:
      "Scrape a URL and save the extracted data to a local file in the requested format " +
      "(json, csv, or markdown).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL of the page to scrape." },
        query: { type: "string", description: "Plain-English description of the data to extract." },
        format: {
          type: "string",
          enum: ["json", "csv", "markdown"],
          description: "Output file format.",
        },
        filename: { type: "string", description: "Output file name (extension added if missing)." },
      },
      required: ["url", "query", "format", "filename"],
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
  logger.info(`Tool call: ${name}`, { args });

  try {
    const result = await dispatch(name, args as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: result && typeof result === "object" && (result as any).success === false,
    };
  } catch (err) {
    // Never crash — always return a valid MCP response.
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Tool '${name}' threw`, { error: errorMessage });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { success: false, error: errorMessage, tool: name },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

/** Route a validated tool call to its implementation. */
async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "scrape_url":
      requireString(args, "url");
      requireString(args, "query");
      return scrapeUrl(args.url as string, args.query as string);

    case "scrape_multiple_urls": {
      if (!Array.isArray(args.urls) || args.urls.length === 0) {
        throw new Error("'urls' must be a non-empty array of strings.");
      }
      requireString(args, "query");
      return scrapeMultipleUrls(args.urls as string[], args.query as string);
    }

    case "scrape_paginated": {
      requireString(args, "start_url");
      requireString(args, "query");
      const maxPages =
        typeof args.max_pages === "number" && args.max_pages > 0
          ? Math.floor(args.max_pages)
          : 10;
      return scrapePaginated(args.start_url as string, args.query as string, maxPages);
    }

    case "extract_links":
      requireString(args, "url");
      requireString(args, "filter_description");
      return extractLinks(args.url as string, args.filter_description as string);

    case "scrape_and_save": {
      requireString(args, "url");
      requireString(args, "query");
      requireString(args, "filename");
      const format = args.format as SaveFormat;
      if (!["json", "csv", "markdown"].includes(format)) {
        throw new Error("'format' must be one of: json, csv, markdown.");
      }
      return scrapeAndSave(
        args.url as string,
        args.query as string,
        format,
        args.filename as string
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireString(args: Record<string, unknown>, key: string): void {
  if (typeof args[key] !== "string" || (args[key] as string).trim() === "") {
    throw new Error(`'${key}' is required and must be a non-empty string.`);
  }
}

async function shutdown(): Promise<void> {
  logger.info("Shutting down web-scraper-mcp");
  await sharedScraper.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

main().catch((err) => {
  logger.error("Fatal error starting server", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
