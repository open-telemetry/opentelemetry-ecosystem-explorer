#!/usr/bin/env python3
"""
Build the PR screenshots comment body.

Reads PR metadata + the optional diff report from environment variables / a
file path and writes the rendered markdown to OUTPUT_PATH. Invoked from
.github/workflows/screenshots-commit.yml.

Required env:
  PR_NUMBER         the PR number (used both for image URLs and the marker)
  HEAD_REF          source branch
  HEAD_REPO         source repo (owner/repo)
  HEAD_SHA          commit SHA
  WORKFLOW_RUN_ID   the capture workflow run ID, for the run link
  REPO              this repository (owner/repo) where otelbot/screenshots lives
  OUTPUT_PATH       where to write the rendered body

Optional env:
  DIFF_REPORT_PATH  path to diff-screenshots.mjs's JSON report. Skipped if
                    absent or unreadable.

The "Visual diffs vs main" section is only appended when the diff report
contains files whose ratio exceeds the per-file budget, new files, or missing
files. Sub-threshold changes (noise) are intentionally hidden so reviewers
only see actionable diffs.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

VIEWPORTS = ("desktop", "tablet", "mobile")

PAGES = [
    ("Home", "home"),
    ("Instrumentation List", "instrumentation-list"),
    ("Detail — Details tab", "detail-details"),
    ("Detail — Telemetry tab", "detail-telemetry"),
    ("Detail — Configuration tab", "detail-configuration"),
    ("Collector List", "collector-list"),
    ("Collector Detail", "collector-detail"),
    ("Dev components showcase", "dev-components"),
]


def theme_table(base_url: str, slug: str, theme: str) -> str:
    cells = " | ".join(
        f"![{slug} {vp} {theme}]({base_url}/{vp}-{theme}-{slug}.png)" for vp in VIEWPORTS
    )
    return "| Desktop | Tablet | Mobile |\n|---|---|---|\n" f"| {cells} |"


def page_section(base_url: str, label: str, slug: str) -> str:
    return (
        f"<details>\n"
        f"<summary><strong>{label}</strong></summary>\n\n"
        f"**Light**\n\n{theme_table(base_url, slug, 'light')}\n\n"
        f"**Dark**\n\n{theme_table(base_url, slug, 'dark')}\n\n"
        f"</details>"
    )


def render_diff_section(base_url: str, report_path: Path) -> str:
    """Return the diff `<details>` block, or "" when there's nothing worth showing."""
    if not report_path.exists():
        return ""
    try:
        payload = json.loads(report_path.read_text())
    except (json.JSONDecodeError, OSError):
        return ""

    summary = payload.get("summary", {}) or {}
    report = payload.get("report", {}) or {}
    threshold = (summary.get("threshold") or {}).get("perFileRatio", 0)

    changed = report.get("changed", []) or []
    new_files = report.get("newFiles", []) or []
    missing = report.get("missing", []) or []

    over_budget = [c for c in changed if c.get("changedRatio", 0) > threshold]

    if not (over_budget or new_files or missing):
        return ""

    rows: list[str] = []
    for entry in over_budget:
        name = entry["file"]
        ratio = entry.get("changedRatio", 0)
        pixels = entry.get("changedPixels", entry.get("reason", "—"))
        link = f"{base_url}/diffs/main/{name}"
        rows.append(f"| `{name}` | {pixels} | {ratio:.2%} | [diff]({link}) |")
    for name in new_files:
        rows.append(f"| `{name}` | new | — | — |")
    for name in missing:
        rows.append(f"| `{name}` | missing | — | — |")

    summary_line = (
        f"{len(over_budget)} over budget, {len(new_files)} new, {len(missing)} missing"
    )
    table = (
        "| File | Changed pixels | Ratio | Diff |\n"
        "|---|---|---|---|\n" + "\n".join(rows)
    )
    return (
        "\n\n<details>\n"
        f"<summary><strong>Visual diffs vs main</strong> ({summary_line})</summary>\n\n"
        f"{table}\n\n"
        "</details>"
    )


def main() -> None:
    pr_number = os.environ["PR_NUMBER"]
    head_ref = os.environ["HEAD_REF"]
    head_repo = os.environ["HEAD_REPO"]
    head_sha = os.environ["HEAD_SHA"]
    run_id = os.environ["WORKFLOW_RUN_ID"]
    repo = os.environ["REPO"]
    output_path = Path(os.environ["OUTPUT_PATH"])
    diff_report_path = Path(os.environ.get("DIFF_REPORT_PATH", ""))

    short_sha = head_sha[:7]
    commit_url = f"https://github.com/{head_repo}/commit/{head_sha}"
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}"
    base_url = f"https://raw.githubusercontent.com/{repo}/otelbot/screenshots/{pr_number}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    sections = "\n\n".join(page_section(base_url, label, slug) for label, slug in PAGES)
    diff_section = render_diff_section(base_url, diff_report_path) if diff_report_path else ""

    footer = (
        f"_Captured from [`{short_sha}`]({commit_url}) on `{head_ref}` "
        f"· [workflow run]({run_url})"
        f"· {timestamp}_"
    )

    body = (
        f"<!-- screenshots-bot -->\n## PR Screenshots\n\n"
        f"{sections}"
        f"{diff_section}\n\n---\n{footer}\n"
    )

    output_path.write_text(body)


if __name__ == "__main__":
    main()
