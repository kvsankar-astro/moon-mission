#!/usr/bin/env python3
"""Extend a mission trajectory beyond the final published HORIZONS craft sample.

Today this supports Artemis II's short guided-entry continuation from the final
published Orion state through splashdown. The extension is config-driven:

- Mission config retains the runtime end time.
- Phase-level ``sourceEndTime`` tells ``orbits.py`` where the public craft data ends.
- ``postHorizonExtension`` defines the modeled splashdown target and altitude knots.

The script rewrites generated NPZ/meta artifacts in ``data-generated/<mission>/``:

- ``geo``: extend SC; linearly extend slow-varying bodies such as MOON/SUN
- ``lunar``: derive fully from the extended geo data for frame consistency
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator


PROJECT_ROOT = Path(__file__).resolve().parent.parent
JD_UNIX_EPOCH = 2440587.5
MS_PER_DAY = 86400000.0
TDB_OFFSET_MS = (37.0 + 32.184) * 1000.0
EARTH_RADIUS_KM = 6378.1363
J2000_OBLIQUITY_RADIANS = np.deg2rad(23.439291111)

R_ECLIPTIC_TO_EQUATORIAL = np.array(
    [
        [1.0, 0.0, 0.0],
        [0.0, np.cos(J2000_OBLIQUITY_RADIANS), -np.sin(J2000_OBLIQUITY_RADIANS)],
        [0.0, np.sin(J2000_OBLIQUITY_RADIANS), np.cos(J2000_OBLIQUITY_RADIANS)],
    ],
    dtype=float,
)
R_EQUATORIAL_TO_ECLIPTIC = R_ECLIPTIC_TO_EQUATORIAL.T


@dataclass(frozen=True)
class PhaseArtifacts:
    phase: str
    npz_path: Path
    meta_path: Path
    center: str
    planets: list[str]
    start_label_ms: float
    end_label_ms: float
    step_seconds: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extend post-HORIZONS trajectory samples")
    parser.add_argument("--mission", required=True, help="Mission folder name under assets/")
    return parser.parse_args()


def parse_iso_ms(text: str) -> float:
    value = str(text or "").strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.timestamp() * 1000.0


def format_label_time(ms: float) -> str:
    dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M")


def timestamp_to_iso(ms: float) -> str:
    dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def label_ms_to_jd_tdb(ms: np.ndarray | float) -> np.ndarray | float:
    return JD_UNIX_EPOCH + (np.asarray(ms, dtype=float) / MS_PER_DAY)


def jd_tdb_to_label_ms(jd: np.ndarray | float) -> np.ndarray | float:
    return (np.asarray(jd, dtype=float) - JD_UNIX_EPOCH) * MS_PER_DAY


def label_ms_to_utc_ms(ms: np.ndarray | float) -> np.ndarray | float:
    return np.asarray(ms, dtype=float) - TDB_OFFSET_MS


def utc_ms_to_label_ms(ms: np.ndarray | float) -> np.ndarray | float:
    return np.asarray(ms, dtype=float) + TDB_OFFSET_MS


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_phase_artifacts(config: dict, manifest: dict, mission: str, phase: str) -> PhaseArtifacts:
    phase_cfg = config[phase]
    phase_manifest = manifest["phases"][phase]
    npz_runtime = phase_manifest["artifacts"]["npz"]["runtime"]
    meta_runtime = phase_manifest["artifacts"]["meta"]["runtime"]
    generated_dir = PROJECT_ROOT / "data-generated" / mission
    return PhaseArtifacts(
        phase=phase,
        npz_path=generated_dir / npz_runtime,
        meta_path=generated_dir / meta_runtime,
        center=phase_cfg["center"],
        planets=list(phase_cfg["planets"]) + (["SUN"] if "SUN" not in phase_cfg["planets"] else []),
        start_label_ms=parse_iso_ms(phase_cfg["startTime"]),
        end_label_ms=parse_iso_ms(phase_cfg["endTime"]),
        step_seconds=int(phase_cfg["step_size_in_seconds"]),
    )


def gmst_radians(utc_ms: float) -> float:
    jd = JD_UNIX_EPOCH + (utc_ms / MS_PER_DAY)
    t = (jd - 2451545.0) / 36525.0
    gmst_degrees = (
        280.46061837
        + (360.98564736629 * (jd - 2451545.0))
        + (0.000387933 * t * t)
        - ((t * t * t) / 38710000.0)
    )
    return np.deg2rad(gmst_degrees % 360.0)


def eci_equatorial_to_ecef(position_eq: np.ndarray, utc_ms: float) -> np.ndarray:
    theta = gmst_radians(utc_ms)
    cos_t = np.cos(theta)
    sin_t = np.sin(theta)
    x = (position_eq[0] * cos_t) + (position_eq[1] * sin_t)
    y = (-position_eq[0] * sin_t) + (position_eq[1] * cos_t)
    z = position_eq[2]
    return np.array([x, y, z], dtype=float)


def ecef_to_eci_equatorial(position_ecef: np.ndarray, utc_ms: float) -> np.ndarray:
    theta = gmst_radians(utc_ms)
    cos_t = np.cos(theta)
    sin_t = np.sin(theta)
    x = (position_ecef[0] * cos_t) - (position_ecef[1] * sin_t)
    y = (position_ecef[0] * sin_t) + (position_ecef[1] * cos_t)
    z = position_ecef[2]
    return np.array([x, y, z], dtype=float)


def ecliptic_to_equatorial(position_ecl: np.ndarray) -> np.ndarray:
    return position_ecl @ R_ECLIPTIC_TO_EQUATORIAL.T


def equatorial_to_ecliptic(position_eq: np.ndarray) -> np.ndarray:
    return position_eq @ R_EQUATORIAL_TO_ECLIPTIC.T


def ecef_to_lat_lon_alt(position_ecef: np.ndarray) -> tuple[float, float, float]:
    radius = float(np.linalg.norm(position_ecef))
    if not np.isfinite(radius) or radius <= 0.0:
        raise ValueError("Invalid ECEF position")
    lat = np.rad2deg(np.arcsin(np.clip(position_ecef[2] / radius, -1.0, 1.0)))
    lon = np.rad2deg(np.arctan2(position_ecef[1], position_ecef[0]))
    alt = radius - EARTH_RADIUS_KM
    return lat, lon, alt


def lat_lon_alt_to_ecef(lat_deg: float, lon_deg: float, alt_km: float) -> np.ndarray:
    lat = np.deg2rad(lat_deg)
    lon = np.deg2rad(lon_deg)
    radius = EARTH_RADIUS_KM + alt_km
    cos_lat = np.cos(lat)
    return np.array(
        [
            radius * cos_lat * np.cos(lon),
            radius * cos_lat * np.sin(lon),
            radius * np.sin(lat),
        ],
        dtype=float,
    )


def lat_lon_to_unit_vector(lat_deg: float, lon_deg: float) -> np.ndarray:
    return lat_lon_alt_to_ecef(lat_deg, lon_deg, 0.0) / EARTH_RADIUS_KM


def great_circle_interpolate(
    start_lat_deg: float,
    start_lon_deg: float,
    end_lat_deg: float,
    end_lon_deg: float,
    fraction: float,
) -> tuple[float, float]:
    start = lat_lon_to_unit_vector(start_lat_deg, start_lon_deg)
    end = lat_lon_to_unit_vector(end_lat_deg, end_lon_deg)
    dot = float(np.clip(np.dot(start, end), -1.0, 1.0))
    omega = float(np.arccos(dot))
    if omega <= 1e-8:
        vec = start
    else:
        sin_omega = np.sin(omega)
        vec = (
            np.sin((1.0 - fraction) * omega) / sin_omega * start
            + np.sin(fraction * omega) / sin_omega * end
        )
    vec /= np.linalg.norm(vec)
    lat = np.rad2deg(np.arcsin(np.clip(vec[2], -1.0, 1.0)))
    lon = np.rad2deg(np.arctan2(vec[1], vec[0]))
    return float(lat), float(lon)


def structured_series_to_arrays(series: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    times_ms = jd_tdb_to_label_ms(series["jdct"]).astype(float)
    positions = np.column_stack((series["x"], series["y"], series["z"])).astype(float)
    return times_ms, positions


def positions_to_structured(times_ms: np.ndarray, positions: np.ndarray) -> np.ndarray:
    velocities = recompute_velocities(times_ms, positions)
    payload = np.zeros(
        len(times_ms),
        dtype=[
            ("jdct", "f8"),
            ("x", "f8"),
            ("y", "f8"),
            ("z", "f8"),
            ("vx", "f8"),
            ("vy", "f8"),
            ("vz", "f8"),
        ],
    )
    payload["jdct"] = label_ms_to_jd_tdb(times_ms)
    payload["x"] = positions[:, 0]
    payload["y"] = positions[:, 1]
    payload["z"] = positions[:, 2]
    payload["vx"] = velocities[:, 0]
    payload["vy"] = velocities[:, 1]
    payload["vz"] = velocities[:, 2]
    return payload


def recompute_velocities(times_ms: np.ndarray, positions: np.ndarray) -> np.ndarray:
    velocities = np.zeros_like(positions, dtype=float)
    if len(times_ms) < 2:
        return velocities
    times_s = times_ms / 1000.0
    for index in range(len(times_ms)):
        if index == 0:
            dt = times_s[1] - times_s[0]
            velocities[index] = (positions[1] - positions[0]) / dt
        elif index == len(times_ms) - 1:
            dt = times_s[-1] - times_s[-2]
            velocities[index] = (positions[-1] - positions[-2]) / dt
        else:
            dt = times_s[index + 1] - times_s[index - 1]
            velocities[index] = (positions[index + 1] - positions[index - 1]) / dt
    return velocities


def build_extension_times(start_label_ms: float, end_label_ms: float, step_seconds: int) -> np.ndarray:
    step_ms = float(step_seconds) * 1000.0
    times = []
    current = start_label_ms + step_ms
    while current < (end_label_ms - 1e-6):
        times.append(current)
        current += step_ms
    if not times or abs(times[-1] - end_label_ms) > 1e-6:
        times.append(end_label_ms)
    return np.asarray(times, dtype=float)


def linear_extend_positions(
    base_times_ms: np.ndarray,
    base_positions: np.ndarray,
    extension_times_ms: np.ndarray,
) -> np.ndarray:
    if extension_times_ms.size == 0:
        return base_positions
    if len(base_times_ms) < 2:
        raise ValueError("Need at least two samples to extend a series linearly")
    last_dt = (base_times_ms[-1] - base_times_ms[-2]) / 1000.0
    last_velocity = (base_positions[-1] - base_positions[-2]) / last_dt
    extra_positions = []
    for label_ms in extension_times_ms:
        dt = (label_ms - base_times_ms[-1]) / 1000.0
        extra_positions.append(base_positions[-1] + (last_velocity * dt))
    return np.vstack((base_positions, np.asarray(extra_positions, dtype=float)))


def load_npz_series(npz_path: Path) -> dict[str, np.ndarray]:
    data = np.load(npz_path)
    return {name: data[name] for name in data.files}


def build_extension_metadata(extension_cfg: dict, runtime_end_time: str) -> dict:
    provenance = extension_cfg.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {}
    return {
        "kind": str(provenance.get("kind", "app-generated")),
        "segment_label": str(provenance.get("segmentLabel", "Ballistic splashdown continuation")),
        "short_label": str(provenance.get("shortLabel", "Generated final descent")),
        "summary": str(
            provenance.get(
                "summary",
                "App-modeled ballistic continuation from the final published JPL HORIZONS Orion sample through splashdown.",
            ),
        ),
        "ui_note": str(
            provenance.get(
                "uiNote",
                "The final descent to splashdown is app-generated ballistic continuation data and not JPL HORIZONS vector data.",
            ),
        ),
        "source_end_time": str(extension_cfg.get("sourceEndTime", "")),
        "runtime_end_time": runtime_end_time,
    }


def write_meta(
    path: Path,
    artifacts: PhaseArtifacts,
    counts: dict[str, int],
    generated_by: str,
    note: str,
    extension_meta: dict | None = None,
) -> None:
    payload = {
        "step_size_seconds": artifacts.step_seconds,
        "step_size_minutes": artifacts.step_seconds / 60.0,
        "start_time": format_label_time(artifacts.start_label_ms),
        "end_time": format_label_time(artifacts.end_label_ms),
        "planets": artifacts.planets,
        "phase": artifacts.phase,
        "center": artifacts.center,
        "generated_by": generated_by,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "python_config": {
            "start_time": format_label_time(artifacts.start_label_ms),
            "end_time": format_label_time(artifacts.end_label_ms),
        },
        "modeling_note": note,
    }
    if extension_meta:
        payload["post_horizons_extension"] = extension_meta
    payload.update({f"{body_id}_vectors_count": count for body_id, count in counts.items()})
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def generate_guided_sc_positions(
    base_series: np.ndarray,
    extension_cfg: dict,
    end_label_ms: float,
    step_seconds: int,
) -> tuple[np.ndarray, np.ndarray]:
    base_times_ms, base_positions_ecl = structured_series_to_arrays(base_series)
    start_label_ms = float(base_times_ms[-1])
    extension_times_ms = build_extension_times(start_label_ms, end_label_ms, step_seconds)
    if extension_times_ms.size == 0:
        return base_times_ms, base_positions_ecl

    start_position_eq = ecliptic_to_equatorial(base_positions_ecl[-1][None, :])[0]
    start_position_ecef = eci_equatorial_to_ecef(start_position_eq, float(label_ms_to_utc_ms(start_label_ms)))
    start_lat_deg, start_lon_deg, start_alt_km = ecef_to_lat_lon_alt(start_position_ecef)

    splash_target = extension_cfg["splashdownTarget"]
    target_lat_deg = float(splash_target["latitudeDeg"])
    target_lon_deg = float(splash_target["longitudeDeg"])

    milestone_rows = []
    for milestone in extension_cfg.get("milestones", []):
        milestone_rows.append(
            (
                parse_iso_ms(milestone["utcTime"]),
                float(milestone["pathFraction"]),
                float(milestone["altitudeKm"]),
            ),
        )
    milestone_rows.sort(key=lambda row: row[0])

    knot_utc_ms = [float(label_ms_to_utc_ms(start_label_ms))]
    knot_fractions = [0.0]
    knot_altitudes = [start_alt_km]
    for utc_ms, fraction, altitude_km in milestone_rows:
        if utc_ms <= knot_utc_ms[-1]:
            continue
        knot_utc_ms.append(float(utc_ms))
        knot_fractions.append(float(fraction))
        knot_altitudes.append(float(altitude_km))

    end_utc_ms = float(label_ms_to_utc_ms(end_label_ms))
    if knot_utc_ms[-1] < end_utc_ms:
        knot_utc_ms.append(end_utc_ms)
        knot_fractions.append(1.0)
        knot_altitudes.append(0.0)

    fraction_curve = PchipInterpolator(np.asarray(knot_utc_ms), np.asarray(knot_fractions))
    altitude_curve = PchipInterpolator(np.asarray(knot_utc_ms), np.asarray(knot_altitudes))

    extra_positions_eq = []
    for label_ms in extension_times_ms:
        utc_ms = float(label_ms_to_utc_ms(label_ms))
        fraction = float(np.clip(fraction_curve(utc_ms), 0.0, 1.0))
        altitude_km = float(max(0.0, altitude_curve(utc_ms)))
        lat_deg, lon_deg = great_circle_interpolate(
            start_lat_deg,
            start_lon_deg,
            target_lat_deg,
            target_lon_deg,
            fraction,
        )
        position_ecef = lat_lon_alt_to_ecef(lat_deg, lon_deg, altitude_km)
        extra_positions_eq.append(ecef_to_eci_equatorial(position_ecef, utc_ms))

    extra_positions_ecl = equatorial_to_ecliptic(np.asarray(extra_positions_eq, dtype=float))
    all_times = np.concatenate((base_times_ms, extension_times_ms))
    all_positions = np.vstack((base_positions_ecl, extra_positions_ecl))
    return all_times, all_positions


def extend_geo_npz(
    geo_artifacts: PhaseArtifacts,
    extension_cfg: dict,
) -> dict[str, np.ndarray]:
    series_by_key = load_npz_series(geo_artifacts.npz_path)
    sc_series = series_by_key.get("SC_vectors")
    if sc_series is None:
        raise ValueError(f"SC_vectors missing in {geo_artifacts.npz_path}")

    all_times_ms, sc_positions_ecl = generate_guided_sc_positions(
        sc_series,
        extension_cfg,
        geo_artifacts.end_label_ms,
        geo_artifacts.step_seconds,
    )

    extended_payload = {
        "SC_vectors": positions_to_structured(all_times_ms, sc_positions_ecl),
    }

    extension_times_ms = all_times_ms[len(sc_series) :]
    for body_id in ("MOON", "SUN"):
        key = f"{body_id}_vectors"
        if key not in series_by_key:
            continue
        body_times_ms, body_positions = structured_series_to_arrays(series_by_key[key])
        if not np.allclose(body_times_ms, jd_tdb_to_label_ms(sc_series["jdct"]), rtol=0.0, atol=1e-3):
            raise ValueError(f"{key} timestamps do not align with SC_vectors in {geo_artifacts.npz_path}")
        body_positions_extended = linear_extend_positions(body_times_ms, body_positions, extension_times_ms)
        extended_payload[key] = positions_to_structured(all_times_ms, body_positions_extended)

    np.savez_compressed(geo_artifacts.npz_path, **extended_payload)
    extension_meta = build_extension_metadata(
        extension_cfg,
        runtime_end_time=timestamp_to_iso(geo_artifacts.end_label_ms),
    )
    write_meta(
        geo_artifacts.meta_path,
        geo_artifacts,
        {
            body_id.removesuffix("_vectors"): len(series)
            for body_id, series in extended_payload.items()
        },
        generated_by="extend-post-horizons-trajectory.py",
        note="Guided post-HORIZONS splashdown continuation from the final published Orion sample.",
        extension_meta=extension_meta,
    )
    return extended_payload


def derive_lunar_npz(
    lunar_artifacts: PhaseArtifacts,
    geo_payload: dict[str, np.ndarray],
    extension_cfg: dict,
) -> None:
    sc = geo_payload["SC_vectors"]
    moon = geo_payload["MOON_vectors"]
    sun = geo_payload["SUN_vectors"]

    sc_times_ms, sc_positions = structured_series_to_arrays(sc)
    moon_times_ms, moon_positions = structured_series_to_arrays(moon)
    sun_times_ms, sun_positions = structured_series_to_arrays(sun)

    if not np.allclose(sc_times_ms, moon_times_ms, rtol=0.0, atol=1e-3):
        raise ValueError("SC and MOON geo times do not align")
    if not np.allclose(sc_times_ms, sun_times_ms, rtol=0.0, atol=1e-3):
        raise ValueError("SC and SUN geo times do not align")

    payload = {
        "SC_vectors": positions_to_structured(sc_times_ms, sc_positions - moon_positions),
        "EARTH_vectors": positions_to_structured(sc_times_ms, -moon_positions),
        "SUN_vectors": positions_to_structured(sc_times_ms, sun_positions - moon_positions),
    }

    np.savez_compressed(lunar_artifacts.npz_path, **payload)
    extension_meta = build_extension_metadata(
        extension_cfg,
        runtime_end_time=timestamp_to_iso(lunar_artifacts.end_label_ms),
    )
    write_meta(
        lunar_artifacts.meta_path,
        lunar_artifacts,
        {
            body_id.removesuffix("_vectors"): len(series)
            for body_id, series in payload.items()
        },
        generated_by="extend-post-horizons-trajectory.py",
        note="Derived from extended geo data for frame consistency through splashdown.",
        extension_meta=extension_meta,
    )


def main() -> int:
    args = parse_args()
    mission = args.mission
    config_path = PROJECT_ROOT / "assets" / mission / "data" / "config.json"
    manifest_path = PROJECT_ROOT / "assets" / mission / "data" / "ephemeris-manifest.json"
    config = load_json(config_path)
    manifest = load_json(manifest_path)

    extension_cfg = config.get("postHorizonExtension")
    if not isinstance(extension_cfg, dict) or not extension_cfg.get("enabled", True):
        print(f"[{mission}] no post-HORIZONS extension configured")
        return 0
    if extension_cfg.get("mode") != "guidedSplashdown":
        raise ValueError(f"Unsupported postHorizonExtension mode: {extension_cfg.get('mode')}")

    geo_artifacts = resolve_phase_artifacts(config, manifest, mission, "geo")
    lunar_artifacts = resolve_phase_artifacts(config, manifest, mission, "lunar")

    geo_payload = extend_geo_npz(geo_artifacts, extension_cfg)
    derive_lunar_npz(lunar_artifacts, geo_payload, extension_cfg)

    print(f"[{mission}] extended geo/lunar trajectories through splashdown")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
