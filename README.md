
## Chandrayaan 3 orbit animation

This project holds the source code for the 3D and 2D animations used
in http://sankara.net/chandrayaan3.html. That page shows an animation
of the orbit of the ISRO <a href="https://www.isro.gov.in/Chandrayaan3_New.html">
Chandrayaan 3</a> mission.

![Screenshot](/assets/chandrayaan3/images/chandrayaan3-screenshot.png?raw=true)

## Features

I created this animation for educational purposes. It has the following features:

* Real-world orbit data and predictions based on information available from JPL/NASA HORIZONS interface
* Rendering of the orbit in 2D and 3D
* Rendering of the orbit with either Earth or Moon at the center
* Rendering of the orbit with views locked on Earth, Moon, or the spacecraft
* Views aligned with J2000 reference axes
* Information on all earth bound and moon bound maneuvers (engine burns)
* Realistic textures for Earth and Moon in 3D mode
* Astronomically correct rendering of sunlight on Earth and Moon, poles, and polar axes
* Various animation controls for education - camera controls (pan, zoom, rotate), timeline controls, visibility controls
* A Joy Ride feature which lets you fly along with Chandrayaan 3
    
## Design

## High level design

The animation has 2D and 3D rendering modes. 

The 2D mode uses SVG and D3 JS. Planetary orbits are rendered as ellipses
based on orbital elements. Spacecraft orbits are rendered using line segments
using position data.

The 3D mode uses THREE JS.

JQuery and JQueryUI are used for control and information panels.

Orbit data is fetched offline from JPL/NASA HORIZONS.
This data in CSV format is processed a bit and converted into JSON or NPZ format 
for use in the animation. A few astronomy functions are based on Steve Moshier's routines.

Mission configuration, including all event timings and descriptions, is centralized in 
`assets/chandrayaan3/data/config.json` for easy maintenance and modification.

### Fetching orbit data

The Python script `scripts/orbits.py` is used to fetch orbit data during development time from
<a href="http://ssd.jpl.nasa.gov/?horizons">NASA JPL HORIZONS</a> web interface.

#### Usage

```bash
# Fetch geocentric orbit data (JSON and NPZ formats generated automatically)
python scripts/orbits.py --phase geo

# Fetch selenocentric orbit data  
python scripts/orbits.py --phase lunar

# Fetch landing phase data (high resolution)
python scripts/orbits.py --phase landing

# Fetch multiple phases at once
python scripts/orbits.py --phases geo lunar landing

# Use cached data (skip re-downloading from JPL)
python scripts/orbits.py --phase geo --use-cache
```

The script supports the following options:

    --phase / --phases [geo|lunar|landing]  # mission phase(s) to process -- defaults to geo
                                           # --phases allows multiple phases at once
    --data-dir <datadir>                   # place to save orbit data files -- defaults to timestamped dir
    --use-cache                           # use orbit data retrieved and saved earlier -- optional

#### Data Output

Raw orbit data obtained from JPL is stored into timestamped archive directories:

    assets/chandrayaan3/archive/data-fetched/YYYYMMDDHHMMSS/
    ├── ho-<id>-elements.txt    # orbital elements for one instant of time
    ├── ho-<id>-vectors.txt     # co-ordinates for a period of time
    └── ho-<id>-orbit.txt       # orbital elements for one instant of time

Orbit data for use by the JavaScript is written in JSON and NPZ formats and placed in `assets/chandrayaan3/data/`:

    geo-CY3.json                # geocentric orbit data (elements and vectors) 
    geo-CY3.npz                 # compressed NumPy format (faster loading)
    geo-CY3-meta.json           # metadata (step size, timing info)
    lunar-CY3.json              # selenocentric orbit data 
    lunar-CY3.npz               # compressed format
    lunar-CY3-meta.json         # metadata
    landing-CY3.json            # landing phase orbit data (high resolution)
    landing-CY3.npz             # compressed format
    landing-CY3-meta.json       # metadata
    config.json                 # mission configuration and events
    

### Project Structure

The project follows a platform-based architecture that separates reusable components from mission-specific assets:

