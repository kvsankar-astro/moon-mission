# Developer Documentation

## Multi-Mission Architecture

The platform supports multiple lunar missions through configuration-driven design. Each mission is self-contained in its own folder under `assets/`.

### URL Routing

```
mission.html              → Mission selector page
mission.html?mission=cy3  → Chandrayaan 3
mission.html?mission=cy2  → Chandrayaan 2
```

The `missionMap` in `mission.html` maps URL parameters to mission folders:

```javascript
const missionMap = {
    'cy2': { name: 'chandrayaan2', folder: 'chandrayaan2', title: 'Chandrayaan 2', year: '2019' },
    'cy3': { name: 'chandrayaan3', folder: 'chandrayaan3', title: 'Chandrayaan 3', year: '2023' },
    'apollo10-lm': { name: 'apollo10-lm', folder: 'apollo10-lm', title: 'Apollo 10 LM', year: '1969' },
    'apollo11-sivb': { name: 'apollo11-sivb', folder: 'apollo11-sivb', title: 'Apollo 11 S-IVB', year: '1969' },
};
```

---

## Adding a New Mission

### Step 1: Create Mission Folder Structure

```
assets/<mission-name>/
├── data/
│   ├── config.json              # Mission configuration (required)
│   ├── geo-<ID>-cheb.json       # Geocentric orbit data (required)
│   ├── lunar-<ID>-cheb.json     # Selenocentric orbit data (required)
│   └── landing-<ID>-cheb.json   # Landing phase data (optional)
├── models/
│   └── spacecraft.glb           # 3D model (optional)
└── images/
    └── screenshot.png           # Mission screenshot
```

### Step 2: Create config.json

The config.json file defines all mission parameters. Required sections:

```json
{
  "spacecraft_mnemonic": "XX",           // Short ID used in data files
  "spacecraft_id": -999,                  // JPL HORIZONS spacecraft ID
  "mission_name": "Mission Name",
  "mission_name_short": "XX",
  "mission_url": "https://...",
  "is_lunar": true,

  "ui": {
    "pageTitle": "Mission Page Title",
    "headerTitle": "Header Text",
    "lockOnLabel": "Spacecraft Name",
    "orbitLabel": "XX Orbit",
    "descentOrbitLabel": "XX Descent Orbit"
  },

  "phases": ["geo", "lunar"],             // or ["geo", "lunar", "landing"]

  "geo": {
    "start_year": "YYYY", "start_month": "MM", "start_day": "DD",
    "start_hour": "HH", "start_minute": "MM",
    "stop_year": "YYYY", "stop_month": "MM", "stop_day": "DD",
    "stop_hour": "HH", "stop_minute": "MM",
    "step_size_in_seconds": 60,
    "planets": ["MOON", "SC"],
    "center": "earth_center",
    "orbits_file": "geo-<ID>"             // Without -cheb.json suffix
  },

  "lunar": {
    // Same structure as geo
    "planets": ["SC", "EARTH"],
    "center": "moon_center",
    "orbits_file": "lunar-<ID>"
  },

  "events": {
    "missionStart": {
      "startTime": "2023-07-14T09:23:00Z",
      "durationSeconds": 0,
      "label": "🚀 Launch",
      "burnFlag": false,
      "infoText": "Launch description",
      "body": "SC"
    }
    // Add more events...
  },

  "eventConfigs": {
    "geo": ["missionStart", "event1", "event2"],
    "lunar": ["missionStart", "event1", "event2"]
  }
}
```

### Step 3: Generate Orbit Data

**Option A: Fetch from JPL HORIZONS (for missions with tracking data)**

```bash
# Fetch geocentric data
python scripts/orbits.py --mission=<mission-name> --phase=geo

# Fetch selenocentric data
python scripts/orbits.py --mission=<mission-name> --phase=lunar

# Fetch landing phase (if applicable)
python scripts/orbits.py --mission=<mission-name> --phase=landing
```

**Option B: Convert existing data (e.g., from legacy JSON)**

Use `scripts/convert-cy2-json.py` as a template for custom converters.

### Step 4: Register Mission in mission.html

Add entry to `missionMap`:

```javascript
const missionMap = {
    // Existing missions...
    '<id>': { name: '<mission-name>', folder: '<folder>', title: 'Title', year: 'YYYY' },
};
```

Add mission card to selector UI:

```html
<a href="?mission=<id>" style="text-decoration: none;">
    <div style="...">
        <h3>Mission Title</h3>
        <p>YYYY - Description</p>
        <p>Additional info</p>
    </div>
</a>
```

