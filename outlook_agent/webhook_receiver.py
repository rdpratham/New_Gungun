"""
Webhook receiver for Power Automate live email sync.

Power Automate sends a POST request with email data each time a new email arrives.
This server stores it into the same SQLite database the agent queries.

Usage:
    python webhook_receiver.py [--port 8765] [--db ./mail_store.db] [--secret mytoken]

Power Automate HTTP action setup:
    Method: POST
    URI: http://<your-server>:8765/email
    Headers: Content-Type: application/json
             X-Secret: <your-secret>
    Body: {
        "id": "@{triggerOutputs()?['body/id']}",
        "conversationId": "@{triggerOutputs()?['body/conversationId']}",
        "subject": "@{triggerOutputs()?['body/subject']}",
        "bodyPreview": "@{triggerOutputs()?['body/bodyPreview']}",
        "body": "@{triggerOutputs()?['body/body/content']}",
        "bodyContentType": "@{triggerOutputs()?['body/body/contentType']}",
        "from": "@{triggerOutputs()?['body/from/emailAddress/address']}",
        "fromName": "@{triggerOutputs()?['body/from/emailAddress/name']}",
        "toRecipients": "@{triggerOutputs()?['body/toRecipients']}",
        "ccRecipients": "@{triggerOutputs()?['body/ccRecipients']}",
        "receivedDateTime": "@{triggerOutputs()?['body/receivedDateTime']}",
        "sentDateTime": "@{triggerOutputs()?['body/sentDateTime']}",
        "isRead": "@{triggerOutputs()?['body/isRead']}",
        "importance": "@{triggerOutputs()?['body/importance']}",
        "hasAttachments": "@{triggerOutputs()?['body/hasAttachments']}",
        "folder": "Inbox"
    }
"""

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
sys.path.insert(0, str(Path(__file__).parent))
from db import init_db, get_conn, upsert_email, log_action

app = Flask(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.getenv("LOG_PATH", "./agent.log")),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "./mail_store.db")
SECRET = os.getenv("WEBHOOK_SECRET", "")


def _strip_html(html: str) -> str:
    from bs4 import BeautifulSoup
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for t in soup.select(".gmail_signature,.signature,#Signature"):
        t.decompose()
    return re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()


def _parse_recipients(val) -> str:
    """Normalise Power Automate recipient arrays to [{name, email}] JSON."""
    if not val:
        return "[]"
    if isinstance(val, list):
        result = []
        for r in val:
            if isinstance(r, dict):
                ea = r.get("emailAddress", r)
                result.append({"name": ea.get("name", ""), "email": ea.get("address", "")})
        return json.dumps(result)
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return _parse_recipients(parsed)
        except Exception:
            return "[]"
    return "[]"


def _build_record(data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()

    body_raw = data.get("body", data.get("bodyPreview", ""))
    content_type = data.get("bodyContentType", "text").lower()
    if "html" in content_type:
        body_text = _strip_html(body_raw)
    else:
        body_text = body_raw or ""

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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/email", methods=["POST"])
def receive_email():
    # Optional shared-secret auth
    if SECRET:
        incoming_secret = request.headers.get("X-Secret", "")
        if incoming_secret != SECRET:
            logger.warning("Rejected request: bad secret")
            return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "invalid JSON"}), 400

    try:
        record = _build_record(data)
        init_db(DB_PATH)
        with get_conn(DB_PATH) as conn:
            upsert_email(conn, record)
            log_action(conn, "sync", f"webhook: {record['subject'][:60]} from {record['sender_email']}")
        logger.info("Stored email: %s | from: %s", record["subject"][:60], record["sender_email"])
        return jsonify({"status": "ok", "message_id": record["message_id"]}), 200
    except Exception as e:
        logger.exception("Error storing email")
        return jsonify({"error": str(e)}), 500


@app.route("/stats", methods=["GET"])
def stats():
    try:
        init_db(DB_PATH)
        with get_conn(DB_PATH) as conn:
            count = conn.execute("SELECT COUNT(*) FROM emails WHERE is_deleted=0").fetchone()[0]
            recent = conn.execute(
                "SELECT subject, sender_email, date_received FROM emails "
                "WHERE is_deleted=0 ORDER BY date_received DESC LIMIT 5"
            ).fetchall()
        return jsonify({
            "total_emails": count,
            "recent": [dict(r) for r in recent],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Power Automate webhook receiver")
    parser.add_argument("--port", type=int, default=int(os.getenv("WEBHOOK_PORT", "8765")))
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--secret", default=SECRET)
    args = parser.parse_args()

    DB_PATH = args.db
    SECRET = args.secret

    init_db(DB_PATH)
    logger.info("Webhook receiver starting on port %d, DB: %s", args.port, DB_PATH)
    app.run(host="0.0.0.0", port=args.port, debug=False)
