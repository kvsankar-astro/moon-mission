# CLAUDE.md

## Visual Regression Testing - SSIM-based Comparison

Visual regression tests use SSIM (Structural Similarity Index) instead of pixel matching for robust comparison that handles anti-aliasing differences. Threshold values are defined in `test/ui.test.js` (single source of truth).

### Test Mode
Tests run with `?testMode=true` URL parameter which:
- Sets a fixed pixel ratio of 1.0 for consistent rendering across devices
- Enables anti-aliasing for consistent visual output

### Key Files
- `test/ui.test.js` - Main test file with SSIM-based comparison (47 tests)
- `assets/platform/js/mission.js` - Product code with testMode support
- `scripts/ssim-compare.js` - SSIM comparison utility for manual analysis
- `docs/testing/` - Test documentation and specifications

---

## Developer Documentation

### Test Server Port Management

The test infrastructure uses a **preferred port with automatic fallback** approach, following Vite/Playwright ecosystem best practices.

#### Design Decisions

| Approach | Description | Adopted? |
|----------|-------------|----------|
| Fixed port (8111) | Simple, predictable, may conflict | **Yes** (as preferred) |
| Vite auto-fallback | If 8111 busy, try 8112, 8113... | **Yes** (built-in) |
| `reuseExistingServer` | Reuse developer's running server | **Yes** |
| Dynamic port (`get-port-cli`) | Fully random port each run | No (added complexity) |

#### How It Works

1. **Preferred Port**: Tests default to port `8111` to avoid conflicts with typical dev server ports (3000, 5173, 8000, 8080)

2. **Automatic Fallback**: Vite automatically tries the next available port if 8111 is busy. This is Vite's default behavior.

3. **Reuse Existing Server**: When running tests locally, if a server is already running on the expected port, tests reuse it instead of starting a new one. This allows developers to:
   - Run `npx vite --port 8111` in one terminal
   - Run tests in another terminal without server startup delay

4. **CI Behavior**: In CI environments (`process.env.CI`), always start a fresh server to ensure clean state.

#### Configuration

Tests read the base URL from environment variable with fallback:
```javascript
baseUrl: process.env.VITE_TEST_BASE_URL || 'http://localhost:8111'
```

#### Running Tests

```bash
# Automatic server management (recommended)
make test                    # Starts server, runs tests, stops server

# Manual server management (for development)
make server-start            # Start server in background
npx vitest test/ui.test.js   # Run tests (reuses running server)
make server-stop             # Stop server when done

# Override port if needed
VITE_TEST_BASE_URL=http://localhost:3000 npx vitest test/ui.test.js
```

