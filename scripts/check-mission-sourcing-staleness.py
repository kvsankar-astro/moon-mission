#!/usr/bin/env python3
"""
Check staleness between docs/mission-sourcing/*.md and assets/*/data/config.json.

Current checks (where present in docs):
  - Orbit data start
  - Orbit data end
  - Sampling step

This is intentionally conservative and does not fail on missing fields.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs" / "mission-sourcing"
ASSETS_DIR = ROOT / "assets"

KV_LINE = re.compile(r"^\s*-\s*([^:]+):\s*(.+)\s*$")


def parse_doc_timestamp(value: str) -> dt.datetime | None:
    text = value.strip().strip("`")
    text = text.replace(" UTC", "").replace("UTC", "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return dt.datetime.strptime(text, fmt).replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
    return None


def parse_config_span(config: dict, origin_key: str = "geo") -> tuple[dt.datetime | None, dt.datetime | None]:
    origin = config.get(origin_key)
    if not isinstance(origin, dict):
        return None, None

    start_iso = origin.get("startTime") or origin.get("start_time")
    end_iso = origin.get("endTime") or origin.get("end_time")
    if isinstance(start_iso, str) and isinstance(end_iso, str):
        try:
            start = dt.datetime.fromisoformat(start_iso.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
            end = dt.datetime.fromisoformat(end_iso.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
            return start, end
        except ValueError:
            pass

    # legacy numeric fields
    try:
        start = dt.datetime(
            int(origin["start_year"]),
            int(origin["start_month"]),
            int(origin["start_day"]),
            int(origin.get("start_hour", 0)),
            int(origin.get("start_minute", 0)),
            tzinfo=dt.timezone.utc,
        )
        end = dt.datetime(
            int(origin["stop_year"]),
            int(origin["stop_month"]),
            int(origin["stop_day"]),
            int(origin.get("stop_hour", 0)),
            int(origin.get("stop_minute", 0)),
            tzinfo=dt.timezone.utc,
        )
        return start, end
    except Exception:
        return None, None


def parse_doc_fields(doc_text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in doc_text.splitlines():
        match = KV_LINE.match(line)
        if match:
            fields[match.group(1).strip()] = match.group(2).strip()
    return fields


def main() -> int:
    docs = sorted(p for p in DOCS_DIR.glob("*.md") if p.stem != "horizons-worker-playbook")
    if not docs:
        print("No mission-sourcing docs found.")
        return 0

    mismatches: list[str] = []
    checked = 0

    for doc_path in docs:
        cfg_path = ASSETS_DIR / doc_path.stem / "data" / "config.json"
        if not cfg_path.exists():
            mismatches.append(f"{doc_path.relative_to(ROOT)}: missing matching config.json at {cfg_path.relative_to(ROOT)}")
            continue

        config = json.loads(cfg_path.read_text(encoding="utf-8"))
        fields = parse_doc_fields(doc_path.read_text(encoding="utf-8"))
        cfg_start, cfg_end = parse_config_span(config, "geo")
        cfg_step = config.get("geo", {}).get("step_size_in_seconds")
        checked += 1

        doc_start = parse_doc_timestamp(fields.get("Orbit data start", "")) if "Orbit data start" in fields else None
        doc_end = parse_doc_timestamp(fields.get("Orbit data end", "")) if "Orbit data end" in fields else None
        doc_step = None
        if "Sampling step" in fields:
            step_match = re.search(r"(\d+)", fields["Sampling step"])
            if step_match:
                doc_step = int(step_match.group(1))

        if doc_start and cfg_start and doc_start != cfg_start:
            mismatches.append(
                f"{doc_path.relative_to(ROOT)}: Orbit data start mismatch (doc={doc_start.isoformat()} cfg={cfg_start.isoformat()})"
            )
        if doc_end and cfg_end and doc_end != cfg_end:
            mismatches.append(
                f"{doc_path.relative_to(ROOT)}: Orbit data end mismatch (doc={doc_end.isoformat()} cfg={cfg_end.isoformat()})"
            )
        if doc_step is not None and isinstance(cfg_step, int) and doc_step != cfg_step:
            mismatches.append(
                f"{doc_path.relative_to(ROOT)}: Sampling step mismatch (doc={doc_step} cfg={cfg_step})"
            )

    print(f"Mission docs checked: {checked}")
    if mismatches:
        print(f"Potential staleness mismatches: {len(mismatches)}")
        for item in mismatches:
            print(f"- {item}")
        return 1

    print("No staleness mismatches detected for checked fields.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
