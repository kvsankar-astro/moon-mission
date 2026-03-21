# Developer Documentation

## Open TODOs

- TODO: Investigate camera "from-object" centering in from-to camera pairs. The camera may intentionally use a small offset for stability, but we need to verify whether any combinations allow the source ("from") object to become visible in-frame (self-looking behavior) and confirm expected behavior.
- TODO: Complete final jQuery UI cleanup. Document and remove compatibility traces/stubs (for example `assets/platform/js/ui/jquery-ui-dialog-stub.js`, legacy `$.dialog`/`dialogExtend` pathways, and related legacy includes) once replacement behavior is fully covered.

## Multi-Mission Architecture

The platform supports multiple lunar missions through configuration-driven design. Each mission is self-contained in its own folder under `assets/`.

### URL Routing

```
mission.html                          → Mission selector page
mission.html?mission=cy3              → Chandrayaan 3
mission.html?mission=cy2              → Chandrayaan 2
mission.html?mission=apollo10-lm      → Apollo 10 LM (Snoopy)
mission.html?mission=apollo11-sivb    → Apollo 11 S-IVB
mission.html?mission=artemis1         → Artemis 1

Additional short aliases also exist (e.g. `a10`, `a11`, `art1`); see `missionMap` in `mission.html`.
```

The `missionMap` in `mission.html` maps URL parameters to mission folders:

