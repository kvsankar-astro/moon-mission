# Chebyshev Ephemeris Format Specification

## Overview

This document defines the JSON format used for Chebyshev-compressed ephemeris data in this repository.

The runtime consumes these files via `src/platform/js/chebyshev.js` and reconstructs:
- Position `(x, y, z)` in km
- Velocity `(vx, vy, vz)` in km/s (analytic derivative of Chebyshev polynomials)

## File Naming

Common files per mission in `assets/<mission>/data/`:

- `geo-<ID>-cheb.json` - Earth-centered/or geocentric phase
- `lunar-<ID>-cheb.json` - Moon-centered/selenocentric phase
- `landing-<ID>-cheb.json` - Legacy landing file (may still exist)
- `landing-<ID>-geo-cheb.json` - Landing data expressed in geo frame
- `landing-<ID>-lunar-cheb.json` - Landing data expressed in lunar frame
- `relative-<ID>-cheb.json` - Earth-centered rotating relative frame (`mode=relative`)

`<ID>` is typically mission mnemonic from `config.json` (`spacecraft_mnemonic`).

## JSON Structure

```json
{
  "format": "chebyshev-ephemeris",
  "version": "1.0",
  "metadata": {
    "source": "geo-CY3.npz",
    "created": "2026-01-14T02:30:29.667048+00:00",
    "tolerance_km": 5,
    "segments_count": 2066,
    "coordinate_frame": "J2000",
    "units": {
      "time": "julian_date",
      "position": "km"
    }
  },
  "time_range": {
    "start": 2460139.890972222,
    "end": 2460194.022916667
  },
  "segments": [
    {
      "t_start": 2460139.890972222,
      "t_end": 2460139.918055556,
      "cx": [-233.13, 6782.74, 325.48],
      "cy": [-8885.77, -5924.94, 1306.44],
      "cz": [381.99, -132.79, -71.70]
    }
  ]
}
```

## Field Definitions

### Root Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `format` | string | yes | Must be `"chebyshev-ephemeris"` |
| `version` | string | yes | Format version (`"1.0"`) |
| `metadata` | object | yes | Source/compression metadata |
| `time_range` | object | yes | Overall coverage |
| `segments` | array | yes | Piecewise Chebyshev segments |

### `metadata`

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | Source NPZ filename |
| `created` | string | yes | ISO timestamp of generation |
| `tolerance_km` | number | yes | Compression tolerance used |
| `segments_count` | number | yes | Number of segments written |
| `coordinate_frame` | string | yes | Frame label (currently `"J2000"`) |
| `units` | object | yes | Unit block |
| `derived_from` | string | no | Present for derived products (for example relative mode) |
| `mode` | string | no | Present for derived products (for example `"relative"`) |

Notes:
- Older files/docs may mention `segment_hours` or `polynomial_degree`; current generator output does not require them.
- Relative files usually include both `derived_from` and `mode`.

### `units`

| Field | Type | Required | Description |
|---|---|---|---|
| `time` | string | yes | `"julian_date"` |
| `position` | string | yes | `"km"` |

### `time_range`

| Field | Type | Required | Description |
|---|---|---|---|
| `start` | number | yes | First sample JD |
| `end` | number | yes | Last sample JD |

### Segment Object

| Field | Type | Required | Description |
|---|---|---|---|
| `t_start` | number | yes | Segment start JD |
| `t_end` | number | yes | Segment end JD |
| `cx` | number[] | yes | X-axis Chebyshev coefficients |
| `cy` | number[] | yes | Y-axis Chebyshev coefficients |
| `cz` | number[] | yes | Z-axis Chebyshev coefficients |

The number of coefficients can vary segment-to-segment (adaptive compression).

## Evaluation

At runtime (`src/platform/js/chebyshev.js`):

1. Find segment with `t_start <= jd <= t_end`.
2. Normalize time to `[-1, 1]`:
   - `t_norm = 2 * (jd - t_start) / (t_end - t_start) - 1`
3. Evaluate `cx`, `cy`, `cz` via Clenshaw recurrence.
4. Evaluate derivatives for velocity and scale by segment span in seconds.

Velocity units returned are km/s.

## Time-Base Notes

- Source HORIZONS products use Julian dates; this repo stores those values directly in NPZ/Chebyshev.
- Runtime ephemeris lookup currently uses UTC-based Julian conversion helpers (`getJD_UTC`) to stay consistent with existing generated datasets.
- Regeneration should keep the same project convention to avoid drift.

## Generation Pipeline

Primary tools:

- `scripts/orbits.py`
  - Fetches vectors and writes `data-generated/<mission>/*.npz` (+ metadata)
  - Adds synthetic landing phases `landing-geo` and `landing-lunar` when landing is configured
- `scripts/compress-orbits.py`
  - Compresses NPZ to `assets/<mission>/data/*-cheb.json`
  - Defaults: `tolerance_km=5` (orbit phases), `tolerance_km=2` (landing phases)
- `scripts/generate-relative-orbits.py`
  - Produces `relative-<ID>-cheb.json` (derived rotating-frame dataset)

## Accuracy Targets

Current compression defaults in tooling:

- Orbit phases (`geo`, `lunar`, `relative`): tolerance 5 km
- Landing phases (`landing`, `landing-geo`, `landing-lunar`): tolerance 2 km

Validation is available in `scripts/compress-orbits.py` (`--validate`).
