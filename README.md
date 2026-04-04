
## Moon Mission Orbit Animations

Interactive 2D/3D lunar mission visualizations powered by NASA JPL HORIZONS data and curated runtime ephemeris artifacts.

Live pages:

- Landing/index: <https://sankara.net/astro/lunar-missions/>
- Mission app: <https://sankara.net/astro/lunar-missions/mission.html>
- Orbit data status: <https://sankara.net/astro/lunar-missions/orbit-data.html>
- Assets status: <https://sankara.net/astro/lunar-missions/assets-status.html>

Sample direct mission links:

- **[Chandrayaan 3](https://sankara.net/astro/lunar-missions/mission.html?mission=chandrayaan3)** (2023)
- **[Chandrayaan 2](https://sankara.net/astro/lunar-missions/mission.html?mission=chandrayaan2)** (2019)
- **[Artemis 2](https://sankara.net/astro/lunar-missions/mission.html?mission=artemis2)** (2026)
- **[GRAIL](https://sankara.net/astro/lunar-missions/mission.html?mission=grail)** (2011-2012)
- **[LRO](https://sankara.net/astro/lunar-missions/mission.html?mission=lro)** (2009-)
- **[SLIM](https://sankara.net/astro/lunar-missions/mission.html?mission=slim)** (2024)

![Mission Preview](images/social/mission-social.png)

## Features

I created this animation for educational purposes. It has the following features:

* Real-world orbit data and predictions based on information available from JPL/NASA HORIZONS interface
* Rendering of the orbit in 2D and 3D
* Rendering with Earth-centered, Moon-centered, and Earth-Moon relative-frame origins
* Multi-craft missions with per-craft styling, visibility pills, and per-craft timeline spans
* Camera from/to controls for mounted viewpoints (spacecraft, Earth, Moon)
* Optional auxiliary camera panels (desktop) for simultaneous craft->Earth and craft->Moon views
* Views aligned with J2000 reference axes
* Information on all earth bound and moon bound maneuvers (engine burns)
* Realistic textures for Earth and Moon in 3D mode
* Astronomically correct rendering of sunlight on Earth and Moon, poles, and polar axes
* Various animation controls for education - camera controls (pan, zoom, rotate), timeline controls, visibility controls
* A Joy Ride feature which lets you fly along with the spacecraft
* Relative-frame mode (`mode=relative`) to view Earth-Moon transfer geometry with Earth->Moon axis fixed
* Selectable orbit styles (`Trail` and `Classic`) with background-loaded style sidecars for authored missions such as CH3
* On startup, if current wall-clock time is within mission data span, runtime can auto-seek to `Now`, switch to realtime speed, and start playback
* Mission brief panels with authored Mission and HORIZONS Data text, programmatic timeline bars, a pilot orbit preview, and curated CC BY-SA image carousels

## Run locally

Prerequisites: Node.js (for the Vite dev server). Python is only needed for orbit-data tooling.

```bash
npm install
npm run dev
```

Open:

- `http://localhost:7274/`
- `http://localhost:7274/index.html`
- `http://localhost:7274/mission.html?mission=chandrayaan3`
- `http://localhost:7274/mission.html?mission=artemis2&mode=relative`
- `http://localhost:7274/orbit-data.html`
- `http://localhost:7274/assets-status.html`

## Multi-Mission Support

URL parameters:

- `index.html` - Landing page
- `mission.html` - Mission selector + app shell (landing view shown when `mission` is omitted)
- `mission.html?mission=<id>` - Open a mission directly (IDs come from `assets/mission-catalog.json`)
- `mission.html?mission=<id>&mode=relative` - Relative-frame mode
- `mission.html?mission=<id>&testMode=true` - Test harness mode for deterministic test behavior

### Debugging with NPZ ephemeris

Runtime supports `chebyshev`, `npz`, and `astronomy` body sources, configured per mission via `ephemeris_source` / `ephemeris_sources` in `config.json`.

Current mission configs in this repo are set to `chebyshev` for `SC`, `MOON`, `EARTH`, and `SUN` by default.

For NPZ debugging, set `"ephemeris_source": "npz"` (or per-body overrides), and stage matching `.npz` files (for example `geo-<SC>.npz`, `lunar-<SC>.npz`, and `landing-<SC>-geo.npz` / `landing-<SC>-lunar.npz` when used).

Developer workflow/build/CI guide: [docs/developer.md](docs/developer.md)  
System design index: [docs/design/design.md](docs/design/design.md)

Shared authored mission panel content lives in:

- `assets/mission-briefs.json`
- `assets/mission-images.json`

Mission config authoring workflow:
- edit `assets/*/data/config.json5` (maintainer source with comments)
- compile runtime JSON with `npm run configs:compile` (writes `assets/*/data/config.json`)
- verify sync with `npm run configs:check`

## Data Repository Boundary

This repository contains runtime app code, mission config, and UI assets.

Generated orbit/ephemeris artifacts are maintained in the sibling data repository (`moon-mission-data`), including:

- `*-cheb.json`
- `*-cheb.json.gz`
- `*.npz`
- `*-meta.json`
- authored style sidecars such as `geo-style.json` / `lunar-style.json`

CI/deploy workflows stage those artifacts into this app during build/deploy.

## Design

The animation has 2D and 3D rendering modes. 

The 2D mode uses SVG and D3 JS. Planetary orbits are rendered as ellipses
based on orbital elements. Spacecraft orbits are rendered using line segments
using position data.

The 3D mode uses THREE JS.

jQuery is used in parts of the UI, with a lightweight compatibility dialog shim (`src/platform/js/ui/jquery-ui-dialog-stub.js`) instead of full jQuery UI.

Orbit data is fetched offline from JPL/NASA HORIZONS.
This data is processed and converted into Chebyshev polynomial format for efficient interpolation.
The runtime supports Chebyshev/NPZ/Astronomy body providers, and current mission configs default to Chebyshev for all major bodies.

**Time Systems:** Runtime ephemeris sampling currently uses UTC-based Julian date helpers for
Chebyshev/NPZ lookups, while TDB-based helpers are used for astronomical orientation math
(for example lunar pole calculations). UTC is used for user-facing event times and display.
See [docs/design/design.md](docs/design/design.md) for detailed technical/design notes.

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

CI workflows stage runtime mission assets from a separate data repository before publishing. Staged assets include orbit artifacts (`*-cheb.json`, `*-cheb.json.gz`, manifests, optional `.npz` / `*-meta.json`, and orbit-style sidecars such as `geo-style.json` / `lunar-style.json`), shared textures (`images/`), mission screenshots (`assets/*/images/`), and optional vendored runtime libraries (`third-party/`).

By default workflows use:

- `MISSION_DATA_REPO = kvsankar/moon-mission-data`
- `MISSION_DATA_REF = main`

You can override these via GitHub repository variables with the same names. No extra token is needed when the data repo is public.

Current workflow behavior:

- `.github/workflows/ci.yml` runs on push, pull request, and manual trigger.
- `.github/workflows/deploy-app-only.yml` is manual-only (`workflow_dispatch`) for GitHub Pages app-only deploys.
- `.github/workflows/deploy-hostgator-app-only.yml` is manual-only (`workflow_dispatch`) for sankara.net app-only deploys.
- `.github/workflows/deploy.yml` is manual-only (`workflow_dispatch`) for GitHub Pages deploys.
- `.github/workflows/deploy-hostgator.yml` is manual-only (`workflow_dispatch`) for sankara.net deploys.

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


