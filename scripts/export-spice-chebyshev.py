#!/usr/bin/env python3
"""
Sample mission SPICE kernels with CSPICE and export moon-mission Chebyshev JSON.

This is intended for missions whose public kernels are not directly readable by
the current skyfield-ts checkout used elsewhere in the project. It preserves
kernel coverage gaps by compressing each SPICE coverage interval separately and
concatenating the resulting Chebyshev segments.
"""

from __future__ import annotations

import argparse
import contextlib
import gzip
import importlib.util
import io
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spiceypy as sp


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = PROJECT_ROOT / "assets"
SECONDS_PER_DAY = 86400.0

ORIGIN_CENTER_CODE = {
    "geo": 399,
    "lunar": 301,
}

BODY_CODES_BY_ORIGIN = {
    "geo": {
        "SC": None,
        "MOON": 301,
        "SUN": 10,
    },
    "lunar": {
        "SC": None,
        "EARTH": 399,
        "SUN": 10,
    },
}


@dataclass(frozen=True)
class CliOptions:
    mission: str
    mission_spk: list[str]
    aux_spk: list[str]
    lsk: str
    target: str
    label: str
    origins: list[str]
    step_seconds: int
    tolerance_km: float
    frame: str
    start_utc: str | None
    end_utc: str | None
    out_dir: str


def parse_args() -> CliOptions:
    parser = argparse.ArgumentParser(
        description="Export SPICE mission kernels to moon-mission Chebyshev JSON"
    )
    parser.add_argument("--mission", required=True, help="Mission folder under assets/")
    parser.add_argument("--mission-spk", action="append", required=True, help="Mission SPK/BSP path")
    parser.add_argument("--aux-spk", action="append", default=[], help="Auxiliary SPK/BSP path")
    parser.add_argument("--lsk", required=True, help="Leapseconds kernel path")
    parser.add_argument("--target", required=True, help="Mission target code or name")
    parser.add_argument("--label", required=True, help="Output label, e.g. CH1")
    parser.add_argument("--origins", default="geo,lunar", help="Comma-separated origins: geo,lunar")
    parser.add_argument("--step-seconds", type=int, default=600, help="Sampling cadence in seconds")
    parser.add_argument("--tolerance-km", type=float, default=5.0, help="Chebyshev tolerance in km")
    parser.add_argument("--frame", default="J2000", help="SPICE frame label, default J2000")
    parser.add_argument("--start-utc", help="Optional UTC clip start, ISO-like text accepted by CSPICE")
    parser.add_argument("--end-utc", help="Optional UTC clip end, ISO-like text accepted by CSPICE")
    parser.add_argument(
        "--out-dir",
        help="Output directory for chebyshev files (default: assets/<mission>/data)",
    )
    args = parser.parse_args()

    origins = [part.strip() for part in str(args.origins).split(",") if part.strip()]
    if not origins:
        raise SystemExit("--origins requires at least one origin")
    unsupported = [origin for origin in origins if origin not in ORIGIN_CENTER_CODE]
    if unsupported:
        raise SystemExit(f"Unsupported origins: {', '.join(unsupported)}")
    if args.step_seconds <= 0:
        raise SystemExit("--step-seconds must be positive")
    if args.tolerance_km <= 0:
        raise SystemExit("--tolerance-km must be positive")

    return CliOptions(
        mission=str(args.mission).strip(),
        mission_spk=[str(value) for value in args.mission_spk],
        aux_spk=[str(value) for value in args.aux_spk],
        lsk=str(args.lsk),
        target=str(args.target).strip(),
        label=str(args.label).strip(),
        origins=origins,
        step_seconds=int(args.step_seconds),
        tolerance_km=float(args.tolerance_km),
        frame=str(args.frame).strip(),
        start_utc=str(args.start_utc).strip() if args.start_utc else None,
        end_utc=str(args.end_utc).strip() if args.end_utc else None,
        out_dir=str(args.out_dir).strip() if args.out_dir else str(ASSETS_DIR / args.mission / "data"),
    )


