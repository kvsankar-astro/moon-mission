# Developer Documentation

This guide is the code-aligned reference for architecture, mission onboarding, data generation, testing, and deployment.

## Current Architecture

- Entry points:
  - `mission.html` (mission selector + app shell; landing view when `mission` is omitted)
  - `index.html` (landing page)
- Shared platform code:
  - `src/platform/css/*`
  - `src/platform/js/*`
- Shared authored landing content:
  - `assets/mission-briefs.json`
  - `assets/mission-images.json`
- Mission-specific runtime assets:
  - `assets/<mission>/data/config.json`
  - `assets/<mission>/data/ephemeris-manifest.json`
  - `assets/<mission>/models/*` (optional)
  - `assets/<mission>/images/*` (optional)

## Terminology

- `origin`: runtime frame selection in the app (`geo`, `lunar`, plus URL mode `relative`).
- `landing slice`: high-resolution time slice, not a top-level origin.
- `phase`: still used by some offline scripts/manifests/CLI flags (for example `--phase`) for compatibility with existing pipeline naming.

## Runtime Ephemeris Sources

- Runtime supports per-body providers: `chebyshev`, `npz`, `astronomy`.
- Source selection is driven by mission config:
  - `ephemeris_source` (default for spacecraft)
  - `ephemeris_sources` (per-body overrides)
- Current mission configs in this repo are set to `chebyshev` for `SC`, `MOON`, `EARTH`, and `SUN`.

Related modules:
- `src/platform/js/data/ephemeris-provider.js`
- `src/platform/js/data/mission-data.js`
- `src/platform/js/app/orbit-load-actions.js`

## Mission Config Shape

Each mission defines runtime behavior in `assets/<mission>/data/config.json`.

Key fields used by runtime:

```json
{
  "spacecraft_mnemonic": "CH3L",
  "primaryCraftId": "CH3L",
  "crafts": [
    {
      "id": "CH3O",
      "mnemonic": "CH3O",
      "spacecraft_id": -169,
      "viewLabel": "Orbiter",
      "primary": false,
      "geo": { "orbits_file": "geo-CH3O" },
      "lunar": { "orbits_file": "lunar-CH3O" },
      "relative": { "orbits_file": "relative-CH3O" }
    },
    {
      "id": "CH3L",
      "mnemonic": "CH3L",
      "spacecraft_id": -158,
      "viewLabel": "Lander",
      "primary": true,
      "geo": { "orbits_file": "geo-CH3L" },
      "lunar": { "orbits_file": "lunar-CH3L" },
      "relative": { "orbits_file": "relative-CH3L" }
    }
  ],
  "ephemeris_source": "chebyshev",
  "ephemeris_sources": {
    "SC": "chebyshev",
    "MOON": "chebyshev",
    "EARTH": "chebyshev",
    "SUN": "chebyshev"
  },
  "origins": ["geo", "lunar"],
  "geo": {
    "center": "earth_center",
    "orbits_file": "geo-CH3L",
    "planets": ["MOON", "CH3O", "CH3L"],
    "step_size_in_seconds": 60,
    "orbit_style_file": "geo-style.json"
  },
  "lunar": {
    "center": "moon_center",
    "orbits_file": "lunar-CH3L",
    "planets": ["CH3O", "CH3L", "EARTH"],
    "step_size_in_seconds": 60,
    "orbit_style_file": "lunar-style.json"
  },
  "relative": {
    "orbits_file": "relative-CH3L"
  },
  "landing": {
    "enabled": true,
    "orbits_file": "landing-CH3L",
    "planets": ["CH3L"],
    "step_size_in_seconds": 1
  },
  "eventConfigs": {
    "geo": ["missionStart"],
    "lunar": ["missionStart"]
  }
}
```

Notes:
- `crafts[]` is the current multi-craft shape. `primaryCraftId` drives default camera/telemetry/visibility, but runtime state is body-keyed.
- `landing.center` controls landing rendering center.
- Landing data may be staged for both origin frames (`landing-<ID>-geo-*`, `landing-<ID>-lunar-*`) even when only one origin is currently active.
- `orbit_style_file` is optional and points to a compact authored sidecar loaded only for `Trail` orbit style.
- Some UI fields (for example `ui.lockOnLabel`) remain as metadata/label config.

## Adding a Mission

1. Create mission folder:

```text
assets/<mission>/
  data/
    config.json
    ephemeris-manifest.json
  images/      (optional)
  models/      (optional)
```

2. Add mission routing entry in `mission.html` (`missionMap` and selector card).
3. Generate orbit products (see data pipeline below).
4. Verify runtime in:
   - `mission.html?mission=<id>`
   - `mission.html?mission=<id>&mode=relative` (if relative artifact exists)

