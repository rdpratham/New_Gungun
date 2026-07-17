"""
Ingest emails from an Outlook export into the agent's SQLite database.

Supported formats:
  - PST / OST files  (requires: pip install libratom)
  - MBOX files       (Python stdlib)
  - EML files        (Python stdlib)
  - Outlook.com JSON export ZIP (account.microsoft.com/privacy/export)

Usage:
  python ingest_export.py <path-to-file-or-folder> [--db mail_store.db]
"""

import email
import json
import logging
import mailbox
import os
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from email.header import decode_header, make_header
from pathlib import Path
from typing import Optional

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import track

load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from db import init_db, upsert_email, get_conn, log_action

console = Console()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_str(val) -> str:
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    try:
        return str(make_header(decode_header(val)))
    except Exception:
        return str(val)


def _extract_addresses(msg: email.message.Message, field: str):
    import email.utils
    raw = msg.get_all(field, [])
    result = []
    for part in raw:
        for name, addr in email.utils.getaddresses([part]):
            result.append({"name": name.strip(), "email": addr.strip()})
    return json.dumps(result)


def _get_body(msg: email.message.Message) -> str:
    from bs4 import BeautifulSoup
    import re
    plain = html = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and not plain:
                charset = part.get_content_charset() or "utf-8"
                try:
                    plain = part.get_payload(decode=True).decode(charset, errors="replace")
                except Exception:
                    plain = str(part.get_payload())
            elif ct == "text/html" and not html:
                charset = part.get_content_charset() or "utf-8"
                try:
                    html = part.get_payload(decode=True).decode(charset, errors="replace")
                except Exception:
                    html = str(part.get_payload())
    else:
        ct = msg.get_content_type()
        charset = msg.get_content_charset() or "utf-8"
        try:
            payload = msg.get_payload(decode=True).decode(charset, errors="replace")
        except Exception:
            payload = str(msg.get_payload())
        if ct == "text/html":
            html = payload
        else:
            plain = payload

    if plain:
        return re.sub(r"\n{3,}", "\n\n", plain).strip()
    if html:
        soup = BeautifulSoup(html, "lxml")
        for tag in soup.select(".gmail_signature,.signature,#Signature"):
            tag.decompose()
        text = soup.get_text(separator="\n")
        return re.sub(r"\n{3,}", "\n\n", text).strip()
    return ""


def _get_attachments(msg: email.message.Message) -> str:
    result = []
    for part in msg.walk():
        if part.get_content_disposition() in ("attachment", "inline"):
            filename = _decode_str(part.get_filename())
            if filename:
                payload = part.get_payload(decode=True) or b""
                result.append({
                    "name": filename,
                    "type": part.get_content_type(),
                    "size": len(payload),
                })
    return json.dumps(result)


def _parse_date(date_str: str) -> str:
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def _msg_to_record(msg: email.message.Message, folder: str, idx: int) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    msg_id = _decode_str(msg.get("Message-ID", "")) or f"local-{folder}-{idx}"
    msg_id = msg_id.strip("<>").strip()

    sender_raw = msg.get("From", "")
    import email.utils
    sender_name, sender_email = email.utils.parseaddr(sender_raw)
    sender_name = _decode_str(sender_name)

    date_raw = msg.get("Date", "")
    date_iso = _parse_date(date_raw)

    return {
        "message_id": msg_id,
        "thread_id": _decode_str(msg.get("Thread-Index", msg.get("References", "")))[:255],
        "folder": folder,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "recipients_to": _extract_addresses(msg, "To"),
        "recipients_cc": _extract_addresses(msg, "Cc"),
        "recipients_bcc": _extract_addresses(msg, "Bcc"),
        "subject": _decode_str(msg.get("Subject", "(no subject)")),
        "date_sent": date_iso,
        "date_received": date_iso,
        "body_text": _get_body(msg),
        "attachments": _get_attachments(msg),
        "categories": json.dumps([]),
        "is_read": 0 if "Unseen" in (msg.get("Status") or "") else 1,
        "importance": msg.get("Importance", "normal").lower(),
        "is_deleted": 0,
        "embedding": None,
        "synced_at": now_iso,
    }


# ── Format handlers ───────────────────────────────────────────────────────────

