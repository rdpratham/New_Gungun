"""
Local Outlook sync via Windows COM automation.
Reads directly from the running Outlook desktop app — no OAuth, no admin approval.

Requirements (run on your Windows PC):
    pip install pywin32 requests python-dateutil beautifulsoup4 lxml

Usage:
    # One-time full sync:
    python sync_local_outlook.py

    # Continuous live sync (checks every 60 seconds):
    python sync_local_outlook.py --watch --interval 60

    # Sync specific folder only:
    python sync_local_outlook.py --folder Inbox

    # Push synced DB to remote agent (optional):
    python sync_local_outlook.py --push-url http://your-server/upload
"""

import argparse
import json
import logging
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Check platform ────────────────────────────────────────────────────────────
if sys.platform != "win32":
    print("ERROR: This script must run on Windows where Outlook is installed.")
    print("Run it on your local PC, not on the remote server.")
    sys.exit(1)

try:
    import win32com.client
    import pythoncom
except ImportError:
    print("ERROR: pywin32 not installed. Run:  pip install pywin32")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("outlook_sync.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "mail_store.db")

# ── Database setup (same schema as the agent) ─────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS emails (
    message_id      TEXT PRIMARY KEY,
    thread_id       TEXT,
    folder          TEXT,
    sender_name     TEXT,
    sender_email    TEXT,
    recipients_to   TEXT,
    recipients_cc   TEXT,
    recipients_bcc  TEXT,
    subject         TEXT,
    date_sent       TEXT,
    date_received   TEXT,
    body_text       TEXT,
    attachments     TEXT,
    categories      TEXT,
    is_read         INTEGER,
    importance      TEXT,
    is_deleted      INTEGER DEFAULT 0,
    embedding       BLOB,
    synced_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_emails_sender   ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_date     ON emails(date_received);
CREATE INDEX IF NOT EXISTS idx_emails_folder   ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_deleted  ON emails(is_deleted);
CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT, detail TEXT, occurred_at TEXT
);
"""


def init_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def upsert(conn: sqlite3.Connection, record: dict) -> None:
    conn.execute(
        """INSERT INTO emails (
            message_id,thread_id,folder,sender_name,sender_email,
            recipients_to,recipients_cc,recipients_bcc,
            subject,date_sent,date_received,body_text,attachments,
            categories,is_read,importance,is_deleted,embedding,synced_at
        ) VALUES (
            :message_id,:thread_id,:folder,:sender_name,:sender_email,
            :recipients_to,:recipients_cc,:recipients_bcc,
            :subject,:date_sent,:date_received,:body_text,:attachments,
            :categories,:is_read,:importance,:is_deleted,:embedding,:synced_at
        ) ON CONFLICT(message_id) DO UPDATE SET
            folder=excluded.folder, sender_name=excluded.sender_name,
            sender_email=excluded.sender_email, recipients_to=excluded.recipients_to,
            recipients_cc=excluded.recipients_cc, subject=excluded.subject,
            date_sent=excluded.date_sent, date_received=excluded.date_received,
            body_text=excluded.body_text, attachments=excluded.attachments,
            categories=excluded.categories, is_read=excluded.is_read,
            importance=excluded.importance, synced_at=excluded.synced_at""",
        record,
    )


# ── Outlook COM helpers ───────────────────────────────────────────────────────

# Outlook importance constants
_IMPORTANCE = {0: "low", 1: "normal", 2: "high"}

# Outlook recipient type constants
_RECIP_TYPE = {1: "to", 2: "cc", 3: "bcc"}


def _strip_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        for t in soup.select(".signature,#Signature,[class*=signature]"):
            t.decompose()
        text = soup.get_text(separator="\n")
        return re.sub(r"\n{3,}", "\n\n", text).strip()
    except Exception:
        return re.sub(r"<[^>]+>", " ", html).strip()


def _safe_str(val) -> str:
    try:
        return str(val) if val is not None else ""
    except Exception:
        return ""


def _mail_item_to_record(item, folder_path: str, now_iso: str) -> dict | None:
    try:
        # Only process MailItem (class 43), skip meetings, tasks, etc.
        if item.Class != 43:
            return None

        to_list, cc_list, bcc_list = [], [], []
        try:
            for r in item.Recipients:
                entry = {"name": _safe_str(r.Name), "email": _safe_str(r.Address)}
                rtype = _RECIP_TYPE.get(r.Type, "to")
                if rtype == "to":
                    to_list.append(entry)
                elif rtype == "cc":
                    cc_list.append(entry)
                else:
                    bcc_list.append(entry)
        except Exception:
            pass

        attachments = []
        try:
            for a in item.Attachments:
                attachments.append({
                    "name": _safe_str(a.FileName),
                    "type": _safe_str(a.Type),
                    "size": int(a.Size) if a.Size else 0,
                })
        except Exception:
            pass

        categories = [c.strip() for c in (_safe_str(item.Categories) or "").split(";") if c.strip()]

        body = ""
        try:
            body = _safe_str(item.Body)  # plain text body
        except Exception:
            try:
                body = _strip_html(_safe_str(item.HTMLBody))
            except Exception:
                pass

        try:
            date_sent = item.SentOn.strftime("%Y-%m-%dT%H:%M:%SZ") if item.SentOn else ""
        except Exception:
            date_sent = ""
        try:
            date_recv = item.ReceivedTime.strftime("%Y-%m-%dT%H:%M:%SZ") if item.ReceivedTime else date_sent
        except Exception:
            date_recv = date_sent

        importance_val = _IMPORTANCE.get(int(item.Importance), "normal")

        return {
            "message_id": _safe_str(item.EntryID),
            "thread_id": _safe_str(item.ConversationID),
            "folder": folder_path,
            "sender_name": _safe_str(item.SenderName),
            "sender_email": _safe_str(item.SenderEmailAddress),
            "recipients_to": json.dumps(to_list),
            "recipients_cc": json.dumps(cc_list),
            "recipients_bcc": json.dumps(bcc_list),
            "subject": _safe_str(item.Subject) or "(no subject)",
            "date_sent": date_sent,
            "date_received": date_recv,
            "body_text": body[:100_000],
            "attachments": json.dumps(attachments),
            "categories": json.dumps(categories),
            "is_read": 1 if item.UnRead is False else 0,
            "importance": importance_val,
            "is_deleted": 0,
            "embedding": None,
            "synced_at": now_iso,
        }
    except Exception as e:
        logger.debug("Skipping item: %s", e)
        return None


def _get_folder_path(folder) -> str:
    parts = []
    try:
        while folder is not None:
            parts.append(folder.Name)
            try:
                folder = folder.Parent
                if not hasattr(folder, "Name"):
                    break
            except Exception:
                break
    except Exception:
        pass
    return " / ".join(reversed(parts))


def sync_folder(conn: sqlite3.Connection, folder, now_iso: str, stats: dict) -> None:
    folder_path = _get_folder_path(folder)
    try:
        items = folder.Items
        count = items.Count
    except Exception:
        return

    logger.info("  Folder: %s (%d items)", folder_path, count)
    inserted = 0

    for i in range(1, count + 1):
        try:
            item = items[i]
            record = _mail_item_to_record(item, folder_path, now_iso)
            if record:
                upsert(conn, record)
                inserted += 1
                if inserted % 100 == 0:
                    conn.commit()
                    logger.info("    … %d/%d", inserted, count)
        except Exception as e:
            logger.debug("Error at item %d in %s: %s", i, folder_path, e)

    conn.commit()
    stats["total"] += inserted
    logger.info("  → %d emails synced from %s", inserted, folder_path)

    # Recurse into subfolders
    try:
        for subfolder in folder.Folders:
            sync_folder(conn, subfolder, now_iso, stats)
    except Exception:
        pass


def run_sync(db_path: str, folder_filter: str | None = None) -> int:
    pythoncom.CoInitialize()
    try:
        logger.info("Connecting to Outlook…")
        outlook = win32com.client.Dispatch("Outlook.Application")
        namespace = outlook.GetNamespace("MAPI")
        now_iso = datetime.now(timezone.utc).isoformat()

        conn = init_db(db_path)
        stats = {"total": 0}

        accounts = namespace.Accounts
        for i in range(1, accounts.Count + 1):
            account = accounts[i]
            logger.info("Account: %s", account.SmtpAddress)
            try:
                store = account.DeliveryStore
                root = store.GetRootFolder()
                if folder_filter:
                    # Find specific folder
                    for folder in root.Folders:
                        if folder_filter.lower() in folder.Name.lower():
                            sync_folder(conn, folder, now_iso, stats)
                else:
                    for folder in root.Folders:
                        sync_folder(conn, folder, now_iso, stats)
            except Exception as e:
                logger.warning("Error accessing account %s: %s", account.SmtpAddress, e)

        conn.execute(
            "INSERT INTO audit_log(action,detail,occurred_at) VALUES(?,?,?)",
            ("sync", f"com_sync complete: {stats['total']} emails", now_iso),
        )
        conn.commit()
        conn.close()
        logger.info("Sync complete: %d total emails", stats["total"])
        return stats["total"]
    finally:
        pythoncom.CoUninitialize()


# ── Watch mode (incremental) ──────────────────────────────────────────────────

def watch_inbox(db_path: str, interval: int = 60) -> None:
    """Poll Outlook Inbox every `interval` seconds for new emails."""
    pythoncom.CoInitialize()
    try:
        outlook = win32com.client.Dispatch("Outlook.Application")
        namespace = outlook.GetNamespace("MAPI")
        inbox = namespace.GetDefaultFolder(6)  # olFolderInbox = 6
        conn = init_db(db_path)

        # Track highest known count to detect new mail
        last_count = inbox.Items.Count
        logger.info("Watching Inbox (%d existing emails, checking every %ds)…", last_count, interval)

        while True:
            try:
                items = inbox.Items
                current_count = items.Count
                if current_count > last_count:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    new_items = current_count - last_count
                    logger.info("%d new email(s) detected", new_items)
                    # Sync the newest items (they appear at the end after Sort)
                    items.Sort("[ReceivedTime]", True)
                    stats = {"total": 0}
                    for i in range(1, new_items + 1):
                        try:
                            record = _mail_item_to_record(items[i], "Inbox", now_iso)
                            if record:
                                upsert(conn, record)
                                stats["total"] += 1
                        except Exception as e:
                            logger.debug("Error on new item %d: %s", i, e)
                    conn.commit()
                    logger.info("Synced %d new email(s)", stats["total"])
                    last_count = current_count
            except Exception as e:
                logger.warning("Watch error: %s", e)
            time.sleep(interval)
    finally:
        pythoncom.CoUninitialize()


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sync local Outlook emails to SQLite (no OAuth needed)")
    parser.add_argument("--db", default=DB_PATH, help="SQLite database path")
    parser.add_argument("--folder", help="Only sync this folder name (e.g. Inbox)")
    parser.add_argument("--watch", action="store_true", help="Watch Inbox for new emails continuously")
    parser.add_argument("--interval", type=int, default=60, help="Watch interval in seconds (default: 60)")
    args = parser.parse_args()

    print(f"Database: {args.db}")
    print(f"Mode: {'Watch (live)' if args.watch else 'Full sync'}")
    print()

    if args.watch:
        print(f"Watching Inbox every {args.interval}s for new emails… (Ctrl+C to stop)")
        watch_inbox(args.db, args.interval)
    else:
        n = run_sync(args.db, folder_filter=args.folder)
        print(f"\nDone! {n} emails synced to {args.db}")
        print("\nNext: copy the .db file to the agent server, then run:")
        print("  python agent.py embed    # generate semantic embeddings")
        print("  python agent.py shell    # start querying")


if __name__ == "__main__":
    main()
