"""
Outlook Mail Intelligence Agent — interactive CLI.

Usage:
    python agent.py sync          # full sync (first run)
    python agent.py sync --delta  # incremental sync
    python agent.py embed         # embed all un-embedded emails
    python agent.py query "find emails from Sarah about the contract"
    python agent.py shell         # interactive REPL
"""

import logging
import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich import box

load_dotenv(Path(__file__).parent / ".env")

console = Console()

# ── Logging ──────────────────────────────────────────────────────────────────

LOG_PATH = os.getenv("LOG_PATH", "./agent.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stderr),
    ],
)
logger = logging.getLogger("agent")

# ── Config helpers ────────────────────────────────────────────────────────────

def _require_env(key: str) -> str:
    val = os.getenv(key)
    if not val:
        console.print(f"[red]Error:[/red] Environment variable [bold]{key}[/bold] is not set.")
        console.print("Copy [bold].env.example[/bold] to [bold].env[/bold] and fill in your credentials.")
        sys.exit(1)
    return val


def _get_token() -> str:
    from auth import get_token
    client_id = _require_env("AZURE_CLIENT_ID")
    tenant_id = _require_env("AZURE_TENANT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET") or None
    return get_token(client_id, tenant_id, client_secret)


def _db_path() -> str:
    return os.getenv("DB_PATH", "./mail_store.db")


def _embedding_model() -> str:
    return os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


# ── Formatting helpers ────────────────────────────────────────────────────────

def _format_date(iso: str) -> str:
    if not iso:
        return "unknown date"
    try:
        from dateutil import parser as dparser
        dt = dparser.parse(iso)
        return dt.strftime("%a %d %b %Y %H:%M")
    except Exception:
        return iso[:16]


def _print_results(results, full: bool = False) -> None:
    if not results:
        console.print("[yellow]No matching emails found.[/yellow]")
        return

    for i, r in enumerate(results, 1):
        date_str = _format_date(r.date_received)
        sender = f"{r.sender_name} <{r.sender_email}>" if r.sender_name else r.sender_email
        header = f"[bold cyan]{i}.[/bold cyan] [bold]{r.subject}[/bold]"
        meta = f"[dim]From:[/dim] {sender}  [dim]Date:[/dim] {date_str}  [dim]Folder:[/dim] {r.folder}"

        if full:
            to_list = ", ".join(
                f"{p.get('name', '')} <{p.get('email', '')}>".strip()
                for p in r.recipients_to
            )
            cc_list = ", ".join(
                f"{p.get('name', '')} <{p.get('email', '')}>".strip()
                for p in r.recipients_cc
            ) or "(none)"
            attach = ", ".join(
                f"{a['name']} ({a.get('size', 0):,} bytes)" for a in r.attachments
            ) or "(none)"
            cats = ", ".join(r.categories) or "(none)"
            body_display = r.body_text[:3000] + ("…" if len(r.body_text) > 3000 else "")
            detail = (
                f"**Message ID:** {r.message_id}\n"
                f"**Thread ID:** {r.thread_id}\n"
                f"**Subject:** {r.subject}\n"
                f"**From:** {sender}\n"
                f"**To:** {to_list}\n"
                f"**CC:** {cc_list}\n"
                f"**Date Sent:** {_format_date(r.date_received)}\n"
                f"**Folder:** {r.folder}\n"
                f"**Importance:** {r.importance}\n"
                f"**Read:** {'Yes' if r.is_read else 'No'}\n"
                f"**Categories:** {cats}\n"
                f"**Attachments:** {attach}\n\n"
                f"---\n\n{body_display}"
            )
            console.print(Panel(Markdown(detail), title=header, border_style="blue"))
        else:
            snippet = r.snippet or "(no body)"
            content = f"{meta}\n{snippet}"
            console.print(Panel(content, title=header, border_style="dim"))

    console.print(f"\n[dim]{len(results)} result(s) shown.[/dim]")


# ── CLI commands ──────────────────────────────────────────────────────────────

@click.group()
def cli():
    """Outlook Mail Intelligence Agent."""


@cli.command()
@click.option("--delta", is_flag=True, help="Incremental sync (delta only)")
@click.option("--limit", default=0, help="Max emails per folder (0 = unlimited)")
def sync(delta: bool, limit: int):
    """Synchronise emails from Outlook."""
    token = _get_token()
    db = _db_path()

    if delta:
        from sync import incremental_sync
        console.print("[cyan]Running incremental (delta) sync…[/cyan]")
        n = incremental_sync(token, db)
        console.print(f"[green]Incremental sync complete:[/green] {n} records updated.")
    else:
        from sync import full_sync
        console.print("[cyan]Running full sync — this may take a while…[/cyan]")
        full_sync(token, db, limit=limit)
        console.print("[green]Full sync complete.[/green]")


