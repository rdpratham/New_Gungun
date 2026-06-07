import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createObjectCsvWriter } from "csv-writer";
import { scrapeUrl } from "./scrape_url.js";
import { logger } from "../utils/logger.js";

export type SaveFormat = "json" | "csv" | "markdown";

export interface SaveResult {
  success: boolean;
  url: string;
  query: string;
  data: unknown[];
  count: number;
  scrape_method: string;
  duration_ms: number;
  format: SaveFormat;
  filename: string;
  saved_path?: string;
  message?: string;
  error?: string;
}

/**
 * Directory where output files are written. Defaults to ./scraped_output but
 * can be overridden via SCRAPE_OUTPUT_DIR.
 */
function outputDir(): string {
  return process.env.SCRAPE_OUTPUT_DIR || path.join(process.cwd(), "scraped_output");
}

/**
 * Scrape a URL and save the extracted data to a local file in the requested
 * format (json | csv | markdown).
 */
export async function scrapeAndSave(
  url: string,
  query: string,
  format: SaveFormat,
  filename: string
): Promise<SaveResult> {
  const scraped = await scrapeUrl(url, query);

  const base: SaveResult = {
    ...scraped,
    format,
    filename,
  };

  if (!scraped.success) {
    return base; // propagate the scrape error; nothing to save
  }

  try {
    const dir = outputDir();
    await fs.mkdir(dir, { recursive: true });

    // Prevent path traversal — only keep the basename.
    const safeName = ensureExtension(path.basename(filename), format);
    const fullPath = path.join(dir, safeName);

    const records = scraped.data;

    switch (format) {
      case "json":
        await fs.writeFile(fullPath, JSON.stringify(records, null, 2), "utf8");
        break;
      case "csv":
        await writeCsv(fullPath, records);
        break;
      case "markdown":
        await fs.writeFile(fullPath, toMarkdown(records, url, query), "utf8");
        break;
      default:
        return { ...base, success: false, error: `Unsupported format: ${format}` };
    }

    logger.info("Saved scraped data", { path: fullPath, count: records.length, format });

    return {
      ...base,
      saved_path: fullPath,
      message: `Saved ${records.length} record(s) to ${fullPath}`,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("scrapeAndSave write failed", { url, error: errorMessage });
    return { ...base, success: false, error: errorMessage };
  }
}

function ensureExtension(name: string, format: SaveFormat): string {
  const ext = format === "markdown" ? ".md" : `.${format}`;
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

/** Collect the union of keys across all records for a stable CSV header. */
function collectHeaders(records: unknown[]): string[] {
  const keys = new Set<string>();
  for (const r of records) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      for (const k of Object.keys(r as Record<string, unknown>)) keys.add(k);
    }
  }
  return Array.from(keys);
}

async function writeCsv(fullPath: string, records: unknown[]): Promise<void> {
  if (records.length === 0) {
    await fs.writeFile(fullPath, "", "utf8");
    return;
  }

  const headers = collectHeaders(records);

  // If records aren't objects, fall back to a single "value" column.
  if (headers.length === 0) {
    const csvWriter = createObjectCsvWriter({
      path: fullPath,
      header: [{ id: "value", title: "value" }],
    });
    await csvWriter.writeRecords(records.map((v) => ({ value: stringify(v) })));
    return;
  }

  const csvWriter = createObjectCsvWriter({
    path: fullPath,
    header: headers.map((h) => ({ id: h, title: h })),
  });

  const rows = records.map((r) => {
    const obj = (r ?? {}) as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const h of headers) {
      row[h] = h in obj ? stringify(obj[h]) : "";
    }
    return row;
  });

  await csvWriter.writeRecords(rows);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toMarkdown(records: unknown[], url: string, query: string): string {
  const lines: string[] = [];
  lines.push(`# Scraped Data`);
  lines.push("");
  lines.push(`- **Source:** ${url}`);
  lines.push(`- **Query:** ${query}`);
  lines.push(`- **Records:** ${records.length}`);
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push("");

  if (records.length === 0) {
    lines.push("_No records were extracted._");
    return lines.join(os.EOL);
  }

  const headers = collectHeaders(records);

  if (headers.length > 0) {
    // Render as a table.
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    for (const r of records) {
      const obj = (r ?? {}) as Record<string, unknown>;
      const cells = headers.map((h) =>
        (h in obj ? stringify(obj[h]) : "").replace(/\|/g, "\\|").replace(/\n/g, " ")
      );
      lines.push(`| ${cells.join(" | ")} |`);
    }
  } else {
    // Render as a list.
    for (const r of records) {
      lines.push(`- ${stringify(r)}`);
    }
  }

  return lines.join(os.EOL) + os.EOL;
}