### Step 5: Test

```bash
# Start dev server
npx vite --port 8111

# Open in browser
http://localhost:8111/mission.html?mission=<id>
```

---

## JPL HORIZONS Spacecraft IDs

Common spacecraft IDs for lunar missions:

| Mission | ID | Description |
|---------|------|-------------|
| Chandrayaan 3 | -158 | Vikram Lander |
| Chandrayaan 2 Orbiter | -152 | Still active |
| Chandrayaan 2 Vikram | -153 | Lander (crashed) |
| LRO | -85 | Lunar Reconnaissance Orbiter |

Search for IDs at: https://ssd.jpl.nasa.gov/horizons/

---

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

### Core Modules

#### `assets/platform/js/mission.js`
- Main application logic (AnimationScene class)
- Scene management (Earth mode, Moon mode)
- Animation control and orchestration
- Integrates all renderer classes

#### `assets/platform/js/astro.js`
- Julian Date conversion functions
- Lunar pole orientation (IAU model)

#### `assets/platform/js/astronomy-bodies.js`
- Astronomy Engine wrapper
- `getMoonState(timestamp)` - Moon position from Earth (geocentric)
- `getEarthFromMoonState(timestamp)` - Earth position from Moon (selenocentric)

#### `assets/platform/js/chebyshev.js`
- `getStateFromChebyshev(data, jd)` - Interpolate position/velocity at given JDTDB
- `generateCurveFromChebyshev(data, start, end, step)` - Generate orbit curve points
- `loadChebyshevData(url)` - Load Chebyshev JSON file

### Core Utilities

#### `assets/platform/js/core/constants.js`
- `PHYSICS_CONSTANTS` - Earth/Moon radii, distances, axial inclination
- `TIME_CONSTANTS` - Step duration
- `COLORS` - Axis, pole, plane, and SOI colors
- `LIGHT_SETTINGS` - Primary, ambient, and craft light intensities

#### `assets/platform/js/core/dom.js`
- DOM element selection and manipulation
- D3.js helper functions
- Event handler management

#### `assets/platform/js/utils/math-utils.js`
- `distance3D()` - 3D distance calculation
- `degreesToRadians()` / `radiansToDegrees()` - Angle conversion
- `sphericalToCartesian()` - Coordinate conversion
- `velocityToAngle()` - Velocity vector to angle

### Rendering Modules (`assets/platform/js/rendering/`)

#### `camera-controller.js`
- Three camera types: main perspective, craft-attached, drone-attached
- TrackballControls for user interaction
- Methods: `setPosition()`, `setFov()`, `updateAspect()`, `dispose()`

#### `spacecraft-renderer.js`
- Two visualization modes: simple geometric, GLTF model
- Drone object for camera targeting
- Layer 1 rendering for separate lighting
- Methods: `createSimple()`, `loadModel()`, `setVisible()`, `dispose()`

#### `light-manager.js`
- Two-layer lighting system:
  - Primary light: For celestial bodies (layer 0)
  - Craft light: For spacecraft (layer 1)
- Methods: `create()`, `dispose()`

#### `earth-renderer.js`
- Earth sphere with texture and specular map
- Axial tilt to 23.439° (Earth's inclination)
- Polar axis with north/south pole markers
- Methods: `setTextures()`, `create()`, `dispose()`

#### `moon-renderer.js`
- Moon sphere with displacement mapping
- IAU lunar pole orientation
- Polar axis with north/south pole markers
- Methods: `setTextures()`, `create()`, `dispose()`

#### `sky-renderer.js`
- Two-layer background: starmap + constellation overlay
- Additive blending for correct appearance
- Follows camera for infinite sky effect
- Methods: `setTextures()`, `create()`, `updatePosition()`, `setVisible()`, `dispose()`

#### `scene-helpers.js`
- XYZ axes helper
- Ecliptic plane (grid + plane)
- Equatorial plane (tilted by Earth's axial inclination)
- Moon's Sphere of Influence wireframe
- Granular visibility controls for each component

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
  SIMILAR: 0.98,
  DIFFERENT: 0.97
};
```

Baseline images: `test/screenshots/baseline/`
Current images: `test/screenshots/current/`
SSIM score history: `test/screenshots/ssim-history.json`

Run tests:
```bash
# Recommended: manages server on port 8111
make test

# If you already have a server running (default baseUrl is http://localhost:8111)
npx vitest test/ui.test.js --run
```
