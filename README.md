
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
cy3/
├── chandrayaan3.html              # Main HTML entry point
├── assets/
│   ├── platform/                  # Reusable platform components
│   │   ├── css/
│   │   │   └── mission.css        # Core styling (mission-agnostic)
│   │   └── js/
│   │       ├── mission.js         # Core animation logic
│   │       ├── astro.js           # Astronomy calculations
│   │       └── chebyshev.js       # Chebyshev polynomial interpolation
│   └── chandrayaan3/              # Mission-specific assets
│       ├── data/
│       │   ├── config.json        # Mission configuration
│       │   └── *-cheb.json        # Chebyshev orbit data files (not in Git)
│       ├── html/
│       │   └── whatsnew-cy3.html  # Mission-specific pages
│       ├── images/
│       │   └── chandrayaan3-screenshot.png
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
- **`assets/platform/js/chebyshev.js`** - Chebyshev polynomial interpolation for orbit data
- **`assets/platform/js/astronomy-bodies.js`** - Astronomy Engine wrapper for Moon/Earth calculations
- **`assets/platform/js/core/constants.js`** - Centralized physical and mathematical constants
- **`assets/platform/js/core/dom.js`** - DOM manipulation utilities and D3.js integration
- **`assets/platform/css/mission.css`** - Base styling for any mission

#### Mission-Specific Assets

- **`assets/chandrayaan3/data/config.json`** - Mission timeline, events, spacecraft parameters
- **`assets/chandrayaan3/data/*.json`** - Orbit data (geocentric, selenocentric, landing phases)
- **`assets/chandrayaan3/models/*.glb`** - 3D models of Chandrayaan-3 spacecraft

#### Third-Party Libraries

- **D3.js v3** - 2D SVG rendering and data visualization
- **Three.js** - 3D WebGL rendering engine
- **jQuery/jQuery UI** - DOM manipulation and UI components
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
# Run complete test suite (47 tests)
npm test

# Run with custom server URL
VITE_TEST_BASE_URL=http://localhost:8000 npm test
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


