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
from datetime import datetime, timedelta
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAX_DURATION_DAYS = 92
TERMINAL_EVENT_KEYWORDS = (
    "impact",
    "landing",
    "arrival",
    "insertion",
    "end",
    "deorbit",
    "touchdown",
    "loi",
)

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


def parse_fixed_event_dt(event_def: dict) -> datetime | None:
    if not isinstance(event_def, dict):
        return None
    if event_def.get("startTime") == "dynamic":
        return None
    if event_def.get("kind") in {"now", "data_end"}:
        return None
    raw = event_def.get("startTime")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        # Accept both Z and offset-less ISO forms.
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except ValueError:
        return None


def is_terminal_event(event_key: str, event_def: dict) -> bool:
    key = (event_key or "").lower()
    label = str(event_def.get("label", "")).lower()
    info = str(event_def.get("infoText", "")).lower()
    text = f"{key} {label} {info}"
    return any(word in text for word in TERMINAL_EVENT_KEYWORDS)


def clamp_window_bounds(start_dt: datetime, stop_dt: datetime, max_duration_days: int) -> tuple[datetime, datetime]:
    if stop_dt <= start_dt:
        return start_dt, start_dt
    max_end = start_dt + timedelta(days=max_duration_days)
    return start_dt, min(stop_dt, max_end)


def select_interesting_window(
    section_start: datetime,
    section_stop: datetime,
    events: dict,
    max_duration_days: int,
) -> tuple[datetime, datetime, str]:
    if section_stop <= section_start:
        return section_start, section_start, "degenerate"

    fixed_events: list[tuple[str, datetime]] = []
    terminal_events: list[tuple[str, datetime]] = []
    for event_key, event_def in (events or {}).items():
        event_dt = parse_fixed_event_dt(event_def)
        if event_dt is None:
            continue
        fixed_events.append((event_key, event_dt))
        if is_terminal_event(event_key, event_def):
            terminal_events.append((event_key, event_dt))

    # Strategy 1: around latest terminal milestone (impact/landing/arrival/end).
    if terminal_events:
        _, terminal_dt = max(terminal_events, key=lambda item: item[1])
        window_end = min(section_stop, terminal_dt)
        window_start = max(section_start, window_end - timedelta(days=max_duration_days))
        if window_end <= window_start:
            window_start, window_end = clamp_window_bounds(section_start, section_stop, max_duration_days)
        return window_start, window_end, "terminal"

    # Strategy 2: start from earliest fixed milestone.
    if fixed_events:
        _, earliest_dt = min(fixed_events, key=lambda item: item[1])
        window_start = max(section_start, earliest_dt)
        window_end = min(section_stop, window_start + timedelta(days=max_duration_days))
        if window_end <= window_start:
            window_start, window_end = clamp_window_bounds(section_start, section_stop, max_duration_days)
        return window_start, window_end, "earliest"

    # Fallback: cap from section start.
    window_start, window_end = clamp_window_bounds(section_start, section_stop, max_duration_days)
    return window_start, window_end, "fallback"


def filter_event_order_for_window(config: dict, section_start: datetime, section_stop: datetime) -> bool:
    events = config.get("events") if isinstance(config.get("events"), dict) else {}
    event_configs = config.get("eventConfigs")
    if not isinstance(event_configs, dict):
        return False

    changed = False
    for origin in ("geo", "lunar"):
        order = event_configs.get(origin)
        if not isinstance(order, list):
            continue
        kept: list[str] = []
        for event_key in order:
            event_def = events.get(event_key, {})
            kind = event_def.get("kind")
            if kind in {"now", "data_end"}:
                kept.append(event_key)
                continue
            event_dt = parse_fixed_event_dt(event_def)
            if event_dt is None:
                continue
            if section_start <= event_dt <= section_stop:
                kept.append(event_key)
        if kept != order:
            event_configs[origin] = kept
            changed = True
    return changed


