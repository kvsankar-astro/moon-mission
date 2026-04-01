# Mission Data Current State

Snapshot of the current mission-data implementation state in this repo and the sibling generated-data repo.

**Last updated:** 2026-04-01

## Purpose

This document is a working status snapshot, not the Wikipedia coverage audit.

Use it to track:

- which missions are onboarded in the app
- which missions were refreshed under the current sampling policy
- which missions are blocked or need cleanup
- what has been synced to `../moon-mission-data`
- what is still uncommitted

For the broader public-data audit across all Wikipedia lunar missions, see [horizons-lunar-missions.md](/C:/sankar/projects/moon-mission-orbit-data/docs/horizons-lunar-missions.md).

## Current Policy

- Default orbit sampling for non-landing phases is `60s`.
- Landing slices use `1s`, but only for short windows around landing events.
- We do not silently coarsen cadence to `120s`, `600s`, or other larger steps just to make a fetch fit.
- If a `60s` HORIZONS request is too large, the fetch must be split into smaller time ranges and recombined.
- If important mission events occur before the first public orbit timestamp, those events should still be captured in mission metadata so runtime infra can decide whether to suppress them before playback begins.

## Infra Changes In Progress

These local changes exist in the app repo and support the current mission-data workflow:

- [orbits.py](/C:/sankar/projects/moon-mission-orbit-data/scripts/orbits.py)
  - reuses a cached larger HORIZONS range to satisfy a contained smaller range
  - splits long `60s` HORIZONS vector requests into smaller subranges instead of degrading cadence
- [horizons_text_cache.py](/C:/sankar/projects/moon-mission-orbit-data/scripts/horizons_text_cache.py)
  - supports covering-range cache reuse for contained `VECTORS` requests
- [run-mission-pipeline.py](/C:/sankar/projects/moon-mission-orbit-data/scripts/run-mission-pipeline.py)
  - no longer auto-doubles step size
  - now fails fast instead of silently reducing temporal resolution
- [horizons-worker-playbook.md](/C:/sankar/projects/moon-mission-orbit-data/docs/mission-sourcing/horizons-worker-playbook.md)
  - documents the `60s` default, `1s` landing rule, and pre-first-sample event rule

## Refreshed Missions

### HORIZONS missions refreshed successfully at `60s`

| Mission | App onboarding present | Refresh status | Notes |
|---|---|---|---|
| Artemis | Yes | Refreshed | `60s` rerun completed |
| CAPSTONE | Yes | Refreshed | `60s` rerun completed |
| Clementine | Yes | Refreshed | `60s` rerun completed |
| GRAIL SS Stage | Yes | Refreshed | `60s` rerun completed |
| ISEE-3 | Yes | Refreshed | `60s` rerun completed |
| JUICE | Yes | Refreshed | `60s` rerun completed |
| KPLO / Danuri | Yes | Refreshed | `60s` rerun completed |
| LADEE | Yes | Refreshed | `60s` rerun completed |
| LCROSS Shepherding Spacecraft | Yes | Refreshed | `60s` rerun completed |
| LRO | Yes | Refreshed | `60s` rerun completed |
| Lunar Flashlight | Yes | Refreshed | `60s` rerun completed |
| Lunar Trailblazer | Yes | Refreshed | `60s` rerun completed |
| Nozomi | Yes | Refreshed | `60s` rerun completed |
| SLIM | Yes | Refreshed | `60s` rerun completed |
| STEREO | Yes | Refreshed | `60s` rerun completed |
| TESS | Yes | Refreshed | `60s` rerun completed |
| WIND | Yes | Refreshed | `60s` rerun completed |
| WMAP | Yes | Refreshed | `60s` rerun completed |

### HORIZONS mission still blocked

| Mission | App onboarding present | Status | Notes |
|---|---|---|---|
| HGS-1 | Yes | Blocked | Current flyby window returns inconsistent or non-data HORIZONS responses at `60s`; needs mission-specific rewindowing |