#### References
- [Playwright webServer docs](https://playwright.dev/docs/test-webserver)
- [Vitest server discussion](https://github.com/vitest-dev/vitest/discussions/334)
- [Vite server.port options](https://vite.dev/config/server-options)

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a multi-mission platform for 3D and 2D animations of lunar mission orbits. Currently supports Chandrayaan 3 (2023), Chandrayaan 2 (2019), Apollo 10 LM (Snoopy), and Apollo 11 S-IVB. Hosted at http://sankara.net/mission.html. The animations display real-world orbit data from JPL/NASA HORIZONS interface.

## Multi-Mission Architecture

### URL Routing
- `mission.html` - Mission selector page (no params)
- `mission.html?mission=cy3` - Chandrayaan 3
- `mission.html?mission=cy2` - Chandrayaan 2

### Mission Configuration
Each mission has its own folder under `assets/<mission>/`:
- `data/config.json` - Mission parameters, events, UI labels
- `data/*-cheb.json` - Chebyshev orbit data files
- `models/` - 3D spacecraft models (optional)
- `images/` - Screenshots

### Adding a New Mission
1. Create `assets/<mission-name>/data/config.json` using existing configs as template
2. Generate orbit data using `scripts/orbits.py --mission=<name>`
3. Add mission to `missionMap` in `mission.html`
4. Add mission card to selector UI in `mission.html`

## High-Level Architecture

The project consists of several major components:

1. **Orbit Data Pipeline**: 
   - Python script (`scripts/orbits.py`) fetches orbit data from NASA JPL HORIZONS
   - Data is fetched for different phases: geocentric ("geo"), selenocentric ("lunar"), and landing
   - Raw data is converted to Chebyshev polynomial format for efficient interpolation
   - Data is saved to both timestamped archive directories and the main data directory

2. **Frontend Visualization**:
   - `mission.html` - Main HTML page with mission selector and routing
   - `assets/platform/js/mission.js` - Core animation engine (AnimationScene class)
   - `assets/platform/js/astro.js` - Astronomy support functions (Julian dates, coordinate conversions)
   - `assets/platform/js/chebyshev.js` - Chebyshev polynomial interpolation
   - `assets/platform/js/astronomy-bodies.js` - Astronomy Engine wrapper for Moon/Earth
   - `assets/platform/js/rendering/` - Extracted renderer classes (camera, spacecraft, lights, Earth, Moon, sky, helpers)
   - `assets/platform/js/core/constants.js` - Centralized physics, color, and light constants
   - `assets/platform/css/mission.css` - Styling for the application
   - Uses THREE.js for 3D rendering and D3.js for 2D SVG rendering
   - jQuery/jQuery UI for UI controls

3. **Data Formats**:
   - Chebyshev polynomial files: `geo-<ID>-cheb.json`, `lunar-<ID>-cheb.json`, `landing-<ID>-cheb.json`
   - Metadata files: `geo-<ID>-meta.json`, `lunar-<ID>-meta.json`, `landing-<ID>-meta.json`
   - Moon/Earth positions computed dynamically using Astronomy Engine

## Common Development Commands

### Fetching Orbit Data

Using Python (recommended):
```bash
# Fetch and generate orbit data for each phase
python scripts/orbits.py --mission=chandrayaan3 --phase=geo
python scripts/orbits.py --mission=chandrayaan3 --phase=lunar
python scripts/orbits.py --mission=chandrayaan3 --phase=landing
```

### Running the Application

Since this is a static site, use a local web server to avoid CORS issues:
```bash
# Using Python
python -m http.server 8000

# Using Node.js http-server (if installed)
npx http-server
```

## Key Technical Details

- **Coordinate Systems**: ECLIPJ2000 (Ecliptic J2000) for all calculations
- **Time Systems**: TDB (Barycentric Dynamical Time) for Chebyshev lookups and astronomical calculations; UTC for UI display
- **Animation Loop**: Uses requestAnimationFrame for smooth rendering
- **Data Resolution**: 1-minute intervals for orbit data, higher resolution for landing phase
- **Browser Support**: Requires modern browser with WebGL support for 3D mode

For detailed technical documentation on time systems, data pipeline, and coordinate systems, see [docs/developer.md](docs/developer.md).

## Recent Updates (January 2026)

### Multi-Mission Support
- Mission selector page at `mission.html` (no params)
- URL parameter routing: `?mission=cy2` or `?mission=cy3`
- Chandrayaan 2 mission added with merged Orbiter+Vikram trajectory
- Each mission has independent config.json and orbit data

### Platform-Based Architecture
- Reusable platform code in `assets/platform/js/` (mission.js, astro.js, chebyshev.js, astronomy-bodies.js)
- Mission-specific assets in `assets/<mission>/`
- Removed NPZ data pipeline - using Chebyshev polynomials exclusively for spacecraft data
- Moon/Earth positions computed dynamically via Astronomy Engine

### Modular Rendering Architecture (January 2026)
- Extracted 7 renderer classes from monolithic mission.js to `assets/platform/js/rendering/`:
  - `CameraController` - Camera management (main, craft-attached, drone-attached)
  - `SpacecraftRenderer` - Spacecraft visualization (geometric and GLTF modes)
  - `LightManager` - Two-layer lighting system (celestial bodies vs spacecraft)
  - `EarthRenderer` - Earth sphere with texture and polar axis
  - `MoonRenderer` - Moon sphere with displacement mapping and polar axis
  - `SkyRenderer` - Starfield and constellation background
  - `SceneHelpers` - Axes, ecliptic/equatorial planes, SOI wireframe
- Core utilities in `assets/platform/js/core/` (constants.js, dom.js)
- Math utilities in `assets/platform/js/utils/math-utils.js`
- Apollo 10 LM and Apollo 11 S-IVB missions added

### CY2 Data Pipeline
- `convert-cy2-json.py` - Converts legacy JSON to Chebyshev with vx/vy bug fix
- `merge-cy2-vikram.py` - Merges Orbiter data (launch→separation) with Vikram data (separation→crash)
- Seamless trajectory transition at Vikram separation point

### Time System Clarification
- HORIZONS data uses TDB (JDTDB timestamps)
- All Chebyshev lookups use `getJD_TDB()` for correct time system
- UTC used only for user-facing display

### Documentation
- Technical documentation in `docs/developer.md`
- Test documentation in `docs/testing/`

## Important File Locations

### Project Structure
```
moon-mission/
├── mission.html                   # Main entry with mission selector
├── index.html                     # Redirects to mission.html
├── assets/
│   ├── platform/                  # Reusable platform components
│   │   ├── js/
│   │   │   ├── mission.js         # Core animation engine (AnimationScene class)
│   │   │   ├── astro.js           # Astronomy calculations (TDB/UTC)
│   │   │   ├── chebyshev.js       # Chebyshev polynomial interpolation
│   │   │   ├── astronomy-bodies.js # Astronomy Engine wrapper
│   │   │   ├── core/              # Core utilities
│   │   │   │   ├── constants.js   # Centralized constants (physics, colors, lights)
│   │   │   │   └── dom.js         # DOM manipulation utilities
│   │   │   ├── rendering/         # Extracted renderer classes
│   │   │   │   ├── camera-controller.js    # Camera and controls management
│   │   │   │   ├── spacecraft-renderer.js  # Spacecraft & drone visualization
│   │   │   │   ├── light-manager.js        # Scene lighting (two-layer system)
│   │   │   │   ├── earth-renderer.js       # Earth sphere and axis
│   │   │   │   ├── moon-renderer.js        # Moon sphere and axis
│   │   │   │   ├── sky-renderer.js         # Starfield and constellations
│   │   │   │   └── scene-helpers.js        # Axes, planes, SOI wireframe
│   │   │   └── utils/
│   │   │       └── math-utils.js  # Mathematical utilities
│   │   └── css/
│   │       └── mission.css        # Base styling
│   ├── chandrayaan3/              # Chandrayaan 3 assets
│   │   ├── data/                  # config.json + Chebyshev files
│   │   ├── images/
│   │   └── models/                # 3D models (GLB files)
│   ├── chandrayaan2/              # Chandrayaan 2 assets
│   │   ├── data/                  # config.json + Chebyshev files
│   │   └── images/
│   ├── apollo10-lm/               # Apollo 10 Snoopy LM assets
│   │   └── data/
│   └── apollo11-sivb/             # Apollo 11 S-IVB assets
│       └── data/
├── docs/                          # Documentation
│   ├── developer.md               # Technical documentation
│   ├── modernization-plan-2026.md # Modernization roadmap
│   └── testing/                   # Test documentation
├── scripts/                       # Data generation scripts
├── test/                          # Test files and baselines
├── third-party/                   # External libraries
└── images/                        # Earth/Moon texture images
```