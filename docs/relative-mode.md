# Relative Mode (Earth–Moon Axis Fixed)

This document describes the design and implementation for a display mode that shows spacecraft orbits in an **Earth-centered rotating frame** where the **Earth→Moon axis is always the +X axis**.

## Goals

- Provide the classic Earth–Moon transfer “figure-8 / lobe” orbit visualizations that are hard to see in inertial `geo` and `lunar` modes.
- Keep **Earth at the origin**.
- Keep **real scale** (Moon distance varies over time; no normalization).
- Avoid any test/baseline churn: existing UI/visual regression tests should pass **unchanged**.
- Prefer offline computation (pre-generate Chebyshev data) to minimize runtime work.

## UX / Entry Points

### URL parameter

- `mission.html?mission=<id>&mode=relative`

Notes:
- `mode=relative` is **additive** and defaults to the current behavior when absent.

### Settings panel toggle

The Settings panel includes a **Relative** checkbox under **Origin/Phase**. Toggling it reloads the page with (or without) `mode=relative`.

### Mission selector toggle

The mission selector page (`mission.html` with no `mission=` param) includes a checkbox that appends `&mode=relative` to mission links when enabled.

## Coordinate Frame Definition (Earth-centered rotating frame)

At each time `t`:

- Let `r_EM(t)` and `v_EM(t)` be Moon position/velocity relative to Earth (geocentric), in the same coordinate frame as the spacecraft ephemeris (ECLIPJ2000).
- Define the basis:
  - `x̂(t) = normalize(r_EM(t))`
  - `ẑ(t) = normalize(r_EM(t) × v_EM(t))` (Earth–Moon orbital angular momentum direction)
  - `ŷ(t) = ẑ(t) × x̂(t)`
- For an Earth-centered spacecraft position `r_SE(t)`, compute **relative mode coordinates**:
  - `x_rel = dot(r_SE, x̂)`
  - `y_rel = dot(r_SE, ŷ)`
  - `z_rel = dot(r_SE, ẑ)`

This yields a rotating frame where the Moon lies on the +X axis at `(‖r_EM‖, 0, 0)` at all times.

## Velocity Semantics

In a rotating frame, the physically consistent “relative velocity” is the time derivative of the rotating-frame coordinates:

- If `r_rel(t) = R(t) r_SE(t)`, then `v_rel(t) = d/dt r_rel(t)`.

In this project, the Chebyshev evaluator provides analytic derivatives (velocity) from the polynomial. If we precompute `r_rel(t)` and fit Chebyshev to it, then the runtime “velocity” naturally becomes `d/dt r_rel(t)` — i.e. rotating-frame velocity — without needing explicit `-ω×r` handling in the renderer.

## Offline Data Generation (preferred)

Relative mode is driven by a new precomputed Chebyshev file per mission:

- `assets/<mission>/data/relative-<SPACECRAFT>-cheb.json`

### Generator script

A new script generates relative-mode ephemeris from the mission’s existing **geocentric** NPZ data:

- Input: `data-generated/<mission>/<geo-orbits-file>.npz`
- Output:
  - `assets/<mission>/data/relative-<SPACECRAFT>-cheb.json`

The script (high level):
1. Loads `SC_vectors` from the NPZ file.
2. Loads `MOON_vectors` from the same NPZ to obtain `r_EM(t), v_EM(t)` at each sample time.
3. Computes `r_rel(t)` using the basis definition above.
4. Fits Chebyshev segments (same tolerance-driven algorithm as `scripts/compress-orbits.py`).
5. Writes `relative-<SPACECRAFT>-cheb.json` in the standard Chebyshev format.

## Runtime Integration (minimal, gated)

Relative mode must not affect existing default behavior:

- When `mode!=relative`: behavior is unchanged.
- When `mode=relative`:
  - The app still uses `geo` as the underlying origin selection.
  - Orbit loading is overridden to load `relative-<SPACECRAFT>-cheb.json` instead of `geo-<SPACECRAFT>-cheb.json`.
  - The Moon state returned by the functional core is adapted to `(distance, 0, 0)` (and a consistent 1D radial velocity).

## Usage

Generate relative ephemeris after creating the mission’s `geo` NPZ:

```bash
python scripts/orbits.py --mission=<mission> --phase=geo
python scripts/generate-relative-orbits.py --mission=<mission>
```

Batch generation helpers:

```bash
# Multiple missions
python scripts/generate-relative-orbits.py --mission chandrayaan2 apollo11-sivb apollo10-lm

# All missions under assets/ except some (optionally generate NPZ if missing)
python scripts/generate-relative-orbits.py --all --exclude artemis1 --ensure-npz
```

Then view:

```text
mission.html?mission=<id>&mode=relative
```

## Pre-generated relative files in repo

These missions have committed `relative-<SPACECRAFT>-cheb.json` files:

- `assets/artemis1/data/relative-ORION-cheb.json`
- `assets/chandrayaan2/data/relative-CY2-cheb.json`
- `assets/apollo11-sivb/data/relative-SIVB-cheb.json`
- `assets/apollo10-lm/data/relative-SNOOPY-cheb.json`