```
cy3/
├── chandrayaan3.html              # Main HTML entry point
├── assets/
│   ├── platform/                  # Reusable platform components
│   │   ├── css/
│   │   │   └── mission.css        # Core styling (mission-agnostic)
│   │   └── js/
│   │       ├── mission.js         # Core animation logic
│   │       ├── astro.js           # Astronomy calculations
│   │       └── npyreader.js       # Data format readers
│   └── chandrayaan3/              # Mission-specific assets
│       ├── data/
│       │   ├── config.json        # Mission configuration
│       │   ├── *.json             # Orbit data files (not in Git)
│       │   └── *.npz              # Compressed orbit data (not in Git)
│       ├── html/
│       │   └── whatsnew-cy3.html  # Mission-specific pages
│       ├── images/
│       │   └── chandrayaan3-screenshot.png
│       ├── js/
│       │   └── ga.js              # Analytics
│       └── models/
│           └── *.glb              # 3D spacecraft models
├── third-party/                   # External libraries
│   ├── css/
│   │   └── ui-darkness/           # jQuery UI theme
│   └── *.js                       # JavaScript libraries
├── images/                        # Shared textures (Earth, Moon, stars)
│   ├── earth/
│   ├── moon/
│   └── sky/
└── scripts/                       # Build and data scripts
    ├── build.py
    ├── deploy.py
    └── orbits.py
```

#### Platform Components (Reusable)

- **`assets/platform/js/mission.js`** - Core animation engine, mission-agnostic
- **`assets/platform/js/astro.js`** - Astronomical calculations and utilities
- **`assets/platform/js/npyreader.js`** - Data format readers (JSON, NPZ)
- **`assets/platform/css/mission.css`** - Base styling for any mission

#### Mission-Specific Assets

- **`assets/chandrayaan3/data/config.json`** - Mission timeline, events, spacecraft parameters
- **`assets/chandrayaan3/data/*.json`** - Orbit data (geocentric, selenocentric, landing phases)
- **`assets/chandrayaan3/models/*.glb`** - 3D models of Chandrayaan-3 spacecraft
- **`assets/chandrayaan3/js/ga.js`** - Mission-specific analytics

#### Third-Party Libraries

- **D3.js v3** - 2D SVG rendering and data visualization
- **Three.js** - 3D WebGL rendering engine
- **jQuery/jQuery UI** - DOM manipulation and UI components
- **Ephemeris.js** - Astronomical calculations library

## Build and Deployment

The project includes scripts for building and deploying the application.

### Build Script

`scripts/build.py` prepares files for deployment by creating a `dist` directory with all necessary files.

```bash
# Build the project (creates/updates dist folder)
python scripts/build.py

# Build without cleaning existing dist
python scripts/build.py --no-clean

# Build to custom directory
python scripts/build.py --dist my-dist
```

### Deployment Script

`scripts/deploy.py` deploys the built project locally or via SFTP.

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

Create `deploy-config.json` for deployment settings:

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

### Development Workflow

1. **Fetch latest orbit data** (if needed):
   ```bash
   # Fetch all phases at once
   python scripts/orbits.py --phases geo lunar landing
   
   # Or fetch individual phases
   python scripts/orbits.py --phase geo
   ```

2. **Build the project**:
   ```bash
   python scripts/build.py
   ```

3. **Deploy**:
   ```bash
   # Local deployment
   python scripts/deploy.py local --target /var/www/chandrayaan3

   # SFTP deployment
   python scripts/deploy.py sftp
   ```

## Testing

The project includes comprehensive automated UI testing infrastructure ensuring functionality across both orbital perspectives and all interaction modes.

### Test Infrastructure

- **Framework:** Vitest + Playwright for browser automation and visual regression testing
- **Dual-Mode Testing:** Parameterized tests covering both geocentric and selenocentric orbital perspectives  
- **Zero-Pixel Tolerance:** Exact screenshot matching for pixel-perfect UI consistency
- **Real-Time Monitoring:** Console error detection and comprehensive logging during all test phases

### Running Tests

```bash
# Run complete test suite (58 tests, ~4 minutes)
npm test

# Run in watch mode (re-run on file changes)
npx vitest test/baseline-ui.test.js

# Exit watch mode
# Press 'q' to quit
```