def ingest_mbox(path: Path, db_path: str, folder_name: str = "Imported") -> int:
    """Parse an MBOX file."""
    count = 0
    mbox = mailbox.mbox(str(path))
    messages = list(mbox)
    console.print(f"[cyan]MBOX:[/cyan] {len(messages)} messages in {path.name}")
    for i, msg in track(enumerate(messages), total=len(messages), description="Importing…"):
        try:
            record = _msg_to_record(msg, folder_name, i)
            with get_conn(db_path) as conn:
                upsert_email(conn, record)
            count += 1
        except Exception as e:
            logger.warning("Skipping message %d: %s", i, e)
    return count


def ingest_eml_folder(path: Path, db_path: str) -> int:
    """Ingest all .eml files in a folder (recursively)."""
    eml_files = list(path.rglob("*.eml"))
    console.print(f"[cyan]EML:[/cyan] {len(eml_files)} .eml files under {path}")
    count = 0
    for i, eml_path in track(enumerate(eml_files), total=len(eml_files), description="Importing…"):
        try:
            with open(eml_path, "rb") as f:
                msg = email.message_from_bytes(f.read())
            folder = eml_path.parent.name
            record = _msg_to_record(msg, folder, i)
            with get_conn(db_path) as conn:
                upsert_email(conn, record)
            count += 1
        except Exception as e:
            logger.warning("Skipping %s: %s", eml_path, e)
    return count


def ingest_pst(path: Path, db_path: str) -> int:
    """Parse a PST/OST file using libratom (pip install libratom)."""
    try:
        from libratom.lib.pff import PffArchive
    except ImportError:
        console.print("[red]PST support requires:[/red] pip install libratom")
        console.print("Run that, then re-run this command.")
        return 0

    count = 0
    with PffArchive(path) as archive:
        messages = list(archive.messages())
        console.print(f"[cyan]PST:[/cyan] {len(messages)} messages in {path.name}")
        for i, pff_msg in track(enumerate(messages), total=len(messages), description="Importing…"):
            try:
                folder = str(pff_msg.get_folder_path() or "Imported")
                raw = pff_msg.plain_text_body or pff_msg.html_body or ""
                now_iso = datetime.now(timezone.utc).isoformat()
                sent_dt = pff_msg.delivery_time
                date_iso = sent_dt.isoformat() if sent_dt else ""
                record = {
                    "message_id": str(pff_msg.identifier),
                    "thread_id": "",
                    "folder": folder,
                    "sender_name": pff_msg.sender_name or "",
                    "sender_email": pff_msg.sender_email_address or "",
                    "recipients_to": json.dumps([
                        {"name": r.display_name or "", "email": r.email_address or ""}
                        for r in (pff_msg.recipients or [])
                        if r.recipient_type == 1  # To
                    ]),
                    "recipients_cc": json.dumps([
                        {"name": r.display_name or "", "email": r.email_address or ""}
                        for r in (pff_msg.recipients or [])
                        if r.recipient_type == 2  # CC
                    ]),
                    "recipients_bcc": "[]",
                    "subject": pff_msg.subject or "(no subject)",
                    "date_sent": date_iso,
                    "date_received": date_iso,
                    "body_text": raw[:50000],
                    "attachments": json.dumps([
                        {"name": a.name or "", "type": a.mime_type or "", "size": a.size or 0}
                        for a in (pff_msg.attachments or [])
                    ]),
                    "categories": "[]",
                    "is_read": 1 if pff_msg.is_read else 0,
                    "importance": "normal",
                    "is_deleted": 0,
                    "embedding": None,
                    "synced_at": now_iso,
                }
                with get_conn(db_path) as conn:
                    upsert_email(conn, record)
                count += 1
            except Exception as e:
                logger.warning("Skipping PST message %d: %s", i, e)
    return count


