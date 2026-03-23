#!/usr/bin/env python3
"""Generate deterministic .json.gz companions for Chebyshev ephemeris files."""

from __future__ import annotations

import argparse
import gzip
from pathlib import Path


def gzip_bytes(payload: bytes, compresslevel: int = 9) -> bytes:
    return gzip.compress(payload, compresslevel=compresslevel, mtime=0)


def compress_file(path: Path, *, force: bool = False) -> tuple[bool, int, int]:
    source_bytes = path.read_bytes()
    gz_path = path.with_suffix(f"{path.suffix}.gz")
    gz_bytes = gzip_bytes(source_bytes)

    if not force and gz_path.exists() and gz_path.read_bytes() == gz_bytes:
        return False, len(source_bytes), len(gz_bytes)

    gz_path.write_bytes(gz_bytes)
    return True, len(source_bytes), len(gz_bytes)


def find_cheb_files(root: Path, mission: str | None = None) -> list[Path]:
    if mission:
        search_root = root / mission / "data"
        if not search_root.exists():
            return []
        return sorted(search_root.glob("*-cheb.json"))
    return sorted((root).glob("**/*-cheb.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate gzip companions for *-cheb.json files")
    parser.add_argument("--assets-root", default="assets", help="Assets root path (default: assets)")
    parser.add_argument("--mission", help="Optional mission folder under assets (e.g. chandrayaan3)")
    parser.add_argument("--force", action="store_true", help="Rewrite all gzip outputs")
    args = parser.parse_args()

    assets_root = Path(args.assets_root)
    files = find_cheb_files(assets_root, mission=args.mission)
    if not files:
        print("No *-cheb.json files found.")
        return 0

    wrote_count = 0
    total_raw = 0
    total_gzip = 0

    for path in files:
        wrote, raw_size, gzip_size = compress_file(path, force=args.force)
        status = "WROTE" if wrote else "SKIP "
        savings = 100.0 * (1.0 - (gzip_size / raw_size)) if raw_size else 0.0
        rel = path.as_posix()
        print(f"{status} {rel}.gz ({raw_size} -> {gzip_size} bytes, {savings:.1f}% smaller)")
        if wrote:
            wrote_count += 1
        total_raw += raw_size
        total_gzip += gzip_size

    overall_savings = 100.0 * (1.0 - (total_gzip / total_raw)) if total_raw else 0.0
    print(
        f"Processed {len(files)} files; wrote {wrote_count}. "
        f"Total {total_raw} -> {total_gzip} bytes ({overall_savings:.1f}% smaller).",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
