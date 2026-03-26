# CLAUDE.md

Assistant-facing notes for this repository.

## Source of truth

- Contributor/agent workflow: `AGENTS.md`
- Developer architecture/pipeline details: `docs/developer.md`
- Test strategy and commands: `docs/testing/README.md`

## Current project shape (important)

- Entry points:
  - `mission.html`
  - `index.html`
- Shared runtime code:
  - `src/platform/css/*`
  - `src/platform/js/*`
- Mission assets/config:
  - `assets/<mission>/data/config.json`
  - `assets/<mission>/data/ephemeris-manifest.json`
- Shared authored landing content:
  - `assets/mission-briefs.json`
  - `assets/mission-images.json`

Do not use legacy paths like `assets/platform/js/*` in new changes.

## Runtime ephemeris behavior

- Runtime supports `chebyshev`, `npz`, `astronomy` body sources.
- Current mission configs are set to Chebyshev for `SC`, `MOON`, `EARTH`, and `SUN`.
- Relative mode uses precomputed `relative-<ID>-cheb.json` and is enabled by URL `mode=relative`.

## Testing quick reference

- Default UI + visual regression run:
  - `make test`
- Unit tests:
  - `npm run test:unit`
- Baseline regeneration:
  - `make baseline`

SSIM thresholds and visual assertions are defined in `test/ui.test.js`.

## CI quick reference

- `.github/workflows/ci.yml`: unit tests
- `.github/workflows/deploy.yml`: manual GitHub Pages deploy with staged data repo assets
- `.github/workflows/deploy-hostgator.yml`: manual Hostgator deploy + parity audit

## Landing brief quick reference

- The mission selector/landing UI reads authored brief copy from `assets/mission-briefs.json`.
- Curated CC BY-SA image carousel entries live in `assets/mission-images.json`.
- The brief panel keeps the `Mission`, `HORIZONS Data`, and `Timelines` structure, with the image carousel displayed below the orbit preview.

## Data staging

Deploy/test workflows stage runtime data from `kvsankar/moon-mission-data` (or repo variable override) via:

- `scripts/stage-ephemeris-data.py`

Staged categories: orbit artifacts, shared images, mission screenshots, optional `third-party/`.
