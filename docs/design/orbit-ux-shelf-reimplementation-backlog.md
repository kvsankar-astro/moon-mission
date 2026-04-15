# Orbit UX Shelf Reimplementation Backlog

This note captures the branch-only behaviors from `temp/orbit-ux-shelf-20260328` that are still worth considering for reimplementation on `master`.

It is intentionally a product/backlog document, not a merge plan. The shelf branch is old (`20` commits ahead, `308` behind as of `2026-04-15`), so we should reimplement useful ideas in small current-state slices rather than revive the branch wholesale.

## What Already Landed Elsewhere

These shelf ideas are already present on `master` in newer or more complete forms, so they do not need to be reimplemented from the shelf branch:

- Generic multi-craft runtime modeling via `crafts[]` + `primaryCraftId`
- Generic craft-aware visibility/runtime helpers in `scene-craft-helpers.js`
- `Trail` orbit style infrastructure in `orbit-trail-style.js`
- Chandrayaan 2 / Chandrayaan 3 multi-craft config shape with explicit craft ids like `CH2O`, `CH2L`, `CH3O`, `CH3L`
- HORIZONS text-cache utility presence (`scripts/horizons_text_cache.py`)

## Branch-Only Specs Worth Preserving

### 1. Re-enable Live Orbit Overlap Refinement

Source commits:
- `c962d13` `chore: preserve orbit ux tuning draft`

Branch behavior:
- removes the hard runtime kill-switch that currently bypasses overlap refinement
- allows refinement to run when there is no authored style metadata and no precomputed density hints

Reimplementation spec:
- overlap refinement should be available in normal runtime, not permanently disabled
- authored style metadata and precomputed density hints should still short-circuit the worker path
- the feature should be guarded by a real product flag only if we want operator control, not by a permanent hidden `false`

Why it matters:
- the current roadmap explicitly assumes refinement is part of the intended `Trail` UX, but `master` still has the kill-switch disabled

### 2. Preserve Base Brightness Ownership

Source commits:
- `c962d13`

Branch behavior:
- applies overlap refinement as a multiplicative factor over the user-selected base opacity
- uses `final opacity = base opacity * overlap factor`

Reimplementation spec:
- `2D Track` and `3D Track` sliders remain the source of truth for base brightness
- overlap refinement may only dim relative to that base; it must never replace it with an absolute opacity target
- stale async refinement results must not overwrite newer base slider choices

Why it matters:
- this matches the intent already documented in [orbit-ux-and-refactor-roadmap.md](orbit-ux-and-refactor-roadmap.md), but `master` does not yet ship the live refinement path that uses it

### 3. Use Percentile Density Instead Of Simple Average Density

Source commits:
- `c962d13`

Branch behavior:
- chunk density is based on a high-percentile sample density, not the mean
- normalization uses a high percentile of all chunk densities, not the single highest outlier
- opacity reduction uses an exponent-based curve

Shelf tuning values:
- `chunkDensityPercentile = 0.82`
- `normalizationPercentile = 0.94`
- `densityExponent = 1.35`
- `minFactor = 0.16`
- `maxFactor = 1`

Reimplementation spec:
- dense local orbit clusters should dim more aggressively than isolated arcs
- one pathological outlier should not flatten the whole scene
- tuning should be exposed in code as named constants or clearly documented defaults

### 4. Slightly Brighter Default Trail Context

Source commits:
- `c962d13`

Branch behavior:
- increases default trail background values in Settings:
  - `2D Track`: `0.24` instead of `0.20`
  - `3D Track`: `0.14` instead of `0.10`

Reimplementation spec:
- revisit shipped default trail brightness with current visuals and SSIM baselines
- use the shelf values as the first candidate when retuning

Why it matters:
- this was part of the same readability tuning as the refinement work

### 5. Minimal Chrome Capture Mode

Source commits:
- `c962d13`

Branch behavior:
- supports `?minimalChrome=true`
- hides header blurb, bottom controls, timeline dock, orbit status stack, banners, FPS/test overlays, and settings panel
- leaves a fixed settings button available so the page is still recoverable

