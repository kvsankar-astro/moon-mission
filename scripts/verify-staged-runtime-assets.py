#!/usr/bin/env python3
"""Verify staged runtime assets against a runtime-asset-manifest.json file."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify staged runtime assets exist and match manifest checksums.",
    )
    parser.add_argument(
        "--staged-root",
        required=True,
        help="Staged deployment root (for example dist-pages).",
    )
    parser.add_argument(
        "--runtime-manifest",
        required=True,
        help="Path to runtime-asset-manifest.json.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    staged_root = Path(args.staged_root).resolve()
    manifest_path = Path(args.runtime_manifest).resolve()

    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    required_assets = manifest.get("required_assets", [])
    if not isinstance(required_assets, list):
        print("ERROR: invalid manifest shape: required_assets must be a list", file=sys.stderr)
        return 1

    missing: list[str] = []
    checksum_mismatch: list[str] = []
    verified = 0

    for entry in required_assets:
        if not isinstance(entry, dict):
            continue
        rel_path = entry.get("path")
        expected_sha = entry.get("sha256")
        if not isinstance(rel_path, str) or not rel_path:
            continue

        staged_path = staged_root / rel_path
        if not staged_path.exists():
            missing.append(rel_path)
            continue

        if isinstance(expected_sha, str) and expected_sha:
            actual = sha256(staged_path)
            if actual != expected_sha:
                checksum_mismatch.append(f"{rel_path} expected={expected_sha} actual={actual}")
                continue

        verified += 1

    print(f"Verified runtime assets: {verified}")
    print(f"Missing runtime assets: {len(missing)}")
    print(f"Checksum mismatches: {len(checksum_mismatch)}")

    if missing:
        print("Missing assets:", file=sys.stderr)
        for item in missing:
            print(f"  - {item}", file=sys.stderr)

    if checksum_mismatch:
        print("Checksum mismatches:", file=sys.stderr)
        for item in checksum_mismatch:
            print(f"  - {item}", file=sys.stderr)

    if missing or checksum_mismatch:
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
