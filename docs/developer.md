# Developer Workflow Guide

This document is the **how-to-work-in-this-repo** guide for contributors and coding agents.

For system/architecture details, use [docs/design/design.md](design/design.md).

## 1) Repo Layout (Operational View)

- App repo (this repo): runtime code, mission config, UI assets.
- Data repo (sibling): `../moon-mission-data` for generated ephemeris/runtime assets.

Key paths in this repo:
- `mission.html`, `index.html`, `orbit-data.html`, `assets-status.html`
- `src/platform/js/*`, `src/platform/css/*`
- `assets/*/data/config.json5` (maintainer source) + `assets/*/data/config.json` (runtime compiled), `assets/*/data/ephemeris-manifest.json`
- `test/*`
- `scripts/*`

## 2) Local Setup

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:7274/`

Useful pages:
- `http://localhost:7274/index.html`
- `http://localhost:7274/mission.html`
- `http://localhost:7274/orbit-data.html`
- `http://localhost:7274/assets-status.html`

### Mission Runtime Control Surfaces

- `mission.html` now exposes two synchronized control surfaces:
  - Header pill strip (`#header-pill-strip`) for quick controls.
  - Settings panel (`#settings-panel`) for full/advanced controls.
- Pill interactions are wired as proxies to the existing settings inputs in `src/platform/js/ui/event-handlers.js` (`originPillPairs`, `planePillPairs`, `followPillPairs`, `viewPillPairs`, `dimensionPillPairs`, `togglePillPairs`).
- When adding/removing a mission control:
  1. Update `mission.html` (pill button and/or settings input).
  2. Update the corresponding pair mapping and sync behavior in `src/platform/js/ui/event-handlers.js`.
  3. Verify both surfaces stay synchronized in runtime and UI tests.

### Artemis II Mission-Specific Panels

- Artemis II currently adds two mission-specific panel surfaces beyond the generic settings/info shell:
  - `Flyby in Focus`
  - `Splashdown in Spotlight`
- `Flyby in Focus` is implemented as the composer-mode auxiliary panel in `src/platform/js/app/auxiliary-camera-views.js` (`PANEL_SPECS` entry `earth-rise-composer`).
  - It is exposed from the `Flyby` focus pill and the auxiliary panel chip strip.
  - It uses the composer timeline/camera stack tied to the Artemis II lunar flyby window rather than the simpler generic camera panel flow.
- `Splashdown in Spotlight` is implemented by:
  - DOM shell in `mission.html` (`#ground-track-panel`)
  - styling in `src/platform/css/mission-panels.css`
  - runtime/controller logic in `src/platform/js/app/ground-track-panel.js`
  - pill launch wiring in `src/platform/js/ui/event-handlers.js`
- Current `Splashdown in Spotlight` behavior:
  - auto-opens on Artemis II load for non-`relative` modes
  - reopens from the `Splashdown` focus pill
  - uses a full-height left sidebar for timeline transport and return-event pills
  - supports `2D` map and `3D` globe modes
  - shows RTC-3-through-splashdown return events and a metrics strip for distance, velocity, altitude, and location
  - marks the post-HORIZONS descent segment as app-generated when the modeled continuation is in view
- When changing either Artemis II panel, update the panel DOM, panel runtime module, and pill/launcher wiring together. These features are mission-specific enough that code and docs drift easily if only one layer changes.

## 3) Core Commands

### Development

- `npm run dev` - Vite dev server
- `npm run test:unit` - unit/integration tests excluding UI visual suite
- `make test` - primary Playwright+SSIM UI suite (managed server on `8111`)
- `make baseline` - regenerate screenshot baselines (intentional visual changes only)

### Mission config JSON5 workflow

- `npm run configs:bootstrap` - one-time/backfill helper to create `config.json5` from existing `config.json`
- `npm run configs:compile` - compile all `config.json5` files into runtime `config.json`
- `npm run configs:check` - CI check that compiled `config.json` is in sync with `config.json5`
- `npm run hooks:install` - installs local pre-commit hook path (`.githooks`)

Pre-commit behavior (when hooks are installed):
- runs `configs:compile`
- stages updated `assets/*/data/config.json`

### Build / Packaging

- `python scripts/build.py` - build deployable static output
- `python scripts/stage-ephemeris-data.py --app-root . --data-root ../moon-mission-data --target-root .` - stage runtime mission data locally

### Data/Status Helpers

- `python scripts/generate-runtime-asset-manifest.py ...`
- `python scripts/verify-staged-runtime-assets.py ...`
- `python scripts/generate-assets-status.py`
- `python scripts/show-deployed-version.py`

## 4) Data Boundary Rules (Important)

Do **not** commit generated runtime ephemeris artifacts in this repo:
- `*-cheb.json`, `*-cheb.json.gz`, `*.npz`, `*-meta.json`, `*-style.json`

These belong in `../moon-mission-data`.

If you regenerate orbit data:
1. Update/verify mission config + manifests in this repo.
2. Sync generated artifacts in `moon-mission-data`.
3. Commit in the correct repo(s) separately.

## 5) Branching / Commit Conventions

- Primary release branch: `master`.
- Keep commits focused and reviewable.
- Use short imperative commit messages (common prefix: `docs:`, `fix:`, `refactor:`).
- Avoid bundling unrelated generated artifacts with app logic changes.

## 6) Coding Conventions

- Prefer small, single-purpose modules and pure helpers where practical.
- Keep diffs targeted; avoid formatting-only churn unless needed.
- Follow existing naming and file placement conventions in `src/platform/js/*`.
- For multi-craft behavior, prefer craft IDs (`A`, `B`, `C` style modeling by mission config), not role-hardcoded names.

## 7) Testing Policy Before Push

Minimum expected checks for most changes:
- `npm run test:unit`

When UI/visual behavior changes:
- `make test`
- Update baselines only when intentional (`make baseline`) and document why.

When mission/data loading logic changes:
- run `npm run test:unit` plus targeted smoke/manual checks using mission URLs.

## 8) CI / Deploy Workflows

CI:
- `.github/workflows/ci.yml` runs on push/PR/manual and executes unit tests.
- CI also enforces `config.json` ↔ `config.json5` sync (`npm run configs:check`).

Manual deploy workflows:
- `.github/workflows/deploy.yml` - GitHub Pages (app + staged mission data)
- `.github/workflows/deploy-hostgator.yml` - sankara.net (app + staged mission data)
- `.github/workflows/deploy-app-only.yml` - GitHub Pages app-only
- `.github/workflows/deploy-hostgator-app-only.yml` - sankara.net app-only

Notes:
- Deploy workflows are manual (`workflow_dispatch`).
- App-only deploys preserve runtime data on remote and publish app-shell changes.

## 9) Pre-Commit Checklist

Use this before committing:
1. `git status` is clean except intended files.
2. No credentials/secrets in diff.
3. `npm run test:unit` passes.
4. If UI changed, run `make test`; if intentional visual diff, update baselines with rationale.
5. Confirm repo boundary (app repo vs data repo) for every changed file.
6. Verify links/docs if paths changed.

## 10) Related Docs

- Design hub: [docs/design/design.md](design/design.md)
- Test strategy: [docs/testing.md](testing.md)
- Agent conventions: [AGENTS.md](../AGENTS.md)
Mission config note:
- Maintainers edit `config.json5`; runtime consumes `config.json`.
- Keep `config.json` generated from `config.json5` via compile step.
