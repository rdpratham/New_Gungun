#!/usr/bin/env node
/**
 * No-API fetcher CLI.
 *
 * This does NOT call the Anthropic API. It only fetches a page (auto-detecting
 * Puppeteer vs Cheerio), strips boilerplate, and prints the cleaned content as
 * JSON. The intelligent extraction is then done by whatever LLM is reading the
 * output — e.g. Claude Code in your current session.
 *
 * Usage:
 *   node dist/fetch_cli.js <url>            # cleaned page text + title
 *   node dist/fetch_cli.js <url> --links    # all links (absolute URLs + text)
 *   node dist/fetch_cli.js <url> --raw      # raw (boilerplate-stripped) HTML
 *   node dist/fetch_cli.js <url> --puppeteer  # force headless-browser render
 */
import { Scraper } from "./scraper.js";
import { cleanHtml } from "./utils/html_cleaner.js";
import { collectLinks } from "./tools/extract_links.js";

interface Flags {
  url: string;
  mode: "text" | "links" | "raw";
  forcePuppeteer: boolean;
}

function parseArgs(argv: string[]): Flags {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));

  const url = positional[0];
  if (!url) {
    process.stderr.write(
      "Usage: node dist/fetch_cli.js <url> [--links] [--raw] [--puppeteer]\n"
    );
    process.exit(2);
  }

  return {
    url,
    mode: flags.has("--links") ? "links" : flags.has("--raw") ? "raw" : "text",
    forcePuppeteer: flags.has("--puppeteer"),
  };
}

async function main(): Promise<void> {
  const { url, mode, forcePuppeteer } = parseArgs(process.argv.slice(2));

  const scraper = new Scraper(
    forcePuppeteer ? { forceMethod: "puppeteer" } : {}
  );

  try {
    const fetched = await scraper.fetchPage(url);

    if (fetched.blocked) {
      print({
        success: false,
        url,
        final_url: fetched.finalUrl,
        status: fetched.status,
        scrape_method: fetched.method,
        error: `Page appears to be blocked: ${fetched.blockReason}`,
      });
      return;
    }

    if (mode === "links") {
      const links = collectLinks(fetched.html, fetched.finalUrl);
      print({
        success: true,
        url,
        final_url: fetched.finalUrl,
        status: fetched.status,
        scrape_method: fetched.method,
        duration_ms: fetched.durationMs,
        link_count: links.length,
        links,
      });
      return;
    }

    if (mode === "raw") {
      const { html, title } = cleanHtml(fetched.html, 200_000);
      print({
        success: true,
        url,
        final_url: fetched.finalUrl,
        status: fetched.status,
        scrape_method: fetched.method,
        duration_ms: fetched.durationMs,
        title,
        html,
      });
      return;
    }

    // Default: cleaned text the host LLM can read and extract from.
    const { text, title } = cleanHtml(fetched.html, 200_000);
    print({
      success: true,
      url,
      final_url: fetched.finalUrl,
      status: fetched.status,
      scrape_method: fetched.method,
      duration_ms: fetched.durationMs,
      title,
      text,
    });
  } catch (err) {
    print({
      success: false,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await scraper.close();
  }
}

function print(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

main();
