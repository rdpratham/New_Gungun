"""
Email ingestion from Microsoft Graph API.
Supports full sync and incremental delta sync per folder.
"""

import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional

import requests
from bs4 import BeautifulSoup

from db import get_conn, init_db, log_action, mark_deleted, set_sync_state, get_sync_state, upsert_email

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

MAIL_SELECT = (
    "id,conversationId,parentFolderId,"
    "from,toRecipients,ccRecipients,bccRecipients,"
    "subject,sentDateTime,receivedDateTime,"
    "body,hasAttachments,attachments,"
    "categories,isRead,importance"
)

FOLDER_NAMES = [
    "inbox", "sentitems", "drafts", "deleteditems",
    "archive", "junkemail", "outbox",
]


def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _get_json(url: str, token: str, params: Optional[Dict] = None) -> Dict:
    resp = requests.get(url, headers=_headers(token), params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _strip_html(html: str) -> str:
    """Convert HTML body to plain text, removing signatures heuristically."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    # Remove common signature wrappers
    for tag in soup.select(".gmail_signature, .signature, #Signature, [class*=signature]"):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def _parse_email_address(obj: Optional[Dict]) -> tuple[str, str]:
    if not obj:
        return "", ""
    addr = obj.get("emailAddress", {})
    return addr.get("name", ""), addr.get("address", "")


def _parse_recipients(lst: Optional[List]) -> str:
    if not lst:
        return "[]"
    result = []
    for item in lst:
        name, email = _parse_email_address(item)
        result.append({"name": name, "email": email})
    return json.dumps(result)


def _parse_attachments(lst: Optional[List]) -> str:
    if not lst:
        return "[]"
    result = []
    for a in lst:
        result.append({
            "name": a.get("name", ""),
            "type": a.get("contentType", ""),
            "size": a.get("size", 0),
        })
    return json.dumps(result)


def _message_to_record(msg: Dict, folder: str, now_iso: str) -> Dict[str, Any]:
    sender_name, sender_email = _parse_email_address(msg.get("from"))
    body_obj = msg.get("body", {})
    body_text = (
        _strip_html(body_obj.get("content", ""))
        if body_obj.get("contentType", "").lower() == "html"
        else body_obj.get("content", "")
    )
    return {
        "message_id": msg["id"],
        "thread_id": msg.get("conversationId", ""),
        "folder": folder,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "recipients_to": _parse_recipients(msg.get("toRecipients")),
        "recipients_cc": _parse_recipients(msg.get("ccRecipients")),
        "recipients_bcc": _parse_recipients(msg.get("bccRecipients")),
        "subject": msg.get("subject", "(no subject)"),
        "date_sent": msg.get("sentDateTime", ""),
        "date_received": msg.get("receivedDateTime", ""),
        "body_text": body_text,
        "attachments": _parse_attachments(msg.get("attachments")),
        "categories": json.dumps(msg.get("categories", [])),
        "is_read": 1 if msg.get("isRead") else 0,
        "importance": msg.get("importance", "normal"),
        "is_deleted": 0,
        "embedding": None,
        "synced_at": now_iso,
    }


def _list_folders(token: str) -> List[Dict]:
    """Return all mail folders (including custom ones)."""
    url = f"{GRAPH_BASE}/me/mailFolders"
    folders = []
    while url:
        data = _get_json(url, token, params={"$top": 100})
        folders.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
    return folders


def _iter_messages(
    token: str,
    folder_id: str,
    delta_link: Optional[str] = None,
    limit: int = 0,
) -> Generator[tuple[Dict, Optional[str]], None, None]:
    """
    Yield (message, delta_link_when_done).
    On the last page, yield (message, final_delta_link).
    """
    if delta_link:
        url = delta_link
        params = None
    else:
        url = f"{GRAPH_BASE}/me/mailFolders/{folder_id}/messages/delta"
        params = {
            "$select": MAIL_SELECT,
            "$expand": "attachments($select=name,contentType,size)",
            "$top": 50,
        }

    count = 0
    while url:
        data = _get_json(url, token, params=params)
        params = None  # only on first request
        messages = data.get("value", [])
        next_link = data.get("@odata.nextLink")
        final_delta = data.get("@odata.deltaLink")

        for msg in messages:
            yield msg, final_delta
            count += 1
            if limit and count >= limit:
                return

        if not next_link:
            break
        url = next_link


def full_sync(token: str, db_path: str, limit: int = 0) -> None:
    """Pull all folders and all messages. Stores delta links for future incremental syncs."""
    init_db(db_path)
    now_iso = datetime.now(timezone.utc).isoformat()

    folders = _list_folders(token)
    logger.info("Found %d folders", len(folders))

    with get_conn(db_path) as conn:
        log_action(conn, "sync", f"full_sync started; {len(folders)} folders")

    for folder in folders:
        folder_id = folder["id"]
        folder_name = folder.get("displayName", folder_id)
        logger.info("Syncing folder: %s", folder_name)

        delta_link: Optional[str] = None
        last_msg = None

        for msg, d_link in _iter_messages(token, folder_id, limit=limit):
            if msg.get("@removed"):
                with get_conn(db_path) as conn:
                    mark_deleted(conn, msg["id"])
                continue

            record = _message_to_record(msg, folder_name, now_iso)
            with get_conn(db_path) as conn:
                upsert_email(conn, record)

            if d_link:
                delta_link = d_link

        if delta_link:
            with get_conn(db_path) as conn:
                set_sync_state(conn, f"delta:{folder_id}", delta_link)
                log_action(conn, "sync", f"folder '{folder_name}' done")

    with get_conn(db_path) as conn:
        log_action(conn, "sync", "full_sync complete")
    logger.info("Full sync complete")


def incremental_sync(token: str, db_path: str) -> int:
    """Run delta sync on all folders that have a stored delta link. Returns count of new/updated messages."""
    now_iso = datetime.now(timezone.utc).isoformat()
    updated = 0

    folders = _list_folders(token)
    for folder in folders:
        folder_id = folder["id"]
        folder_name = folder.get("displayName", folder_id)

        with get_conn(db_path) as conn:
            delta_link = get_sync_state(conn, f"delta:{folder_id}")

        if not delta_link:
            logger.debug("No delta link for %s, skipping incremental", folder_name)
            continue

        logger.info("Incremental sync for: %s", folder_name)
        new_delta: Optional[str] = None

        for msg, d_link in _iter_messages(token, folder_id, delta_link=delta_link):
            if msg.get("@removed"):
                with get_conn(db_path) as conn:
                    mark_deleted(conn, msg["id"])
                updated += 1
                continue

            record = _message_to_record(msg, folder_name, now_iso)
            with get_conn(db_path) as conn:
                upsert_email(conn, record)
            updated += 1

            if d_link:
                new_delta = d_link

        if new_delta:
            with get_conn(db_path) as conn:
                set_sync_state(conn, f"delta:{folder_id}", new_delta)

    with get_conn(db_path) as conn:
        log_action(conn, "sync", f"incremental_sync complete; {updated} records updated")

    logger.info("Incremental sync: %d records updated", updated)
    return updated