@cli.command()
def embed():
    """Generate embeddings for all un-embedded emails."""
    from embeddings import embed_all_pending
    db = _db_path()
    model = _embedding_model()
    if model.lower() == "none":
        console.print("[yellow]Embedding is disabled (EMBEDDING_MODEL=none).[/yellow]")
        return
    console.print(f"[cyan]Embedding emails with model '{model}'…[/cyan]")
    n = embed_all_pending(db, model)
    console.print(f"[green]Done:[/green] {n} emails embedded.")


@cli.command()
@click.argument("question")
@click.option("--full", "show_full", is_flag=True, help="Show full email detail")
@click.option("--top", default=5, help="Number of results to return")
def query(question: str, show_full: bool, top: int):
    """Ask a natural-language question about your email."""
    from query_parser import parse
    from search import search as do_search

    pq = parse(question)
    logger.info("Parsed query: %s", pq)

    db = _db_path()
    model = _embedding_model()

    results = do_search(db, pq, embedding_model=model, top_k=top)
    _print_results(results, full=show_full)


@cli.command()
def status():
    """Show database statistics."""
    import sqlite3 as _sq
    db = _db_path()
    try:
        conn = _sq.connect(db)
        conn.row_factory = _sq.Row
        total = conn.execute("SELECT COUNT(*) FROM emails WHERE is_deleted=0").fetchone()[0]
        unread = conn.execute("SELECT COUNT(*) FROM emails WHERE is_deleted=0 AND is_read=0").fetchone()[0]
        folders = conn.execute(
            "SELECT folder, COUNT(*) as cnt FROM emails WHERE is_deleted=0 GROUP BY folder ORDER BY cnt DESC"
        ).fetchall()
        embedded = conn.execute(
            "SELECT COUNT(*) FROM emails WHERE is_deleted=0 AND embedding IS NOT NULL"
        ).fetchone()[0]
        conn.close()
    except Exception as e:
        console.print(f"[red]Database error:[/red] {e}")
        return

    tbl = Table(title="Mail Store Status", box=box.SIMPLE)
    tbl.add_column("Metric", style="cyan")
    tbl.add_column("Value", justify="right")
    tbl.add_row("Total emails", str(total))
    tbl.add_row("Unread", str(unread))
    tbl.add_row("Embedded", f"{embedded} / {total}")
    tbl.add_section()
    for f in folders:
        tbl.add_row(f"  {f['folder']}", str(f["cnt"]))
    console.print(tbl)


@cli.command()
def shell():
    """Start an interactive query REPL."""
    from query_parser import parse
    from search import search as do_search
    from db import count_emails, get_conn

    db = _db_path()
    model = _embedding_model()

    with get_conn(db) as conn:
        total = count_emails(conn)

    console.print(Panel(
        f"[bold cyan]Outlook Mail Intelligence Agent[/bold cyan]\n"
        f"{total} emails in store  •  model: {model}\n"
        "Type a question, [bold]!full[/bold] for full detail, [bold]quit[/bold] to exit.",
        border_style="cyan",
    ))

    show_full = False
    top_k = 5

    while True:
        try:
            line = console.input("[bold green]> [/bold green]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye.[/dim]")
            break

        if not line:
            continue
        if line.lower() in ("quit", "exit", "q"):
            break
        if line.lower() == "!full":
            show_full = not show_full
            console.print(f"[dim]Full detail mode: {'ON' if show_full else 'OFF'}[/dim]")
            continue
        if line.lower().startswith("!top "):
            try:
                top_k = int(line.split()[1])
                console.print(f"[dim]Showing top {top_k} results[/dim]")
            except ValueError:
                console.print("[red]Usage: !top <number>[/red]")
            continue

        pq = parse(line)
        results = do_search(db, pq, embedding_model=model, top_k=top_k)
        _print_results(results, full=show_full)


@cli.command("logout")
def do_logout():
    """Clear the cached authentication token (forces re-login on next run)."""
    from auth import clear_token_cache
    clear_token_cache()
    console.print("[green]Token cache cleared.[/green]")


if __name__ == "__main__":
    cli()
