# Developer Workflow Guide

This document is the **how-to-work-in-this-repo** guide for contributors and coding agents.

Use this document for:
- local setup
- day-to-day commands
- testing and deploy expectations
- commit hygiene and contributor workflow

Do not use this document as the authoritative source for repo-boundary exceptions or mission-data drift handling. For those, use:
- [docs/operations/repo-sync-playbook.md](operations/repo-sync-playbook.md)
- [docs/operations/mission-data-current-state.md](operations/mission-data-current-state.md)

For the overall docs map, use [docs/README.md](README.md). For system/architecture details, use [docs/design/design.md](design/design.md).

## 1) Repo Layout (Operational View)

- App repo (this repo): runtime code, mission config, UI assets.
- Data repo (sibling): `../moon-mission-data` for generated ephemeris/runtime assets.

Key paths in this repo:
- `mission.html`, `index.html`, `orbit-data.html`, `assets-status.html`
- `src/platform/js/*`, `src/platform/css/*`
- `assets/*/data/config.json5` (maintainer source) + `assets/*/data/config.json` (runtime compiled), optional `assets/*/data/media-manifest.json5` + `media-manifest.json`, `assets/*/data/ephemeris-manifest.json`
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
- `http://localhost:7274/moon-render-tuner.html`
- `http://localhost:7274/sky-render-demo.html`

### Mission Runtime Control Surfaces

- `mission.html` now exposes two synchronized control surfaces:
  - Header pill strip (`#header-pill-strip`) for quick controls.
  - Settings panel (`#settings-panel`) for full/advanced controls.
- Pill/control wiring is now split across dedicated controllers instead of living only in `src/platform/js/ui/event-handlers.js`.
  - Top-level bind order and raw DOM hookup live in `src/platform/js/ui/main-control-bindings.js`.
  - Shared origin/dimension/toggle/moon-surface behavior lives in `src/platform/js/ui/view-settings-pill-controller.js`.
  - Follow/view camera behavior lives in `src/platform/js/ui/camera-pill-controller.js`.
  - Plane behavior lives in `src/platform/js/ui/plane-pill-controller.js`.
  - Mission-focus panel pills such as Artemis II `Flyby` and `Splashdown` live in `src/platform/js/ui/focus-pill-controller.js`.
- When adding/removing a mission control:
  1. Update `mission.html` (pill button and/or settings input).
  2. Update the relevant controller or binding module, not just `event-handlers.js`.
     - Use `main-control-bindings.js` for generic hook-up/bind-order changes.
     - Use the specific pill controller for sync/state behavior changes.
  3. Verify both surfaces stay synchronized in runtime and UI tests.

### Moon Render Asset Profiles

- The Moon renderer now supports two runtime asset profiles selected from the `Moon Surface` pill strip.
- User-facing labels are `Standard` and `Detailed`; internal storage/config keys remain `fast` and `quality` for compatibility.
- Profile defaults and migration logic live in `src/platform/js/app/moon-render-asset-profiles.js`.
- Runtime asset provenance and the NASA source chain are documented in [docs/operations/moon-render-assets.md](operations/moon-render-assets.md).
- When changing Moon runtime assets:
  1. Keep the runtime file paths in `moon-render-asset-profiles.js` in sync with the actual files under `images/moon/`.
  2. Update `docs/operations/moon-render-assets.md` with the new source/derivation story.
  3. Be careful with `.gitignore`; only explicitly tracked Moon runtime files should be unignored.

### Artemis II Mission-Specific Panels

- Artemis II currently adds three mission-specific panel surfaces beyond the generic settings/info shell:
  - `Flyby in Focus`
  - `Splashdown in Spotlight`
  - `Mission Media`
- `Flyby in Focus` is implemented as the composer-mode auxiliary panel in `src/platform/js/app/auxiliary-camera-views.js` (`PANEL_SPECS` entry `earth-rise-composer`).
  - It is exposed from the `Flyby` focus pill and the auxiliary panel chip strip.
  - It uses the composer timeline/camera stack tied to the Artemis II lunar flyby window rather than the simpler generic camera panel flow.
- `Splashdown in Spotlight` is implemented by:
  - DOM shell in `mission.html` (`#ground-track-panel`)
  - styling in `src/platform/css/mission-panels.css`
  - runtime/controller logic in `src/platform/js/app/ground-track-panel.js`
  - pill launch wiring in `src/platform/js/ui/focus-pill-controller.js`
