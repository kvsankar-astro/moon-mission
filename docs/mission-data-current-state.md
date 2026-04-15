# Mission Data Current State

Last updated: 2026-04-15

This document captures the **current boundary and operating model** between app code and runtime mission data.

Detailed operational process and audit-tool usage live in [docs/repo-sync-playbook.md](repo-sync-playbook.md).

## Source of truth

- App/runtime code, mission config, and UI assets live in this repo (`moon-mission`).
- Generated runtime orbit artifacts live in sibling repo `../moon-mission-data`.
- Coverage/audit-style mission inventory is maintained in:
  - [docs/horizons-lunar-missions.md](horizons-lunar-missions.md)
  - `orbit-data.html` (data-source coverage view)
  - `assets-status.html` (runtime asset-size/status view)

## What belongs where

App repo (`moon-mission`) tracks:
- `assets/*/data/config.json5`
- `assets/*/data/config.json`
- `assets/*/data/ephemeris-manifest.json`
- shared authored content (`assets/mission-briefs.json`, `assets/mission-images.json`)
- runtime app code (`src/platform/**`)

Data repo (`moon-mission-data`) tracks:
- `*-cheb.json`
- `*-cheb.json.gz`
- `*.npz`
- `*-meta.json`
- authored style sidecars (for example `geo-style.json`, `lunar-style.json`)
- staged runtime media (`images/`, mission screenshots, optional `third-party/`)

## Runtime cadence policy

- Default `geo`/`lunar` sampling: `60s`.
- Landing slices (when used): `1s` for short terminal windows.
- Do not silently coarsen mission cadence above `60s` to force HORIZONS responses; split windows instead.

## Deployment/staging reality

Workflows stage mission data from the data repo before deploy:
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-hostgator.yml`

App-only deploy workflows keep existing runtime data on remote and only ship app-shell changes:
- `.github/workflows/deploy-app-only.yml`
- `.github/workflows/deploy-hostgator-app-only.yml`

Use the full deploy workflows when a change introduces new missions, new manifests, or new runtime assets that are not already present on the published site. App-only deploys are for app-shell changes against an already-populated runtime-data set.

## How to verify current state quickly

```bash
# Audit app repo vs sibling data repo boundary
make data-audit
# or
npm run audit:data-boundary

# Mission config coverage in app repo
rg --files assets -g "*/data/config.json"

# Relative artifacts present in the sibling data repo
rg --files ..\moon-mission-data\assets -g "*/data/relative-*-cheb.json"
rg --files ..\moon-mission-data\assets -g "*/data/relative-*.npz"

# Generate/update asset-size status JSON for assets-status.html
python scripts/generate-assets-status.py
```

## Notes

- This file intentionally avoids static mission-by-mission “done/pending” tables because they drift quickly.
- Use the status pages and manifests as the live operational view, and keep this document focused on durable process/boundary rules.
- The repo-boundary audit currently treats `config.json5` and a few other maintainer-source files under `assets/*/data/*` as `unknown` for manual review rather than auto-classifying them as app-only. That is expected with the current rules file; review them, but do not treat them as generated-data drift by default.

## Slice Extraction Status

`mission-data-refresh` is being mined in deliberate slices rather than merged wholesale.

Completed on `master`:
- robotic ARTEMIS naming cleanup and mission-family split presentation as `THEMIS-ARTEMIS`
- new mission slices:
  - `artemis-overview`
  - `artemis-lagrange`
  - `artemis-lunar-capture`
- story-window refinements aligned to product semantics for:
  - `SLIM`
  - `KPLO Danuri`
  - `CAPSTONE`
  - `Lunar Flashlight`
- selected single-craft config/event cleanup for:
  - `TESS`
  - `LADEE`
  - `LRO`
  - `Lunar Trailblazer`
- combined multi-craft public mission surfaces for:
  - `Chandrayaan 2`
  - `Chandrayaan 3`
- combined multi-craft public mission surface for:
  - `GRAIL`
- retirement of standalone `Vikram` mission folders as first-class app missions
- retirement of standalone `GRAIL-A Ebb` / `GRAIL-B Flow` mission folders as first-class app missions
- stricter orbit-artifact integrity auditing, including required `geo`/`lunar`/`relative` coverage and `relative-*.npz`

Still best treated as explicit follow-up slices rather than branch-merge work:
- active multi-craft UX/runtime polish
- orbit-overlap / trail-style runtime tuning and related catalog/UX cleanup
