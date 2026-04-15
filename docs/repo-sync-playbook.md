# Repo Sync Playbook

This document defines the safe boundary between:

- `moon-mission` - app/runtime repo
- `moon-mission-data` - generated orbit-data repo

It also documents the no-loss sync process and the audit tools used to detect drift.

## Source Of Truth Layers

There are two repos, but three practical sources we work with:

- `moon-mission`
  - the live app repo and integration point
- `moon-mission-orbit-data`
  - a Git worktree of `moon-mission` used as the curated mission-source branch
  - this is the place to compare and curate mission `config.json`, `ephemeris-manifest.json`, event models, mission folder structure, and related onboarding metadata
- `moon-mission-data`
  - the generated runtime-artifact repo
  - this is the place for generated `*.npz`, `*-cheb.json`, `*-meta.json`, and orbit-style sidecars

In short:

- curated mission semantics come from `moon-mission-orbit-data`
- generated runtime artifacts come from `moon-mission-data`
- `moon-mission` should converge to both

**Last updated:** 2026-04-02

## Ownership Model

Within `assets/<mission>/data/`, files fall into three categories.

### App-only

These belong in `moon-mission` and should not be committed to `moon-mission-data`:

- `config.json`
- `README*.md`

### Review-needed maintainer source

These also belong in `moon-mission`, but the current boundary-audit rules intentionally leave them in the `unknown` bucket so they are reviewed explicitly instead of being auto-classified:

- `config.json5`
- `config.ssim.json`

### Mirrored

These are expected in both repos and should stay byte-identical:

- `ephemeris-manifest.json`

### Data-only

These belong in `moon-mission-data` and should not be tracked in `moon-mission`:

- `*.npz`
- `*-cheb.json`
- `*-cheb.json.gz`
- `*-meta.json`
- `*-style.json`
- `geo-style.json`
- `lunar-style.json`

## No-Loss Sync Policy

Never delete a mission-data file from either repo until it has first been classified.

Use this order:

1. Run the boundary audit.
2. Classify each file as `app-only`, `mirrored`, `data-only`, or `unknown`.
3. For `data-only` files found in `moon-mission`, copy or preserve them in `moon-mission-data` before cleanup.
4. For `mirrored` files, make the content identical in both repos in the same work session.
5. For `unknown` files, do not delete them immediately.
6. Decide whether each `unknown` file is:
   - a new supported boundary type to encode in the rules file
   - a temporary local export that should be archived or ignored
   - a misplaced artifact that should move to `moon-mission-data`
7. Only after preservation and re-audit should cleanup happen.

## Required Commands

### 1. Audit the app vs generated-data boundary

```bash
python scripts/audit-data-repo-boundary.py --data-root ../moon-mission-data
```

JSON output is available with:

```bash
python scripts/audit-data-repo-boundary.py --data-root ../moon-mission-data --format json
```

Wrapper commands are also available:

```bash
make data-audit
# or
npm run audit:data-boundary
```

The audit also validates active-mission orbit completeness:

- `geo`, `lunar`, and `relative` compressed Chebyshev coverage
- body coverage per origin: mission craft body/bodies plus the required celestial bodies, excluding the origin-degenerate body
- `relative-*.npz` support files alongside relative-mode Chebyshev payloads

To fail a CI or pre-push style check when drift exists:

```bash
python scripts/audit-data-repo-boundary.py --data-root ../moon-mission-data --fail-on-drift
```

### 1b. Compare app onboarding against the curated worktree

Use `moon-mission-orbit-data` as the authority when deciding whether a config,
manifest, mission folder, or event model is stale in `moon-mission`.

Typical checks:

- compare `assets/<mission>/data/config.json`
- compare `assets/<mission>/data/ephemeris-manifest.json`
- compare mission family structure such as merged-vs-standalone folders
- compare catalog/brief/image references after mission-family refactors

### 2. Stage runtime assets from the data repo

```bash
python scripts/stage-ephemeris-data.py --data-root ../moon-mission-data --target-root dist-pages
```

### 3. Verify staged runtime assets

```bash
python scripts/verify-staged-runtime-assets.py --staged-root dist-pages --runtime-manifest dist-pages/runtime-asset-manifest.json
```

## Recommended Working Process

### When app code changes but orbit data does not

1. Update `config.json`, mission docs, UI, tests, or catalog files in `moon-mission`.
2. Re-run the audit.
3. Confirm there are no new `data-only` files in `moon-mission`.

### When orbit generation changes

1. Generate or refresh orbit artifacts locally.
2. Copy generated `data-only` outputs into `moon-mission-data`.
3. If `ephemeris-manifest.json` changed, mirror the same bytes into both repos.
4. Re-run the audit until:
   - no mirrored mismatches remain
   - no required artifacts are missing from `moon-mission-data`
   - no unexpected `data-only` files remain in `moon-mission`
5. Commit the app-repo and data-repo slices separately, but from the same audited state.

### When curated mission structure changes

1. First compare `moon-mission` against `moon-mission-orbit-data`.
2. Bring over curated changes to:
   - mission `config.json`
   - `ephemeris-manifest.json`
   - event and timeline semantics
   - mission-family folder structure
   - landing-page/catalog metadata
3. Only after that compare `moon-mission` against `moon-mission-data`.
4. Resolve any remaining artifact gaps by either:
   - generating missing runtime artifacts into `moon-mission-data`, or
   - relaxing stale app manifest expectations if the curated source no longer requires them

### Before release or baseline regeneration

1. Audit repo boundary.
2. Stage runtime assets from `moon-mission-data`.
3. Verify staged runtime assets.
4. Run SSIM / test workflow.

## Current Precise Sync Plan

As of 2026-04-02, use the audit output to work through the boundary in this order:

1. Compare `moon-mission` with `moon-mission-orbit-data` first for mission semantics and structure.
2. Treat `config.json` as app-owned only.
3. Treat generated orbit payloads and style sidecars as data-owned only.
4. Keep `ephemeris-manifest.json` mirrored and byte-identical between `moon-mission` and `moon-mission-data`, but derive the intended manifest shape from `moon-mission-orbit-data`.
5. Review `unknown` files manually before moving or deleting them.
6. Clean up local-only generated files in `moon-mission` only after confirming they exist or are intentionally archived in `moon-mission-data`.

## Tooling Added For Drift Control

- [audit-data-repo-boundary.py](/C:/sankar/projects/moon-mission/scripts/audit-data-repo-boundary.py)
  - audits ownership, mirrored-file equality, and missing required artifacts
- [data-repo-boundary-rules.json](/C:/sankar/projects/moon-mission/scripts/data-repo-boundary-rules.json)
  - central fixture for the boundary rules
- [stage-ephemeris-data.py](/C:/sankar/projects/moon-mission/scripts/stage-ephemeris-data.py)
  - stages deploy/runtime assets from `moon-mission-data`
- [verify-staged-runtime-assets.py](/C:/sankar/projects/moon-mission/scripts/verify-staged-runtime-assets.py)
  - verifies a staged runtime tree against checksums