- Current `Splashdown in Spotlight` behavior:
  - auto-opens on Artemis II load for non-`relative` modes
  - reopens from the `Splashdown` focus pill
  - uses a full-height left sidebar for timeline transport and return-event pills
  - supports `2D` map and `3D` globe modes
  - shows RTC-3-through-splashdown return events and a metrics strip for distance, velocity, altitude, and location
  - marks the post-HORIZONS descent segment as app-generated when the modeled continuation is in view
- When changing any Artemis II panel, update the panel DOM, panel runtime module, and pill/launcher wiring together. These features are mission-specific enough that code and docs drift easily if only one layer changes.
- `Mission Media` is a config-gated workflow panel (`workflow:media-browser`) implemented by:
  - authored metadata in `assets/artemis2/data/media-manifest.json5`
  - compiled runtime metadata in `assets/artemis2/data/media-manifest.json`
  - coordination in `src/platform/js/app/media-timeline-coordination.js`
  - panel rendering/lifecycle in `src/platform/js/app/media-browser-panel.js`
  - media domain helpers under `src/platform/js/core/domain/media-*.js`
- The media workflow is disabled unless the mission config enables `ui.panels.defaults["workflow:media-browser"].enabled`. Compare mode disables it even when configured.
- The current Artemis II media implementation keeps media files remote in the public Artemis Timeline R2 bucket and stores only mirrored metadata locally. See [docs/operations/artemis2-media-assets.md](operations/artemis2-media-assets.md).
- Playable Mission Media items are synchronized with the mission clock: selecting a video or audio clip seeks the mission time, switches animation playback to realtime, starts both media and animation, and pauses animation when the media pauses or ends. Plain animation playback does not auto-start media.
- `Flyby in Focus` / `Frame and Shoot` treats wheel zoom as optical FoV only: the composer camera stays anchored at the craft.
- Its sky controls include `Star Mag` from `-3` to `6`, `Labels`, `Constellations`, `Const Labels`, and a default-on `Clouds` checkbox. Body labels are suppressed when their anchor point is hidden behind the projected Earth or Moon disk.
- Its Sun controls intentionally keep ordinary camera optics separate from eclipse rendering:
  - outside a craft-view solar eclipse, `Strength`, `Halo`, `Star`, and `Flare` adjust the normal Sun/camera optics
  - during a craft-view solar eclipse, those normal controls stay visible but do not affect the eclipse render; changes apply again after eclipse
  - `Eclipse Corona` controls (`Intensity`, `Motion`, `Detail`) drive the corona-only eclipse model

## 3) Core Commands

### Development

- `npm run dev` - Vite dev server
- `npm run test:unit` - unit/integration tests excluding UI visual suite
- `make test` - primary Playwright+SSIM UI suite (`test/ui.test.js`, managed server on `8111`)
- `make baseline` - regenerate screenshot baselines (intentional visual changes only)
- `make data-audit` - audit app/data repo boundary against `../moon-mission-data`
- `npm run audit:data-boundary` - same audit without `make`

### Mission config JSON5 workflow

- `npm run configs:bootstrap` - one-time/backfill helper to create `config.json5` from existing `config.json`
- `npm run configs:compile` - compile mission JSON5 artifacts into runtime JSON (`config.json5` -> `config.json`, and optional `media-manifest.json5` -> `media-manifest.json`)
- `npm run configs:check` - sync-only check that compiled mission JSON artifacts are in sync with their JSON5 sources
- `npm run configs:lint` - stricter CI/local gate for config sync plus required `time_scale` annotations
- `npm run hooks:install` - installs local pre-commit hook path (`.githooks`)

Pre-commit behavior (when hooks are installed):
- runs `configs:compile`
- stages updated `assets/*/data/config.json`
- does not currently auto-stage compiled `media-manifest.json`; stage media manifest source and compiled output intentionally when media metadata changes

### Build / Packaging

- `python scripts/build.py` - build deployable static output
- `python scripts/stage-ephemeris-data.py --app-root . --data-root ../moon-mission-data --target-root .` - stage runtime mission data locally

### Data/Status Helpers

