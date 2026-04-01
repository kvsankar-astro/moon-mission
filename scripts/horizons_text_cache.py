"""Disk-backed cache for JPL HORIZONS text responses."""

from __future__ import annotations

import hashlib
import json
import re
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


def _normalize_params_without_keys(
    params: dict[str, Any] | None,
    excluded_keys: set[str] | None = None,
) -> dict[str, str]:
    normalized = _normalize_params(params)
    if not excluded_keys:
        return normalized
    return {
        key: value
        for key, value in normalized.items()
        if key not in excluded_keys
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


def cache_stem(
    *,
    base_url: str,
    params: dict[str, Any] | None,
) -> str:
    return _cache_stem(base_url, params)


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


def _parse_request_time(value: str | None) -> datetime | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().strip("'").strip('"')
    if not normalized:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def _parse_response_calendar_date(value: str) -> datetime | None:
    cleaned = value.strip()
    for prefix in ("A.D. ", "B.C. "):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break
    try:
        return datetime.strptime(cleaned, "%Y-%b-%d %H:%M:%S.%f")
    except ValueError:
        return None


def _format_header_time(value: datetime) -> str:
    month = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ][value.month - 1]
    return f"A.D. {value.year:04d}-{month}-{value.day:02d} {value.hour:02d}:{value.minute:02d}:{value.second:02d}.0000 TDB"


def _update_header_time(text: str, label: str, value: datetime) -> str:
    replacement = f"{label}: {_format_header_time(value)}"
    pattern = re.compile(rf"^{re.escape(label)}\s*:.*$", re.MULTILINE)
    return pattern.sub(replacement, text, count=1)


def _slice_vector_text_for_range(
    text: str,
    *,
    start_time: datetime,
    stop_time: datetime,
) -> str | None:
    lines = text.splitlines()
    start_index = None
    end_index = None
    for index, line in enumerate(lines):
        if line.startswith("$$SOE"):
            start_index = index
        elif line.startswith("$$EOE"):
            end_index = index
            break

    if start_index is None or end_index is None or end_index <= start_index:
        return None

    selected_rows: list[str] = []
    first_selected_dt: datetime | None = None
    last_selected_dt: datetime | None = None

    for line in lines[start_index + 1:end_index]:
        stripped = line.strip()
        if not stripped:
            continue
        fields = line.split(",", 2)
        if len(fields) < 2:
            continue
        row_dt = _parse_response_calendar_date(fields[1])
        if row_dt is None:
            continue
        if start_time <= row_dt <= stop_time:
            selected_rows.append(line)
            if first_selected_dt is None:
                first_selected_dt = row_dt
            last_selected_dt = row_dt

    if not selected_rows or first_selected_dt is None or last_selected_dt is None:
        return None
    if first_selected_dt != start_time or last_selected_dt != stop_time:
        return None

    sliced_lines = [
        *lines[:start_index + 1],
        *selected_rows,
        *lines[end_index:],
    ]
    sliced_text = "\n".join(sliced_lines)
    sliced_text = _update_header_time(sliced_text, "Start time      ", start_time)
    sliced_text = _update_header_time(sliced_text, "Stop  time      ", stop_time)
    if text.endswith("\n"):
        sliced_text += "\n"
    return sliced_text


def find_covering_cached_text(
    *,
    base_url: str,
    params: dict[str, Any] | None,
    cache_dir: str | Path,
) -> tuple[str, dict[str, Any]] | None:
    normalized_params = _normalize_params(params)
    request_start = _parse_request_time(normalized_params.get("START_TIME"))
    request_stop = _parse_request_time(normalized_params.get("STOP_TIME"))
    if request_start is None or request_stop is None:
        return None

    # Reuse only ranged VECTORS responses with the same query shape and cadence.
    request_shape = _normalize_params_without_keys(
        params,
        {"START_TIME", "STOP_TIME"},
    )
    if request_shape.get("EPHEM_TYPE") != "VECTORS":
        return None

    cache_root = Path(cache_dir)
    best_candidate: tuple[float, Path, dict[str, Any]] | None = None
    for meta_path in cache_root.glob("*.json"):
        try:
            metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        if str(metadata.get("base_url")) != str(base_url):
            continue

        candidate_params = metadata.get("params")
        if not isinstance(candidate_params, dict):
            continue
        candidate_shape = _normalize_params_without_keys(
            candidate_params,
            {"START_TIME", "STOP_TIME"},
        )
        if candidate_shape != request_shape:
            continue

        candidate_start = _parse_request_time(candidate_params.get("START_TIME"))
        candidate_stop = _parse_request_time(candidate_params.get("STOP_TIME"))
        if candidate_start is None or candidate_stop is None:
            continue
        if candidate_start > request_start or candidate_stop < request_stop:
            continue

        span_seconds = (candidate_stop - candidate_start).total_seconds()
        if best_candidate is None or span_seconds < best_candidate[0]:
            best_candidate = (span_seconds, meta_path, metadata)

    if best_candidate is None:
        return None

    _, meta_path, metadata = best_candidate
    text_path = meta_path.with_suffix(".txt")
    try:
        source_text = text_path.read_text(encoding="utf-8")
    except OSError:
        return None

    sliced_text = _slice_vector_text_for_range(
        source_text,
        start_time=request_start,
        stop_time=request_stop,
    )
    if sliced_text is None:
        return None

    metadata = dict(metadata)
    metadata["cache_hit_type"] = "covering-range"
    metadata["derived_from_stem"] = meta_path.stem
    return sliced_text, metadata


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
