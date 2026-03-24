#!/usr/bin/env python3
"""
Write deployment metadata files for a staged static site directory.

Outputs under <output-root>/deployment/:
  - version.json: app/data source revision metadata + artifact summary
  - file-manifest.json: per-file size + SHA-256 for deployed files
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
from pathlib import Path


def git(cwd: Path, *args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()
    except Exception:  # noqa: BLE001
        return ""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.name == ".DS_Store":
            continue
        files.append(path)
    files.sort(key=lambda item: item.as_posix())
    return files


def compute_tree_digest(entries: list[dict]) -> str:
    digest = hashlib.sha256()
    for entry in entries:
        digest.update(entry["path"].encode("utf-8"))
        digest.update(b"\0")
        digest.update(entry["sha256"].encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write deployment metadata JSON files")
    parser.add_argument(
        "--output-root",
        required=True,
        help="Staged deployment root (for example, dist-pages)",
    )
    parser.add_argument(
        "--app-root",
        default=".",
        help="moon-mission app repository root (default: .)",
    )
    parser.add_argument(
        "--data-root",
        default="./mission-data",
        help="moon-mission-data repository root (default: ./mission-data)",
    )
    parser.add_argument(
        "--site-url",
        default="",
        help="Public site base URL for this deployment",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root).resolve()
    app_root = Path(args.app_root).resolve()
    data_root = Path(args.data_root).resolve()

    deployment_dir = output_root / "deployment"
    deployment_dir.mkdir(parents=True, exist_ok=True)

    version_path = deployment_dir / "version.json"
    file_manifest_path = deployment_dir / "file-manifest.json"

    data_runtime_manifest = data_root / "provenance" / "runtime-asset-manifest.json"
    runtime_manifest_sha = sha256_file(data_runtime_manifest) if data_runtime_manifest.exists() else ""

    app_info = {
        "path": app_root.as_posix(),
        "git_commit": git(app_root, "rev-parse", "HEAD"),
        "git_branch": git(app_root, "branch", "--show-current"),
        "git_remote_origin": git(app_root, "remote", "get-url", "origin"),
    }
    data_info = {
        "path": data_root.as_posix(),
        "git_commit": git(data_root, "rev-parse", "HEAD"),
        "git_branch": git(data_root, "branch", "--show-current"),
        "git_remote_origin": git(data_root, "remote", "get-url", "origin"),
        "runtime_asset_manifest_path": "deployment/runtime-asset-manifest.json",
        "runtime_asset_manifest_sha256": runtime_manifest_sha,
    }

    ci_info = {
        "github_workflow": os.getenv("GITHUB_WORKFLOW", ""),
        "github_run_id": os.getenv("GITHUB_RUN_ID", ""),
        "github_run_number": os.getenv("GITHUB_RUN_NUMBER", ""),
        "github_sha": os.getenv("GITHUB_SHA", ""),
        "github_ref": os.getenv("GITHUB_REF", ""),
    }

    version_payload = {
        "schema": "moon-mission-deployment-version",
        "version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "site_url": args.site_url,
        "app_repo": app_info,
        "data_repo": data_info,
        "ci": ci_info,
        "artifacts": {
            "file_manifest_path": "deployment/file-manifest.json",
        },
    }

    with version_path.open("w", encoding="utf-8") as handle:
        json.dump(version_payload, handle, indent=2)
        handle.write("\n")

    # Build file manifest after writing version.json.
    # Exclude file-manifest.json itself to avoid self-referential hash churn.
    entries: list[dict] = []
    total_bytes = 0
    for path in iter_files(output_root):
        rel_path = path.relative_to(output_root).as_posix()
        if rel_path == "deployment/file-manifest.json":
            continue
        size_bytes = path.stat().st_size
        total_bytes += size_bytes
        entries.append(
            {
                "path": rel_path,
                "size_bytes": size_bytes,
                "sha256": sha256_file(path),
            },
        )

    file_manifest_payload = {
        "schema": "moon-mission-deployment-file-manifest",
        "version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "root": output_root.as_posix(),
        "file_count": len(entries),
        "total_bytes": total_bytes,
        "tree_sha256": compute_tree_digest(entries),
        "entries": entries,
    }

    with file_manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(file_manifest_payload, handle, indent=2)
        handle.write("\n")

    print(f"Wrote deployment metadata: {version_path.as_posix()}")
    print(f"Wrote file manifest: {file_manifest_path.as_posix()}")
    print(f"Files: {len(entries)}  Total bytes: {total_bytes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
