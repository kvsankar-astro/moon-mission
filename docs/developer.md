# Developer Documentation

## Time Systems

The application uses two time systems:

### TDB (Barycentric Dynamical Time)
Used for all astronomical calculations and ephemeris data.

- **Chebyshev polynomial lookups** - Spacecraft position interpolation
- **Lunar pole calculations** - IAU orientation model
- **Astronomy Engine calculations** - Moon/Earth positions

```javascript
const jd = new Date(timestamp).getJD_TDB();
const state = getStateFromChebyshev(chebyshevData, jd);
```

### UTC (Coordinated Universal Time)
Used for user-facing display and mission event times.

- **UI date/time display** - Shown in local timezone (IST)
- **Mission events in config.json** - Launch, burns, landing times

### Conversion

TDB ≈ UTC + 69.184 seconds (as of 2017+)

```javascript
// TDB offset: leap_seconds (37s) + 32.184s
const TDB_OFFSET_MS = (37.000 + 32.184) * 1000;
```

Functions defined in `assets/platform/js/astro.js`:
- `Date.prototype.getJD_TDB()` - Julian Date in TDB
- `Date.prototype.getJD_UTC()` - Julian Date in UTC
- `Date.prototype.getMJD_TDB()` - Days since J2000 (TDB)
- `Date.prototype.getT_TDB()` - Centuries since J2000 (TDB)

## Data Pipeline

### HORIZONS → Chebyshev

```
NASA JPL HORIZONS API
        ↓
    orbits.py (fetches vectors)
        ↓
    *-vectors.txt (JDTDB, ECLIPJ2000)
        ↓
    compress-orbits.py
        ↓
    *-cheb.json (Chebyshev coefficients)
```

**Important:** HORIZONS outputs data with JDTDB timestamps in ECLIPJ2000 frame. The Chebyshev compression preserves these timestamps without conversion.

### Chebyshev Data Structure

```json
{
  "segments": [
    {
      "t_start": 2460139.89,  // JDTDB
      "t_end": 2460140.89,    // JDTDB
      "coeffs": { "x": [...], "y": [...], "z": [...], ... }
    }
  ]
}
```

## Coordinate Systems

### ECLIPJ2000 (Ecliptic J2000)
Used by HORIZONS and all spacecraft position data.
- X-axis: Vernal equinox direction
- Z-axis: North ecliptic pole
- Reference epoch: J2000.0 (2000-01-01 12:00 TT)

### EQJ2000 (Equatorial J2000)
Used by Astronomy Engine for Moon/Earth calculations.
- Requires rotation to ECLIPJ2000 for consistency with spacecraft data

```javascript
// astronomy-bodies.js
const rot = Astronomy.Rotation_EQJ_ECL();
const eclState = Astronomy.RotateState(rot, eqState);
```

## Key Modules

### `assets/platform/js/astro.js`
- Julian Date conversion functions
- Lunar pole orientation (IAU model)

### `assets/platform/js/astronomy-bodies.js`
- Astronomy Engine wrapper
- `getMoonState(timestamp)` - Moon position from Earth (geocentric)
- `getEarthFromMoonState(timestamp)` - Earth position from Moon (selenocentric)

### `assets/platform/js/chebyshev.js`
- `getStateFromChebyshev(data, jd)` - Interpolate position/velocity at given JDTDB
- `generateCurveFromChebyshev(data, start, end, step)` - Generate orbit curve points
- `loadChebyshevData(url)` - Load Chebyshev JSON file

### `assets/platform/js/mission.js`
- Main application logic
- Scene management (Earth mode, Moon mode)
- Animation control

## Configuration

### `config.json`
Mission-specific configuration including:
- Phase definitions (geo, lunar, landing)
- Start/stop times for each phase
- Event definitions (burns, maneuvers)
- Landing site coordinates

### Test Mode
URL parameter `?testMode=true` enables:
- Fixed pixel ratio (1.0) for consistent screenshots
- Used by visual regression tests

## Visual Regression Testing

Tests use SSIM (Structural Similarity Index) for image comparison.

```javascript
// test/ui.test.js
const SSIM_THRESHOLD = {
  IDENTICAL: 0.99,
  VERY_SIMILAR: 0.98,
  SIMILAR: 0.95,
  DIFFERENT: 0.90
};
```

Baseline images: `test/screenshots/baseline/`
Current images: `test/screenshots/current/`

Run tests:
```bash
npx vitest run test/ui.test.js
```
