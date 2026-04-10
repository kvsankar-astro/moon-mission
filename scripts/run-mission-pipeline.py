#!/usr/bin/env python3
"""Run mission data pipeline with auto-retry for common HORIZONS constraints."""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
NO_EPHEMERIS_RE = re.compile(
    r'No ephemeris for target ".*?" prior to A\.D\. (\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)',
)
OUTPUT_LIMIT_RE = re.compile(
    r"Projected output length \(~(\d+)\) exceeds (\d+) line max -- change step-size",
)
MONTH_MAP = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


def run_cmd(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(
        cmd,
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    print(f"$ {' '.join(cmd)}")
    if out:
        print(out)
    return proc.returncode, out


def config_path_for_mission(mission: str) -> Path:
    return PROJECT_ROOT / "assets" / mission / "data" / "config.json"


def load_config(mission: str) -> dict:
    path = config_path_for_mission(mission)
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_config(mission: str, config: dict) -> None:
    path = config_path_for_mission(mission)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")


def parse_section_datetime(section: dict, prefix: str) -> datetime | None:
    exact_key = "startTime" if prefix == "start" else "endTime"
    exact_value = section.get(exact_key)
    if isinstance(exact_value, str) and exact_value.strip():
        text = exact_value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            pass
    try:
        return datetime(
            int(section[f"{prefix}_year"]),
            int(section[f"{prefix}_month"]),
            int(section[f"{prefix}_day"]),
            int(section[f"{prefix}_hour"]),
            int(section[f"{prefix}_minute"]),
        )
    except Exception:
        return None


def write_section_datetime(section: dict, prefix: str, dt: datetime) -> None:
    section[f"{prefix}_year"] = f"{dt.year:04d}"
    section[f"{prefix}_month"] = f"{dt.month:02d}"
    section[f"{prefix}_day"] = f"{dt.day:02d}"
    section[f"{prefix}_hour"] = f"{dt.hour:02d}"
    section[f"{prefix}_minute"] = f"{dt.minute:02d}"


def parse_no_ephemeris_start(output: str) -> datetime | None:
    match = NO_EPHEMERIS_RE.search(output)
    if not match:
        return None
    year, month, day, hour, minute, sec = match.groups()
    month_num = MONTH_MAP.get(month.upper())
    if month_num is None:
        return None
    sec_float = float(sec)
    sec_int = int(math.floor(sec_float))
    dt = datetime(
        int(year),
        month_num,
        int(day),
        int(hour),
        int(minute),
        sec_int,
    )
    dt = dt.replace(microsecond=0) + timedelta(seconds=1)
    return dt


def bump_start_to_dt(mission: str, dt: datetime) -> bool:
    config = load_config(mission)
    changed = False
    for origin in ("geo", "lunar"):
        section = config.get(origin)
        if not isinstance(section, dict):
            continue
        new_values = {
            "start_year": f"{dt.year:04d}",
            "start_month": f"{dt.month:02d}",
            "start_day": f"{dt.day:02d}",
            "start_hour": f"{dt.hour:02d}",
            "start_minute": f"{dt.minute:02d}",
        }
        for key, value in new_values.items():
            if section.get(key) != value:
                section[key] = value
                changed = True
        exact_iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        if section.get("startTime") != exact_iso:
            section["startTime"] = exact_iso
            changed = True
    if changed:
        save_config(mission, config)
        print(
            f"[{mission}] adjusted start to {dt.strftime('%Y-%m-%d %H:%M:%S')} in geo/lunar",
        )
    return changed


def output_limit_hit(output: str) -> bool:
    return OUTPUT_LIMIT_RE.search(output) is not None


def run_orbits_with_retry(mission: str, max_retries: int) -> None:
    for attempt in range(1, max_retries + 1):
        code, out = run_cmd([sys.executable, "scripts/orbits.py", "--mission", mission])
        if code == 0:
            if output_limit_hit(out):
                raise RuntimeError(
                    f"[{mission}] HORIZONS reported output-length limits at 60 s sampling. "
                    "Keep 60 s fidelity and resolve by narrowing the time window or splitting phases.",
                )
            return

        earliest = parse_no_ephemeris_start(out)
        if earliest is not None and bump_start_to_dt(mission, earliest):
            print(f"[{mission}] retrying orbits after start-time adjustment (attempt {attempt}/{max_retries})")
            continue

        if output_limit_hit(out):
            raise RuntimeError(
                f"[{mission}] HORIZONS output exceeds limits at 60 s sampling. "
                "Do not coarsen cadence automatically; narrow the requested window or split the data run.",
            )

        # HORIZONS intermittently returns HTTP 503/timeout errors; treat as retryable.
        if "503 Server Error" in out or "HTTP request failed" in out or "Request timed out" in out:
            wait_seconds = min(60, 5 * attempt)
            print(
                f"[{mission}] transient HORIZONS error, retrying after {wait_seconds}s "
                f"(attempt {attempt}/{max_retries})",
            )
            time.sleep(wait_seconds)
            continue

        raise RuntimeError(f"[{mission}] orbits.py failed with non-recoverable error")

    raise RuntimeError(f"[{mission}] orbits.py exceeded retry limit")


def run_full_pipeline(mission: str, max_retries: int) -> None:
    print(f"\n=== {mission} ===")
    run_orbits_with_retry(mission, max_retries=max_retries)

    config = load_config(mission)
    post_horizon_extension = config.get("postHorizonExtension")
    if isinstance(post_horizon_extension, dict) and post_horizon_extension.get("enabled", True):
        code, _ = run_cmd(
            [sys.executable, "scripts/extend-post-horizons-trajectory.py", "--mission", mission],
        )
        if code != 0:
            raise RuntimeError(f"[{mission}] extend-post-horizons-trajectory.py failed")

    for attempt in range(1, max_retries + 1):
        code, compress_out = run_cmd(
            [sys.executable, "scripts/compress-orbits.py", "--mission", mission],
        )
        if code == 0:
            break
        raise RuntimeError(f"[{mission}] compress-orbits.py failed")
    else:
        raise RuntimeError(f"[{mission}] compress-orbits.py exceeded retry limit")

    code, _ = run_cmd(
        [sys.executable, "scripts/generate-relative-orbits.py", "--mission", mission, "--force"],
    )
    if code != 0:
        raise RuntimeError(f"[{mission}] generate-relative-orbits.py failed")

    code, _ = run_cmd(
        [sys.executable, "scripts/compress-chebyshev-gzip.py", "--mission", mission, "--force"],
    )
    if code != 0:
        raise RuntimeError(f"[{mission}] compress-chebyshev-gzip.py failed")

    print(f"[{mission}] complete")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run mission pipeline for one or more missions")
    parser.add_argument("--missions", nargs="+", required=True, help="Mission folder names under assets/")
    parser.add_argument("--max-retries", type=int, default=6)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    for mission in args.missions:
        run_full_pipeline(
            mission,
            max_retries=args.max_retries,
        )
    print("\nAll requested missions completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
