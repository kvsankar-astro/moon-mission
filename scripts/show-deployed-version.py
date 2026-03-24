#!/usr/bin/env python3
"""Show deployed app/data revisions from deployment/version.json."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Show deployed version metadata")
    parser.add_argument(
        "--url",
        default="https://sankara.net/astro/lunar-missions/deployment/version.json",
        help="Full URL to deployment/version.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        with urllib.request.urlopen(args.url, timeout=20) as response:
            payload = json.load(response)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: failed to load {args.url}: {exc}", file=sys.stderr)
        return 1

    app = payload.get("app_repo", {})
    data = payload.get("data_repo", {})
    ci = payload.get("ci", {})

    print(f"URL: {args.url}")
    print(f"App commit: {app.get('git_commit', 'unknown')}")
    print(f"App branch: {app.get('git_branch', 'unknown')}")
    print(f"Data commit: {data.get('git_commit', 'unknown')}")
    print(f"Data branch: {data.get('git_branch', 'unknown')}")
    print(f"Generated at: {payload.get('generated_at_utc', 'unknown')}")
    if ci:
        print(f"CI run: {ci.get('github_workflow', '')} #{ci.get('github_run_number', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