def ingest_microsoft_zip(path: Path, db_path: str) -> int:
    """
    Ingest the ZIP downloaded from account.microsoft.com/privacy/export.
    Contains JSON files per folder.
    """
    count = 0
    with zipfile.ZipFile(path) as zf:
        json_files = [n for n in zf.namelist() if n.endswith(".json") and "mail" in n.lower()]
        if not json_files:
            # Try any JSON — some exports use different naming
            json_files = [n for n in zf.namelist() if n.endswith(".json")]
        console.print(f"[cyan]ZIP:[/cyan] {len(json_files)} JSON files in {path.name}")
        now_iso = datetime.now(timezone.utc).isoformat()
        for fname in track(json_files, description="Importing…"):
            try:
                data = json.loads(zf.read(fname))
                messages = data if isinstance(data, list) else data.get("value", [data])
                folder = Path(fname).stem
                for i, item in enumerate(messages):
                    # Microsoft privacy export format
                    sender = item.get("from") or item.get("sender") or {}
                    if isinstance(sender, dict):
                        ea = sender.get("emailAddress", sender)
                        sname = ea.get("name", "")
                        semail = ea.get("address", "")
                    else:
                        sname, semail = "", str(sender)

                    body_obj = item.get("body", {})
                    body_text = body_obj.get("content", "") if isinstance(body_obj, dict) else str(body_obj)
                    if isinstance(body_obj, dict) and body_obj.get("contentType", "").lower() == "html":
                        from bs4 import BeautifulSoup
                        body_text = BeautifulSoup(body_text, "lxml").get_text(separator="\n")

                    record = {
                        "message_id": item.get("id", f"zip-{fname}-{i}"),
                        "thread_id": item.get("conversationId", ""),
                        "folder": item.get("parentFolderName", folder),
                        "sender_name": sname,
                        "sender_email": semail,
                        "recipients_to": json.dumps([
                            {"name": r.get("emailAddress", {}).get("name", ""),
                             "email": r.get("emailAddress", {}).get("address", "")}
                            for r in item.get("toRecipients", [])
                        ]),
                        "recipients_cc": json.dumps([
                            {"name": r.get("emailAddress", {}).get("name", ""),
                             "email": r.get("emailAddress", {}).get("address", "")}
                            for r in item.get("ccRecipients", [])
                        ]),
                        "recipients_bcc": "[]",
                        "subject": item.get("subject", "(no subject)"),
                        "date_sent": item.get("sentDateTime", ""),
                        "date_received": item.get("receivedDateTime", item.get("sentDateTime", "")),
                        "body_text": body_text[:50000],
                        "attachments": json.dumps([
                            {"name": a.get("name", ""), "type": a.get("contentType", ""), "size": a.get("size", 0)}
                            for a in item.get("attachments", [])
                        ]),
                        "categories": json.dumps(item.get("categories", [])),
                        "is_read": 1 if item.get("isRead") else 0,
                        "importance": item.get("importance", "normal"),
                        "is_deleted": 0,
                        "embedding": None,
                        "synced_at": now_iso,
                    }
                    with get_conn(db_path) as conn:
                        upsert_email(conn, record)
                    count += 1
            except Exception as e:
                logger.warning("Skipping %s: %s", fname, e)
    return count


# ── CLI ───────────────────────────────────────────────────────────────────────

@click.command()
@click.argument("source", type=click.Path(exists=True))
@click.option("--db", default=None, help="SQLite DB path (default: from .env or ./mail_store.db)")
@click.option("--folder", default="Imported", help="Folder label for MBOX/EML imports")
def main(source: str, db: Optional[str], folder: str):
    """
    Ingest emails from an Outlook export file into the agent database.

    SOURCE can be:
      - A .pst or .ost file  (requires: pip install libratom)
      - An .mbox file
      - A .zip file from account.microsoft.com/privacy/export
      - A folder of .eml files
    """
    db_path = db or os.getenv("DB_PATH", "./mail_store.db")
    init_db(db_path)

    src = Path(source)
    suffix = src.suffix.lower()

    if suffix == ".pst" or suffix == ".ost":
        count = ingest_pst(src, db_path)
    elif suffix == ".mbox":
        count = ingest_mbox(src, db_path, folder)
    elif suffix == ".zip":
        count = ingest_microsoft_zip(src, db_path)
    elif src.is_dir():
        count = ingest_eml_folder(src, db_path)
    elif suffix == ".eml":
        init_db(db_path)
        with open(src, "rb") as f:
            msg = email.message_from_bytes(f.read())
        record = _msg_to_record(msg, folder, 0)
        with get_conn(db_path) as conn:
            upsert_email(conn, record)
        count = 1
    else:
        console.print(f"[red]Unsupported format:[/red] {suffix}")
        console.print("Supported: .pst, .ost, .mbox, .zip, .eml, or a folder of .eml files")
        raise SystemExit(1)

    with get_conn(db_path) as conn:
        log_action(conn, "sync", f"ingest_export: {count} emails from {src.name}")

    console.print(f"\n[green]Done![/green] {count} emails imported into {db_path}")
    console.print("Next step: generate embeddings with:  python agent.py embed")


if __name__ == "__main__":
    main()
