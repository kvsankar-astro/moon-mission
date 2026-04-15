#!/usr/bin/env python3
"""Audit mission-data ownership across moon-mission and moon-mission-data."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ClassifiedPath:
    rel_path: str
    mission: str
    name: str
    category: str
    tracked: bool


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_rules(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_stage_module(script_path: Path):
    spec = importlib.util.spec_from_file_location("stage_ephemeris_data", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {script_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def resolve_git_executable() -> str:
    git_path = shutil.which("git")
    if git_path:
        return git_path

    if os.name == "nt":
        fallbacks = [
            Path(r"C:\Program Files\Git\cmd\git.exe"),
            Path(r"C:\Program Files\Git\bin\git.exe"),
            Path(r"C:\PROGRA~1\Git\cmd\git.exe"),
            Path(r"C:\PROGRA~1\Git\bin\git.exe"),
        ]
        for candidate in fallbacks:
            if candidate.exists():
                return str(candidate)

    return "git"


def git_tracked_paths(repo_root: Path) -> set[str]:
    result = subprocess.run(
        [resolve_git_executable(), "ls-files"],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return {
        line.strip().replace("\\", "/")
        for line in result.stdout.splitlines()
        if line.strip()
    }


def scan_mission_data_paths(repo_root: Path) -> list[str]:
    assets_root = repo_root / "assets"
    results: list[str] = []
    if not assets_root.exists():
        return results
    for path in assets_root.glob("*/data/*"):
        if path.is_file():
            results.append(path.relative_to(repo_root).as_posix())
    return sorted(results)


def classify_path(rel_path: str, rules: dict[str, Any], tracked: bool) -> ClassifiedPath:
    path = Path(rel_path)
    mission = path.parts[1] if len(path.parts) >= 3 else ""
    name = path.name

    app_only_names = set(rules.get("app_only_names", []))
    mirrored_names = set(rules.get("mirrored_names", []))
    app_only_globs = rules.get("app_only_globs", [])
    data_only_globs = rules.get("data_only_globs", [])

    if name in app_only_names or any(fnmatch.fnmatch(name, pattern) for pattern in app_only_globs):
        category = "app_only"
    elif name in mirrored_names:
        category = "mirrored"
    elif any(fnmatch.fnmatch(name, pattern) for pattern in data_only_globs):
        category = "data_only"
    else:
        category = "unknown"

    return ClassifiedPath(
        rel_path=rel_path,
        mission=mission,
        name=name,
        category=category,
        tracked=tracked,
    )


def summarize_only_in_repo(
    entries: list[ClassifiedPath],
    *,
    expected_categories: set[str],
) -> dict[str, list[str]]:
    by_mission: dict[str, list[str]] = {}
    for entry in entries:
        by_mission.setdefault(entry.mission, []).append(entry.category)

    expected: list[str] = []
    suspicious: list[str] = []
    for mission, categories in sorted(by_mission.items()):
        unique = set(categories)
        if unique.issubset(expected_categories):
            expected.append(mission)
        else:
            suspicious.append(mission)
    return {
        "expected": expected,
        "suspicious": suspicious,
    }


def required_artifact_gaps(app_root: Path, data_root: Path, stage_script: Path) -> dict[str, list[str]]:
    module = load_stage_module(stage_script)
    required = module.collect_required_orbit_artifacts(app_root)
    runtime_index = module.build_runtime_file_index(data_root)

    missing_required: list[str] = []
    missing_optional: list[str] = []

    for artifact in required:
        source, _mode = module.resolve_source_path(artifact, data_root, runtime_index)
        if source is not None:
            continue
        record = f"{artifact.rel_path.as_posix()} (mission={artifact.mission}, phase={artifact.phase})"
        if artifact.optional:
            missing_optional.append(record)
        else:
            missing_required.append(record)

    return {
        "required": missing_required,
        "optional": missing_optional,
    }


def compare_mirrored_files(
    app_root: Path,
    data_root: Path,
    app_entries: list[ClassifiedPath],
    data_entries: list[ClassifiedPath],
) -> dict[str, list[dict[str, Any]]]:
    app_mirrored = {entry.rel_path: entry for entry in app_entries if entry.category == "mirrored"}
    data_mirrored = {entry.rel_path: entry for entry in data_entries if entry.category == "mirrored"}
    all_paths = sorted(set(app_mirrored) | set(data_mirrored))

    matches: list[dict[str, Any]] = []
    mismatches: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []

    for rel_path in all_paths:
        app_entry = app_mirrored.get(rel_path)
        data_entry = data_mirrored.get(rel_path)
        if app_entry is None or data_entry is None:
            missing.append(
                {
                    "path": rel_path,
                    "app_present": app_entry is not None,
                    "data_present": data_entry is not None,
                }
            )
            continue

        app_path = app_root / rel_path
        data_path = data_root / rel_path
        app_sha = sha256(app_path)
        data_sha = sha256(data_path)
        if app_sha == data_sha:
            matches.append({"path": rel_path, "sha256": app_sha})
        else:
            mismatches.append(
                {
                    "path": rel_path,
                    "app_sha256": app_sha,
                    "data_sha256": data_sha,
                }
            )

    return {
        "matches": matches,
        "mismatches": mismatches,
        "missing": missing,
    }


def serialize(entries: list[ClassifiedPath]) -> list[dict[str, Any]]:
    return [
        {
            "path": entry.rel_path,
            "mission": entry.mission,
            "category": entry.category,
            "tracked": entry.tracked,
        }
        for entry in entries
    ]


def build_report(app_root: Path, data_root: Path, rules_path: Path) -> dict[str, Any]:
    rules = load_rules(rules_path)
    app_tracked = git_tracked_paths(app_root)
    data_tracked = git_tracked_paths(data_root)

    app_paths = scan_mission_data_paths(app_root)
    data_paths = scan_mission_data_paths(data_root)

    app_entries = [classify_path(path, rules, path in app_tracked) for path in app_paths]
    data_entries = [classify_path(path, rules, path in data_tracked) for path in data_paths]

    app_only_paths = sorted(set(app_paths) - set(data_paths))
    data_only_paths = sorted(set(data_paths) - set(app_paths))

    app_only_entries = [classify_path(path, rules, path in app_tracked) for path in app_only_paths]
    data_only_entries = [classify_path(path, rules, path in data_tracked) for path in data_only_paths]

    stage_script = app_root / "scripts" / "stage-ephemeris-data.py"
    artifact_gaps = required_artifact_gaps(app_root, data_root, stage_script)
    mirrored = compare_mirrored_files(app_root, data_root, app_entries, data_entries)

    return {
        "app_root": app_root.as_posix(),
        "data_root": data_root.as_posix(),
        "rules_path": rules_path.as_posix(),
        "summary": {
            "app_paths_scanned": len(app_paths),
            "data_paths_scanned": len(data_paths),
            "app_only_paths": len(app_only_paths),
            "data_only_paths": len(data_only_paths),
            "app_data_only_files": sum(1 for entry in app_entries if entry.category == "data_only"),
            "app_data_only_files_tracked": sum(
                1 for entry in app_entries if entry.category == "data_only" and entry.tracked
            ),
            "app_data_only_files_local_only": sum(
                1 for entry in app_entries if entry.category == "data_only" and not entry.tracked
            ),
            "app_unknown_files": sum(1 for entry in app_entries if entry.category == "unknown"),
            "data_app_only_files": sum(1 for entry in data_entries if entry.category == "app_only"),
            "data_only_files_tracked": sum(
                1 for entry in data_entries if entry.category == "data_only" and entry.tracked
            ),
            "data_unknown_files": sum(1 for entry in data_entries if entry.category == "unknown"),
            "mirrored_mismatches": len(mirrored["mismatches"]),
            "missing_required_artifacts": len(artifact_gaps["required"]),
        },
        "app_repo": {
            "data_only_files": serialize([entry for entry in app_entries if entry.category == "data_only"]),
            "unknown_files": serialize([entry for entry in app_entries if entry.category == "unknown"]),
            "only_in_app": serialize(app_only_entries),
            "only_in_app_missions": summarize_only_in_repo(
                app_only_entries,
                expected_categories={"app_only", "mirrored"},
            ),
        },
        "data_repo": {
            "app_only_files": serialize([entry for entry in data_entries if entry.category == "app_only"]),
            "unknown_files": serialize([entry for entry in data_entries if entry.category == "unknown"]),
            "only_in_data": serialize(data_only_entries),
            "only_in_data_missions": summarize_only_in_repo(
                data_only_entries,
                expected_categories={"data_only", "mirrored"},
            ),
        },
        "mirrored_files": mirrored,
        "required_artifacts": artifact_gaps,
    }


def print_section(title: str) -> None:
    print(f"\n{title}")
    print("-" * len(title))


def print_paths(title: str, entries: list[dict[str, Any]], *, limit: int = 20) -> None:
    print_section(title)
    if not entries:
        print("None")
        return
    for entry in entries[:limit]:
        tracked_suffix = ""
        if "tracked" in entry:
            tracked_suffix = " tracked" if entry["tracked"] else " local-only"
        print(f"{entry['path']} [{entry.get('category', 'n/a')}{tracked_suffix}]")
    if len(entries) > limit:
        print(f"... {len(entries) - limit} more")


def print_text_report(report: dict[str, Any]) -> None:
    summary = report["summary"]
    print("Mission-data repo boundary audit")
    print(f"App repo : {report['app_root']}")
    print(f"Data repo: {report['data_root']}")
    print(f"Rules    : {report['rules_path']}")

    print_section("Summary")
    for key, value in summary.items():
        print(f"{key}: {value}")

    print_paths("App repo files that look data-owned", report["app_repo"]["data_only_files"])
    print_paths("App repo unknown files under assets/*/data", report["app_repo"]["unknown_files"])
    print_paths("Data repo files that look app-owned", report["data_repo"]["app_only_files"])
    print_paths("Data repo unknown files under assets/*/data", report["data_repo"]["unknown_files"])
    print_paths("Mirrored file mismatches", report["mirrored_files"]["mismatches"])
    print_paths(
        "Missing required artifacts from data repo",
        [{"path": item} for item in report["required_artifacts"]["required"]],
    )

    print_section("Mission directory asymmetry")
    only_in_app = report["app_repo"]["only_in_app_missions"]
    print(f"Only in app, expected: {', '.join(only_in_app['expected']) or 'None'}")
    print(f"Only in app, suspicious: {', '.join(only_in_app['suspicious']) or 'None'}")
    only_in_data = report["data_repo"]["only_in_data_missions"]
    print(f"Only in data, expected: {', '.join(only_in_data['expected']) or 'None'}")
    print(f"Only in data, suspicious: {', '.join(only_in_data['suspicious']) or 'None'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit mission-data ownership across moon-mission and moon-mission-data.",
    )
    parser.add_argument(
        "--app-root",
        default=".",
        help="Path to the moon-mission app repo root (default: .)",
    )
    parser.add_argument(
        "--data-root",
        default="../moon-mission-data",
        help="Path to the moon-mission-data repo root (default: ../moon-mission-data)",
    )
    parser.add_argument(
        "--rules",
        default="scripts/data-repo-boundary-rules.json",
        help="Path to the boundary rules JSON file",
    )
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Output format",
    )
    parser.add_argument(
        "--fail-on-drift",
        action="store_true",
        help="Exit non-zero when drift or missing artifacts are detected.",
    )
    return parser.parse_args()


def has_drift(report: dict[str, Any]) -> bool:
    return any(
        (
            report["summary"]["app_data_only_files"] > 0,
            report["summary"]["app_unknown_files"] > 0,
            report["summary"]["data_app_only_files"] > 0,
            report["summary"]["data_unknown_files"] > 0,
            report["summary"]["mirrored_mismatches"] > 0,
            report["summary"]["missing_required_artifacts"] > 0,
        )
    )


def main() -> int:
    args = parse_args()
    app_root = Path(args.app_root).resolve()
    data_root = Path(args.data_root).resolve()
    rules_path = Path(args.rules).resolve()

    report = build_report(app_root, data_root, rules_path)
    if args.format == "json":
        json.dump(report, sys.stdout, indent=2)
        print()
    else:
        print_text_report(report)

    if args.fail_on_drift and has_drift(report):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
