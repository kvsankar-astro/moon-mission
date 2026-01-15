#!/usr/bin/env python3
"""
Merge CY2 (Orbiter) and VIKRAM (Lander) vector data, then compress to Chebyshev.

This creates seamless trajectory data:
- Before separation: CY2 (Orbiter) data (Vikram was attached)
- After separation: VIKRAM (Lander) data (descent to crash)

Handles the vx/vy swap bug from orbits.pl.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from numpy.polynomial import chebyshev as cheb


# ============================================================================
# Configuration
# ============================================================================

SOURCE_DIR = Path("C:/sankar/projects/chandrayaan2")
OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "chandrayaan2" / "data"

PHASES = {
    "geo": {
        "source": "geo-cy2.json",
        "output_cheb": "geo-SC-cheb.json",
        "output_meta": "geo-SC-meta.json",
        "tolerance_km": 5,
    },
    "lunar": {
        "source": "lunar-cy2.json",
        "output_cheb": "lunar-SC-cheb.json",
        "output_meta": "lunar-SC-meta.json",
        "tolerance_km": 5,
    },
}


# ============================================================================
# Chebyshev Compression Functions (from compress-orbits.py)
# ============================================================================

def hermite_to_chebyshev(p0, v0, p1, v1, dt_jd):
    v0_jd = v0 * 86400
    v1_jd = v1 * 86400
    m0 = v0_jd * dt_jd
    m1 = v1_jd * dt_jd
    a = p0
    b = m0
    c = -3 * p0 + 3 * p1 - 2 * m0 - m1
    d = 2 * p0 - 2 * p1 + m0 + m1
    c0 = a + b / 2 + c / 4 + d / 8
    c1 = b / 2 + c / 2 + 3 * d / 8
    c2 = c / 4 + 3 * d / 8
    c3 = d / 8
    cheb_c0 = c0 + c2 / 2
    cheb_c1 = c1 + 3 * c3 / 4
    cheb_c2 = c2 / 2
    cheb_c3 = c3 / 4
    return [cheb_c0, cheb_c1, cheb_c2, cheb_c3]


def compress_segment(t, x, y, z, degree):
    t_start, t_end = float(t[0]), float(t[-1])
    t_norm = 2 * (t - t_start) / (t_end - t_start) - 1
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


def compress_segment_hermite(t_start, t_end, p0, v0, p1, v1):
    dt_jd = t_end - t_start
    return {
        "t_start": t_start,
        "t_end": t_end,
        "cx": hermite_to_chebyshev(p0[0], v0[0], p1[0], v1[0], dt_jd),
        "cy": hermite_to_chebyshev(p0[1], v0[1], p1[1], v1[1], dt_jd),
        "cz": hermite_to_chebyshev(p0[2], v0[2], p1[2], v1[2], dt_jd),
    }


def hermite_interpolate(t, p0, v0, p1, v1, dt):
    t2 = t * t
    t3 = t2 * t
    h00 = 2 * t3 - 3 * t2 + 1
    h10 = t3 - 2 * t2 + t
    h01 = -2 * t3 + 3 * t2
    h11 = t3 - t2
    return h00 * p0 + h10 * dt * v0 + h01 * p1 + h11 * dt * v1


def evaluate_chebyshev(coeffs, x):
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


def compress_orbit_data_tolerance(data, tolerance_km, max_degree=12, min_samples=2, max_samples=60):
    jd = data["jd"]
    x = data["x"]
    y = data["y"]
    z = data["z"]
    vx = data["vx"]
    vy = data["vy"]
    vz = data["vz"]
    n = len(jd)
    internal_tolerance = tolerance_km * 0.5

    def compute_segment_error(start_idx, end_idx, segment):
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

    def compress_range(start_idx, end_idx, depth=0):
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
            return [segment]
        mid_idx = (start_idx + end_idx) // 2
        left_segments = compress_range(start_idx, mid_idx + 1, depth + 1)
        right_segments = compress_range(mid_idx, end_idx, depth + 1)
        return left_segments + right_segments

    print(f"    Compressing {n} vectors (tolerance: {tolerance_km} km)...")
    segments = compress_range(0, n)
    lengths = [(s["t_end"] - s["t_start"]) * 24 * 60 for s in segments]
    print(f"    Segments: {len(segments)}, lengths: {min(lengths):.1f}-{max(lengths):.1f} min")
    return segments


# ============================================================================
# Data Loading and Merging
# ============================================================================

def load_and_merge_vectors(source_file):
    """
    Load CY2 and VIKRAM vectors, merge at separation boundary.
    Applies vx/vy swap correction.
    """
    print(f"  Loading {source_file}...")
    with open(source_file) as f:
        raw_data = json.load(f)

    cy2_vectors = raw_data['CY2']['vectors']
    vikram_vectors = raw_data['VIKRAM']['vectors']

    vikram_start_jd = float(vikram_vectors[0]['jdct'])

    # Get CY2 vectors before separation (exclusive)
    cy2_before = [v for v in cy2_vectors if float(v['jdct']) < vikram_start_jd]

    print(f"    CY2 vectors before separation: {len(cy2_before)}")
    print(f"    VIKRAM vectors: {len(vikram_vectors)}")
    print(f"    Separation JD: {vikram_start_jd}")

    # Merge vectors
    merged_vectors = cy2_before + vikram_vectors
    print(f"    Merged total: {len(merged_vectors)}")

    # Convert to numpy arrays with vx/vy swap correction
    n = len(merged_vectors)
    jd = np.array([float(v['jdct']) for v in merged_vectors])
    x = np.array([float(v['x']) for v in merged_vectors])
    y = np.array([float(v['y']) for v in merged_vectors])
    z = np.array([float(v['z']) for v in merged_vectors])
    # Swap vx/vy to correct orbits.pl bug
    vx = np.array([float(v['vy']) for v in merged_vectors])
    vy = np.array([float(v['vx']) for v in merged_vectors])
    vz = np.array([float(v['vz']) for v in merged_vectors])

    print(f"    Time range: JD {jd[0]:.6f} to {jd[-1]:.6f}")
    print(f"    Applied vx/vy swap correction")

    return {
        "jd": jd, "x": x, "y": y, "z": z,
        "vx": vx, "vy": vy, "vz": vz,
        "separation_jd": vikram_start_jd,
        "cy2_count": len(cy2_before),
        "vikram_count": len(vikram_vectors),
    }


def validate_compression(data, segments, tolerance_km, sample_interval_seconds=30):
    jd = data["jd"]
    x, y, z = data["x"], data["y"], data["z"]
    vx, vy, vz = data["vx"], data["vy"], data["vz"]
    jd_interval = sample_interval_seconds / 86400

    max_error = 0.0
    total_error = 0.0
    count = 0

    current_jd = jd[0]
    while current_jd <= jd[-1]:
        # Find segment
        seg = None
        for s in segments:
            if s["t_start"] <= current_jd <= s["t_end"]:
                seg = s
                break
        if seg is None:
            current_jd += jd_interval
            continue

        # Chebyshev position
        t_norm = 2 * (current_jd - seg["t_start"]) / (seg["t_end"] - seg["t_start"]) - 1
        cheb_pos = (
            evaluate_chebyshev(seg["cx"], t_norm),
            evaluate_chebyshev(seg["cy"], t_norm),
            evaluate_chebyshev(seg["cz"], t_norm),
        )

        # Interpolated original position
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
                hermite_interpolate(t_param, x[idx-1], vx[idx-1], x[idx], vx[idx], dt),
                hermite_interpolate(t_param, y[idx-1], vy[idx-1], y[idx], vy[idx], dt),
                hermite_interpolate(t_param, z[idx-1], vz[idx-1], z[idx], vz[idx], dt),
            )

        error = np.sqrt(sum((a-b)**2 for a, b in zip(cheb_pos, orig_pos)))
        max_error = max(max_error, error)
        total_error += error
        count += 1
        current_jd += jd_interval

    return {
        "max_error_km": max_error,
        "mean_error_km": total_error / count if count > 0 else 0,
        "sample_count": count,
        "passed": max_error <= tolerance_km,
    }


def process_phase(phase_name):
    config = PHASES[phase_name]
    source_path = SOURCE_DIR / config["source"]
    cheb_path = OUTPUT_DIR / config["output_cheb"]
    meta_path = OUTPUT_DIR / config["output_meta"]

    print(f"\n{'='*60}")
    print(f"Processing {phase_name} phase")
    print(f"{'='*60}")

    # Load and merge vectors
    data = load_and_merge_vectors(source_path)

    # Compress to Chebyshev
    segments = compress_orbit_data_tolerance(data, config["tolerance_km"])

    # Create output
    output = {
        "format": "chebyshev-ephemeris",
        "version": "1.0",
        "metadata": {
            "source": "merged CY2+VIKRAM vectors",
            "created": datetime.now(timezone.utc).isoformat(),
            "description": "CY2 (Orbiter) until separation, then VIKRAM (Lander) descent",
            "tolerance_km": config["tolerance_km"],
            "segments_count": len(segments),
            "coordinate_frame": "ECLIPJ2000",
            "units": {"time": "julian_date", "position": "km"},
            "separation_jd": data["separation_jd"],
            "cy2_vectors": data["cy2_count"],
            "vikram_vectors": data["vikram_count"],
            "vx_vy_swap_corrected": True,
        },
        "time_range": {
            "start": float(data["jd"][0]),
            "end": float(data["jd"][-1]),
        },
        "segments": segments,
    }

    # Write files
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n  Writing {cheb_path}...")
    with open(cheb_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"    Size: {cheb_path.stat().st_size / 1024:.1f} KB")

    # Validate
    print("\n  Validating...")
    result = validate_compression(data, segments, config["tolerance_km"])
    print(f"    Max error: {result['max_error_km']:.3f} km")
    print(f"    Mean error: {result['mean_error_km']:.3f} km")
    print(f"    Result: {'PASSED' if result['passed'] else 'FAILED'}")

    return result["passed"]


def main():
    print("CY2 + VIKRAM Vector Merge and Chebyshev Compression")
    print("="*60)

    success = True
    for phase in PHASES:
        if not process_phase(phase):
            success = False

    print("\n" + "="*60)
    if success:
        print("All phases processed successfully!")
    else:
        print("Some phases failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
