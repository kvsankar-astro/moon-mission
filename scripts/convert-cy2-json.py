#!/usr/bin/env python3
"""
Convert Chandrayaan-2 JSON orbit data to Chebyshev polynomial format.

This script converts the legacy CY2 JSON files (geo-cy2.json, lunar-cy2.json) from
the chandrayaan2 repository into the Chebyshev polynomial format used by the new
moon-mission platform.

IMPORTANT: The original orbits.pl script had a velocity swap bug (lines 509-510):
    $rec->{'vx'} = $vy;
    $rec->{'vy'} = $vx;

This means the existing JSON files have vx and vy swapped. This converter corrects
this by swapping them back to the proper order.

Usage:
    python scripts/convert-cy2-json.py                    # Convert all phases
    python scripts/convert-cy2-json.py --phase=geo        # Convert specific phase
    python scripts/convert-cy2-json.py --validate         # Validate after conversion
    python scripts/convert-cy2-json.py --source-dir=PATH  # Custom source directory
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from numpy.polynomial import chebyshev as cheb


# ============================================================================
# Configuration
# ============================================================================

DEFAULT_SOURCE_DIR = Path("C:/sankar/projects/chandrayaan2")
OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "chandrayaan2" / "data"

# Phase configurations
# Note: CY2 = Orbiter (-152), VIKRAM = Lander (-153)
PHASES = {
    "geo": {
        "source": "geo-cy2.json",
        "spacecraft_key": "CY2",  # Orbiter
        "output_cheb": "geo-CY2-cheb.json",
        "output_meta": "geo-CY2-meta.json",
        "tolerance_km": 5,  # Target: 5 km max error
    },
    "lunar": {
        "source": "lunar-cy2.json",
        "spacecraft_key": "CY2",  # Orbiter
        "output_cheb": "lunar-CY2-cheb.json",
        "output_meta": "lunar-CY2-meta.json",
        "tolerance_km": 5,
    },
    "geo-vikram": {
        "source": "geo-cy2.json",
        "spacecraft_key": "VIKRAM",  # Lander
        "output_cheb": "geo-VIKRAM-cheb.json",
        "output_meta": "geo-VIKRAM-meta.json",
        "tolerance_km": 5,
    },
    "lunar-vikram": {
        "source": "lunar-cy2.json",
        "spacecraft_key": "VIKRAM",  # Lander
        "output_cheb": "lunar-VIKRAM-cheb.json",
        "output_meta": "lunar-VIKRAM-meta.json",
        "tolerance_km": 5,
    },
}


# ============================================================================
# Data Loading
# ============================================================================


def load_cy2_json(filepath: Path, spacecraft_key: str = "CY2") -> dict:
    """
    Load CY2 JSON file and return dict with jd, x, y, z, vx, vy, vz arrays.

    IMPORTANT: Swaps vx and vy to correct the bug in the original orbits.pl.

    Parameters:
        filepath: Path to the JSON file
        spacecraft_key: Key for spacecraft data (default "CY2")

    Returns:
        dict with numpy arrays: jd, x, y, z, vx, vy, vz (corrected)
    """
    print(f"    Loading {filepath}...")
    with open(filepath) as f:
        data = json.load(f)

    vectors = data[spacecraft_key]["vectors"]
    n = len(vectors)
    print(f"    Found {n} data points")

    # Extract arrays
    jd = np.array([float(v["jdct"]) for v in vectors])
    x = np.array([float(v["x"]) for v in vectors])
    y = np.array([float(v["y"]) for v in vectors])
    z = np.array([float(v["z"]) for v in vectors])

    # IMPORTANT: Swap vx and vy to correct the orbits.pl bug
    # In the JSON: what's labeled "vx" is actually vy, and "vy" is actually vx
    # So we read them swapped to get correct values
    vx = np.array([float(v["vy"]) for v in vectors])  # vy -> vx (correcting swap)
    vy = np.array([float(v["vx"]) for v in vectors])  # vx -> vy (correcting swap)
    vz = np.array([float(v["vz"]) for v in vectors])

    print(f"    Time range: JD {jd[0]:.6f} to {jd[-1]:.6f}")
    print(f"    Applied vx/vy swap correction")

    return {
        "jd": jd,
        "x": x, "y": y, "z": z,
        "vx": vx, "vy": vy, "vz": vz,
    }


# ============================================================================
# Chebyshev Compression (from compress-orbits.py)
# ============================================================================


def compress_segment(
    t: np.ndarray,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    degree: int,
) -> dict:
    """Compress a segment of orbit data to Chebyshev coefficients."""
    t_start, t_end = float(t[0]), float(t[-1])

    # Normalize time to [-1, 1]
    t_norm = 2 * (t - t_start) / (t_end - t_start) - 1

    # Fit Chebyshev polynomials
    cx = cheb.Chebyshev.fit(t_norm, x, degree)
    cy = cheb.Chebyshev.fit(t_norm, y, degree)
    cz = cheb.Chebyshev.fit(t_norm, z, degree)

    return {
        "t_start": t_start,
        "t_end": t_end,
        "cx": cx.coef.tolist(),
        "cy": cy.coef.tolist(),
        "cz": cz.coef.tolist(),
    }


def hermite_to_chebyshev(p0: float, v0: float, p1: float, v1: float, dt_jd: float) -> list:
    """Convert Hermite cubic (2 points with velocities) to Chebyshev coefficients."""
    # Convert velocity to km per Julian day (internal units)
    v0_jd = v0 * 86400  # km/s -> km/day
    v1_jd = v1 * 86400

    # Scale velocity by the interval length
    m0 = v0_jd * dt_jd  # slope * interval = delta in km
    m1 = v1_jd * dt_jd

    # Hermite cubic in standard form P(t) = a + b*t + c*t² + d*t³ for t in [0, 1]
    a = p0
    b = m0
    c = -3 * p0 + 3 * p1 - 2 * m0 - m1
    d = 2 * p0 - 2 * p1 + m0 + m1

    # Convert from t in [0, 1] to t_norm in [-1, 1]
    c0 = a + b / 2 + c / 4 + d / 8
    c1 = b / 2 + c / 2 + 3 * d / 8
    c2 = c / 4 + 3 * d / 8
    c3 = d / 8

    # Convert from power basis to Chebyshev basis
    cheb_c0 = c0 + c2 / 2
    cheb_c1 = c1 + 3 * c3 / 4
    cheb_c2 = c2 / 2
    cheb_c3 = c3 / 4

    return [cheb_c0, cheb_c1, cheb_c2, cheb_c3]


def compress_segment_hermite(
    t_start: float,
    t_end: float,
    p0: tuple,
    v0: tuple,
    p1: tuple,
    v1: tuple,
) -> dict:
    """Create a Chebyshev segment from two endpoints using Hermite interpolation."""
    dt_jd = t_end - t_start

    return {
        "t_start": t_start,
        "t_end": t_end,
        "cx": hermite_to_chebyshev(p0[0], v0[0], p1[0], v1[0], dt_jd),
        "cy": hermite_to_chebyshev(p0[1], v0[1], p1[1], v1[1], dt_jd),
        "cz": hermite_to_chebyshev(p0[2], v0[2], p1[2], v1[2], dt_jd),
    }


def hermite_interpolate(t: float, p0: float, v0: float, p1: float, v1: float, dt: float) -> float:
    """Hermite cubic interpolation between two points."""
    t2 = t * t
    t3 = t2 * t

    h00 = 2 * t3 - 3 * t2 + 1
    h10 = t3 - 2 * t2 + t
    h01 = -2 * t3 + 3 * t2
    h11 = t3 - t2

    return h00 * p0 + h10 * dt * v0 + h01 * p1 + h11 * dt * v1


def evaluate_chebyshev(coeffs: list, x: float) -> float:
    """Evaluate Chebyshev polynomial using Clenshaw recurrence."""
    n = len(coeffs)
    if n == 0:
        return 0.0
    if n == 1:
        return coeffs[0]

    b_k1 = 0.0
    b_k2 = 0.0

    for k in range(n - 1, 0, -1):
        b_k = coeffs[k] + 2 * x * b_k1 - b_k2
        b_k2 = b_k1
        b_k1 = b_k

    return coeffs[0] + x * b_k1 - b_k2


def compress_orbit_data_tolerance(
    data: dict,
    tolerance_km: float,
    max_degree: int = 12,
    min_samples: int = 2,
    max_samples: int = 60,
) -> list[dict]:
    """Compress orbit data with tolerance-driven adaptive segmentation."""
    jd = data["jd"]
    x = data["x"]
    y = data["y"]
    z = data["z"]
    vx = data["vx"]
    vy = data["vy"]
    vz = data["vz"]
    n = len(jd)

    internal_tolerance = tolerance_km * 0.5

    def compute_segment_error(start_idx: int, end_idx: int, segment: dict) -> float:
        """Compute max error for a segment."""
        max_error = 0.0
        t_span = segment["t_end"] - segment["t_start"]

        for i in range(start_idx, end_idx):
            t_norm = 2 * (jd[i] - segment["t_start"]) / t_span - 1
            cheb_x = evaluate_chebyshev(segment["cx"], t_norm)
            cheb_y = evaluate_chebyshev(segment["cy"], t_norm)
            cheb_z = evaluate_chebyshev(segment["cz"], t_norm)
            error = np.sqrt((cheb_x - x[i])**2 + (cheb_y - y[i])**2 + (cheb_z - z[i])**2)
            max_error = max(max_error, error)

            if i < end_idx - 1:
                dt = (jd[i + 1] - jd[i]) * 86400
                for t_param in [0.25, 0.5, 0.75]:
                    jd_interp = jd[i] + t_param * (jd[i + 1] - jd[i])
                    t_norm_interp = 2 * (jd_interp - segment["t_start"]) / t_span - 1

                    x_interp = hermite_interpolate(t_param, x[i], vx[i], x[i + 1], vx[i + 1], dt)
                    y_interp = hermite_interpolate(t_param, y[i], vy[i], y[i + 1], vy[i + 1], dt)
                    z_interp = hermite_interpolate(t_param, z[i], vz[i], z[i + 1], vz[i + 1], dt)

                    cheb_x_interp = evaluate_chebyshev(segment["cx"], t_norm_interp)
                    cheb_y_interp = evaluate_chebyshev(segment["cy"], t_norm_interp)
                    cheb_z_interp = evaluate_chebyshev(segment["cz"], t_norm_interp)

                    error_interp = np.sqrt(
                        (cheb_x_interp - x_interp)**2 +
                        (cheb_y_interp - y_interp)**2 +
                        (cheb_z_interp - z_interp)**2
                    )
                    max_error = max(max_error, error_interp)

        return max_error

    def compress_range(start_idx: int, end_idx: int, depth: int = 0) -> list[dict]:
        """Recursively compress a range."""
        n_samples = end_idx - start_idx

        if n_samples > max_samples:
            mid_idx = (start_idx + end_idx) // 2
            left_segments = compress_range(start_idx, mid_idx + 1, depth + 1)
            right_segments = compress_range(mid_idx, end_idx, depth + 1)
            return left_segments + right_segments

        if n_samples == 2:
            segment = compress_segment_hermite(
                jd[start_idx], jd[end_idx - 1],
                (x[start_idx], y[start_idx], z[start_idx]),
                (vx[start_idx], vy[start_idx], vz[start_idx]),
                (x[end_idx - 1], y[end_idx - 1], z[end_idx - 1]),
                (vx[end_idx - 1], vy[end_idx - 1], vz[end_idx - 1]),
            )
            error = compute_segment_error(start_idx, end_idx, segment)
        else:
            max_possible_degree = min(max_degree, n_samples // 2 - 1)
            max_possible_degree = max(1, max_possible_degree)

            segment = None
            error = float('inf')
            for degree in range(2, max_possible_degree + 1):
                test_segment = compress_segment(
                    jd[start_idx:end_idx],
                    x[start_idx:end_idx],
                    y[start_idx:end_idx],
                    z[start_idx:end_idx],
                    degree,
                )
                test_error = compute_segment_error(start_idx, end_idx, test_segment)
                if test_error <= internal_tolerance:
                    segment = test_segment
                    error = test_error
                    break
                if test_error < error:
                    segment = test_segment
                    error = test_error

            if segment is None:
                segment = compress_segment(
                    jd[start_idx:end_idx],
                    x[start_idx:end_idx],
                    y[start_idx:end_idx],
                    z[start_idx:end_idx],
                    max_possible_degree,
                )
                error = compute_segment_error(start_idx, end_idx, segment)

        if error <= internal_tolerance:
            return [segment]

        if n_samples <= min_samples:
            if error > internal_tolerance * 5:
                print(f"      WARNING: High error {error:.1f} km at idx {start_idx}-{end_idx}")
            return [segment]

        mid_idx = (start_idx + end_idx) // 2
        left_segments = compress_range(start_idx, mid_idx + 1, depth + 1)
        right_segments = compress_range(mid_idx, end_idx, depth + 1)

        return left_segments + right_segments

    print(f"    Tolerance-driven compression (target: {tolerance_km} km, internal: {internal_tolerance:.1f} km)")
    segments = compress_range(0, n)

    lengths = [(s["t_end"] - s["t_start"]) * 24 * 60 for s in segments]
    print(f"    Segment lengths: {min(lengths):.1f} to {max(lengths):.1f} min (mean: {np.mean(lengths):.1f} min)")

    degrees = [len(s["cx"]) - 1 for s in segments]
    print(f"    Polynomial degrees: {min(degrees)} to {max(degrees)} (mean: {np.mean(degrees):.1f})")

    return segments


# ============================================================================
# Validation
# ============================================================================


def get_position_from_chebyshev(segments: list, jd: float) -> tuple | None:
    """Get position from Chebyshev data at a specific Julian date."""
    for seg in segments:
        if seg["t_start"] <= jd <= seg["t_end"]:
            t_norm = 2 * (jd - seg["t_start"]) / (seg["t_end"] - seg["t_start"]) - 1
            return (
                evaluate_chebyshev(seg["cx"], t_norm),
                evaluate_chebyshev(seg["cy"], t_norm),
                evaluate_chebyshev(seg["cz"], t_norm),
            )
    return None


def validate_compression(
    data: dict,
    segments: list,
    tolerance_km: float,
    sample_interval_seconds: float = 30,
) -> dict:
    """Validate Chebyshev compression against original data."""
    jd = data["jd"]
    x = data["x"]
    y = data["y"]
    z = data["z"]
    vx = data["vx"]
    vy = data["vy"]
    vz = data["vz"]

    jd_interval = sample_interval_seconds / 86400

    errors = []
    max_error = 0.0
    max_error_jd = None
    total_error = 0.0

    current_jd = jd[0]
    while current_jd <= jd[-1]:
        cheb_pos = get_position_from_chebyshev(segments, current_jd)
        if cheb_pos is None:
            current_jd += jd_interval
            continue

        idx = np.searchsorted(jd, current_jd)
        if idx == 0:
            orig_pos = (x[0], y[0], z[0])
        elif idx >= len(jd):
            orig_pos = (x[-1], y[-1], z[-1])
        else:
            t0, t1 = jd[idx - 1], jd[idx]
            dt = (t1 - t0) * 86400
            t_param = (current_jd - t0) / (t1 - t0)
            orig_pos = (
                hermite_interpolate(t_param, x[idx - 1], vx[idx - 1], x[idx], vx[idx], dt),
                hermite_interpolate(t_param, y[idx - 1], vy[idx - 1], y[idx], vy[idx], dt),
                hermite_interpolate(t_param, z[idx - 1], vz[idx - 1], z[idx], vz[idx], dt),
            )

        error = np.sqrt(
            (cheb_pos[0] - orig_pos[0]) ** 2
            + (cheb_pos[1] - orig_pos[1]) ** 2
            + (cheb_pos[2] - orig_pos[2]) ** 2
        )

        errors.append(error)
        total_error += error

        if error > max_error:
            max_error = error
            max_error_jd = current_jd

        current_jd += jd_interval

    sample_count = len(errors)
    mean_error = total_error / sample_count if sample_count > 0 else 0

    return {
        "sample_count": sample_count,
        "max_error_km": max_error,
        "max_error_jd": max_error_jd,
        "mean_error_km": mean_error,
        "tolerance_km": tolerance_km,
        "passed": max_error <= tolerance_km,
    }


# ============================================================================
# Main Functions
# ============================================================================


def convert_phase(phase_name: str, source_dir: Path, validate: bool = True, dry_run: bool = False) -> bool:
    """Convert a single phase."""
    if phase_name not in PHASES:
        print(f"Error: Unknown phase '{phase_name}'")
        return False

    config = PHASES[phase_name]
    source_path = source_dir / config["source"]
    cheb_path = OUTPUT_DIR / config["output_cheb"]
    meta_path = OUTPUT_DIR / config["output_meta"]

    print(f"\n{'=' * 60}")
    print(f"Converting {phase_name} phase")
    print(f"{'=' * 60}")
    print(f"  Source: {source_path}")
    print(f"  Output: {cheb_path}")
    print(f"  Tolerance: {config['tolerance_km']} km")

    if not source_path.exists():
        print(f"Error: Source file not found: {source_path}")
        return False

    if dry_run:
        print("  [DRY RUN] Would convert and write to output")
        return True

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load CY2 JSON data (with vx/vy swap correction)
    spacecraft_key = config.get("spacecraft_key", "CY2")
    print(f"\n  Loading CY2 JSON data (spacecraft: {spacecraft_key})...")
    data = load_cy2_json(source_path, spacecraft_key=spacecraft_key)
    print(f"    Data points: {len(data['jd'])}")

    # Compress using tolerance-driven algorithm
    print("\n  Compressing to Chebyshev polynomials...")
    segments = compress_orbit_data_tolerance(
        data,
        tolerance_km=config["tolerance_km"],
    )
    print(f"    Segments created: {len(segments)}")

    # Calculate compression statistics
    original_size = len(data["jd"]) * 3 * 8
    compressed_size = sum(
        len(s["cx"]) * 3 * 8 + 16 for s in segments
    )
    ratio = original_size / compressed_size
    print(f"    Compression ratio: {ratio:.1f}x")

    # Create Chebyshev output
    cheb_output = {
        "format": "chebyshev-ephemeris",
        "version": "1.0",
        "metadata": {
            "source": config["source"],
            "created": datetime.now(timezone.utc).isoformat(),
            "tolerance_km": config["tolerance_km"],
            "segments_count": len(segments),
            "coordinate_frame": "ECLIPJ2000",
            "units": {"time": "julian_date", "position": "km"},
            "vx_vy_swap_corrected": True,
        },
        "time_range": {
            "start": float(data["jd"][0]),
            "end": float(data["jd"][-1]),
        },
        "segments": segments,
    }

    # Create metadata output
    meta_output = {
        "format": "chebyshev-metadata",
        "version": "1.0",
        "created": datetime.now(timezone.utc).isoformat(),
        "source": config["source"],
        "phase": phase_name,
        "time_range": {
            "start_jd": float(data["jd"][0]),
            "end_jd": float(data["jd"][-1]),
        },
        "coordinate_frame": "ECLIPJ2000",
        "units": {"time": "julian_date", "position": "km", "velocity": "km/s"},
    }

    # Write output files
    print(f"\n  Writing {cheb_path}...")
    with open(cheb_path, "w") as f:
        json.dump(cheb_output, f, indent=2)

    print(f"  Writing {meta_path}...")
    with open(meta_path, "w") as f:
        json.dump(meta_output, f, indent=2)

    file_size = cheb_path.stat().st_size
    print(f"    Chebyshev file size: {file_size / 1024:.1f} KB")

    # Validate if requested
    if validate:
        print("\n  Validating accuracy...")
        result = validate_compression(
            data, segments, config["tolerance_km"]
        )
        print(f"    Samples tested: {result['sample_count']}")
        print(f"    Max error: {result['max_error_km']:.3f} km")
        print(f"    Mean error: {result['mean_error_km']:.3f} km")
        print(f"    Tolerance: {result['tolerance_km']} km")
        print(f"    Result: {'PASSED' if result['passed'] else 'FAILED'}")

        if not result["passed"]:
            print(f"\n  WARNING: Validation failed!")
            print(f"    Max error {result['max_error_km']:.3f} km exceeds tolerance {result['tolerance_km']} km")
            return False

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Convert CY2 JSON orbit data to Chebyshev polynomial format"
    )
    parser.add_argument(
        "--phase",
        choices=list(PHASES.keys()),
        help="Specific phase to convert (default: all)",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=DEFAULT_SOURCE_DIR,
        help=f"Source directory for CY2 JSON files (default: {DEFAULT_SOURCE_DIR})",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        default=True,
        help="Validate conversion accuracy (default: True)",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip validation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually converting",
    )

    args = parser.parse_args()

    validate = not args.no_validate

    phases = [args.phase] if args.phase else list(PHASES.keys())

    print("CY2 JSON to Chebyshev Converter")
    print("================================")
    print(f"Source directory: {args.source_dir}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Phases: {', '.join(phases)}")
    print(f"Validate: {validate}")
    print(f"Dry run: {args.dry_run}")
    print("\nNOTE: This script corrects the vx/vy swap bug from orbits.pl")

    success = True
    for phase in phases:
        if not convert_phase(phase, args.source_dir, validate=validate, dry_run=args.dry_run):
            success = False

    print("\n" + "=" * 60)
    if success:
        print("All phases converted successfully!")
    else:
        print("Some phases failed - see above for details")
        sys.exit(1)


if __name__ == "__main__":
    main()
