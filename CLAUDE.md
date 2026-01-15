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

This is the source code for a 3D and 2D animation of the ISRO Chandrayaan 3 mission orbit, hosted at http://sankara.net/chandrayaan3.html. The animation displays real-world orbit data and predictions from JPL/NASA HORIZONS interface.

## High-Level Architecture

The project consists of several major components:

1. **Orbit Data Pipeline**: 
   - Python script (`scripts/orbits.py`) fetches orbit data from NASA JPL HORIZONS
   - Data is fetched for different phases: geocentric ("geo"), selenocentric ("lunar"), and landing
   - Raw data is converted to Chebyshev polynomial format for efficient interpolation
   - Data is saved to both timestamped archive directories and the main data directory

2. **Frontend Visualization**:
   - `chandrayaan3.html` - Main HTML page (stays in root for easy web access)
   - `assets/platform/js/mission.js` - Core animation engine (mission-agnostic)
   - `assets/platform/js/astro.js` - Astronomy support functions (Julian dates, coordinate conversions)
   - `assets/platform/js/chebyshev.js` - Chebyshev polynomial interpolation
   - `assets/platform/js/astronomy-bodies.js` - Astronomy Engine wrapper for Moon/Earth
   - `assets/platform/css/mission.css` - Styling for the application
   - Uses THREE.js for 3D rendering and D3.js for 2D SVG rendering
   - jQuery/jQuery UI for UI controls

3. **Data Formats**:
   - Chebyshev polynomial files: `geo-CY3-cheb.json`, `lunar-CY3-cheb.json`, `landing-CY3-cheb.json`
   - Metadata files: `geo-CY3-meta.json`, `lunar-CY3-meta.json`, `landing-CY3-meta.json`
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

### Platform-Based Architecture
- Reusable platform code in `assets/platform/js/` (mission.js, astro.js, chebyshev.js, astronomy-bodies.js)
- Mission-specific assets in `assets/chandrayaan3/`
- Removed NPZ data pipeline - using Chebyshev polynomials exclusively for spacecraft data
- Moon/Earth positions computed dynamically via Astronomy Engine

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
cy3/
├── chandrayaan3.html              # Main entry point (root for easy web access)
├── assets/
│   ├── platform/                  # Reusable platform components
│   │   ├── js/
│   │   │   ├── mission.js         # Core animation engine
│   │   │   ├── astro.js           # Astronomy calculations (TDB/UTC)
│   │   │   ├── chebyshev.js       # Chebyshev polynomial interpolation
│   │   │   └── astronomy-bodies.js # Astronomy Engine wrapper
│   │   └── css/
│   │       └── mission.css        # Base styling
│   └── chandrayaan3/              # Mission-specific assets
│       ├── data/                  # Chebyshev JSON files (not in Git)
│       ├── html/                  # Supporting pages
│       ├── images/                # Screenshots
│       └── models/                # 3D models (GLB files)
├── docs/                          # Documentation
│   ├── developer.md               # Technical documentation
│   └── testing/                   # Test documentation
├── scripts/                       # Data generation scripts
├── test/                          # Test files and baselines
├── third-party/                   # External libraries
└── images/                        # Earth/Moon texture images
```