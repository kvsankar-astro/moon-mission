#!/usr/bin/env python3
"""
Stage runtime mission data assets into a target directory.

Data is sourced from the external moon-mission-data repository and staged into
the target tree using runtime-relative paths:
  - Orbit artifacts under assets/<mission>/data/
  - Shared textures under images/
  - Vendored runtime libraries under third-party/
  - Mission screenshots under assets/<mission>/images/

The script validates required orbit artifacts declared by each mission
ephemeris manifest in the app repository.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


@dataclass(frozen=True)
class RequiredArtifact:
    mission: str
    phase: str
    rel_path: Path
    optional: bool = False


def _norm(path: Path) -> str:
    return path.as_posix()


def _is_orbit_runtime_name(name: str) -> bool:
    return (
        name.endswith(".npz")
        or name.endswith("-cheb.json")
        or name.endswith("-cheb.json.gz")
        or name.endswith("-meta.json")
        or name == "ephemeris-manifest.json"
    )


def collect_required_orbit_artifacts(app_root: Path) -> List[RequiredArtifact]:
    assets_root = app_root / "assets"
    required: Dict[str, RequiredArtifact] = {}
    optional: Dict[str, RequiredArtifact] = {}

    if not assets_root.exists():
        raise FileNotFoundError(f"Assets directory not found: {assets_root}")

    for manifest_path in sorted(assets_root.glob("*/data/ephemeris-manifest.json")):
        mission = manifest_path.parent.parent.name
        rel_manifest = Path("assets") / mission / "data" / "ephemeris-manifest.json"
        required[_norm(rel_manifest)] = RequiredArtifact(
            mission=mission,
            phase="manifest",
            rel_path=rel_manifest,
            optional=False,
        )

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

            artifacts = phase_cfg.get("artifacts", {})
            if not isinstance(artifacts, dict):
                continue

            skip_generic_landing = phase == "landing" and has_landing_variants
            for key in ("npz", "chebyshev", "meta"):
                artifact_cfg = artifacts.get(key, {})
                if not isinstance(artifact_cfg, dict):
                    continue

                runtime_name = artifact_cfg.get("runtime")
                if not isinstance(runtime_name, str) or not _is_orbit_runtime_name(
                    runtime_name,
                ):
                    continue
                if skip_generic_landing:
                    continue

                rel_path = Path("assets") / mission / "data" / runtime_name
                required[_norm(rel_path)] = RequiredArtifact(
                    mission=mission,
                    phase=str(phase),
                    rel_path=rel_path,
                    optional=False,
                )

                # Gzip Chebyshev payload is optional. Runtime falls back to JSON if
                # the compressed variant is unavailable.
                if runtime_name.endswith("-cheb.json"):
                    gzip_rel_path = rel_path.with_name(f"{runtime_name}.gz")
                    optional[_norm(gzip_rel_path)] = RequiredArtifact(
                        mission=mission,
                        phase=str(phase),
                        rel_path=gzip_rel_path,
                        optional=True,
                    )

    merged = list(required.values()) + list(optional.values())
    return sorted(merged, key=lambda item: (item.optional, _norm(item.rel_path)))


def build_runtime_file_index(data_root: Path) -> Dict[str, List[Path]]:
    index: Dict[str, List[Path]] = {}
    for path in data_root.rglob("*"):
        if not path.is_file():
            continue
        if not _is_orbit_runtime_name(path.name):
            continue
        index.setdefault(path.name, []).append(path)
    return index


def choose_best_match(
    mission: str,
    artifact_name: str,
    candidates: List[Path],
) -> Path | None:
    if not candidates:
        return None

    mission_tag = f"/{mission}/"
    mission_candidates = [path for path in candidates if mission_tag in path.as_posix()]
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


def copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def copy_tree_contents(source_root: Path, target_root: Path) -> int:
    copied = 0
    for source in source_root.rglob("*"):
        if not source.is_file():
            continue
        rel = source.relative_to(source_root)
        target = target_root / rel
        copy_file(source, target)
        copied += 1
    return copied


def stage_shared_tree(
    data_root: Path,
    target_root: Path,
    rel_dir: str,
) -> int:
    source_root = data_root / rel_dir
    if not source_root.exists():
        raise FileNotFoundError(
            f"Required shared data directory not found in data repo: {source_root}",
        )
    copied = copy_tree_contents(source_root, target_root / rel_dir)
    print(f"Staged {copied} file(s) from {source_root.as_posix()}")
    return copied


def stage_mission_images(
    data_root: Path,
    target_root: Path,
) -> int:
    copied = 0
    assets_root = data_root / "assets"
    if not assets_root.exists():
        return 0

    for source in assets_root.glob("*/images/**/*"):
        if not source.is_file():
            continue
        rel = source.relative_to(data_root)
        target = target_root / rel
        copy_file(source, target)
        copied += 1

    print(f"Staged {copied} mission image file(s) from data repo assets/")
    return copied


def stage_orbit_artifacts(
    app_root: Path,
    data_root: Path,
    target_root: Path,
) -> Tuple[int, int]:
    required = collect_required_orbit_artifacts(app_root)
    if not required:
        print("No required orbit artifacts declared in mission manifests.")
        return 0, 0

    if not data_root.exists():
        raise FileNotFoundError(f"Data repository root not found: {data_root}")

    runtime_index = build_runtime_file_index(data_root)
    missing: List[str] = []
    copied_required = 0
    copied_optional = 0

    for artifact in required:
        source, mode = resolve_source_path(artifact, data_root, runtime_index)
        if source is None:
            if artifact.optional:
                continue
            missing.append(
                f"{artifact.rel_path.as_posix()} (mission={artifact.mission}, phase={artifact.phase})",
            )
            continue

        target = target_root / artifact.rel_path
        copy_file(source, target)
        if artifact.optional:
            copied_optional += 1
        else:
            copied_required += 1
        print(
            f"Copied {artifact.rel_path.as_posix()} from {source.as_posix()} [{mode}]",
        )

    if missing:
        print("\nMissing required orbit artifacts:", file=sys.stderr)
        for item in missing:
            print(f"  - {item}", file=sys.stderr)
        raise RuntimeError(
            f"Failed to stage {len(missing)} required artifact(s).",
        )

    return copied_required, copied_optional


def stage_runtime_assets(
    app_root: Path,
    data_root: Path,
    target_root: Path,
) -> None:
    copied_required, copied_optional = stage_orbit_artifacts(
        app_root=app_root,
        data_root=data_root,
        target_root=target_root,
    )
    images_count = stage_shared_tree(data_root, target_root, "images")
    third_party_count = stage_shared_tree(data_root, target_root, "third-party")
    mission_images_count = stage_mission_images(data_root, target_root)

    print(
        "\nStaging summary:\n"
        f"  Orbit required: {copied_required}\n"
        f"  Orbit optional: {copied_optional}\n"
        f"  Shared images: {images_count}\n"
        f"  Shared third-party: {third_party_count}\n"
        f"  Mission images: {mission_images_count}\n"
        f"  Target root: {target_root.as_posix()}",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stage runtime mission data assets from moon-mission-data",
    )
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
        "--target-root",
        "--dist-root",
        required=True,
        dest="target_root",
        help="Path to target root (workspace root or deploy output root)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_root = Path(args.app_root).resolve()
    data_root = Path(args.data_root).resolve()
    target_root = Path(args.target_root).resolve()

    try:
        stage_runtime_assets(
            app_root=app_root,
            data_root=data_root,
            target_root=target_root,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
