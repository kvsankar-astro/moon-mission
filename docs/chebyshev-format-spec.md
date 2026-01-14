# Chebyshev Ephemeris Format Specification

## Overview

This document specifies the JSON format for Chebyshev polynomial-compressed ephemeris data. The format stores spacecraft positions as piecewise Chebyshev polynomial segments, allowing efficient storage and smooth interpolation at any time within the data range.

## File Naming Convention

- `geo-CY3-cheb.json` - Geocentric phase (Earth-centered)
- `lunar-CY3-cheb.json` - Selenocentric phase (Moon-centered)
- `landing-CY3-cheb.json` - Landing phase

## JSON Structure

```json
{
  "format": "chebyshev-ephemeris",
  "version": "1.0",
  "metadata": {
    "source": "geo-CY3.npz",
    "created": "2026-01-13T12:00:00Z",
    "segment_hours": 2,
    "polynomial_degree": 20,
    "coordinate_frame": "J2000",
    "units": {
      "time": "julian_date",
      "position": "km"
    }
  },
  "time_range": {
    "start": 2460123.5,
    "end": 2460180.5
  },
  "segments": [
    {
      "t_start": 2460123.5,
      "t_end": 2460123.583333,
      "cx": [1.0, 2.0, 3.0, ...],
      "cy": [1.0, 2.0, 3.0, ...],
      "cz": [1.0, 2.0, 3.0, ...]
    }
  ]
}
```

## Field Descriptions

### Root Level

| Field | Type | Description |
|-------|------|-------------|
| `format` | string | Must be `"chebyshev-ephemeris"` |
| `version` | string | Format version, currently `"1.0"` |
| `metadata` | object | Information about the source data and compression parameters |
| `time_range` | object | Overall time coverage |
| `segments` | array | Array of polynomial segments |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Original data file name |
| `created` | string | ISO 8601 timestamp of compression |
| `segment_hours` | number | Length of each segment in hours |
| `polynomial_degree` | number | Degree of Chebyshev polynomials used |
| `coordinate_frame` | string | Reference frame (always "J2000") |
| `units` | object | Units for time and position |

### Time Range Object

| Field | Type | Description |
|-------|------|-------------|
| `start` | number | Julian date of first data point |
| `end` | number | Julian date of last data point |

### Segment Object

| Field | Type | Description |
|-------|------|-------------|
| `t_start` | number | Julian date at segment start |
| `t_end` | number | Julian date at segment end |
| `cx` | array | Chebyshev coefficients for X coordinate |
| `cy` | array | Chebyshev coefficients for Y coordinate |
| `cz` | array | Chebyshev coefficients for Z coordinate |

## Chebyshev Polynomial Evaluation

To reconstruct a position at time `t` (Julian date):

1. Find the segment where `t_start <= t <= t_end`
2. Normalize time to [-1, 1]: `t_norm = 2 * (t - t_start) / (t_end - t_start) - 1`
3. Evaluate each polynomial using the Clenshaw recurrence algorithm
4. Result is (x, y, z) position in kilometers

### Clenshaw Recurrence Algorithm

```
function evaluateChebyshev(coeffs, x):
    // x must be in [-1, 1]
    n = length(coeffs)
    if n == 0: return 0
    if n == 1: return coeffs[0]

    b_k1 = 0  // b_{k+1}
    b_k2 = 0  // b_{k+2}

    for k from (n-1) down to 1:
        b_k = coeffs[k] + 2 * x * b_k1 - b_k2
        b_k2 = b_k1
        b_k1 = b_k

    return coeffs[0] + x * b_k1 - b_k2
```

## Accuracy Requirements

For orbit visualization purposes:
- Maximum position error: < 100 km for orbital phases
- Maximum position error: < 5 km for landing phase
- These errors are subpixel at typical visualization scales

## Example Usage (JavaScript)

```javascript
// Load the Chebyshev data
const data = await fetch('geo-CY3-cheb.json').then(r => r.json());

// Get position at a specific Julian date
const jd = 2460150.5;
const position = getPositionFromChebyshev(data.segments, jd);
console.log(`Position: (${position.x}, ${position.y}, ${position.z}) km`);
```
