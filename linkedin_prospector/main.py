#!/usr/bin/env python3
"""LinkedIn Sales Prospecting CLI — entry point."""

import argparse
import asyncio
import os
import sys
from typing import Optional

from rich.console import Console
from rich.prompt import Prompt, Confirm

console = Console()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="LinkedIn Sales Prospector — find and score LinkedIn profiles for outreach.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --keywords "AI procurement" --designation "CPO" --location "France"
  python main.py --keywords "SaaS" --designation "VP of Sales" --company "Salesforce"
  python main.py  # interactive mode
        """,
    )

    parser.add_argument("--keywords", help='e.g. "AI automation SaaS"')
    parser.add_argument("--designation", help='e.g. "VP of Sales" "Head of Marketing"')
    parser.add_argument("--process", help='e.g. "procurement" "digital transformation"')
    parser.add_argument("--location", help='e.g. "France" "New York" "London"')
    parser.add_argument("--company", help='e.g. "Airbus" "Salesforce"')
    parser.add_argument("--pages", type=int, default=3, help="Number of search pages to scrape (default: 3)")
    parser.add_argument("--auth-state", default="auth_state.json", help="Path to Playwright auth state file (default: auth_state.json)")
    parser.add_argument("--no-csv", action="store_true", help="Skip CSV export")
    parser.add_argument("--csv-output", help="Custom CSV output path")
    parser.add_argument("--no-score", action="store_true", help="Skip Claude scoring (faster, no API key needed)")
    parser.add_argument("--html-file", help="Fallback: parse profiles from a saved HTML file instead of scraping")
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")
    parser.add_argument("--min-score", type=int, default=0, help="Only show profiles at or above this score (0-10)")

    return parser.parse_args()


def interactive_collect(args: argparse.Namespace) -> argparse.Namespace:
    """Prompt for any missing required fields interactively."""
    console.rule("[bold blue]LinkedIn Sales Prospector")
    console.print("[dim]Press Enter to skip any field.[/dim]\n")

    if not args.keywords:
        args.keywords = Prompt.ask("[cyan]Keywords[/cyan] (e.g. AI automation SaaS)", default="") or None
    if not args.designation:
        args.designation = Prompt.ask("[cyan]Target designation[/cyan] (e.g. VP of Sales, CPO)", default="") or None
    if not args.process:
        args.process = Prompt.ask("[cyan]Business process[/cyan] (e.g. procurement, hiring)", default="") or None
    if not args.location:
        args.location = Prompt.ask("[cyan]Location[/cyan] (e.g. France, New York)", default="") or None
    if not args.company:
        args.company = Prompt.ask("[cyan]Company[/cyan] (e.g. Airbus, Salesforce)", default="") or None

    if not any([args.keywords, args.designation, args.process, args.location, args.company]):
        console.print("[red]At least one search criterion is required.[/red]")
        sys.exit(1)

    return args


async def run(args: argparse.Namespace) -> None:
    from scraper import scrape_linkedin, scrape_from_html
    from scorer import score_profiles
    from exporter import print_table, export_csv

    # --- Scraping ---
    if args.html_file:
        console.print(f"\n[yellow]Parsing profiles from HTML file:[/yellow] {args.html_file}")
        with open(args.html_file, encoding="utf-8") as f:
            raw_html = f.read()
        profiles = scrape_from_html(raw_html)
    else:
        console.print("\n[bold]Scraping LinkedIn...[/bold]")
        profiles = await scrape_linkedin(
            keywords=args.keywords,
            designation=args.designation,
            process=args.process,
            location=args.location,
            company=args.company,
            max_pages=args.pages,
            auth_state_path=args.auth_state,
        )

    if not profiles:
        console.print("[red]No profiles found.[/red]")
        console.print(
            "\n[yellow]Tip:[/yellow] If LinkedIn blocked the scraper, save your search results "
            "page as HTML and re-run with [bold]--html-file results.html[/bold]"
        )
        sys.exit(0)

    console.print(f"\n[green]✓[/green] Scraped [bold]{len(profiles)}[/bold] profiles.\n")

    # --- Scoring ---
    if args.no_score:
        for p in profiles:
            p["score"] = 0
            p["notes"] = "Scoring skipped (--no-score)"
        scored = profiles
    else:
        api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            console.print(
                "[red]No Anthropic API key found.[/red] "
                "Set ANTHROPIC_API_KEY or pass --api-key. "
                "Use --no-score to skip scoring."
            )
            sys.exit(1)

        console.print("[bold]Scoring profiles with Claude...[/bold]")
        scored = score_profiles(
            profiles=profiles,
            keywords=args.keywords,
            designation=args.designation,
            process=args.process,
            location=args.location,
            company=args.company,
            api_key=api_key,
        )

    # --- Filter by min score ---
    if args.min_score > 0:
        before = len(scored)
        scored = [p for p in scored if p.get("score", 0) >= args.min_score]
        console.print(f"[dim]Filtered to {len(scored)} profiles with score ≥ {args.min_score} (was {before})[/dim]")

    # --- Display ---
    console.print()
    print_table(scored)

    # --- Export ---
    if not args.no_csv:
        csv_path = export_csv(scored, output_path=args.csv_output)
        console.print(f"\n[green]✓[/green] Results saved to [bold]{csv_path}[/bold]")


def main() -> None:
    args = parse_args()

    # If no search criteria provided at all, go interactive
    has_criteria = any([args.keywords, args.designation, args.process, args.location, args.company, args.html_file])
    if not has_criteria:
        args = interactive_collect(args)

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
