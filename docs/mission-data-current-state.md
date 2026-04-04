# Mission Data Current State

Last updated: 2026-04-04

This document captures the **current boundary and operating model** between app code and runtime mission data.

## Source of truth

- App/runtime code, mission config, and UI assets live in this repo (`moon-mission`).
- Generated runtime orbit artifacts live in sibling repo `../moon-mission-data`.
- Coverage/audit-style mission inventory is maintained in:
  - [docs/horizons-lunar-missions.md](horizons-lunar-missions.md)
  - `orbit-data.html` (data-source coverage view)
  - `assets-status.html` (runtime asset-size/status view)

## What belongs where

App repo (`moon-mission`) tracks:
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

## How to verify current state quickly

```bash
# Mission config coverage in app repo
rg --files assets -g "*/data/config.json"

# Relative artifacts present locally (if staged)
rg --files assets -g "*/data/relative-*-cheb.json"

# Generate/update asset-size status JSON for assets-status.html
python scripts/generate-assets-status.py
```

## Notes

- This file intentionally avoids static mission-by-mission “done/pending” tables because they drift quickly.
- Use the status pages and manifests as the live operational view, and keep this document focused on durable process/boundary rules.
