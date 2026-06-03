"""CSV and rich terminal table output for scored LinkedIn prospects."""

import csv
import os
from datetime import date
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich import box

console = Console()

COLUMNS = [
    ("Full Name", "name"),
    ("Job Title", "title"),
    ("Company", "company"),
    ("Location", "location"),
    ("LinkedIn URL", "profile_url"),
    ("Score", "score"),
    ("Notes", "notes"),
]


def _score_color(score: int) -> str:
    if score >= 8:
        return "bold green"
    if score >= 5:
        return "yellow"
    return "red"


def print_table(profiles: list[dict]) -> None:
    """Render a rich terminal table of scored prospects."""
    table = Table(
        title=f"LinkedIn Prospects ({len(profiles)} found)",
        box=box.ROUNDED,
        show_lines=True,
        highlight=True,
    )

    table.add_column("Full Name", style="bold cyan", min_width=18)
    table.add_column("Job Title", style="white", min_width=20)
    table.add_column("Company", style="bright_white", min_width=16)
    table.add_column("Location", style="dim", min_width=12)
    table.add_column("LinkedIn URL", style="blue underline", min_width=24, overflow="fold")
    table.add_column("Score", justify="center", min_width=7)
    table.add_column("Notes", min_width=35, overflow="fold")

    for p in sorted(profiles, key=lambda x: x.get("score", 0), reverse=True):
        score = p.get("score", 0)
        table.add_row(
            p.get("name", ""),
            p.get("title", ""),
            p.get("company", ""),
            p.get("location", ""),
            p.get("profile_url", ""),
            f"[{_score_color(score)}]{score}/10[/]",
            p.get("notes", ""),
        )

    console.print(table)


def export_csv(profiles: list[dict], output_path: Optional[str] = None) -> str:
    """Write profiles to CSV and return the file path."""
    if output_path is None:
        today = date.today().isoformat()
        output_path = f"prospects_{today}.csv"

    fieldnames = [col[1] for col in COLUMNS]
    header_map = {col[1]: col[0] for col in COLUMNS}

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )
        # Write human-readable header row
        writer.writerow(header_map)
        for p in sorted(profiles, key=lambda x: x.get("score", 0), reverse=True):
            writer.writerow({k: p.get(k, "") for k in fieldnames})

    return output_path
