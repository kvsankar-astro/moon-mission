
## Moon Mission Orbit Animations

A multi-mission platform for 3D and 2D orbital animations of lunar missions. Currently supports:

- **[Chandrayaan 3](http://sankara.net/mission.html?mission=cy3)** (2023) - India's successful Moon landing
- **[Chandrayaan 2](http://sankara.net/mission.html?mission=cy2)** (2019) - Vikram lander descent trajectory
- **[Apollo 10 LM](http://sankara.net/mission.html?mission=apollo10-lm)** (1969) - Snoopy lunar module
- **[Apollo 11 S-IVB](http://sankara.net/mission.html?mission=apollo11-sivb)** (1969) - Saturn V third stage
- **[Artemis 1](http://sankara.net/mission.html?mission=artemis1)** (2022) - Orion lunar mission

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
* Relative-frame mode (`mode=relative`) to view Earth-Moon transfer geometry with Earth->Moon axis fixed

## Run locally

Prerequisites: Node.js (for the Vite dev server). Python is only needed for orbit-data tooling.

```bash
npm install
npm run dev
```

Open:

`http://localhost:7274/mission.html?mission=cy3`

## Multi-Mission Support

URL parameters:

- `mission.html` - Mission selector page
- `mission.html?mission=cy3` - Chandrayaan 3
- `mission.html?mission=cy2` - Chandrayaan 2
- `mission.html?mission=apollo10-lm` - Apollo 10 LM (Snoopy)
- `mission.html?mission=apollo11-sivb` - Apollo 11 S-IVB
- `mission.html?mission=artemis1` - Artemis 1

### Debugging with NPZ ephemeris

To bypass Chebyshev and the Astronomy Engine for orbit data, set `"ephemeris_source": "npz"` in a mission's `config.json`, and place matching `.npz` files (e.g., `geo-<SC>.npz`, `lunar-<SC>.npz`, and when applicable `landing-<SC>-geo.npz` / `landing-<SC>-lunar.npz`) alongside the other data files. Earth, Moon, and spacecraft positions will then be read directly from the HORIZONS NPZ vectors.

Developer documentation (adding missions, orbit pipeline, build/deploy scripts): [docs/developer.md](docs/developer.md)

## Design

The animation has 2D and 3D rendering modes. 

The 2D mode uses SVG and D3 JS. Planetary orbits are rendered as ellipses
based on orbital elements. Spacecraft orbits are rendered using line segments
using position data.

The 3D mode uses THREE JS.

JQuery and JQueryUI are used for control and information panels.

Orbit data is fetched offline from JPL/NASA HORIZONS.
This data is processed and converted into Chebyshev polynomial format for efficient interpolation.
Moon and Earth positions are computed dynamically using Astronomy Engine.

**Time Systems:** Runtime ephemeris sampling currently uses UTC-based Julian date helpers for
Chebyshev/NPZ lookups, while TDB-based helpers are used for astronomical orientation math
(for example lunar pole calculations). UTC is used for user-facing event times and display.
See [docs/developer.md](docs/developer.md) for detailed technical notes.

## Testing

The project includes automated testing with Vitest + Playwright.

```bash
make test
```

`make test` runs the primary UI + visual regression suite (`test/ui.test.js`) on `http://localhost:8111`.

For strategy and full-suite commands (`ui`, `mission-smoke`, `chebyshev-accuracy`), see:
- [docs/testing/README.md](docs/testing/README.md)

### Hosting

At present the page can be hosted statically. There are no server components needed.
However, you need to serve it over HTTP (not `file://`) to avoid module/fetch/CORS issues.

### Deployment Data Repository

CI workflows (tests + deploy) stage runtime mission assets from a separate data repository before publishing. Staged assets include orbit artifacts (`.npz`, `*-cheb.json`, `*-meta.json`, manifests), shared textures (`images/`), mission screenshots (`assets/*/images/`), and vendored runtime libraries (`third-party/`).

By default workflows use:

- `MISSION_DATA_REPO = kvsankar/moon-mission-data`
- `MISSION_DATA_REF = main`

You can override these via GitHub repository variables with the same names. No extra token is needed when the data repo is public.

For development, you can use the Vite dev server:
```bash
npm run dev
```

Or Python's built-in server:
```bash
python -m http.server 7274
```

Or Node.js http-server:
```bash
npx http-server
``` 

### Deployed Version and Audit Artifacts

Each deployment now publishes machine-readable metadata:

- `/deployment/version.json` - deployed app/data repository commits, CI run metadata, and artifact summary
- `/deployment/runtime-asset-manifest.json` - required runtime assets and SHA-256 values from `moon-mission-data`
- `/deployment/file-manifest.json` - file list + SHA-256 for the deployed static tree

For the production site this is available at:

- `https://sankara.net/astro/lunar-missions/deployment/version.json`

The Hostgator deploy workflow also runs a post-deploy parity audit (`rsync --dry-run --checksum --delete`) and fails if the remote tree differs from the staged deployment output.

Quick CLI check:

```bash
python scripts/show-deployed-version.py
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
  
## Roadmap

This project is undergoing incremental modernization (the earliest versions date back to 2013).

See [docs/archived/modernization-plan-2026.md](docs/archived/modernization-plan-2026.md) for historical roadmap and progress context.

## AI assistance

See [docs/ai-tools.md](docs/ai-tools.md) for how AI tools are used in this repo (and where tool-specific notes live).

## Inspirations

* https://mgvez.github.io/jsorrery/ 
* https://github.com/Flowm/satvis
* https://github.com/CoryG89/MoonDemo 
* http://stuffin.space/ 
* https://theskylive.com/3dsolarsystem 


