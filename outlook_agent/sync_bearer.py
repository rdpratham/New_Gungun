"""
Sync emails using a raw Bearer token extracted from the browser session.
No OAuth app registration, no admin consent needed.
The token is the same one outlook.office.com already uses in your browser.

Usage:
    python sync_bearer.py --token "eyJ..."
    python sync_bearer.py --token-file token.txt
"""

import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import click
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

load_dotenv(Path(__file__).parent / ".env")
sys.path.insert(0, str(Path(__file__).parent))
from db import init_db, get_conn, upsert_email, set_sync_state, get_sync_state, log_action, count_emails

console = Console()
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(os.getenv("LOG_PATH", "./agent.log")), logging.StreamHandler(sys.stderr)],
)

GRAPH = "https://graph.microsoft.com/v1.0"
MAIL_SELECT = (
    "id,conversationId,parentFolderId,"
    "from,toRecipients,ccRecipients,bccRecipients,"
    "subject,sentDateTime,receivedDateTime,"
    "body,hasAttachments,attachments,"
    "categories,isRead,importance"
)


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _get(url: str, token: str, params: dict = None) -> dict:
    for attempt in range(3):
        try:
            r = requests.get(url, headers=_headers(token), params=params, timeout=30)
            if r.status_code == 401:
                raise RuntimeError("TOKEN_EXPIRED: The bearer token has expired. Please get a fresh one from your browser.")
            r.raise_for_status()
            return r.json()
        except RuntimeError:
            raise
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def _strip_html(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for t in soup.select(".gmail_signature,.signature,#Signature"):
        t.decompose()
    return re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()


def _parse_addr(obj) -> tuple[str, str]:
    if not obj:
        return "", ""
    ea = obj.get("emailAddress", {})
    return ea.get("name", ""), ea.get("address", "")


def _msg_record(msg: dict, folder_name: str, now: str) -> dict:
    sname, semail = _parse_addr(msg.get("from"))
    body = msg.get("body", {})
    text = _strip_html(body.get("content", "")) if body.get("contentType", "").lower() == "html" else body.get("content", "")
    return {
        "message_id": msg["id"],
        "thread_id": msg.get("conversationId", ""),
        "folder": folder_name,
        "sender_name": sname,
        "sender_email": semail,
        "recipients_to": json.dumps([{"name": n, "email": e} for n, e in
                                      [_parse_addr(r) for r in msg.get("toRecipients", [])]]),
        "recipients_cc": json.dumps([{"name": n, "email": e} for n, e in
                                      [_parse_addr(r) for r in msg.get("ccRecipients", [])]]),
        "recipients_bcc": json.dumps([{"name": n, "email": e} for n, e in
                                       [_parse_addr(r) for r in msg.get("bccRecipients", [])]]),
        "subject": msg.get("subject", "(no subject)"),
        "date_sent": msg.get("sentDateTime", ""),
        "date_received": msg.get("receivedDateTime", ""),
        "body_text": text,
        "attachments": json.dumps([
            {"name": a.get("name", ""), "type": a.get("contentType", ""), "size": a.get("size", 0)}
            for a in msg.get("attachments", [])
        ]),
        "categories": json.dumps(msg.get("categories", [])),
        "is_read": 1 if msg.get("isRead") else 0,
        "importance": msg.get("importance", "normal"),
        "is_deleted": 0,
        "embedding": None,
        "synced_at": now,
    }


def verify_token(token: str) -> dict:
    """Check the token works and return the user's profile."""
    data = _get(f"{GRAPH}/me", token)
    return data


def sync_all(token: str, db_path: str, limit: int = 0) -> int:
    init_db(db_path)
    now = datetime.now(timezone.utc).isoformat()
    total = 0

    # Verify token first
    try:
        me = verify_token(token)
        console.print(f"[green]✓ Token valid[/green] — syncing mailbox for [bold]{me.get('userPrincipalName', me.get('mail', '?'))}[/bold]")
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        return 0

    # Get all folders
    folders = []
    url = f"{GRAPH}/me/mailFolders"
    while url:
        data = _get(url, token, params={"$top": 100})
        folders.extend(data.get("value", []))
        url = data.get("@odata.nextLink")

    console.print(f"Found [bold]{len(folders)}[/bold] folders")

    for folder in folders:
        fid = folder["id"]
        fname = folder.get("displayName", fid)
        msg_count = folder.get("totalItemCount", "?")
        console.print(f"\n[cyan]Syncing:[/cyan] {fname} ({msg_count} messages)")

        url = f"{GRAPH}/me/mailFolders/{fid}/messages"
        params = {
            "$select": MAIL_SELECT,
            "$expand": "attachments($select=name,contentType,size)",
            "$top": 50,
            "$orderby": "receivedDateTime desc",
        }
        count = 0
        with Progress(SpinnerColumn(), TextColumn("{task.description}"), BarColumn(), TaskProgressColumn(), console=console) as progress:
            task = progress.add_task(f"  {fname}", total=msg_count if isinstance(msg_count, int) else None)
            while url:
                data = _get(url, token, params)
                params = None
                for msg in data.get("value", []):
                    record = _msg_record(msg, fname, now)
                    with get_conn(db_path) as conn:
                        upsert_email(conn, record)
                    count += 1
                    progress.advance(task)
                    if limit and count >= limit:
                        break
                url = None if (limit and count >= limit) else data.get("@odata.nextLink")

        total += count
        console.print(f"  [green]✓[/green] {count} emails synced")

    with get_conn(db_path) as conn:
        log_action(conn, "sync", f"bearer_sync complete: {total} emails")

    console.print(f"\n[bold green]Sync complete![/bold green] {total} total emails in {db_path}")
    return total


@click.command()
@click.option("--token", envvar="BEARER_TOKEN", help="Bearer token from browser DevTools")
@click.option("--token-file", type=click.Path(), help="File containing the bearer token")
@click.option("--db", default=None, help="SQLite DB path")
@click.option("--limit", default=0, help="Max emails per folder (0=all)")
@click.option("--verify-only", is_flag=True, help="Just check the token is valid")
def main(token: Optional[str], token_file: Optional[str], db: Optional[str], limit: int, verify_only: bool):
    """
    Sync Outlook emails using a bearer token from your browser session.
    No OAuth consent or admin approval needed.

    \b
    How to get your token:
      1. Open outlook.office.com in your browser
      2. Press F12 → Network tab
      3. Type 'graph' in the filter
      4. Click any request → Headers → copy the Authorization value (after 'Bearer ')
      5. Pass it here: --token "eyJ..."
    """
    if token_file:
        token = Path(token_file).read_text().strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()

    if not token:
        console.print("[red]No token provided.[/red]")
        console.print("Get it from your browser (F12 → Network → filter 'graph' → Authorization header)")
        console.print("\nThen run:")
        console.print('  python sync_bearer.py --token "eyJ..."')
        raise SystemExit(1)

    # Strip "Bearer " prefix if accidentally included
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    db_path = db or os.getenv("DB_PATH", "./mail_store.db")

    if verify_only:
        try:
            me = verify_token(token)
            console.print(f"[green]✓ Token valid[/green] — user: {me.get('userPrincipalName', me.get('mail'))}")
        except Exception as e:
            console.print(f"[red]✗ {e}[/red]")
        return

    sync_all(token, db_path, limit=limit)
    console.print("\nNext steps:")
    console.print("  python agent.py embed   # generate semantic search embeddings")
    console.print("  python agent.py shell   # query your email")


if __name__ == "__main__":
    main()