### SPICE missions refreshed successfully at `60s`

| Mission | App onboarding present | Base data status | Relative data status |
|---|---|---|---|
| SMART-1 | Yes | Refreshed | Produced with warnings; needs quality review |
| SELENE / Kaguya | Yes | Refreshed | Produced with warnings; needs quality review |
| Lunar Orbiter 1 | Yes | Refreshed | Produced with warnings; needs quality review |

## Relative-Mode Quality Concerns

The current concern is not the base `geo` and `lunar` SPICE exports. Those completed successfully.

The concern is the derived `relative-*` products for:

- `smart1`
- `selene`
- `lunarorbiter1`

Observed issues during generation:

- high local fit errors in some segments
- warnings that some fits could not be split down any further
- `RankWarning` messages indicating poorly conditioned fits

Current interpretation:

- `geo` and `lunar` outputs for those three missions are usable
- `relative` outputs exist, but should be treated as needing cleanup or validation before being considered fully trusted

## Landing And Catalog Surface

The landing page and mission selector already include the currently onboarded missions through:

- [mission-catalog.json](/C:/sankar/projects/moon-mission-orbit-data/assets/mission-catalog.json)
- [mission-briefs.json](/C:/sankar/projects/moon-mission-orbit-data/assets/mission-briefs.json)
- [mission.html](/C:/sankar/projects/moon-mission-orbit-data/mission.html)
- [index-landing.js](/C:/sankar/projects/moon-mission-orbit-data/src/platform/js/index-landing.js)

This includes the newly onboarded HORIZONS and SPICE missions listed above. `HGS-1` is also cataloged even though its latest `60s` refresh is still blocked.

## Data Repo Sync Status

Generated runtime orbit artifacts were synced into the sibling repo:

- `C:\sankar\projects\moon-mission-data`

The sync currently includes:

- refreshed tracked mission data for existing folders such as `artemis`, `clementine`, `isee3`, `juice`, `nozomi`, `smart1`, `selene`, `stereo`, `tess`, `wind`, `wmap`, and `lunarorbiter1`
- newly added mission folders such as `capstone`, `grail-ss-stage`, `kplo-danuri`, `ladee`, `lcross-shepherd`, `lro`, `lunar-flashlight`, `lunar-trailblazer`, and `slim`

Typical synced outputs include:

- `ephemeris-manifest.json`
- `*-cheb.json`
- `*-cheb.json.gz`
- `*-meta.json`
- `*.npz` for the HORIZONS-backed generated bundles

## Verification Already Run

- `python -m py_compile scripts/orbits.py scripts/run-mission-pipeline.py scripts/horizons_text_cache.py`
- full mission-pipeline reruns for the refreshed HORIZONS missions
- WSL SPICE export runs for `smart1`, `selene`, and `lunarorbiter1`
- relative-mode regeneration for those three SPICE missions at `60s`
- sync checks confirming refreshed mission folders exist in `../moon-mission-data`

## Uncommitted State

At the time of this snapshot:

- app repo changes are still uncommitted
- data repo refresh outputs are still uncommitted

Main tracked app-repo files currently modified include:

- mission configs under `assets/*/data/config.json` for the refreshed missions
- SPICE export notes under `assets/smart1/data/README-spice-export.md`, `assets/selene/data/README-spice-export.md`, and `assets/lunarorbiter1/data/README-spice-export.md`
- mission sourcing docs under `docs/mission-sourcing/`
- pipeline/cache scripts under `scripts/`

## Next Recommended Steps

1. Rewindow `HGS-1` so its `60s` HORIZONS fetch succeeds without non-data spans.
2. Quantitatively review `relative-*` accuracy for `smart1`, `selene`, and `lunarorbiter1`.
3. Decide whether to keep, tune, or temporarily disable relative mode for those SPICE missions.
4. Commit and push the app-repo and `moon-mission-data` changes once the above blockers are resolved or explicitly accepted.
