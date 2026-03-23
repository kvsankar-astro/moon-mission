#!/usr/bin/env python3
"""
Stage runtime NPZ ephemeris artifacts into a deployment directory.

This script reads per-mission ephemeris manifests from the app repository and
copies all required NPZ runtime artifacts from an external data repository into
the deployment tree.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class RequiredArtifact:
    mission: str
    phase: str
    rel_path: Path


def collect_required_npz(app_root: Path) -> List[RequiredArtifact]:
    assets_root = app_root / "assets"
    required: Dict[str, RequiredArtifact] = {}

    if not assets_root.exists():
        raise FileNotFoundError(f"Assets directory not found: {assets_root}")

    for manifest_path in sorted(assets_root.glob("*/data/ephemeris-manifest.json")):
        mission = manifest_path.parent.parent.name
        with manifest_path.open("r", encoding="utf-8") as handle:
            manifest = json.load(handle)

        phases = manifest.get("phases", {})
        if not isinstance(phases, dict):
            continue
        phase_keys = set(phases.keys())
        has_landing_variants = (
            "landing-geo" in phase_keys or "landing-lunar" in phase_keys
        )

        for phase, phase_cfg in phases.items():
            if not isinstance(phase_cfg, dict):
                continue
            # Runtime loading resolves landing per active config (geo/lunar). When
            # specific landing variants exist, the generic "landing" NPZ is not used.
            if phase == "landing" and has_landing_variants:
                continue
            artifacts = phase_cfg.get("artifacts", {})
            if not isinstance(artifacts, dict):
                continue
            npz_cfg = artifacts.get("npz", {})
            if not isinstance(npz_cfg, dict):
                continue
            runtime = npz_cfg.get("runtime")
            if not isinstance(runtime, str) or not runtime.endswith(".npz"):
                continue

            rel_path = Path("assets") / mission / "data" / runtime
            key = str(rel_path).replace("\\", "/")
            required[key] = RequiredArtifact(
                mission=mission,
                phase=str(phase),
                rel_path=rel_path,
            )

    return sorted(required.values(), key=lambda item: str(item.rel_path))


def build_npz_index(data_root: Path) -> Dict[str, List[Path]]:
    index: Dict[str, List[Path]] = {}
    for npz_path in data_root.rglob("*.npz"):
        index.setdefault(npz_path.name, []).append(npz_path)
    return index


def choose_best_match(
    mission: str,
    artifact_name: str,
    candidates: List[Path],
) -> Path | None:
    if not candidates:
        return None

    mission_tag = f"{Path('/').as_posix()}{mission}{Path('/').as_posix()}"
    mission_candidates = [
        path for path in candidates if mission_tag in path.as_posix()
    ]
    if not mission_candidates:
        return None
    if len(mission_candidates) == 1:
        return mission_candidates[0]

    preferred = [
        path
        for path in mission_candidates
        if f"/assets/{mission}/data/" in path.as_posix()
    ]
    if len(preferred) == 1:
        return preferred[0]

    generated = [
        path
        for path in mission_candidates
        if f"/data-generated/{mission}/" in path.as_posix()
    ]
    if len(generated) == 1:
        return generated[0]

    return None


def resolve_source_path(
    artifact: RequiredArtifact,
    data_root: Path,
    index: Dict[str, List[Path]],
) -> Tuple[Path | None, str]:
    direct = data_root / artifact.rel_path
    if direct.exists():
        return direct, "direct"

    generated = data_root / "data-generated" / artifact.mission / artifact.rel_path.name
    if generated.exists():
        return generated, "generated"

    candidates = index.get(artifact.rel_path.name, [])
    best = choose_best_match(artifact.mission, artifact.rel_path.name, candidates)
    if best is not None:
        return best, "indexed"

    return None, "missing"


def stage_npz(
    app_root: Path,
    data_root: Path,
    dist_root: Path,
) -> int:
    required = collect_required_npz(app_root)
    if not required:
        print("No NPZ artifacts declared in mission manifests.")
        return 0

    if not data_root.exists():
        raise FileNotFoundError(f"Data repository root not found: {data_root}")

    npz_index = build_npz_index(data_root)
    missing: List[str] = []
    copied = 0

    for artifact in required:
        source, mode = resolve_source_path(artifact, data_root, npz_index)
        if source is None:
            missing.append(
                f"{artifact.rel_path.as_posix()} (mission={artifact.mission}, phase={artifact.phase})"
            )
            continue

        target = dist_root / artifact.rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        copied += 1
        print(
            f"Copied {artifact.rel_path.as_posix()} from {source.as_posix()} [{mode}]",
        )

    if missing:
        print("\nMissing required NPZ artifacts:", file=sys.stderr)
        for item in missing:
            print(f"  - {item}", file=sys.stderr)
        raise RuntimeError(
            f"Failed to stage {len(missing)} required NPZ artifact(s).",
        )

    print(f"\nStaged {copied} NPZ artifact(s) into {dist_root.as_posix()}")
    return copied


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage NPZ ephemeris artifacts for deployment")
    parser.add_argument(
        "--app-root",
        default=".",
        help="Path to app repository root (default: .)",
    )
    parser.add_argument(
        "--data-root",
        required=True,
        help="Path to data repository root",
    )
    parser.add_argument(
        "--dist-root",
        required=True,
        help="Path to deployment output root (e.g. dist-pages)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_root = Path(args.app_root).resolve()
    data_root = Path(args.data_root).resolve()
    dist_root = Path(args.dist_root).resolve()

    try:
        stage_npz(
            app_root=app_root,
            data_root=data_root,
            dist_root=dist_root,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