## Orbit Data Pipeline

### 1) Fetch mission vectors

```bash
python scripts/orbits.py --mission=<mission>
```

Optional targeted fetch:

```bash
python scripts/orbits.py --mission=<mission> --phase geo lunar
python scripts/orbits.py --mission=<mission> --phase landing landing-geo landing-lunar
```

### 2) Compress to Chebyshev

```bash
python scripts/compress-orbits.py --mission <mission>
```

### 3) Generate relative frame artifact

```bash
python scripts/generate-relative-orbits.py --mission <mission>
```

Output patterns (per mission):
- `geo-<ID>-cheb.json`
- `lunar-<ID>-cheb.json`
- `geo-<ID>-sun-cheb.json` / `lunar-<ID>-sun-cheb.json` (when split)
- `landing-<ID>-geo-cheb.json` / `landing-<ID>-lunar-cheb.json` (landing variants)
- `relative-<ID>-cheb.json`
- optional authored orbit-style sidecars such as `geo-style.json` / `lunar-style.json`

Generated intermediate/reference products are typically under `data-generated/<mission>/` (`.npz`, `*-meta.json`, raw fetch artifacts).

## Relative Mode

- URL driven: `mission.html?mission=<id>&mode=relative`
- Runtime keeps Earth at origin, fixes Earth->Moon axis to +X, and samples a precomputed multi-body `relative-<ID>-cheb.json`.
- Primary docs: [relative-mode.md](relative-mode.md)

## Time Conventions

- Runtime ephemeris lookup uses UTC-based Julian conversion (`getJD_UTC` helper path).
- Astronomical orientation math still uses TDB-oriented helpers where required.
- UI event timestamps are configured in UTC ISO format.

## Landing Brief Content

- The landing/selector UI opens a mission brief panel from `src/platform/js/index-landing.js`.
- The text column is intentionally split into:
  - `Mission`
  - `HORIZONS Data`
  - `Timelines`
- Mission and HORIZONS prose are authored offline in `assets/mission-briefs.json`; there is no runtime sentence synthesis.
- The `Timelines` section is still programmatic and renders three coverage bars from mission/config/HORIZONS metadata.
- The visual column renders:
  - a pilot orbit preview
  - an image carousel directly below it
- The carousel sources curated CC BY-SA entries from `assets/mission-images.json` and preserves full images with letterboxing/pillarboxing instead of cropping.

## Build and Deploy

### Local build output

```bash
python scripts/build.py
```

Produces `dist/` and generates deterministic `*.json.gz` companions for `*-cheb.json` unless disabled.

### Runtime asset staging from data repo

```bash
python scripts/stage-ephemeris-data.py \
  --app-root . \
  --data-root <path-to-moon-mission-data> \
  --target-root .
```

Stages:
- required orbit artifacts from mission manifests
- authored orbit-style sidecars referenced from mission config (`orbit_style_file`)
- shared `images/`
- mission screenshots `assets/*/images/`
- optional `third-party/`

### CI workflows

- `.github/workflows/ci.yml`
  - runs `npm run test:unit`
  - triggers on push, pull request, and manual dispatch
- `.github/workflows/deploy.yml`
  - manual-only (`workflow_dispatch`)
  - runs unit tests first
  - stages data repo assets into `dist-pages/`
  - writes deployment metadata under `dist-pages/deployment/`
  - verifies staged runtime assets against the runtime manifest
- `.github/workflows/deploy-hostgator.yml`
  - manual-only (`workflow_dispatch`)
  - runs unit tests first
  - same staging + metadata
  - deploys via rsync/SFTP
  - performs post-deploy parity audit

## Testing

Quick run:

```bash
make test
```

Primary suites:
- UI + SSIM: `test/ui.test.js`
- Cross-mission smoke: `test/mission-smoke.test.js`
- Chebyshev accuracy: `test/chebyshev-accuracy.test.js`

Detailed test guide: [testing/README.md](testing/README.md)

## Key Runtime Modules

- `src/platform/js/mission.js` - app entry/wiring
- `src/platform/js/scene-state.js` - functional core scene state computation
- `src/platform/js/chebyshev.js` - Chebyshev load/evaluate path (+ gzip transport support)
- `src/platform/js/app/*` - orchestration actions/UI behavior
- `src/platform/js/core/*` - pure helpers/domain utilities
- `src/platform/js/rendering/*` - 2D/3D rendering components

## Deployment Metadata

Published under `/deployment/`:

- `version.json`
- `runtime-asset-manifest.json`
- `file-manifest.json`

CLI helper:

```bash
python scripts/show-deployed-version.py
```
