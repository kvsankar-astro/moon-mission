#!/usr/bin/env python3
"""Audit mission-data ownership across moon-mission and moon-mission-data."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import importlib.util
import json
import os
import re
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


CHEB_METADATA_SCAN_BYTES = 128 * 1024
NON_CRAFT_BODIES = {"SUN", "EARTH", "MOON", "FRAME_ROT"}
ORIGIN_REQUIREMENTS = {
    "geo": {
        "required_bodies": {"SUN", "MOON"},
        "forbidden_bodies": {"EARTH"},
        "require_frame_rot": False,
        "require_relative_npz": False,
    },
    "lunar": {
        "required_bodies": {"SUN", "EARTH"},
        "forbidden_bodies": {"MOON"},
        "require_frame_rot": False,
        "require_relative_npz": False,
    },
    "relative": {
        "required_bodies": {"SUN", "MOON"},
        "forbidden_bodies": {"EARTH"},
        "require_frame_rot": True,
        "require_relative_npz": True,
    },
}
DEFAULT_THUMBNAIL_BASE_PATH = "../media/thumbnails"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_rules(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_json(path: Path) -> Any:
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


def is_path_within(child_path: Path, parent_path: Path) -> bool:
    try:
        child_path.relative_to(parent_path)
        return True
    except ValueError:
        return False


def scan_mission_data_paths(repo_root: Path) -> list[str]:
    assets_root = repo_root / "assets"
    results: list[str] = []
    if not assets_root.exists():
        return results
    for path in assets_root.glob("*/data/*"):
        if path.is_file():
            results.append(path.relative_to(repo_root).as_posix())
    return sorted(results)


def load_active_mission_folders(app_root: Path) -> set[str]:
    catalog_path = app_root / "assets" / "mission-catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Mission catalog not found: {catalog_path}")

    catalog = load_json(catalog_path)
    missions = catalog.get("missions", [])
    if not isinstance(missions, list):
        raise ValueError(f"Mission catalog has invalid missions list: {catalog_path}")

    folders: set[str] = set()
    for mission in missions:
        if not isinstance(mission, dict):
            continue
        folder = mission.get("folder")
        if isinstance(folder, str) and folder.strip():
            folders.add(folder.strip())
    return folders


def extract_cheb_bodies(path: Path) -> set[str]:
    with path.open("r", encoding="utf-8") as handle:
        head = handle.read(CHEB_METADATA_SCAN_BYTES)

    match = re.search(r'"bodies"\s*:\s*\[(.*?)\]', head, flags=re.DOTALL)
    if match:
        try:
            raw = json.loads(f"[{match.group(1)}]")
            return {
                body.strip()
                for body in raw
                if isinstance(body, str) and body.strip()
            }
        except json.JSONDecodeError:
            pass

    data = load_json(path)
    metadata = data.get("metadata", {}) if isinstance(data, dict) else {}
    raw = metadata.get("bodies", []) if isinstance(metadata, dict) else []
    if not isinstance(raw, list):
        return set()
    return {
        body.strip()
        for body in raw
        if isinstance(body, str) and body.strip()
    }


def audit_origin_artifact_integrity(app_root: Path, data_root: Path) -> dict[str, Any]:
    active_missions = load_active_mission_folders(app_root)
    issues: list[dict[str, Any]] = []

    for mission in sorted(active_missions):
        data_dir = data_root / "assets" / mission / "data"
        for origin, rule in ORIGIN_REQUIREMENTS.items():
            cheb_paths = sorted(data_dir.glob(f"{origin}-*-cheb.json"))
            if not cheb_paths:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-chebyshev",
                        "detail": f"No {origin}-*-cheb.json files found",
                    }
                )
                continue

            missing_gzip = [
                path.name
                for path in cheb_paths
                if not path.with_name(f"{path.name}.gz").exists()
            ]
            if missing_gzip:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-compressed-chebyshev",
                        "detail": ", ".join(missing_gzip),
                    }
                )

            if rule["require_relative_npz"]:
                npz_paths = sorted(data_dir.glob("relative-*.npz"))
                if not npz_paths:
                    issues.append(
                        {
                            "mission": mission,
                            "origin": origin,
                            "kind": "missing-relative-npz",
                            "detail": "No relative-*.npz files found",
                        }
                    )

            bodies: set[str] = set()
            missing_body_metadata: list[str] = []
            for path in cheb_paths:
                file_bodies = extract_cheb_bodies(path)
                if not file_bodies and path.name.endswith("-sun-cheb.json"):
                    file_bodies = {"SUN"}
                if not file_bodies:
                    missing_body_metadata.append(path.name)
                    continue
                bodies.update(file_bodies)

            if missing_body_metadata and not bodies:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-body-metadata",
                        "detail": ", ".join(missing_body_metadata),
                    }
                )
                continue

            missing_required = sorted(rule["required_bodies"] - bodies)
            if missing_required:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-required-bodies",
                        "detail": ", ".join(missing_required),
                    }
                )

            forbidden_bodies = sorted(rule["forbidden_bodies"] & bodies)
            if forbidden_bodies:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "contains-origin-degenerate-body",
                        "detail": ", ".join(forbidden_bodies),
                    }
                )

            if rule["require_frame_rot"] and "FRAME_ROT" not in bodies:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-frame-rot",
                        "detail": "FRAME_ROT",
                    }
                )

            craft_bodies = sorted(bodies - NON_CRAFT_BODIES)
            if not craft_bodies:
                issues.append(
                    {
                        "mission": mission,
                        "origin": origin,
                        "kind": "missing-craft-bodies",
                        "detail": "No craft-like bodies found",
                    }
                )

    return {
        "missions_checked": len(active_missions),
        "issues": issues,
    }


def audit_media_thumbnail_derivatives(
    app_root: Path,
    data_root: Path,
    data_tracked: set[str],
) -> dict[str, Any]:
    active_missions = load_active_mission_folders(app_root)
    issues: list[dict[str, Any]] = []

    for mission in sorted(active_missions):
        manifest_path = app_root / "assets" / mission / "data" / "media-manifest.json"
        if not manifest_path.exists():
            continue
        manifest = load_json(manifest_path)
        thumbnails = manifest.get("thumbnails") if isinstance(manifest, dict) else None
        if not isinstance(thumbnails, dict):
            continue

        base_path = thumbnails.get("basePath")
        if not isinstance(base_path, str) or not base_path.strip():
            base_path = DEFAULT_THUMBNAIL_BASE_PATH

        mission_root = (data_root / "assets" / mission).resolve()
        thumbnail_root = (mission_root / "data" / base_path).resolve()
        if not is_path_within(thumbnail_root, mission_root):
            issues.append(
                {
                    "mission": mission,
                    "kind": "thumbnail-path-escapes-mission",
                    "path": base_path,
                    "detail": "Thumbnail basePath resolves outside the mission folder",
                }
            )
            continue

        rel_root = thumbnail_root.relative_to(data_root).as_posix()
        if not thumbnail_root.exists():
            issues.append(
                {
                    "mission": mission,
                    "kind": "missing-thumbnail-root",
                    "path": rel_root,
                    "detail": "Manifest declares generated thumbnails but the data repo has no thumbnail directory",
                }
            )
            continue

        thumbnail_files = sorted(path for path in thumbnail_root.rglob("*") if path.is_file())
        if not thumbnail_files:
            issues.append(
                {
                    "mission": mission,
                    "kind": "empty-thumbnail-root",
                    "path": rel_root,
                    "detail": "Manifest declares generated thumbnails but the thumbnail directory is empty",
                }
            )
            continue

        untracked = [
            path.relative_to(data_root).as_posix()
            for path in thumbnail_files
            if path.relative_to(data_root).as_posix() not in data_tracked
        ]
        if untracked:
            issues.append(
                {
                    "mission": mission,
                    "kind": "untracked-media-thumbnails",
                    "path": rel_root,
                    "detail": f"{len(untracked)} thumbnail file(s) are not tracked in the data repo",
                    "samples": untracked[:5],
                }
            )

    return {
        "missions_checked": len(active_missions),
        "issues": issues,
    }


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
    origin_integrity = audit_origin_artifact_integrity(app_root, data_root)
    media_thumbnails = audit_media_thumbnail_derivatives(app_root, data_root, data_tracked)

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
            "origin_integrity_issues": len(origin_integrity["issues"]),
            "media_thumbnail_issues": len(media_thumbnails["issues"]),
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
        "origin_integrity": origin_integrity,
        "media_thumbnails": media_thumbnails,
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
    print_paths(
        "Origin/body integrity issues",
        [
            {
                "path": (
                    f"{item['mission']}[{item['origin']}] "
                    f"{item['kind']}: {item['detail']}"
                )
            }
            for item in report["origin_integrity"]["issues"]
        ],
    )
    print_paths(
        "Media thumbnail derivative issues",
        [
            {
                "path": (
                    f"{item['mission']} {item['kind']}: "
                    f"{item.get('path', '')} ({item.get('detail', '')})"
                )
            }
            for item in report["media_thumbnails"]["issues"]
        ],
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
            report["summary"]["origin_integrity_issues"] > 0,
            report["summary"]["media_thumbnail_issues"] > 0,
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
