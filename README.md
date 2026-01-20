
## Moon Mission Orbit Animations

A multi-mission platform for 3D and 2D orbital animations of lunar missions. Currently supports:

- **[Chandrayaan 3](http://sankara.net/mission.html?mission=cy3)** (2023) - India's successful Moon landing
- **[Chandrayaan 2](http://sankara.net/mission.html?mission=cy2)** (2019) - Vikram lander descent trajectory
- **[Apollo 10 LM](http://sankara.net/mission.html?mission=apollo10-lm)** (1969) - Snoopy lunar module
- **[Apollo 11 S-IVB](http://sankara.net/mission.html?mission=apollo11-sivb)** (1969) - Saturn V third stage

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
* A Joy Ride feature which lets you fly along with the spacecraft

## Multi-Mission Support

The platform supports multiple lunar missions through a configuration-driven architecture:

### URL Parameters
- `mission.html` - Shows mission selector page
- `mission.html?mission=cy3` - Chandrayaan 3
- `mission.html?mission=cy2` - Chandrayaan 2
- `mission.html?mission=apollo10-lm` - Apollo 10 LM (Snoopy)
- `mission.html?mission=apollo11-sivb` - Apollo 11 S-IVB

### Adding a New Mission

To add a new mission, create a mission folder and configuration:

1. **Create mission folder structure:**
   ```
   assets/<mission-name>/
   ├── data/
   │   ├── config.json          # Mission configuration
   │   ├── geo-<ID>-cheb.json   # Geocentric orbit data
   │   ├── lunar-<ID>-cheb.json # Selenocentric orbit data
   │   └── landing-<ID>-cheb.json # Landing phase (optional)
   ├── models/                   # 3D spacecraft models (optional)
   └── images/                   # Screenshots
   ```

2. **Create `config.json`** with mission parameters (see [docs/developer.md](docs/developer.md) for full schema)

3. **Generate orbit data** from JPL HORIZONS using `scripts/orbits.py`

4. **Register mission** in `mission.html` missionMap

See [docs/developer.md](docs/developer.md) for detailed instructions.

## Design

## High level design

The animation has 2D and 3D rendering modes. 

The 2D mode uses SVG and D3 JS. Planetary orbits are rendered as ellipses
based on orbital elements. Spacecraft orbits are rendered using line segments
using position data.

The 3D mode uses THREE JS.

JQuery and JQueryUI are used for control and information panels.

Orbit data is fetched offline from JPL/NASA HORIZONS.
This data is processed and converted into Chebyshev polynomial format for efficient interpolation.
Moon and Earth positions are computed dynamically using Astronomy Engine.

**Time Systems:** The application uses TDB (Barycentric Dynamical Time) for all astronomical calculations
and Chebyshev lookups, matching the time system used by JPL HORIZONS. UTC is used for user-facing display.
See [docs/developer.md](docs/developer.md) for detailed technical documentation.

Mission configuration, including all event timings and descriptions, is centralized in 
`assets/chandrayaan3/data/config.json` for easy maintenance and modification.

### Fetching orbit data

The Python script `scripts/orbits.py` is used to fetch orbit data during development time from
<a href="http://ssd.jpl.nasa.gov/?horizons">NASA JPL HORIZONS</a> web interface.

#### Usage

```bash
# Fetch geocentric orbit data
python scripts/orbits.py --mission chandrayaan3 --phase geo

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

Orbit data for use by the JavaScript is placed in `assets/chandrayaan3/data/`:

    geo-CY3-cheb.json           # geocentric Chebyshev coefficients for SC trajectory
    geo-CY3-meta.json           # metadata (step size, timing info)
    lunar-CY3-cheb.json         # selenocentric Chebyshev coefficients
    lunar-CY3-meta.json         # metadata
    landing-CY3-cheb.json       # landing phase Chebyshev coefficients (high resolution)
    landing-CY3-meta.json       # metadata
    config.json                 # mission configuration and events
    

### Project Structure

The project follows a platform-based architecture that separates reusable components from mission-specific assets:

```
moon-mission/
├── mission.html                   # Main entry point with mission selector
├── index.html                     # Redirects to mission.html
├── assets/
│   ├── platform/                  # Reusable platform components
│   │   ├── css/
│   │   │   └── mission.css        # Core styling (mission-agnostic)
│   │   └── js/
│   │       ├── mission.js         # Core animation engine (AnimationScene class)
│   │       ├── astro.js           # Astronomy calculations
│   │       ├── chebyshev.js       # Chebyshev polynomial interpolation
│   │       ├── astronomy-bodies.js # Astronomy Engine wrapper
│   │       ├── core/              # Core utilities
│   │       │   ├── constants.js   # Physics, color, and light constants
│   │       │   └── dom.js         # DOM manipulation utilities
│   │       ├── rendering/         # Extracted renderer classes
│   │       │   ├── camera-controller.js    # Camera and controls management
│   │       │   ├── spacecraft-renderer.js  # Spacecraft visualization
│   │       │   ├── light-manager.js        # Two-layer lighting system
│   │       │   ├── earth-renderer.js       # Earth sphere and axis
│   │       │   ├── moon-renderer.js        # Moon sphere and axis
│   │       │   ├── sky-renderer.js         # Starfield and constellations
│   │       │   └── scene-helpers.js        # Axes, planes, SOI wireframe
│   │       └── utils/
│   │           └── math-utils.js  # Mathematical utilities
│   ├── chandrayaan3/              # Chandrayaan 3 mission assets
│   │   ├── data/
│   │   │   ├── config.json        # Mission configuration
│   │   │   └── *-cheb.json        # Chebyshev orbit data
│   │   ├── images/
│   │   └── models/                # 3D spacecraft models
│   ├── chandrayaan2/              # Chandrayaan 2 mission assets
│   │   ├── data/
│   │   │   ├── config.json        # Mission configuration
│   │   │   └── *-cheb.json        # Chebyshev orbit data
│   │   └── images/
│   ├── apollo10-lm/               # Apollo 10 LM (Snoopy) assets
│   │   └── data/
│   └── apollo11-sivb/             # Apollo 11 S-IVB assets
│       └── data/
├── third-party/                   # External libraries
├── images/                        # Shared textures (Earth, Moon, stars)
├── scripts/                       # Build and data scripts
│   ├── orbits.py                  # Fetch orbit data from HORIZONS
│   ├── compress-orbits.py         # Convert to Chebyshev format
│   ├── convert-cy2-json.py        # Convert legacy CY2 JSON data
│   ├── merge-cy2-vikram.py        # Merge Orbiter + Vikram trajectories
│   ├── build.py                   # Build for deployment
│   └── deploy.py                  # Deploy to server
└── test/                          # Visual regression tests
```

#### Platform Components (Reusable)

- **`assets/platform/js/mission.js`** - Core animation engine (AnimationScene class)
- **`assets/platform/js/astro.js`** - Astronomical calculations and utilities
- **`assets/platform/js/chebyshev.js`** - Chebyshev polynomial interpolation for orbit data
- **`assets/platform/js/astronomy-bodies.js`** - Astronomy Engine wrapper for Moon/Earth calculations
- **`assets/platform/js/core/constants.js`** - Centralized physics, color, and light constants
- **`assets/platform/js/core/dom.js`** - DOM manipulation utilities and D3.js integration
- **`assets/platform/js/utils/math-utils.js`** - Mathematical utilities (vectors, conversions)
- **`assets/platform/css/mission.css`** - Base styling for any mission

#### Rendering Modules (Extracted from mission.js)

- **`rendering/camera-controller.js`** - Camera management (main, craft-attached, drone cameras)
- **`rendering/spacecraft-renderer.js`** - Spacecraft visualization (geometric and GLTF modes)
- **`rendering/light-manager.js`** - Two-layer lighting (primary for celestial bodies, secondary for spacecraft)
- **`rendering/earth-renderer.js`** - Earth sphere with textures and polar axis
- **`rendering/moon-renderer.js`** - Moon sphere with displacement mapping and polar axis
- **`rendering/sky-renderer.js`** - Starfield and constellation background
- **`rendering/scene-helpers.js`** - Axes, ecliptic/equatorial planes, SOI wireframe

#### Mission-Specific Assets

- **`assets/chandrayaan3/data/config.json`** - Mission timeline, events, spacecraft parameters
- **`assets/chandrayaan3/data/*.json`** - Orbit data (geocentric, selenocentric, landing phases)
- **`assets/chandrayaan3/models/*.glb`** - 3D models of Chandrayaan-3 spacecraft

#### Third-Party Libraries

- **D3.js v3** - 2D SVG rendering and data visualization
- **Three.js** - 3D WebGL rendering engine
- **jQuery (legacy)** - DOM manipulation, plus a lightweight dialog shim for panels
- **Astronomy Engine** - High-precision ephemeris calculations for Moon/Earth positions

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

The project includes automated UI testing for comprehensive functionality verification.

### Running Tests

```bash
# Recommended: manage the test server and run the full UI suite (SSIM-based)
make test

# Without make (manual server management)
node test/server-manager.js start
HEADLESS=true VITE_TEST_BASE_URL=http://localhost:8111 npx vitest test/ui.test.js --run
node test/server-manager.js stop

# If you already have a server running, run the UI suite directly
npx vitest test/ui.test.js --run

# Override the server URL (default is http://localhost:8111)
VITE_TEST_BASE_URL=http://localhost:8000 npx vitest test/ui.test.js --run
```

### Test Coverage

- **UI Elements:** Timeline controls, animation controls, view toggles
- **Dual Modes:** Earth-centered and Moon-centered orbital perspectives  
- **Visual Regression:** Screenshot comparison with baseline images using SSIM
- **Error Detection:** Console error monitoring during test execution

Tests verify UI functionality across orbital modes and control states. See [docs/testing/](docs/testing/) for detailed test documentation.

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

The code base is undergoing incremental modernization. The very first release was for the Mars Orbiter Mission launch in 2013. After supporting several missions, the code grew into a large monolithic file.

### Modernization Progress (January 2026)

A systematic refactoring effort has extracted modular components from the monolithic `mission.js`:

**Completed:**
- ✅ Extracted 7 renderer classes to `assets/platform/js/rendering/`
- ✅ Centralized constants (physics, colors, lights) in `core/constants.js`
- ✅ DOM utilities extracted to `core/dom.js`
- ✅ Math utilities extracted to `utils/math-utils.js`
- ✅ Animation controller extracted to `assets/platform/js/animation/animation-controller.js`
- ✅ UI event binding centralized in `assets/platform/js/ui/event-handlers.js`
- ✅ Lightweight pub/sub added in `assets/platform/js/core/event-bus.js`
- ✅ Multi-mission support with configuration-driven architecture
- ✅ Visual regression testing with SSIM-based comparison (48 tests)

**In Progress:**
- UI state management refactoring
- Further reduce `assets/platform/js/mission.js` to orchestration-only

**Future Goals:**
- Further reduce `mission.js` to orchestration-only (~500 lines)
- TypeScript migration for better maintainability
- jQuery UI migration to lighter alternatives
- Responsive UX for mobile screens
- On-demand loading of high-resolution textures

See [docs/modernization-plan-2026.md](docs/modernization-plan-2026.md) for the detailed roadmap. 

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