- `python scripts/generate-runtime-asset-manifest.py ...`
- `python scripts/verify-staged-runtime-assets.py ...`
- `python scripts/generate-assets-status.py`
- `python scripts/show-deployed-version.py`

## 4) Data Boundary Quick Rules

Do **not** commit generated runtime ephemeris artifacts in this repo:
- `*-cheb.json`, `*-cheb.json.gz`, `*.npz`, `*-meta.json`, `*-style.json`

These belong in `../moon-mission-data`.

Maintainer/source files that stay in this repo:
- `assets/*/data/config.json5` - maintainer-edited source with comments
- `assets/*/data/config.json` - compiled runtime JSON
- `assets/*/data/media-manifest.json5` - optional maintainer-edited mission media metadata
- `assets/*/data/media-manifest.json` - optional compiled runtime media metadata
- `assets/*/data/ephemeris-manifest.json` - mirrored boundary file shared with the data repo

Boundary audit workflow:
- use `make data-audit` or `npm run audit:data-boundary`
- read [docs/operations/repo-sync-playbook.md](operations/repo-sync-playbook.md) for the authoritative classification, staging, and cleanup rules
- the audit now also checks active missions for origin completeness:
  - compressed Chebyshev coverage for `geo`, `lunar`, and `relative`
  - required body presence per origin (`craft(s)` plus `SUN`/`EARTH`/`MOON`, excluding the origin-degenerate body)
  - required `relative-*.npz` support files
- current audit rules intentionally leave some maintainer-source files such as `config.json5` under `assets/*/data/*` in the `unknown` bucket for manual review; do not delete them just because they are flagged as unknown

If you regenerate orbit data:
1. Update/verify mission config + manifests in this repo.
2. Sync generated artifacts in `moon-mission-data`.
3. Use the playbook to verify mirrored/manifold expectations before cleanup.
4. Commit in the correct repo(s) separately.

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
- `npm run configs:lint` when mission config source/compiled files changed

When UI/visual behavior changes:
- `make test`
- Update baselines only when intentional (`make baseline`) and document why.

When mission/data loading logic changes:
- run `npm run test:unit` plus targeted smoke/manual checks using mission URLs.
- if the change affects published mission assets or manifests, choose a full deploy instead of an app-only deploy.

## 8) CI / Deploy Workflows

CI:
- `.github/workflows/ci.yml` runs on push/PR/manual and executes config lint plus unit tests.
- CI also enforces config sync plus explicit `time_scale` annotations via `npm run configs:lint`.

Manual deploy workflows:
- `.github/workflows/deploy-hetzner.yml` - sankara.net (app + staged mission data)

Notes:
- Deploy workflows are manual (`workflow_dispatch`).
- Production (`sankara.net`) publishes through the Hetzner deploy workflow.
- Production `sankara.net` is fronted by nginx only. Legacy `mission.html?mission=<slug>` redirects are implemented in VPS nginx config, not `.htaccess`.
- The repo's `.htaccess` is cache-header-only and should not carry production redirect logic.
- Use the Hetzner deploy when introducing app-shell changes, new missions, new manifests, or runtime assets that need to be published.
- Local and CI Vitest discovery excludes nested `.tmp/**` scratch repos so temporary checkouts do not pollute test runs.

## 9) Pre-Commit Checklist

Use this before committing:
1. `git status` is clean except intended files.
2. No credentials/secrets in diff.
3. `npm run test:unit` passes.
4. If UI changed, run `make test`; if intentional visual diff, update baselines with rationale.
5. If mission data/config/manifests/staging changed, run `make data-audit`.
6. Confirm repo boundary (app repo vs data repo) for every changed file.
7. Verify links/docs if paths changed.

## 10) Related Docs

- Design hub: [docs/design/design.md](design/design.md)
- Docs hub: [docs/README.md](README.md)
- Test strategy: [docs/guides/testing.md](guides/testing.md)
- Repo boundary + sync playbook: [docs/operations/repo-sync-playbook.md](operations/repo-sync-playbook.md)
- Mission-data boundary status: [docs/operations/mission-data-current-state.md](operations/mission-data-current-state.md)
- Agent conventions: [AGENTS.md](../AGENTS.md)
Mission config note:
- Maintainers edit `config.json5`; runtime consumes `config.json`.
- Keep `config.json` generated from `config.json5` via compile step.
