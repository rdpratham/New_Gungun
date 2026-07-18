"""
Poll webhook.site for new emails POSTed by Power Automate and store them in the DB.

Usage:
    python poll_webhook_site.py --token d3c3cc44-426c-492b-a6ec-ed733ba050d6 --interval 30
"""

import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import click
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
sys.path.insert(0, str(Path(__file__).parent))
from db import init_db, get_conn, upsert_email, log_action

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "./mail_store.db")
WEBHOOK_SITE_API = "https://webhook.site/token/{token}/requests"


def _strip_html(html: str) -> str:
    from bs4 import BeautifulSoup
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for t in soup.select(".gmail_signature,.signature,#Signature"):
        t.decompose()
    return re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()


def _parse_recipients(val) -> str:
    if not val:
        return "[]"
    if isinstance(val, list):
        result = []
        for r in val:
            if isinstance(r, dict):
                ea = r.get("emailAddress", r)
                result.append({"name": ea.get("name", ""), "email": ea.get("address", "")})
            elif isinstance(r, str):
                result.append({"name": "", "email": r})
        return json.dumps(result)
    if isinstance(val, str):
        try:
            return _parse_recipients(json.loads(val))
        except Exception:
            return json.dumps([{"name": "", "email": val}]) if "@" in val else "[]"
    return "[]"


def _build_record(data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    body_raw = data.get("body", "")
    content_type = data.get("bodyContentType", "text").lower()
    body_text = _strip_html(body_raw) if "html" in content_type else body_raw

    is_read = data.get("isRead", False)
    if isinstance(is_read, str):
        is_read = is_read.lower() in ("true", "1", "yes")

    return {
        "message_id": data.get("id", f"pa-{now}"),
        "thread_id": data.get("conversationId", ""),
        "folder": data.get("folder", "Inbox"),
        "sender_name": data.get("fromName", ""),
        "sender_email": data.get("from", ""),
        "recipients_to": _parse_recipients(data.get("toRecipients")),
        "recipients_cc": _parse_recipients(data.get("ccRecipients")),
        "recipients_bcc": "[]",
        "subject": data.get("subject", "(no subject)"),
        "date_sent": data.get("sentDateTime", ""),
        "date_received": data.get("receivedDateTime", now),
        "body_text": body_text[:100_000],
        "attachments": "[]",
        "categories": "[]",
        "is_read": 1 if is_read else 0,
        "importance": (data.get("importance") or "normal").lower(),
        "is_deleted": 0,
        "embedding": None,
        "synced_at": now,
    }


def fetch_and_store(token: str, seen_uuids: set, db_path: str) -> int:
    url = WEBHOOK_SITE_API.format(token=token)
    try:
        resp = requests.get(url, params={"sorting": "newest", "per_page": 50}, timeout=15)
        resp.raise_for_status()
        requests_data = resp.json().get("data", [])
    except Exception as e:
        logger.warning("Failed to fetch from webhook.site: %s", e)
        return 0

    new_count = 0
    for req in requests_data:
        uuid = req.get("uuid")
        if uuid in seen_uuids:
            continue
        if req.get("method") != "POST":
            seen_uuids.add(uuid)
            continue
        content = req.get("content", "")
        if not content:
            seen_uuids.add(uuid)
            continue
        try:
            data = json.loads(content)
            record = _build_record(data)
            with get_conn(db_path) as conn:
                upsert_email(conn, record)
                log_action(conn, "sync", f"webhook.site: {record['subject'][:60]} from {record['sender_email']}")
            logger.info("Stored: [%s] %s | from: %s", record["folder"], record["subject"][:50], record["sender_email"])
            new_count += 1
        except Exception as e:
            logger.warning("Failed to process request %s: %s", uuid, e)
        seen_uuids.add(uuid)

    return new_count


@click.command()
@click.option("--token", required=True, help="webhook.site token UUID")
@click.option("--db", default=None, help="SQLite DB path")
@click.option("--interval", default=30, help="Poll interval in seconds (default: 30)")
@click.option("--once", is_flag=True, help="Run once and exit (no loop)")
def main(token: str, db: str, interval: int, once: bool):
    """Poll webhook.site and import new Power Automate emails into the database."""
    db_path = db or DB_PATH
    init_db(db_path)
    seen_uuids: set = set()

    logger.info("Starting webhook.site poller — token: %s, DB: %s", token[:8] + "...", db_path)

    while True:
        n = fetch_and_store(token, seen_uuids, db_path)
        if n:
            logger.info("Imported %d new email(s). Total seen UUIDs: %d", n, len(seen_uuids))
        else:
            logger.debug("No new emails.")

        if once:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
