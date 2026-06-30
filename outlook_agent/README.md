# Outlook Mail Intelligence Agent

A self-contained Python agent that connects to a user's Outlook mailbox via
Microsoft Graph API, stores all email data locally in SQLite, and answers
natural-language questions about that mail through hybrid structured + semantic search.

---

## Features

| Capability | Detail |
|---|---|
| **OAuth2 auth** | Device-code flow (interactive) or client-credentials (app-only). Token cached securely at `~/.outlook_agent_token_cache.json`. |
| **Full sync** | Pulls all folders (Inbox, Sent, Drafts, Archive, Junk, custom) with per-message fields listed below. |
| **Delta sync** | Microsoft Graph delta-query based incremental sync — only new/changed messages fetched. |
| **Structured storage** | SQLite with indexed fields: sender, date, folder, thread, read-status, importance, categories. |
| **Semantic embeddings** | Optional `sentence-transformers` local model (no API key) embeds subject + body for semantic search. |
| **Hybrid search** | SQL filter → semantic re-ranking pipeline on each query. |
| **NL query parser** | Regex-based parser handles sender, date ranges, folder, subject keywords, read/unread from plain English. |
| **Audit log** | Every sync and query is appended to `audit_log` table. |
| **CLI + REPL** | Single-question `query` command or interactive `shell`. |

---

## Quick Start

### 1. Register an Azure App

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps).
2. New registration → choose "Accounts in this org only" (or multi-tenant).
3. Under **Authentication** → add a *Mobile and desktop application* redirect: `https://login.microsoftonline.com/common/oauth2/nativeclient`.
4. Under **API permissions** → add `Mail.Read` and `Mail.ReadBasic` (delegated).
5. Grant admin consent if required.
6. Copy the **Application (client) ID** and **Directory (tenant) ID**.

### 2. Configure

```bash
cd outlook_agent
cp .env.example .env
# Edit .env and fill in AZURE_CLIENT_ID and AZURE_TENANT_ID
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

For semantic search (recommended):
```bash
pip install sentence-transformers
```

### 4. Authenticate & Sync

```bash
# First run: full sync (authenticates via browser device-code)
python agent.py sync

# After first sync, generate embeddings for semantic search
python agent.py embed

# Subsequent runs: fast incremental sync
python agent.py sync --delta
```

### 5. Query

```bash
# Single question
python agent.py query "find emails from Sarah about the contract"

# Show full email detail
python agent.py query "what did John say last Tuesday" --full

# Interactive REPL
python agent.py shell
```

---

## CLI Reference

```
python agent.py sync [--delta] [--limit N]   Sync from Outlook
python agent.py embed                         Embed un-embedded emails
python agent.py query "..." [--full] [--top N]  Ask a question
python agent.py shell                         Interactive REPL
python agent.py status                        Show DB statistics
python agent.py logout                        Clear token cache
```

### REPL commands

| Input | Effect |
|---|---|
| Any question | Search and display results |
| `!full` | Toggle full-detail mode |
| `!top N` | Set max results to N |
| `quit` / `exit` | Exit the REPL |

---

## Natural-Language Query Examples

```
find emails from alice@company.com about the Q3 budget
what did Sarah say last Tuesday about the contract?
show unread emails in inbox from this week
emails from John in sent items
list emails about project kickoff from the last 30 days
find emails with subject renewal from Carol
```

The parser extracts:
- **Sender** — by name or email address
- **Date range** — today, yesterday, last N days, last week, this month, last Tuesday, "in March"
- **Folder** — inbox, sent, drafts, archive, junk, deleted
- **Subject keyword** — from "about X" / "subject X" / "re: X"
- **Read status** — "unread" / "read"
- **Semantic term** — remaining text used for body-level embedding search

---

## Data Schema

```sql
emails (
    message_id      TEXT PRIMARY KEY,
    thread_id       TEXT,
    folder          TEXT,
    sender_name     TEXT,
    sender_email    TEXT,
    recipients_to   TEXT,   -- JSON [{name, email}]
    recipients_cc   TEXT,
    recipients_bcc  TEXT,
    subject         TEXT,
    date_sent       TEXT,
    date_received   TEXT,
    body_text       TEXT,   -- HTML stripped to plain text
    attachments     TEXT,   -- JSON [{name, type, size}]
    categories      TEXT,
    is_read         INTEGER,
    importance      TEXT,
    is_deleted      INTEGER,
    embedding       BLOB,   -- float32 numpy array
    synced_at       TEXT
)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AZURE_CLIENT_ID` | Yes | — | App registration client ID |
| `AZURE_TENANT_ID` | Yes | — | Azure AD tenant ID |
| `AZURE_CLIENT_SECRET` | No | — | For app-only auth; leave blank for delegated |
| `DB_PATH` | No | `./mail_store.db` | SQLite file path |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | sentence-transformers model name, or `none` |
| `SYNC_LIMIT` | No | `0` (unlimited) | Max emails per folder on first sync |
| `LOG_PATH` | No | `./agent.log` | Log file path |

---

## Architecture

```
agent.py          CLI entry point (click + rich)
auth.py           MSAL OAuth2 — device-code & client-credentials flows
sync.py           Microsoft Graph API email ingestion + delta sync
db.py             SQLite schema, upsert, structured query helpers
embeddings.py     sentence-transformers local embeddings + cosine ranking
query_parser.py   NL → structured filters + semantic term (regex-based)
search.py         Hybrid search: SQL filter → semantic re-rank
tests/            pytest suite (db, parser, search)
```

---

## Running Tests

```bash
pip install pytest
python -m pytest tests/ -v
```

All 24 tests run without network access or Azure credentials.