def load_compressor_module():
    module_path = PROJECT_ROOT / "scripts" / "compress-orbits.py"
    spec = importlib.util.spec_from_file_location("compress_orbits_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load compressor module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_target(value: str) -> tuple[str, int]:
    if value.lstrip("+-").isdigit():
        return value, int(value)
    code = int(sp.bods2c(value))
    return value, code


def et_to_jd_tdb(et: np.ndarray) -> np.ndarray:
    return np.array([float(sp.unitim(float(value), "ET", "JDTDB")) for value in et], dtype=float)


def build_velocity_series(jd: np.ndarray, pos: np.ndarray) -> dict[str, np.ndarray]:
    count = len(jd)
    vel = np.zeros_like(pos)
    if count >= 2:
        dt0 = (jd[1] - jd[0]) * SECONDS_PER_DAY
        vel[0] = (pos[1] - pos[0]) / dt0
        dtn = (jd[-1] - jd[-2]) * SECONDS_PER_DAY
        vel[-1] = (pos[-1] - pos[-2]) / dtn
    if count >= 3:
        dt_mid = (jd[2:] - jd[:-2]) * SECONDS_PER_DAY
        vel[1:-1] = (pos[2:] - pos[:-2]) / dt_mid[:, None]
    return {
        "jd": jd,
        "x": pos[:, 0],
        "y": pos[:, 1],
        "z": pos[:, 2],
        "vx": vel[:, 0],
        "vy": vel[:, 1],
        "vz": vel[:, 2],
    }


def write_gzip_companion(json_path: Path) -> Path:
    payload = json_path.read_bytes()
    gzip_path = json_path.with_suffix(f"{json_path.suffix}.gz")
    gzip_path.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    return gzip_path


def build_requested_window(start_utc: str | None, end_utc: str | None):
    if not start_utc and not end_utc:
        return None
    start_et = float(sp.str2et(start_utc)) if start_utc else -1.0e300
    end_et = float(sp.str2et(end_utc)) if end_utc else 1.0e300
    if not end_et > start_et:
        raise SystemExit("--end-utc must be greater than --start-utc")
    window = sp.utils.support_types.SPICEDOUBLE_CELL(2)
    sp.wninsd(start_et, end_et, window)
    return window


def build_union_coverage(mission_spk: list[str], target_code: int, requested_window):
    coverage = sp.utils.support_types.SPICEDOUBLE_CELL(400000)
    for spk_path in mission_spk:
        file_window = sp.utils.support_types.SPICEDOUBLE_CELL(400000)
        sp.spkcov(spk_path, target_code, file_window)
        coverage = sp.wnunid(coverage, file_window)
    if requested_window is not None:
        coverage = sp.wnintd(coverage, requested_window)
    if sp.wncard(coverage) == 0:
        raise RuntimeError("No SPICE coverage remains after applying optional time clipping")
    return coverage


def sample_interval(target_name: str, center_name: str, et_start: float, et_end: float, step_seconds: int, frame: str):
    if not et_end > et_start:
        raise RuntimeError("Invalid coverage interval")
    et_values = np.arange(et_start, et_end + step_seconds, step_seconds, dtype=float)
    if et_values.size == 0 or et_values[-1] < et_end - 1.0e-6:
        et_values = np.append(et_values, et_end)
    else:
        et_values[-1] = et_end

    positions = np.empty((et_values.size, 3), dtype=float)
    for idx, et in enumerate(et_values):
        pos, _ = sp.spkpos(target_name, float(et), frame, "NONE", center_name)
        positions[idx] = pos
    return et_values, positions


def sample_origin_batches(target_name: str, coverage, origin: str, step_seconds: int, frame: str):
    center_code = ORIGIN_CENTER_CODE[origin]
    center_name = str(center_code)
    body_codes = BODY_CODES_BY_ORIGIN[origin]
    batches: dict[str, list[dict[str, np.ndarray]]] = {body_id: [] for body_id in body_codes}
    interval_summaries: list[dict[str, str | float]] = []

    for idx in range(sp.wncard(coverage)):
        et_start, et_end = sp.wnfetd(coverage, idx)
        for body_id, code in body_codes.items():
            body_name = target_name if code is None else str(code)
            et_values, pos = sample_interval(body_name, center_name, et_start, et_end, step_seconds, frame)
            jd = et_to_jd_tdb(et_values)
            batches[body_id].append(build_velocity_series(jd, pos))

        interval_summaries.append(
            {
                "start_utc": sp.et2utc(et_start, "ISOC", 3),
                "end_utc": sp.et2utc(et_end, "ISOC", 3),
                "duration_hours": round((et_end - et_start) / 3600.0, 6),
            }
        )

    return batches, interval_summaries


def compress_batches(compressor, batches: list[dict[str, np.ndarray]], tolerance_km: float):
    combined_segments: list[dict] = []
    start_jd = None
    end_jd = None
    for batch in batches:
        if len(batch["jd"]) < 2:
            continue
        with contextlib.redirect_stdout(io.StringIO()):
            segments = compressor.compress_orbit_data_tolerance(batch, tolerance_km=tolerance_km)
        combined_segments.extend(segments)
        batch_start = float(batch["jd"][0])
        batch_end = float(batch["jd"][-1])
        start_jd = batch_start if start_jd is None else min(start_jd, batch_start)
        end_jd = batch_end if end_jd is None else max(end_jd, batch_end)
    if start_jd is None or end_jd is None:
        raise RuntimeError("No sampled batches produced enough points for Chebyshev compression")
    return {
        "time_range": {"start": start_jd, "end": end_jd},
        "segments": combined_segments,
    }


def export_origin(
    compressor,
    options: CliOptions,
    target_name: str,
    target_code: int,
    coverage,
    origin: str,
    out_dir: Path,
):
    batches_by_body, interval_summaries = sample_origin_batches(
        target_name=target_name,
        coverage=coverage,
        origin=origin,
        step_seconds=options.step_seconds,
        frame=options.frame,
    )

    body_payloads: dict[str, dict] = {}
    total_segments = 0
    start_jd = None
    end_jd = None
    for body_id, batches in batches_by_body.items():
        payload = compress_batches(compressor, batches, tolerance_km=options.tolerance_km)
        body_payloads[body_id] = payload
        total_segments += len(payload["segments"])
        start_jd = payload["time_range"]["start"] if start_jd is None else min(start_jd, payload["time_range"]["start"])
        end_jd = payload["time_range"]["end"] if end_jd is None else max(end_jd, payload["time_range"]["end"])

    if start_jd is None or end_jd is None:
        raise RuntimeError(f"No output generated for origin {origin}")

    output = {
        "format": "chebyshev-ephemeris",
        "version": "1.0",
        "metadata": {
            "source": "SPICE sampling",
            "created": datetime.now(timezone.utc).isoformat(),
            "tolerance_km": options.tolerance_km,
            "segments_count": total_segments,
            "bodies": list(body_payloads.keys()),
            "coordinate_frame": options.frame,
            "units": {"time": "julian_date_tdb", "position": "km"},
            "step_size_seconds": options.step_seconds,
            "spice_target": {"name": target_name, "code": target_code},
            "source_kernels": [options.lsk, *options.mission_spk, *options.aux_spk],
            "coverage_intervals_utc": interval_summaries,
        },
        "time_range": {"start": start_jd, "end": end_jd},
    }
    output.update(body_payloads)

    out_path = out_dir / f"{origin}-{options.label}-cheb.json"
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    gzip_path = write_gzip_companion(out_path)
    print(f"Wrote {out_path}")
    print(f"Wrote {gzip_path}")
    return out_path


def main() -> int:
    options = parse_args()
    compressor = load_compressor_module()

    sp.kclear()
    sp.furnsh(options.lsk)
    for kernel_path in options.aux_spk:
        sp.furnsh(kernel_path)
    for kernel_path in options.mission_spk:
        sp.furnsh(kernel_path)

    target_name, target_code = parse_target(options.target)
    coverage = build_union_coverage(
        mission_spk=options.mission_spk,
        target_code=target_code,
        requested_window=build_requested_window(options.start_utc, options.end_utc),
    )

    out_dir = Path(options.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for origin in options.origins:
        export_origin(
            compressor=compressor,
            options=options,
            target_name=target_name,
            target_code=target_code,
            coverage=coverage,
            origin=origin,
            out_dir=out_dir,
        )

    sp.kclear()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
