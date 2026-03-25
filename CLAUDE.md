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
- `.github/workflows/deploy.yml`: GitHub Pages deploy with staged data repo assets
- `.github/workflows/deploy-hostgator.yml`: Hostgator deploy + parity audit

## Data staging

Deploy/test workflows stage runtime data from `kvsankar/moon-mission-data` (or repo variable override) via:

- `scripts/stage-ephemeris-data.py`

Staged categories: orbit artifacts, shared images, mission screenshots, optional `third-party/`.
