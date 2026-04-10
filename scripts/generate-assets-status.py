#!/usr/bin/env python3
"""
Generate assets status JSON for the Assets Status page.

The report is derived from:
  - configured missions in this app repo (assets/*/data/config.json)
  - generated/runtime files in sibling moon-mission-data repo

Scope for now:
  - mission asset granularity: {geo, moon(lunar), relative} x {chebyshev}
  - shared assets: images/** and third-party/** from moon-mission-data
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
from pathlib import Path
from urllib.parse import quote


ORIGIN_PREFIXES = {
    "geo": "geo-",
    "moon": "lunar-",
    "relative": "relative-",
}

SIDECAR_SUFFIXES = (
    "-sun-cheb.json.gz",
    "-moon-cheb.json.gz",
    "-earth-cheb.json.gz",
)


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def git(cwd: Path, *args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()
    except Exception:
        return ""


def as_repo_rel(path: Path, repo_root: Path) -> str:
    return path.relative_to(repo_root).as_posix()


def github_urls(repo_rel: str, repo_slug: str, branch: str) -> dict[str, str]:
    encoded_rel = quote(repo_rel, safe="/-_.~")
    return {
        "blob": f"https://github.com/{repo_slug}/blob/{branch}/{encoded_rel}",
        "raw": f"https://raw.githubusercontent.com/{repo_slug}/{branch}/{encoded_rel}",
    }


def parse_int(value, default: int) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


def parse_iso_datetime(value: str | None) -> dt.datetime | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def parse_legacy_datetime(config: dict, prefix: str) -> dt.datetime | None:
    year_key = f"{prefix}_year"
    month_key = f"{prefix}_month"
    day_key = f"{prefix}_day"
    hour_key = f"{prefix}_hour"
    minute_key = f"{prefix}_minute"
    second_key = f"{prefix}_second"
    if year_key not in config or month_key not in config or day_key not in config:
        return None
    year = parse_int(config.get(year_key), 0)
    month = parse_int(config.get(month_key), 1)
    day = parse_int(config.get(day_key), 1)
    hour = parse_int(config.get(hour_key), 0)
    minute = parse_int(config.get(minute_key), 0)
    second = parse_int(config.get(second_key), 0)
    if year <= 0:
        return None
    try:
        return dt.datetime(year, month, day, hour, minute, second, tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def extract_start_end(config: dict) -> tuple[dt.datetime | None, dt.datetime | None]:
    start_iso = parse_iso_datetime(config.get("startTime") or config.get("start_time"))
    end_iso = parse_iso_datetime(config.get("endTime") or config.get("end_time"))
    start_legacy = parse_legacy_datetime(config, "start")
    end_legacy = parse_legacy_datetime(config, "stop")
    start = start_iso or start_legacy
    end = end_iso or end_legacy
    return start, end


def compute_mission_data_span(config: dict) -> dict | None:
    starts: list[dt.datetime] = []
    ends: list[dt.datetime] = []

    for origin_key in ("geo", "lunar", "relative"):
        origin_cfg = config.get(origin_key)
        if isinstance(origin_cfg, dict):
            start, end = extract_start_end(origin_cfg)
            if start:
                starts.append(start)
            if end:
                ends.append(end)

    crafts = config.get("crafts")
    if isinstance(crafts, list):
        for craft in crafts:
            if not isinstance(craft, dict):
                continue
            spans = craft.get("spans")
            if isinstance(spans, dict):
                for origin_key in ("geo", "lunar", "relative"):
                    span_cfg = spans.get(origin_key)
                    if not isinstance(span_cfg, dict):
                        continue
                    start, end = extract_start_end(span_cfg)
                    if start:
                        starts.append(start)
                    if end:
                        ends.append(end)

    if not starts or not ends:
        return None

    start = min(starts)
    end = max(ends)
    duration_seconds = (end - start).total_seconds()
    duration_days = duration_seconds / 86400.0
    if duration_days < 0:
        return None

    return {
        "startUtc": start.isoformat().replace("+00:00", "Z"),
        "endUtc": end.isoformat().replace("+00:00", "Z"),
        "durationDays": duration_days,
    }


def is_primary_compressed_chebyshev(name: str) -> bool:
    if not name.endswith("-cheb.json.gz"):
        return False
    for suffix in SIDECAR_SUFFIXES:
        if name.endswith(suffix):
            return False
    return True


def collect_primary_compressed_cheb_files_for_origin(data_dir: Path, origin_key: str) -> list[Path]:
    prefix = ORIGIN_PREFIXES[origin_key]
    files: list[Path] = []
    if not data_dir.exists():
        return files
    for path in sorted(data_dir.iterdir()):
        if not path.is_file():
            continue
        name = path.name.lower()
        if not name.startswith(prefix):
            continue
        if not is_primary_compressed_chebyshev(name):
            continue
        files.append(path)
    return files


def file_entry(path: Path, repo_root: Path, repo_slug: str, branch: str) -> dict:
    repo_rel = as_repo_rel(path, repo_root)
    urls = github_urls(repo_rel, repo_slug, branch)
    return {
        "path": repo_rel,
        "name": path.name,
        "sizeBytes": path.stat().st_size,
        "urls": urls,
    }


def collect_configured_missions(app_root: Path) -> list[dict]:
    missions: list[dict] = []
    for config_path in sorted(app_root.glob("assets/*/data/config.json")):
        mission_folder = config_path.parent.parent.name
        config = read_json(config_path)
        mission_name = (
            str(config.get("mission_name") or "").strip()
            or str(config.get("mission_name_short") or "").strip()
            or mission_folder
        )
        missions.append(
            {
                "folder": mission_folder,
                "name": mission_name,
                "configPath": config_path,
                "config": config,
            }
        )
    return missions


def summarize_files(files: list[dict]) -> dict:
    total_bytes = sum(item["sizeBytes"] for item in files)
    return {
        "fileCount": len(files),
        "totalBytes": total_bytes,
        "files": files,
    }


def build_mission_entries(
    app_root: Path,
    data_root: Path,
    data_repo_slug: str,
    data_branch: str,
) -> list[dict]:
    missions = collect_configured_missions(app_root)
    entries: list[dict] = []
    for mission in missions:
        folder = mission["folder"]
        mission_data_dir = data_root / "assets" / folder / "data"
        mission_config = mission["config"]
        data_span = compute_mission_data_span(mission_config)
        origins: dict[str, dict] = {}
        mission_total_bytes = 0
        mission_total_files = 0

        for origin_key in ("geo", "moon", "relative"):
            cheb_files = collect_primary_compressed_cheb_files_for_origin(mission_data_dir, origin_key)
            file_entries = [
                file_entry(path, data_root, data_repo_slug, data_branch)
                for path in cheb_files
            ]
            origin_summary = summarize_files(file_entries)
            origins[origin_key] = origin_summary
            mission_total_bytes += origin_summary["totalBytes"]
            mission_total_files += origin_summary["fileCount"]

        bytes_per_day = None
        if data_span and data_span["durationDays"] > 0:
            bytes_per_day = mission_total_bytes / data_span["durationDays"]

        entries.append(
            {
                "missionFolder": folder,
                "missionName": mission["name"],
                "hasDataDir": mission_data_dir.exists(),
                "dataSpan": data_span,
                "totals": {
                    "chebyshevFiles": mission_total_files,
                    "chebyshevBytes": mission_total_bytes,
                    "chebyshevBytesPerDay": bytes_per_day,
                },
                "origins": origins,
            }
        )

    return entries


def collect_shared_assets(
    data_root: Path,
    data_repo_slug: str,
    data_branch: str,
) -> dict:
    groups_spec = [
        ("images", "Shared Images / Textures", data_root / "images"),
        ("third-party", "Third-party Runtime Assets", data_root / "third-party"),
    ]
    groups = []
    grand_total_bytes = 0
    grand_total_files = 0

    for key, label, group_root in groups_spec:
        files: list[dict] = []
        if group_root.exists():
            for path in sorted(group_root.rglob("*")):
                if not path.is_file():
                    continue
                files.append(file_entry(path, data_root, data_repo_slug, data_branch))
        summary = summarize_files(files)
        grand_total_bytes += summary["totalBytes"]
        grand_total_files += summary["fileCount"]
        groups.append(
            {
                "key": key,
                "label": label,
                "fileCount": summary["fileCount"],
                "totalBytes": summary["totalBytes"],
                "files": summary["files"],
            }
        )

    return {
        "fileCount": grand_total_files,
        "totalBytes": grand_total_bytes,
        "groups": groups,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate assets status JSON")
    parser.add_argument(
        "--app-root",
        default=".",
        help="moon-mission app repository root",
    )
    parser.add_argument(
        "--data-root",
        default="../moon-mission-data",
        help="moon-mission-data repository root",
    )
    parser.add_argument(
        "--data-repo-slug",
        default="kvsankar-astro/moon-mission-data",
        help="GitHub repo slug for moon-mission-data links",
    )
    parser.add_argument(
        "--data-branch",
        default="main",
        help="GitHub branch name for moon-mission-data links",
    )
    parser.add_argument(
        "--output",
        default="assets/assets-status.json",
        help="Output JSON path relative to app root unless absolute",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_root = Path(args.app_root).resolve()
    data_root = Path(args.data_root).resolve()
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = (app_root / output_path).resolve()

    mission_entries = build_mission_entries(
        app_root=app_root,
        data_root=data_root,
        data_repo_slug=args.data_repo_slug,
        data_branch=args.data_branch,
    )
    shared_assets = collect_shared_assets(
        data_root=data_root,
        data_repo_slug=args.data_repo_slug,
        data_branch=args.data_branch,
    )

    total_cheb_files = sum(item["totals"]["chebyshevFiles"] for item in mission_entries)
    total_cheb_bytes = sum(item["totals"]["chebyshevBytes"] for item in mission_entries)

    payload = {
        "schema": "moon-mission-assets-status",
        "version": 1,
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sources": {
            "appRepo": {
                "path": app_root.as_posix(),
                "gitCommit": git(app_root, "rev-parse", "HEAD"),
                "gitBranch": git(app_root, "branch", "--show-current"),
            },
            "dataRepo": {
                "path": data_root.as_posix(),
                "gitCommit": git(data_root, "rev-parse", "HEAD"),
                "gitBranch": git(data_root, "branch", "--show-current"),
                "githubRepo": args.data_repo_slug,
                "githubBranch": args.data_branch,
                "githubUrl": f"https://github.com/{args.data_repo_slug}",
            },
        },
        "totals": {
            "missionCount": len(mission_entries),
            "chebyshevFileCount": total_cheb_files,
            "chebyshevBytes": total_cheb_bytes,
            "sharedFileCount": shared_assets["fileCount"],
            "sharedBytes": shared_assets["totalBytes"],
        },
        "missions": mission_entries,
        "sharedAssets": shared_assets,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    print(f"Wrote assets status JSON: {output_path.as_posix()}")
    print(f"Missions: {len(mission_entries)}")
    print(f"Chebyshev files: {total_cheb_files}")
    print(f"Shared files: {shared_assets['fileCount']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