def enforce_interesting_window(mission: str, max_duration_days: int) -> bool:
    config = load_config(mission)
    changed = False
    events = config.get("events") if isinstance(config.get("events"), dict) else {}
    any_start: datetime | None = None
    any_stop: datetime | None = None

    for origin in ("geo", "lunar"):
        section = config.get(origin)
        if not isinstance(section, dict):
            continue

        start_dt = parse_section_datetime(section, "start")
        stop_dt = parse_section_datetime(section, "stop")
        if start_dt is None or stop_dt is None:
            continue

        if stop_dt <= start_dt:
            continue

        duration_days = (stop_dt - start_dt).total_seconds() / 86400.0
        if duration_days <= max_duration_days:
            if any_start is None or start_dt < any_start:
                any_start = start_dt
            if any_stop is None or stop_dt > any_stop:
                any_stop = stop_dt
            continue

        selected_start, selected_stop, strategy = select_interesting_window(
            start_dt,
            stop_dt,
            events,
            max_duration_days=max_duration_days,
        )
        if selected_start != start_dt or selected_stop != stop_dt:
            write_section_datetime(section, "start", selected_start)
            write_section_datetime(section, "stop", selected_stop)
            changed = True
            print(
                f"[{mission}] adjusted {origin} window ({strategy}) from "
                f"{start_dt:%Y-%m-%d %H:%M} -> {stop_dt:%Y-%m-%d %H:%M} "
                f"to {selected_start:%Y-%m-%d %H:%M} -> {selected_stop:%Y-%m-%d %H:%M} "
                f"({duration_days:.2f}d -> {(selected_stop - selected_start).total_seconds()/86400.0:.2f}d)",
            )

        if any_start is None or selected_start < any_start:
            any_start = selected_start
        if any_stop is None or selected_stop > any_stop:
            any_stop = selected_stop

    if any_start is not None and any_stop is not None:
        if filter_event_order_for_window(config, any_start, any_stop):
            changed = True
            print(f"[{mission}] pruned out-of-window event buttons for adjusted timeline window")

    if changed:
        save_config(mission, config)

    return changed


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
    # Config only supports minute precision, so bump to next minute.
    dt = dt.replace(second=0, microsecond=0) + timedelta(minutes=1)
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
    if changed:
        save_config(mission, config)
        print(
            f"[{mission}] adjusted start to {dt.strftime('%Y-%m-%d %H:%M')} in geo/lunar",
        )
    return changed


def output_limit_hit(output: str) -> bool:
    return OUTPUT_LIMIT_RE.search(output) is not None


def double_step_size(mission: str) -> bool:
    config = load_config(mission)
    changed = False
    for origin in ("geo", "lunar"):
        section = config.get(origin)
        if not isinstance(section, dict):
            continue
        current = section.get("step_size_in_seconds")
        if isinstance(current, int) and current > 0:
            section["step_size_in_seconds"] = current * 2
            changed = True
    if changed:
        save_config(mission, config)
        cfg = load_config(mission)
        print(
            f"[{mission}] doubled step_size_in_seconds to geo={cfg['geo']['step_size_in_seconds']}, "
            f"lunar={cfg['lunar']['step_size_in_seconds']}",
        )
    return changed


def run_orbits_with_retry(mission: str, max_retries: int) -> None:
    for attempt in range(1, max_retries + 1):
        code, out = run_cmd([sys.executable, "scripts/orbits.py", "--mission", mission])
        if code == 0:
            # HORIZONS can return a tiny payload that results in zero vectors while still
            # exiting successfully. Treat explicit output-limit warnings as retryable.
            if output_limit_hit(out) and double_step_size(mission):
                print(
                    f"[{mission}] retrying orbits after output-limit warning in successful run "
                    f"(attempt {attempt}/{max_retries})",
                )
                continue
            return

        earliest = parse_no_ephemeris_start(out)
        if earliest is not None and bump_start_to_dt(mission, earliest):
            print(f"[{mission}] retrying orbits after start-time adjustment (attempt {attempt}/{max_retries})")
            continue

        if output_limit_hit(out) and double_step_size(mission):
            print(f"[{mission}] retrying orbits after step-size adjustment (attempt {attempt}/{max_retries})")
            continue

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


def run_full_pipeline(mission: str, max_retries: int, max_duration_days: int) -> None:
    print(f"\n=== {mission} ===")
    enforce_interesting_window(mission, max_duration_days=max_duration_days)
    run_orbits_with_retry(mission, max_retries=max_retries)

    for attempt in range(1, max_retries + 1):
        code, compress_out = run_cmd(
            [sys.executable, "scripts/compress-orbits.py", "--mission", mission],
        )
        if code == 0:
            break
        if "no *_vectors data found" in compress_out and double_step_size(mission):
            print(
                f"[{mission}] compress reported missing vectors; rerunning orbits with larger step "
                f"(attempt {attempt}/{max_retries})",
            )
            run_orbits_with_retry(mission, max_retries=max_retries)
            continue
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
    parser.add_argument(
        "--max-duration-days",
        type=int,
        default=DEFAULT_MAX_DURATION_DAYS,
        help=f"Upper bound for geo/lunar window duration (default: {DEFAULT_MAX_DURATION_DAYS})",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Only apply duration-cap adjustments to config.json and exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    any_capped = False
    for mission in args.missions:
        if args.prepare_only:
            if enforce_interesting_window(mission, max_duration_days=args.max_duration_days):
                any_capped = True
            continue
        run_full_pipeline(
            mission,
            max_retries=args.max_retries,
            max_duration_days=args.max_duration_days,
        )
    if args.prepare_only:
        if any_capped:
            print("\nDuration cap adjustments applied.")
        else:
            print("\nNo duration cap adjustments required.")
        return 0
    print("\nAll requested missions completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
