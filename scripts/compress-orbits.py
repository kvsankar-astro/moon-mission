#!/usr/bin/env python3
"""
Chebyshev Polynomial Compression for Ephemeris Data

This script compresses NPZ orbit data files into Chebyshev polynomial format
for efficient storage and smooth interpolation.

Usage:
    python scripts/compress-orbits.py                    # Compress all phases
    python scripts/compress-orbits.py --phase=geo       # Compress specific phase
    python scripts/compress-orbits.py --validate        # Validate after compression
    python scripts/compress-orbits.py --dry-run         # Show what would be done

Output Format Specification: docs/chebyshev-format-spec.md
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

DATA_DIR = Path(__file__).parent.parent / "assets" / "chandrayaan3" / "data"

# Phase configurations
PHASES = {
    "geo": {
        "npz": "geo-CY3.npz",
        "cheb": "geo-CY3-cheb.json",
        "tolerance_km": 5,  # Target: 5 km max error
    },
    "lunar": {
        "npz": "lunar-CY3.npz",
        "cheb": "lunar-CY3-cheb.json",
        "tolerance_km": 5,
    },
    "landing": {
        "npz": "landing-CY3.npz",
        "cheb": "landing-CY3-cheb.json",
        "tolerance_km": 2,  # Tighter for landing
    },
}


# ============================================================================
# Compression Functions
# ============================================================================


def load_npz(filepath: Path) -> dict:
    """Load NPZ file and return dict with jd, x, y, z, vx, vy, vz arrays.

    The NPZ files contain structured arrays:
    - SC_vectors: spacecraft position/velocity with fields (jdct, x, y, z, vx, vy, vz)

    Note: Velocity is computed from numerical derivatives of position for accuracy,
    as NPZ velocity fields may have coordinate labeling issues.
    """
    data = np.load(filepath)
    sc = data["SC_vectors"]

    jd = sc["jdct"]
    x, y, z = sc["x"], sc["y"], sc["z"]
    n = len(jd)

    # Compute velocity from central differences of position (km/s)
    vx = np.zeros(n)
    vy = np.zeros(n)
    vz = np.zeros(n)

    # Interior points: central difference
    for i in range(1, n - 1):
        dt = (jd[i + 1] - jd[i - 1]) * 86400  # seconds
        vx[i] = (x[i + 1] - x[i - 1]) / dt
        vy[i] = (y[i + 1] - y[i - 1]) / dt
        vz[i] = (z[i + 1] - z[i - 1]) / dt

    # Edge points: forward/backward difference
    if n > 1:
        dt0 = (jd[1] - jd[0]) * 86400
        vx[0] = (x[1] - x[0]) / dt0
        vy[0] = (y[1] - y[0]) / dt0
        vz[0] = (z[1] - z[0]) / dt0

        dtn = (jd[-1] - jd[-2]) * 86400
        vx[-1] = (x[-1] - x[-2]) / dtn
        vy[-1] = (y[-1] - y[-2]) / dtn
        vz[-1] = (z[-1] - z[-2]) / dtn

    return {
        "jd": jd,
        "x": x, "y": y, "z": z,
        "vx": vx, "vy": vy, "vz": vz,
    }


def compress_segment(
    t: np.ndarray,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    degree: int,
) -> dict:
    """
    Compress a segment of orbit data to Chebyshev coefficients.

    Parameters:
        t: array of Julian dates
        x, y, z: position coordinates (km)
        degree: polynomial degree

    Returns:
        dict with time bounds and coefficients
    """
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
    """
    Convert Hermite cubic (2 points with velocities) to Chebyshev coefficients.

    The Hermite cubic P(t) for t in [0, 1] is:
        P(t) = h00*p0 + h10*dt*v0 + h01*p1 + h11*dt*v1
    where:
        h00 = 2t³ - 3t² + 1
        h10 = t³ - 2t² + t
        h01 = -2t³ + 3t²
        h11 = t³ - t²

    For Chebyshev with t_norm in [-1, 1], we have t = (t_norm + 1) / 2.

    Parameters:
        p0, p1: positions at start and end
        v0, v1: velocities at start and end (km/s)
        dt_jd: time interval in Julian days

    Returns:
        Chebyshev coefficients [c0, c1, c2, c3]
    """
    # Convert velocity to km per Julian day (internal units)
    v0_jd = v0 * 86400  # km/s -> km/day
    v1_jd = v1 * 86400

    # Scale velocity by the interval length
    m0 = v0_jd * dt_jd  # slope * interval = delta in km
    m1 = v1_jd * dt_jd

    # Hermite cubic in standard form P(t) = a + b*t + c*t² + d*t³ for t in [0, 1]:
    # P(0) = p0, P(1) = p1, P'(0) = m0, P'(1) = m1
    # gives:
    a = p0
    b = m0
    c = -3 * p0 + 3 * p1 - 2 * m0 - m1
    d = 2 * p0 - 2 * p1 + m0 + m1

    # Convert from t in [0, 1] to t_norm in [-1, 1] using t = (t_norm + 1) / 2
    # P(t_norm) = a + b*(t_norm+1)/2 + c*((t_norm+1)/2)² + d*((t_norm+1)/2)³
    # Expand and collect coefficients for powers of t_norm:

    # For t_norm: t = (t_norm + 1) / 2
    # (t_norm + 1)/2 = t_norm/2 + 1/2
    # ((t_norm + 1)/2)² = t_norm²/4 + t_norm/2 + 1/4
    # ((t_norm + 1)/2)³ = t_norm³/8 + 3*t_norm²/8 + 3*t_norm/8 + 1/8

    # Constant term (t_norm^0):
    c0 = a + b / 2 + c / 4 + d / 8
    # Linear term (t_norm^1):
    c1 = b / 2 + c / 2 + 3 * d / 8
    # Quadratic term (t_norm^2):
    c2 = c / 4 + 3 * d / 8
    # Cubic term (t_norm^3):
    c3 = d / 8

    # Convert from power basis to Chebyshev basis
    # T_0(x) = 1, T_1(x) = x, T_2(x) = 2x² - 1, T_3(x) = 4x³ - 3x
    # So: 1 = T_0, x = T_1, x² = (T_2 + 1)/2, x³ = (T_3 + 3*T_1)/4
    # P(x) = c0 + c1*x + c2*x² + c3*x³
    #      = c0 + c1*T_1 + c2*(T_2 + 1)/2 + c3*(T_3 + 3*T_1)/4
    #      = (c0 + c2/2) + (c1 + 3*c3/4)*T_1 + (c2/2)*T_2 + (c3/4)*T_3

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
    """
    Create a Chebyshev segment from two endpoints using Hermite interpolation.

    This produces a cubic (degree 3) segment that exactly matches position and
    velocity at both endpoints, providing much better accuracy than linear fit
    for highly curved orbital sections.

    Parameters:
        t_start, t_end: Julian dates at endpoints
        p0, p1: (x, y, z) positions at start and end
        v0, v1: (vx, vy, vz) velocities at start and end (km/s)

    Returns:
        dict with time bounds and Chebyshev coefficients
    """
    dt_jd = t_end - t_start

    return {
        "t_start": t_start,
        "t_end": t_end,
        "cx": hermite_to_chebyshev(p0[0], v0[0], p1[0], v1[0], dt_jd),
        "cy": hermite_to_chebyshev(p0[1], v0[1], p1[1], v1[1], dt_jd),
        "cz": hermite_to_chebyshev(p0[2], v0[2], p1[2], v1[2], dt_jd),
    }


def hermite_interpolate(t: float, p0: float, v0: float, p1: float, v1: float, dt: float) -> float:
    """
    Hermite cubic interpolation between two points.

    Parameters:
        t: normalized parameter in [0, 1]
        p0, p1: positions at start and end
        v0, v1: velocities at start and end (km/s)
        dt: time interval in seconds

    Returns:
        interpolated position
    """
    t2 = t * t
    t3 = t2 * t

    # Hermite basis functions
    h00 = 2 * t3 - 3 * t2 + 1
    h10 = t3 - 2 * t2 + t
    h01 = -2 * t3 + 3 * t2
    h11 = t3 - t2

    # P(t) = h00*P0 + h10*dt*V0 + h01*P1 + h11*dt*V1
    return h00 * p0 + h10 * dt * v0 + h01 * p1 + h11 * dt * v1


def compress_orbit_data_tolerance(
    npz_data: dict,
    tolerance_km: float,
    max_degree: int = 12,
    min_samples: int = 2,   # Minimum 2 points (can go down to just endpoints)
    max_samples: int = 60,  # Max 1 hour at 1-minute intervals
    optimize_degree: bool = True,  # Find minimum degree that meets tolerance
) -> list[dict]:
    """
    Compress orbit data with tolerance-driven adaptive segmentation.

    Starts with large segments and recursively splits until tolerance is met.
    Uses Hermite interpolation for accurate midpoint validation.

    Parameters:
        npz_data: dict with jd, x, y, z, vx, vy, vz arrays
        tolerance_km: maximum allowed error in km
        max_degree: maximum polynomial degree (will use min(max_degree, n_samples//2))
        min_samples: minimum samples per segment
        max_samples: maximum samples per segment (forces splitting)

    Returns:
        list of segment dicts
    """
    jd = npz_data["jd"]
    x = npz_data["x"]
    y = npz_data["y"]
    z = npz_data["z"]
    vx = npz_data["vx"]
    vy = npz_data["vy"]
    vz = npz_data["vz"]
    n = len(jd)

    def compute_segment_error(start_idx: int, end_idx: int, segment: dict) -> float:
        """Compute max error for a segment at multiple points between data points.

        Uses Hermite interpolation for accurate ground truth.
        Checks at all data points plus 3 intermediate points (quarter, midpoint, three-quarter)
        to match validation interval of 30 seconds for 1-minute data.
        """
        max_error = 0.0
        t_span = segment["t_end"] - segment["t_start"]

        # Check all data points in the segment
        for i in range(start_idx, end_idx):
            t_norm = 2 * (jd[i] - segment["t_start"]) / t_span - 1
            cheb_x = evaluate_chebyshev(segment["cx"], t_norm)
            cheb_y = evaluate_chebyshev(segment["cy"], t_norm)
            cheb_z = evaluate_chebyshev(segment["cz"], t_norm)
            error = np.sqrt((cheb_x - x[i])**2 + (cheb_y - y[i])**2 + (cheb_z - z[i])**2)
            max_error = max(max_error, error)

            # Check intermediate points between this data point and the next (except for last point)
            if i < end_idx - 1:
                dt = (jd[i + 1] - jd[i]) * 86400  # Time interval in seconds

                # Check at t=0.25, 0.5, 0.75 (quarter, mid, three-quarter)
                for t_param in [0.25, 0.5, 0.75]:
                    jd_interp = jd[i] + t_param * (jd[i + 1] - jd[i])
                    t_norm_interp = 2 * (jd_interp - segment["t_start"]) / t_span - 1

                    # Hermite interpolation for accurate ground truth
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
        """Recursively compress a range, splitting if tolerance not met or too long."""
        n_samples = end_idx - start_idx

        # Force split if segment is too long (regardless of error)
        if n_samples > max_samples:
            mid_idx = (start_idx + end_idx) // 2
            left_segments = compress_range(start_idx, mid_idx + 1, depth + 1)
            right_segments = compress_range(mid_idx, end_idx, depth + 1)
            return left_segments + right_segments

        if n_samples == 2:
            # With only 2 data points, use Hermite interpolation (cubic) instead of linear
            # This uses velocities at endpoints to create a much more accurate curve
            segment = compress_segment_hermite(
                jd[start_idx], jd[end_idx - 1],
                (x[start_idx], y[start_idx], z[start_idx]),
                (vx[start_idx], vy[start_idx], vz[start_idx]),
                (x[end_idx - 1], y[end_idx - 1], z[end_idx - 1]),
                (vx[end_idx - 1], vy[end_idx - 1], vz[end_idx - 1]),
            )
            error = compute_segment_error(start_idx, end_idx, segment)
        else:
            # 3+ samples: fit Chebyshev polynomials with adaptive degree
            max_possible_degree = min(max_degree, n_samples // 2 - 1)
            max_possible_degree = max(1, max_possible_degree)

            if optimize_degree:
                # Try increasing degrees until tolerance is met
                # Start at degree 2 (linear often insufficient for orbits)
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
                        # Found minimum degree that works
                        segment = test_segment
                        error = test_error
                        break
                    # Keep track of best so far in case none meet tolerance
                    if test_error < error:
                        segment = test_segment
                        error = test_error
                # If no degree met tolerance, segment holds the best attempt
                if segment is None:
                    segment = compress_segment(
                        jd[start_idx:end_idx],
                        x[start_idx:end_idx],
                        y[start_idx:end_idx],
                        z[start_idx:end_idx],
                        max_possible_degree,
                    )
                    error = compute_segment_error(start_idx, end_idx, segment)
            else:
                # Original behavior: use max degree
                degree = max_possible_degree
                segment = compress_segment(
                    jd[start_idx:end_idx],
                    x[start_idx:end_idx],
                    y[start_idx:end_idx],
                    z[start_idx:end_idx],
                    degree,
                )
                error = compute_segment_error(start_idx, end_idx, segment)

        if error <= internal_tolerance:
            # Acceptable
            return [segment]

        if n_samples <= min_samples:
            # Can't split further - use this segment but warn if error is high
            if error > internal_tolerance * 5:
                print(f"      WARNING: High error {error:.1f} km at idx {start_idx}-{end_idx} (can't split further)")
            return [segment]

        # Split in half and recurse
        mid_idx = (start_idx + end_idx) // 2

        # Left half ends at mid, right half starts at mid (shared point)
        left_segments = compress_range(start_idx, mid_idx + 1, depth + 1)
        right_segments = compress_range(mid_idx, end_idx, depth + 1)

        return left_segments + right_segments

    # With Hermite interpolation revealing true errors, use 50% margin
    # to ensure we genuinely meet the tolerance requirement
    internal_tolerance = tolerance_km * 0.5
    print(f"    Tolerance-driven compression (target: {tolerance_km} km, internal: {internal_tolerance:.1f} km, Hermite, optimize_degree={optimize_degree})")
    segments = compress_range(0, n)

    # Report segment length statistics
    lengths = [(s["t_end"] - s["t_start"]) * 24 * 60 for s in segments]  # in minutes
    print(f"    Segment lengths: {min(lengths):.1f} to {max(lengths):.1f} min (mean: {np.mean(lengths):.1f} min)")

    # Report degree statistics
    degrees = [len(s["cx"]) - 1 for s in segments]  # degree = num_coeffs - 1
    print(f"    Polynomial degrees: {min(degrees)} to {max(degrees)} (mean: {np.mean(degrees):.1f})")

    # Report coefficient count
    total_coeffs = sum(len(s["cx"]) + len(s["cy"]) + len(s["cz"]) for s in segments)
    print(f"    Total coefficients: {total_coeffs:,}")

    return segments


def evaluate_chebyshev(coeffs: list, x: float) -> float:
    """
    Evaluate Chebyshev polynomial using Clenshaw recurrence.

    Parameters:
        coeffs: Chebyshev coefficients [c0, c1, c2, ...]
        x: normalized time in [-1, 1]

    Returns:
        evaluated value
    """
    n = len(coeffs)
    if n == 0:
        return 0.0
    if n == 1:
        return coeffs[0]

    b_k1 = 0.0  # b_{k+1}
    b_k2 = 0.0  # b_{k+2}

    for k in range(n - 1, 0, -1):
        b_k = coeffs[k] + 2 * x * b_k1 - b_k2
        b_k2 = b_k1
        b_k1 = b_k

    return coeffs[0] + x * b_k1 - b_k2


def get_position_from_chebyshev(segments: list, jd: float) -> tuple | None:
    """
    Get position from Chebyshev data at a specific Julian date.

    Parameters:
        segments: list of segment dicts
        jd: Julian date

    Returns:
        (x, y, z) tuple or None if out of range
    """
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
    npz_data: dict,
    segments: list,
    tolerance_km: float,
    sample_interval_seconds: float = 30,
) -> dict:
    """
    Validate Chebyshev compression against original NPZ data.

    Uses Hermite interpolation for accurate position estimation between data points.

    Parameters:
        npz_data: original NPZ data with jd, x, y, z, vx, vy, vz arrays
        segments: compressed Chebyshev segments
        tolerance_km: maximum allowed error in km
        sample_interval_seconds: sampling interval for validation

    Returns:
        dict with validation results
    """
    jd = npz_data["jd"]
    x = npz_data["x"]
    y = npz_data["y"]
    z = npz_data["z"]
    vx = npz_data["vx"]
    vy = npz_data["vy"]
    vz = npz_data["vz"]

    jd_interval = sample_interval_seconds / 86400  # Convert to Julian date

    errors = []
    max_error = 0.0
    max_error_jd = None
    total_error = 0.0

    # Interpolate NPZ data at sample points
    current_jd = jd[0]
    while current_jd <= jd[-1]:
        # Get Chebyshev position
        cheb_pos = get_position_from_chebyshev(segments, current_jd)
        if cheb_pos is None:
            current_jd += jd_interval
            continue

        # Interpolate NPZ position using Hermite interpolation
        idx = np.searchsorted(jd, current_jd)
        if idx == 0:
            npz_pos = (x[0], y[0], z[0])
        elif idx >= len(jd):
            npz_pos = (x[-1], y[-1], z[-1])
        else:
            # Hermite cubic interpolation for accurate ground truth
            t0, t1 = jd[idx - 1], jd[idx]
            dt = (t1 - t0) * 86400  # Time interval in seconds
            t_param = (current_jd - t0) / (t1 - t0)  # Normalized parameter [0, 1]
            npz_pos = (
                hermite_interpolate(t_param, x[idx - 1], vx[idx - 1], x[idx], vx[idx], dt),
                hermite_interpolate(t_param, y[idx - 1], vy[idx - 1], y[idx], vy[idx], dt),
                hermite_interpolate(t_param, z[idx - 1], vz[idx - 1], z[idx], vz[idx], dt),
            )

        # Calculate error
        error = np.sqrt(
            (cheb_pos[0] - npz_pos[0]) ** 2
            + (cheb_pos[1] - npz_pos[1]) ** 2
            + (cheb_pos[2] - npz_pos[2]) ** 2
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


def compress_phase(phase_name: str, validate: bool = True, dry_run: bool = False) -> bool:
    """
    Compress a single phase and optionally validate.

    Returns:
        True if successful (and validation passed if enabled)
    """
    if phase_name not in PHASES:
        print(f"Error: Unknown phase '{phase_name}'")
        return False

    config = PHASES[phase_name]
    npz_path = DATA_DIR / config["npz"]
    cheb_path = DATA_DIR / config["cheb"]

    print(f"\n{'=' * 60}")
    print(f"Compressing {phase_name} phase")
    print(f"{'=' * 60}")
    print(f"  Source: {npz_path}")
    print(f"  Output: {cheb_path}")
    print(f"  Tolerance: {config['tolerance_km']} km")

    if not npz_path.exists():
        print(f"Error: Source file not found: {npz_path}")
        return False

    if dry_run:
        print("  [DRY RUN] Would compress and write to output")
        return True

    # Load NPZ data
    print("\n  Loading NPZ data...")
    npz_data = load_npz(npz_path)
    print(f"    Data points: {len(npz_data['jd'])}")
    print(f"    Time range: JD {npz_data['jd'][0]:.6f} to {npz_data['jd'][-1]:.6f}")

    # Compress using tolerance-driven algorithm
    print("\n  Compressing to Chebyshev polynomials...")
    segments = compress_orbit_data_tolerance(
        npz_data,
        tolerance_km=config["tolerance_km"],
    )
    print(f"    Segments created: {len(segments)}")

    # Calculate compression statistics
    original_size = len(npz_data["jd"]) * 3 * 8  # 3 coords * 8 bytes
    compressed_size = sum(
        len(s["cx"]) * 3 * 8 + 16 for s in segments  # coeffs + time bounds
    )
    ratio = original_size / compressed_size
    print(f"    Compression ratio: {ratio:.1f}x")

    # Create output structure
    output = {
        "format": "chebyshev-ephemeris",
        "version": "1.0",
        "metadata": {
            "source": config["npz"],
            "created": datetime.now(timezone.utc).isoformat(),
            "tolerance_km": config["tolerance_km"],
            "segments_count": len(segments),
            "coordinate_frame": "J2000",
            "units": {"time": "julian_date", "position": "km"},
        },
        "time_range": {
            "start": float(npz_data["jd"][0]),
            "end": float(npz_data["jd"][-1]),
        },
        "segments": segments,
    }

    # Write output
    print(f"\n  Writing {cheb_path}...")
    with open(cheb_path, "w") as f:
        json.dump(output, f, indent=2)

    file_size = cheb_path.stat().st_size
    print(f"    File size: {file_size / 1024:.1f} KB")

    # Validate if requested
    if validate:
        print("\n  Validating accuracy...")
        result = validate_compression(
            npz_data, segments, config["tolerance_km"]
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
        description="Compress ephemeris data using Chebyshev polynomials"
    )
    parser.add_argument(
        "--phase",
        choices=list(PHASES.keys()),
        help="Specific phase to compress (default: all)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        default=True,
        help="Validate compression accuracy (default: True)",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip validation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually compressing",
    )

    args = parser.parse_args()

    validate = not args.no_validate

    phases = [args.phase] if args.phase else list(PHASES.keys())

    print("Chebyshev Polynomial Compression")
    print("=================================")
    print(f"Data directory: {DATA_DIR}")
    print(f"Phases: {', '.join(phases)}")
    print(f"Validate: {validate}")
    print(f"Dry run: {args.dry_run}")

    success = True
    for phase in phases:
        if not compress_phase(phase, validate=validate, dry_run=args.dry_run):
            success = False

    print("\n" + "=" * 60)
    if success:
        print("All phases compressed successfully!")
    else:
        print("Some phases failed - see above for details")
        sys.exit(1)


if __name__ == "__main__":
    main()
