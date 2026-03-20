#!/usr/bin/env python3
"""Shared ephemeris-manifest helpers for orbit generation/compression scripts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MANIFEST_FORMAT = "ephemeris-manifest"
MANIFEST_VERSION = "1.0"


def normalize_repo_path(path_value: str) -> str:
    return str(path_value).replace("\\", "/")


def _default_tolerance_km(phase_name: str) -> int:
    return 2 if phase_name.startswith("landing") else 5


def _build_phase_entry(*, mission_name: str, phase_name: str, orbits_file: str, tolerance_km: int) -> dict[str, Any]:
    base = Path(orbits_file).name
    return {
        "orbits_file": base,
        "tolerance_km": tolerance_km,
        "artifacts": {
            "npz": {
                "runtime": f"{base}.npz",
                "generated": normalize_repo_path(Path("data-generated") / mission_name / f"{base}.npz"),
            },
            "chebyshev": {
                "runtime": f"{base}-cheb.json",
                "generated": normalize_repo_path(Path("assets") / mission_name / "data" / f"{base}-cheb.json"),
            },
            "meta": {
                "runtime": f"{base}-meta.json",
                "generated": normalize_repo_path(Path("data-generated") / mission_name / f"{base}-meta.json"),
            },
            "json": {
                "runtime": f"{base}.json",
                "generated": normalize_repo_path(Path("data-generated") / mission_name / f"{base}.json"),
            },
        },
    }


def build_default_manifest(mission_name: str, config: dict[str, Any]) -> dict[str, Any]:
    phases: dict[str, Any] = {}
    mnemonic = config.get("spacecraft_mnemonic", "SC")
    configured_phases = config.get("phases", [])

    for phase_name in configured_phases:
        phase_cfg = config.get(phase_name, {})
        if not isinstance(phase_cfg, dict):
            continue
        if not phase_cfg.get("enabled", True):
            continue

        orbits_file = phase_cfg.get("orbits_file", f"{phase_name}-{mnemonic}")
        phases[phase_name] = _build_phase_entry(
            mission_name=mission_name,
            phase_name=phase_name,
            orbits_file=orbits_file,
            tolerance_km=_default_tolerance_km(phase_name),
        )

    landing_cfg = config.get("landing")
    if isinstance(landing_cfg, dict) and landing_cfg.get("enabled", True):
        landing_base = landing_cfg.get("orbits_file", f"landing-{mnemonic}")
        for phase_name, suffix in (("landing-geo", "geo"), ("landing-lunar", "lunar")):
            phases[phase_name] = _build_phase_entry(
                mission_name=mission_name,
                phase_name=phase_name,
                orbits_file=f"{Path(landing_base).name}-{suffix}",
                tolerance_km=2,
            )

    return {
        "format": MANIFEST_FORMAT,
        "version": MANIFEST_VERSION,
        "mission": mission_name,
        "phases": phases,
    }


def _normalize_artifact(artifact_value: Any) -> dict[str, str]:
    if isinstance(artifact_value, str):
        return {"runtime": normalize_repo_path(artifact_value)}
    if isinstance(artifact_value, dict):
        normalized: dict[str, str] = {}
        runtime = artifact_value.get("runtime")
        generated = artifact_value.get("generated")
        if isinstance(runtime, str) and runtime.strip():
            normalized["runtime"] = normalize_repo_path(runtime.strip())
        if isinstance(generated, str) and generated.strip():
            normalized["generated"] = normalize_repo_path(generated.strip())
        return normalized
    return {}


def merge_manifest(existing: dict[str, Any] | None, defaults: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(existing, dict):
        return defaults

    merged = dict(existing)
    merged["format"] = MANIFEST_FORMAT
    merged["version"] = MANIFEST_VERSION
    merged["mission"] = defaults.get("mission")

    existing_phases = existing.get("phases", {})
    if not isinstance(existing_phases, dict):
        existing_phases = {}

    merged_phases: dict[str, Any] = {}
    default_phases = defaults.get("phases", {})

    for phase_name, default_phase in default_phases.items():
        current_phase = existing_phases.get(phase_name, {})
        if not isinstance(current_phase, dict):
            current_phase = {}

        phase_out = dict(current_phase)
        phase_out["orbits_file"] = default_phase.get("orbits_file")
        tolerance_current = current_phase.get("tolerance_km")
        phase_out["tolerance_km"] = (
            tolerance_current if isinstance(tolerance_current, (int, float)) else default_phase.get("tolerance_km")
        )

        current_artifacts = current_phase.get("artifacts", {})
        if not isinstance(current_artifacts, dict):
            current_artifacts = {}

        artifacts_out: dict[str, Any] = {}
        default_artifacts = default_phase.get("artifacts", {})

        for artifact_name, default_artifact in default_artifacts.items():
            normalized_current = _normalize_artifact(current_artifacts.get(artifact_name))
            runtime = normalized_current.get("runtime") or default_artifact.get("runtime")
            generated = normalized_current.get("generated") or default_artifact.get("generated")
            artifacts_out[artifact_name] = {
                "runtime": normalize_repo_path(runtime),
                "generated": normalize_repo_path(generated),
            }

        for artifact_name, artifact_value in current_artifacts.items():
            if artifact_name in artifacts_out:
                continue
            normalized = _normalize_artifact(artifact_value)
            if normalized:
                artifacts_out[artifact_name] = normalized

        phase_out["artifacts"] = artifacts_out
        merged_phases[phase_name] = phase_out

    for phase_name, phase_value in existing_phases.items():
        if phase_name in merged_phases:
            continue
        if isinstance(phase_value, dict):
            merged_phases[phase_name] = phase_value

    merged["phases"] = merged_phases
    return merged


def read_manifest(manifest_path: Path) -> dict[str, Any] | None:
    if not manifest_path.exists():
        return None
    try:
        with open(manifest_path, "r", encoding="utf-8") as handle:
            parsed = json.load(handle)
        return parsed if isinstance(parsed, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def write_manifest(manifest_path: Path, manifest: dict[str, Any]) -> None:
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")


def ensure_manifest_file(*, manifest_path: Path, mission_name: str, config: dict[str, Any]) -> dict[str, Any]:
    defaults = build_default_manifest(mission_name, config)
    existing = read_manifest(manifest_path)
    merged = merge_manifest(existing, defaults)

    existing_serialized = json.dumps(existing, sort_keys=True) if existing is not None else None
    merged_serialized = json.dumps(merged, sort_keys=True)
    if existing_serialized != merged_serialized:
        write_manifest(manifest_path, merged)

    return merged


def resolve_project_path(project_root: Path, path_value: str | None) -> Path | None:
    if not path_value:
        return None
    path_obj = Path(path_value)
    if path_obj.is_absolute():
        return path_obj
    return project_root / path_obj
