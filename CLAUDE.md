# CLAUDE.md

## CONTINUATION PROMPT - Current Work in Progress

**Task:** Fix failing visual regression tests in `test/ui.test.js`

### Problem Identified
- 24 tests were failing due to screenshot comparison using pixel-by-pixel matching (pixelmatch)
- SSIM analysis revealed only 3 real issues; the rest (42) are false positives from anti-aliasing variations
- Root causes:
  1. Pixel tolerance of 10 is too strict for WebGL 3D rendering
  2. Some tests don't explicitly set checkbox states (e.g., `#view-orbit`)
  3. Landing animation state leaks between tests

### Work Completed
1. Created `scripts/ssim-compare.js` - SSIM comparison tool that identified false positives
2. Installed `ssim.js` package (in devDependencies)
3. Identified all 22 UI checkboxes and their handling in each test (comprehensive analysis done)

### Remaining Tasks
1. **Update test file** (`test/ui.test.js`):
   - Replace `pixelmatch` import with `ssim.js`
   - Replace `TOLERANCE` constants with `SSIM_THRESHOLD` (0.95 for standard, 0.90 for complex scenes)
   - Rewrite `compareScreenshots()` function to use SSIM instead of pixel matching
   - Add `?testMode=true` URL parameter for anti-aliasing control

2. **Fix checkbox state issues**:
   - Add `ensureOrbitEnabled()` helper function
   - Add `ensureLandingDisabled()` helper function
   - Update `beforeEach` to ensure: stellar sky disabled, landing disabled, orbit enabled
   - Fix "2D/3D Mode Switching" test - add `#view-orbit` enable before screenshot
   - Fix "Landing Animation" test - disable landing in cleanup
   - Fix "CY3 Descent Orbit Display" test - restore `#view-orbit` state

3. **Add test-mode anti-aliasing** to product code:
   - Check for `?testMode=true` URL parameter in `mission.js`
   - Enable anti-aliasing on WebGLRenderer when in test mode

### Key Files
- `test/ui.test.js` - Main test file (needs updates)
- `assets/platform/js/mission.js` - Product code (add testMode anti-aliasing)
- `scripts/ssim-compare.js` - SSIM comparison utility (already created)

### SSIM Thresholds to Use
```javascript
const SSIM_THRESHOLD = {
  IDENTICAL: 0.99,      // For exact visual matches
  VERY_SIMILAR: 0.97,   // For minor anti-aliasing differences
  SIMILAR: 0.95,        // For standard 3D scene comparisons (DEFAULT)
  DIFFERENT: 0.90       // For complex 3D scenes
};
```

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the source code for a 3D and 2D animation of the ISRO Chandrayaan 3 mission orbit, hosted at http://sankara.net/chandrayaan3.html. The animation displays real-world orbit data and predictions from JPL/NASA HORIZONS interface.

## High-Level Architecture

The project consists of several major components:

1. **Orbit Data Pipeline**: 
   - Python script (`scripts/orbits.py`) fetches orbit data from NASA JPL HORIZONS
   - Data is fetched for different phases: geocentric ("geo"), selenocentric ("lunar"), and landing
   - Raw data is converted to JSON format for use by the animation
   - Alternative NPZ (NumPy compressed) format is also supported
   - Data is saved to both timestamped archive directories and the main data directory

2. **Frontend Visualization**:
   - `chandrayaan3.html` - Main HTML page (stays in root for easy web access)
   - `assets/chandrayaan3/js/cy3.js` - Core JavaScript module handling animation logic (ES6 modules)
   - `assets/chandrayaan3/js/astro.js` - Astronomy support functions (Julian dates, coordinate conversions)
   - `assets/chandrayaan3/js/npyreader.js` - NPZ/NPY file reader for orbit data
   - `assets/chandrayaan3/css/cy3.css` - Styling for the application
   - Uses THREE.js for 3D rendering and D3.js for 2D SVG rendering
   - jQuery/jQuery UI for UI controls

3. **Data Formats**:
   - Orbit data stored in `assets/chandrayaan3/data/` as JSON files: `geo-CY3.json`, `lunar-CY3.json`, `landing-CY3.json`
   - Alternative NPZ format: `geo-CY3.npz`, `lunar-CY3.npz`, `landing-CY3.npz`
   - Metadata files: `geo-CY3-meta.json`, `lunar-CY3-meta.json`, `landing-CY3-meta.json`
   - Each file contains spacecraft position vectors and orbital elements

## Common Development Commands

### Fetching Orbit Data

Using Python (recommended):
```bash
# Fetch geocentric orbit data
python scripts/orbits.py --phase=geo

# Fetch selenocentric orbit data
python scripts/orbits.py --phase=lunar

# Generate JSON and NPZ formats (both generated automatically)
python scripts/orbits.py --phase=geo
python scripts/orbits.py --phase=lunar
python scripts/orbits.py --phase=landing
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

### NPZ Support
- Added support for NumPy compressed (NPZ) format for orbit data
- NPZ files provide more efficient storage and faster loading
- Python script automatically generates both JSON and NPZ files

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
│       │   ├── astro.js           # Astronomy calculations
│       │   ├── npyreader.js       # NPZ/NPY file reader
│       │   └── ga.js              # Google Analytics
│       ├── css/
│       │   └── cy3.css            # Application styles
│       ├── html/
│       │   └── whatsnew-cy3.html  # Supporting pages
│       ├── images/
│       │   └── chandrayaan3-screenshot.png  # Social media preview
│       ├── data/                  # Orbit data files (JSON/NPZ)
│       ├── models/                # 3D models (GLB files)
│       └── archive/               # Historical data archives
├── scripts/                       # Data generation scripts
│   ├── orbits.py                  # Python orbit fetcher
│   └── [other scripts]
├── third-party/                   # External libraries (jQuery, D3, Three.js)
└── images/                        # Earth/Moon texture images
```