Reimplementation spec:
- add a documented minimal-chrome mode intended for screenshots, demos, and uncluttered embeds
- make it URL-driven and non-destructive to normal runtime layout
- decide whether panel UI should also collapse/hide under this mode in today’s panel architecture

### 6. Relative-Mode Sun Frame Metadata

Source commits:
- `496a9f0` `Fix relative mode sun frame handling`

Branch behavior:
- annotates loaded Chebyshev data with `metadata.sun_frame`
- marks the Sun series as already relative when the primary relative file includes a relative-frame Sun
- avoids rotating the Sun direction a second time in `scene-state.js`

Reimplementation spec:
- relative-mode solar lighting must explicitly track whether Sun data is inertial or already relative-frame
- scene-state computation must not apply `FRAME_ROT` twice
- the distinction should live in runtime metadata, not in fragile heuristics

### 7. Relative-Mode Moon Lighting Fallback

Source commits:
- `fc554e8` `Fix relative mode moon lighting fallback`

Branch behavior:
- uses `FRAME_ROT` when present for relative-mode lighting/orientation
- falls back to Moon basis lookup only when precomputed relative frame data is absent

Reimplementation spec:
- relative-mode Moon lighting/orientation should prefer precomputed frame rotation when available
- fallback to Moon ephemeris-derived basis only when the relative frame is missing
- tests should cover both paths explicitly

Why it matters:
- relative-mode rendering bugs have repeatedly shown up as lighting/orientation issues rather than camera-aim issues

### 8. Tone Down Lower Sky Brightness

Source commits:
- `15aaf95` `Tone down lower sky brightness`

Branch behavior:
- reduces starmap opacity from `0.40` to `0.28`
- reduces constellation opacity from `0.06` to `0.04`
- adds a lower-hemisphere shade mesh with a dark gradient

Reimplementation spec:
- darker lower-sky treatment should be reconsidered against current star/sky rendering
- if adopted, it should be tuned with the current renderer rather than copied literally

Why it matters:
- this is a user-visible readability spec, not just a shader tweak

### 9. Consolidate Mission Catalog Entries Around Combined Missions

Source commits:
- `4f3b5bd` `Remove standalone Vikram missions`
- `27c5d09` `Merge GRAIL twin mission`

Branch behavior:
- removes standalone public mission entries for:
  - `chandrayaan2-vikram`
  - `chandrayaan3-vikram`
- treats `chandrayaan2` and `chandrayaan3` as the combined orbiter/lander mission surfaces
- removes standalone public mission entries for:
  - `grail-a-ebb`
  - `grail-b-flow`
- treats `grail` as the twin-mission combined surface

Reimplementation spec:
- `Chandrayaan 2` and `Chandrayaan 3` already landed on `master` as the combined multi-craft public mission surfaces, and the standalone Vikram mission folders have been retired from the app-facing catalog
- `GRAIL` remains the open consolidation decision in this area
- any remaining combined-surface cleanup should focus on:
  - mission briefs/images
  - source docs and sourcing playbooks
  - timeline/event language
  - final handling of retired split-mission slugs if we ever want explicit redirects

Why it matters:
- this is a product/catalog decision, not just a config cleanup

## What Not To Preserve Blindly

These changes existed in the shelf branch but should not be copied forward automatically:

- bulk config churn caused by the branch being hundreds of commits behind
- old landing-page and mission-shell HTML from the pre-panel / pre-current-layout world
- deletions of newer design docs, panel work, or testing infrastructure
- any assumption that the shelf branch is a better technical base than current `master`

## Suggested Reimplementation Order

1. Orbit overlap refinement enablement + multiplicative brightness ownership
2. Percentile overlap tuning and default trail brightness retune
3. Relative-mode Sun frame / Moon lighting fixes
4. Minimal chrome capture mode
5. Lower-sky brightness retune
6. Mission catalog consolidation decision (`GRAIL`)

## Branch Hygiene Decision

Once the specs above are either reimplemented or explicitly rejected, `temp/orbit-ux-shelf-20260328` can be deleted as historical shelf work rather than retained as a pseudo-roadmap branch.