### Test Coverage

#### **Comprehensive UI Testing (58 Tests)**
- **Page Load Verification:** Application initialization and critical element presence
- **Timeline Controls:** All 15 mission events (Launch, EBNs, TLI, LBNs, Landing)
- **Animation Controls:** Play/Pause, speed adjustment, directional controls
- **Plane Selection:** XY/YZ plane switching with visual orientation verification
- **Dimension Controls:** 2D/3D mode switching with proper state restoration
- **Dual Orbital Modes:** Complete test suite in both geocentric and selenocentric perspectives

#### **Visual Regression Testing (11 Screenshot Tests)**
- **XY Plane Orientation:** Axes alignment verification (Red right, Green up)
- **YZ Plane Orientation:** Axes alignment verification (Green right, Blue up)  
- **3D Mode Rendering:** WebGL context and visualization state verification
- **2D Mode Rendering:** SVG rendering state verification
- **Mode Restoration:** Proper return to preferred 3D mode after testing cycles

#### **Error Monitoring & Reporting**
- **Real-Time Console Monitoring:** Automatic detection of JavaScript errors during test execution
- **Timestamped Reports:** CSV and JSON reports with pixel differences and timing data
- **Comprehensive Logging:** Detailed test execution logs with error tracking and performance metrics

### Test Reports

Each test run generates timestamped reports in `test/reports/`:
- **CSV Reports:** Pixel difference analysis for every screenshot comparison
- **JSON Logs:** Detailed execution logs with timing and error information
- **Performance Data:** Test duration and browser interaction timing

Tests ensure UI functionality remains consistent during refactoring and catch visual regressions across different orbital viewing modes and control states.

### Hosting

At present the page can be hosted statically. There are no server components needed.
However, to prevent browsers from complaining about CORS, one may use a tiny web server
like Mongoose to test the local site.

For development, you can use Python's built-in server:
```bash
python -m http.server 8000
```

Or Node.js http-server:
```bash
npx http-server
``` 

## Credits

* "Chandrayaan-2 in flight configuration" (https://skfb.ly/6SoMv) by tashtego is licensed under 
  Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  
* Jon D. Giorgini for helping with the JPL/HORIZONS interface and data. 
  He was very responsive whenever I mailed him my queries.
  He has been of great help since 2013 for the Mars Orbiter Mission until now
  for the Chandrayaan 3 mission.
  
* Members of the Bangalore Astronomy Society (http://bas.org.in/) for their valuable feedback

* Members of the Reddit r/isro (https://www.reddit.com/r/ISRO/) community for their valuable feedback
  
## Future work

The code base needs a rewrite. The very first release was for the Mars Orbiter Mission launch in 2013. 
Minor changes were made later to support MOM Mars orbit insertion and the Pluto flyby of New Horizons.

After a gap of 6 years, this was been modified again in 2019 to support the Chandrayaan 2 mission. 
The major changes were for 3D support. In that process, the code quality has degraded.

After another gap of 4 years, it has now been prepped for Chandrayaan 3. 

The rewrite will focus on present-day JavaScript tooling, better abstraction, 
better separation of concerns (2D vs. 3D, model vs. rendering, etc.), extensibility
(how does one extend the code for a new mission easily merely by changing configurations), 
performance (decrease the load time; improve rendering smoothness; on-demand loading of high resolution
LRO textures), and responsive UX. The current UX is not too great mobile screens. 

## Use of Generative AI

This project now leverages generative AI tools to accelerate development and improve code quality:

* **[Claude Code](https://claude.ai/code)** - Anthropic's AI coding assistant for enhancements, refactoring, and bug fixes
* **[Gemini CLI](https://ai.google.dev/gemini-api/docs/cli)** - Google's AI assistant for development tasks and automation

These tools help with code improvements, documentation updates, and implementing new features while maintaining the project's educational mission and code quality standards.

## Inspirations

* https://mgvez.github.io/jsorrery/ 
* https://github.com/Flowm/satvis
* https://github.com/CoryG89/MoonDemo 
* http://stuffin.space/ 
* https://theskylive.com/3dsolarsystem 