```javascript
const missionMap = {
    'cy2': { name: 'chandrayaan2', folder: 'chandrayaan2', title: 'Chandrayaan 2', year: '2019' },
    'cy3': { name: 'chandrayaan3', folder: 'chandrayaan3', title: 'Chandrayaan 3', year: '2023' },
    'a11': { name: 'apollo11-sivb', folder: 'apollo11-sivb', title: 'Apollo 11 S-IVB', year: '1969' },
    'a10': { name: 'apollo10-lm', folder: 'apollo10-lm', title: 'Apollo 10 Snoopy', year: '1969' },
    'art1': { name: 'artemis1', folder: 'artemis1', title: 'Artemis 1', year: '2022' },
    'chandrayaan2': { name: 'chandrayaan2', folder: 'chandrayaan2', title: 'Chandrayaan 2', year: '2019' },
    'chandrayaan3': { name: 'chandrayaan3', folder: 'chandrayaan3', title: 'Chandrayaan 3', year: '2023' },
    'apollo11-sivb': { name: 'apollo11-sivb', folder: 'apollo11-sivb', title: 'Apollo 11 S-IVB', year: '1969' },
    'apollo10-lm': { name: 'apollo10-lm', folder: 'apollo10-lm', title: 'Apollo 10 Snoopy', year: '1969' },
    'artemis1': { name: 'artemis1', folder: 'artemis1', title: 'Artemis 1', year: '2022' },
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
│   ├── relative-<ID>-cheb.json  # Relative-frame data (optional, mode=relative)
│   ├── landing-<ID>-cheb.json   # Legacy landing phase data (optional)
│   ├── landing-<ID>-geo-cheb.json   # Landing in Earth-centered frame (optional)
│   └── landing-<ID>-lunar-cheb.json # Landing in Moon-centered frame (optional)
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
  "ephemeris_source": "chebyshev",      // Default source for SC
  "ephemeris_sources": {                // Optional per-body overrides
    "SC": "chebyshev",
    "MOON": "astronomy",
    "EARTH": "astronomy"
  },

  // Optional-but-used-by-the-UI fields (see existing missions for examples)
  "mission_description": "Short description",
  "mission_keywords": "comma,separated,keywords",
  "mission_github": "https://github.com/...",
  "mission_image": "assets/<mission-name>/images/<screenshot>.png",

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

  "landing": {
    "enabled": true,                    // Optional
    "center": "moon_center",
    "orbits_file": "landing-<ID>"       // scripts can also generate -geo/-lunar variants
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
# Fetch all enabled phases from config (recommended)
python scripts/orbits.py --mission=<mission-name>

# Fetch specific phases
python scripts/orbits.py --mission=<mission-name> --phase geo lunar

# Landing variants (if landing is enabled)
# `landing-geo` and `landing-lunar` are synthetic phases created by scripts/orbits.py
python scripts/orbits.py --mission=<mission-name> --phase landing landing-geo landing-lunar

# Optional: precompute relative-frame Chebyshev from geo NPZ
python scripts/generate-relative-orbits.py --mission <mission-name>
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
# Start dev server (any static server works; Vite uses port 7274 by default here)
npm run dev

# Open in browser
http://localhost:7274/mission.html?mission=<id>
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

The runtime currently uses both Julian-date conventions; keep them distinct:

### UTC-based Julian Date (runtime ephemeris sampling)

Used by runtime ephemeris lookup for Chebyshev/NPZ state evaluation.

- `assets/platform/js/data/ephemeris-provider.js` (`getHorizonsJulianDate`)
- `assets/platform/js/chebyshev.js` (`generateCurveFromChebyshev`)

```javascript
const jd = new Date(timestamp).getJD_UTC();
const state = getStateFromChebyshev(chebyshevData, jd);
```

### TDB (astronomical orientation math)

Used for IAU lunar pole/orientation calculations in `assets/platform/js/astro.js`.

- `Date.prototype.getJD_TDB()`
- `Date.prototype.getMJD_TDB()`
- `Date.prototype.getT_TDB()`

### UI/Event Times

- Mission events in `config.json` are UTC ISO timestamps.
- UI displays local-time formatted values (currently IST-centric formatting in labels/text).

## Data Pipeline

### HORIZONS → Chebyshev

```
NASA JPL HORIZONS API
        ↓
    orbits.py (fetches vectors per phase)
        ↓
    data-generated/<mission>/*.npz + *-meta.json
        ↓
    compress-orbits.py
        ↓
    assets/<mission>/data/*-cheb.json
```

`scripts/orbits.py` also exposes synthetic landing variants (`landing-geo`, `landing-lunar`) when landing is configured.

### Fetching Orbit Data (`scripts/orbits.py`)

`scripts/orbits.py` fetches and processes orbit vectors from the HORIZONS API using a mission's `assets/<mission>/data/config.json`.

```bash
# Fetch all enabled phases from the mission config (geo/lunar/landing)
python scripts/orbits.py --mission chandrayaan3

# Fetch specific phases
python scripts/orbits.py --mission chandrayaan3 --phase geo
python scripts/orbits.py --mission chandrayaan3 --phase lunar landing

# Write raw HORIZONS outputs to a custom folder
python scripts/orbits.py --mission chandrayaan3 --data-dir data-generated/chandrayaan3/my-run
```

By default, raw outputs go under `data-generated/<mission>/...`. `scripts/compress-orbits.py` writes `*-cheb.json` into `assets/<mission>/data/`.

#### Raw Output Files

The HORIZONS request outputs are saved as plain text files (useful for debugging and provenance), typically including:

- `ho-<id>-elements.txt` - orbital elements at one instant of time
- `ho-<id>-vectors.txt` - state vectors over a period of time (used for Chebyshev compression)
- `ho-<id>-orbit.txt` - orbital elements at one instant of time

### Chebyshev Data Structure

```json
{
  "format": "chebyshev-ephemeris",
  "version": "1.0",
  "metadata": {
    "segments_count": 2066
  },
  "time_range": {
    "start": 2460139.890972222,
    "end": 2460194.022916667
  },
  "segments": [
    {
      "t_start": 2460139.89,
      "t_end": 2460140.89,
      "cx": [ ... ],
      "cy": [ ... ],
      "cz": [ ... ]
    }
  ]
}
```

## Build and Deployment

The repository includes Python scripts to build a deployable static folder and optionally deploy it.

### Build (`scripts/build.py`)

```bash
# Default build output: dist/
python scripts/build.py

# Build without cleaning existing dist
python scripts/build.py --no-clean

# Build to a custom directory
python scripts/build.py --dist my-dist

# Deterministic build metadata timestamp (ISO-8601)
python scripts/build.py --build-date 2026-03-21T00:00:00+00:00

# Or use SOURCE_DATE_EPOCH for reproducible pipelines
$env:SOURCE_DATE_EPOCH=1774051200; python scripts/build.py
```

### Deploy (`scripts/deploy.py`)

```bash
# Create deployment config template
python scripts/deploy.py config

# Deploy to local directory
python scripts/deploy.py local --target /path/to/deployment

# Deploy via SFTP (requires config)
python scripts/deploy.py sftp

# Dry run (show what would be done)
python scripts/deploy.py local --target /path/to/deployment --dry-run
```

#### Deployment Configuration

`scripts/deploy.py config` generates a `deploy-config.json` template. The file supports local and SFTP deployment targets.

Example:

```json
{
  "local": {
    "target_dir": "/path/to/local/deployment"
  },
  "sftp": {
    "host": "example.com",
    "port": 22,
    "username": "your-username",
    "password": "your-password or leave empty for key auth",
    "key_filename": "/path/to/private/key (optional)",
    "remote_dir": "/path/to/remote/deployment"
  }
}
```

### Development Workflow (Build/Deploy)

```bash
# 1) (Optional) regenerate orbit data
python scripts/orbits.py --mission chandrayaan3

# 2) build a deployable static folder
python scripts/build.py

# 3) deploy
python scripts/deploy.py local --target /path/to/deployment
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
- Runtime composition/orchestration entrypoint
- Wires app modules from `app/*`, `data/*`, `rendering/*`, and controllers
- Maintains legacy-compatible state bridge and exports `animationScenes`

#### `assets/platform/js/astro.js`
- Julian Date conversion functions
- Lunar pole orientation (IAU model)

#### `assets/platform/js/astronomy-bodies.js`
- Astronomy Engine wrapper
- `getMoonState(timestamp)` - Moon position from Earth (geocentric)
- `getEarthFromMoonState(timestamp)` - Earth position from Moon (selenocentric)

#### `assets/platform/js/chebyshev.js`
- `getStateFromChebyshev(data, jd)` - Interpolate position/velocity at given Julian date
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
Committed SSIM baseline: `test/screenshots/ssim-history.json`
Latest-run SSIM scores: `test/screenshots/ssim-latest.json` (git-ignored)

Run tests:
```bash
# Recommended: manages server on port 8111
make test

# If you already have a server running (default baseUrl is http://localhost:8111)
npx vitest test/ui.test.js --run
```
