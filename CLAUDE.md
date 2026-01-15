# CLAUDE.md

## Visual Regression Testing - SSIM-based Comparison

Visual regression tests use SSIM (Structural Similarity Index) instead of pixel matching for robust comparison that handles anti-aliasing differences. Threshold values are defined in `test/ui.test.js` (single source of truth).

### Test Mode
Tests run with `?testMode=true` URL parameter which:
- Sets a fixed pixel ratio of 1.0 for consistent rendering across devices
- Enables anti-aliasing for consistent visual output

### Key Files
- `test/ui.test.js` - Main test file with SSIM-based comparison
- `assets/platform/js/mission.js` - Product code with testMode support
- `scripts/ssim-compare.js` - SSIM comparison utility for manual analysis

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
   - `assets/chandrayaan3/js/cy3.js` - Core JavaScript module handling animation logic (ES6 modules)
   - `assets/chandrayaan3/js/astro.js` - Astronomy support functions (Julian dates, coordinate conversions)
   - `assets/chandrayaan3/css/cy3.css` - Styling for the application
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

- **Coordinate Systems**: J2000 reference frame is used for all calculations
- **Time Format**: Julian dates and Modified Julian dates for astronomical calculations
- **Animation Loop**: Uses requestAnimationFrame for smooth rendering
- **Data Resolution**: 1-minute intervals for orbit data, higher resolution for landing phase
- **Browser Support**: Requires modern browser with WebGL support for 3D mode

## Recent Updates (August 2025)

### File Organization
- All Chandrayaan-3 specific assets moved to `assets/chandrayaan3/` directory
- JavaScript files organized under `assets/chandrayaan3/js/`
- CSS moved to `assets/chandrayaan3/css/`
- Supporting HTML pages in `assets/chandrayaan3/html/`
- Orbit data files now in `assets/chandrayaan3/data/` (excluded from Git)
- 3D models in `assets/chandrayaan3/models/`

### Data Pipeline Updates
- Python script now outputs to timestamped archive directories
- Files are also copied to main data directory for runtime access
- Archive structure: `assets/chandrayaan3/archive/data-fetched/YYYYMMDDHHMMSS/`

## Important File Locations

### Project Structure
```
cy3/
├── chandrayaan3.html              # Main entry point (root for easy web access)
├── assets/
│   └── chandrayaan3/
│       ├── js/                    # JavaScript files
│       │   ├── cy3.js             # Core animation logic
│       │   └── astro.js           # Astronomy calculations
│       ├── css/
│       │   └── cy3.css            # Application styles
│       ├── html/
│       │   └── whatsnew-cy3.html  # Supporting pages
│       ├── images/
│       │   └── chandrayaan3-screenshot.png  # Social media preview
│       ├── data/                  # Orbit data files (Chebyshev JSON)
│       ├── models/                # 3D models (GLB files)
│       └── archive/               # Historical data archives
├── scripts/                       # Data generation scripts
│   ├── orbits.py                  # Python orbit fetcher
│   └── [other scripts]
├── third-party/                   # External libraries (jQuery, D3, Three.js)
└── images/                        # Earth/Moon texture images
```