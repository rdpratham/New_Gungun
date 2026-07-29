/**
 * Local, file-based search history. Deliberately never stores ZoomInfo
 * credentials/tokens — only the retrieved contact summary and search metadata.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Contact, SearchHistoryEntry } from "../types";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, "[]", "utf8");
  }
}

async function readHistory(): Promise<SearchHistoryEntry[]> {
  await ensureDataFile();
  const raw = await fs.readFile(HISTORY_FILE, "utf8");
  try {
    return JSON.parse(raw) as SearchHistoryEntry[];
  } catch {
    return [];
  }
}

async function writeHistory(entries: SearchHistoryEntry[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export async function appendHistoryEntry(
  linkedinUrl: string,
  contact: Contact,
  matchConfidence: number
): Promise<SearchHistoryEntry> {
  const entries = await readHistory();
  const entry: SearchHistoryEntry = {
    id: randomUUID(),
    linkedinUrl,
    name: contact.name,
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    searchDate: new Date().toISOString(),
    matchConfidence,
  };
  entries.unshift(entry);
  await writeHistory(entries.slice(0, 500)); // cap growth of the local history file
  return entry;
}

export async function listHistory(): Promise<SearchHistoryEntry[]> {
  return readHistory();
}

export async function clearHistory(): Promise<void> {
  await writeHistory([]);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function historyToCsv(): Promise<string> {
  const entries = await readHistory();
  const header = ["LinkedIn URL", "Name", "Company", "Email", "Phone", "Search Date", "Match Confidence"];
  const rows = entries.map((e) =>
    [e.linkedinUrl, e.name, e.company, e.email, e.phone, e.searchDate, `${e.matchConfidence}`].map(csvEscape).join(",")
  );
  return [header.join(","), ...rows].join("\n");
}
