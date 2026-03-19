# Relative Mode (Earth-Moon Axis Fixed)

This document describes the relative-frame display mode used by `mode=relative`.

In this mode:
- Earth stays at the origin.
- The Earth->Moon axis is fixed to +X.
- Moon distance still varies with time (real scale, not normalized).

## Goals

- Make translunar transfer structure easier to read than inertial `geo`/`lunar` views.
- Keep default inertial behavior unchanged when relative mode is not selected.
- Precompute relative orbit data offline (Chebyshev) to minimize runtime transforms.

## Entry Points

### URL

- `mission.html?mission=<id>&mode=relative`
- Relative mode is URL-driven. Entering or leaving it causes a page reload.

### Settings Panel

Origin/Phase is controlled by three radio options:
- `Earth` (`#origin-earth`)
- `Moon` (`#origin-moon`)
- `Relative` (`#origin-relative`)

Current selection remains visible but disabled. The other two remain enabled.

### Mission Selector

The selector page (`mission.html` without `mission=`) has a checkbox that appends/removes `mode=relative` from mission links.

## Mode Switching and Time Preservation

Relative-mode switching logic is in `assets/platform/js/app/relative-mode.js`.

- Animation time is preserved across reload using session storage key:
  - `cy3.animTimeOverride`
- Leaving relative mode records an origin override (`geo` or `lunar`) using:
  - `cy3.originOverride`
- Startup restore path:
  - `mission-view-bootstrap.js` consumes session overrides
  - `mission-runtime-handlers-entry.js` forwards startup override into init flags
  - `init-orchestration.js` applies `startupAnimTimeOverride` before normal reset/start behavior

This is why switching into/out of relative mode preserves mission time even though that transition reloads the page.

## Coordinate Frame Definition

At each time `t`, using geocentric Moon state `r_EM(t), v_EM(t)`:

- `x_hat = normalize(r_EM)`
- `z_hat = normalize(r_EM x v_EM)`
- `y_hat = z_hat x x_hat`

For geocentric spacecraft position `r_SE(t)`, relative coordinates are:

- `x_rel = dot(r_SE, x_hat)`
- `y_rel = dot(r_SE, y_hat)`
- `z_rel = dot(r_SE, z_hat)`

This keeps the Moon on +X at `(||r_EM||, 0, 0)`.

## Runtime Integration

Relative mode stays on `geo` as the base origin but swaps orbit data source:

- In `init-config-scene-setup.js`, geo orbit URLs are replaced with:
  - `relative-<SPACECRAFT>-cheb.json`

Additional runtime adjustments:

- Moon state is represented in relative coordinates as `(distance, 0, 0)` with radial velocity `(dr/dt, 0, 0)` in `scene-state.js`.
- Sun direction is rotated into the same relative frame for consistent lighting in `scene-state.js`.

## Data Generation

Relative files are produced by `scripts/generate-relative-orbits.py`.

Inputs:
- Geocentric NPZ from `data-generated/<mission>/<geo-orbits-file>.npz`
- `SC_vectors` and `MOON_vectors` from that NPZ

Outputs:
- `assets/<mission>/data/relative-<SPACECRAFT>-cheb.json`
- Intermediate debug NPZ: `data-generated/<mission>/relative-<SPACECRAFT>.npz`

Velocity note:
- Relative Chebyshev is fit on rotated positions.
- Runtime velocity comes from analytic derivative of those Chebyshev polynomials.

## Commands

```bash
# Ensure geocentric source data exists
python scripts/orbits.py --mission=<mission> --phase=geo

# Generate relative Chebyshev
python scripts/generate-relative-orbits.py --mission <mission>

# Optional batch generation
python scripts/generate-relative-orbits.py --all --exclude artemis1 --ensure-npz
```

Open:

```text
mission.html?mission=<id>&mode=relative
```

## Relative Files Currently Committed

- `assets/apollo10-lm/data/relative-SNOOPY-cheb.json`
- `assets/apollo11-sivb/data/relative-SIVB-cheb.json`
- `assets/artemis1/data/relative-ORION-cheb.json`
- `assets/chandrayaan2/data/relative-CY2-cheb.json`
- `assets/chandrayaan3/data/relative-CY3-cheb.json`
