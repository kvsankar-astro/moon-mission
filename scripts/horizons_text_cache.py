"""Disk-backed cache for JPL HORIZONS text responses."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def get_default_cache_dir(project_root: str | Path) -> Path:
    return Path(project_root) / "data-generated" / "horizons-text-cache"


def _normalize_params(params: dict[str, Any] | None) -> dict[str, str]:
    if not isinstance(params, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in sorted(params.items(), key=lambda item: str(item[0])):
        normalized[str(key)] = "" if value is None else str(value)
    return normalized


def _build_cache_payload(base_url: str, params: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "base_url": str(base_url),
        "params": _normalize_params(params),
    }


def _cache_stem(base_url: str, params: dict[str, Any] | None) -> str:
    payload = _build_cache_payload(base_url, params)
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def cache_paths(
    *,
    base_url: str,
    params: dict[str, Any] | None,
    cache_dir: str | Path,
) -> tuple[Path, Path]:
    root = Path(cache_dir)
    stem = _cache_stem(base_url, params)
    return root / f"{stem}.txt", root / f"{stem}.json"


def read_cached_text(
    *,
    base_url: str,
    params: dict[str, Any] | None,
    cache_dir: str | Path,
) -> str | None:
    text_path, _ = cache_paths(base_url=base_url, params=params, cache_dir=cache_dir)
    if not text_path.exists():
        return None
    return text_path.read_text(encoding="utf-8")


def write_cached_text(
    *,
    base_url: str,
    params: dict[str, Any] | None,
    text: str,
    cache_dir: str | Path,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    text_path, meta_path = cache_paths(base_url=base_url, params=params, cache_dir=cache_dir)
    text_path.parent.mkdir(parents=True, exist_ok=True)
    text_path.write_text(text, encoding="utf-8")

    metadata = _build_cache_payload(base_url, params)
    metadata["cached_at"] = datetime.now(timezone.utc).isoformat()
    metadata["text_length"] = len(text)
    if isinstance(extra_metadata, dict) and extra_metadata:
        metadata.update(extra_metadata)
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
