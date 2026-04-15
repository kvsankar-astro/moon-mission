# Orbit UX And Refactor Roadmap

This document records the current roadmap threads so they are easy to resume later without depending on chat context.

Branch recovery note:

- The shelf branch `temp/orbit-ux-shelf-20260328` contained additional branch-only product/runtime ideas that are not fully on `master`.
- Those extracted reimplementation targets are tracked in [orbit-ux-shelf-reimplementation-backlog.md](orbit-ux-shelf-reimplementation-backlog.md).

## Current Guardrail

Before starting broad refactor work, run the visual gate again:

- unit tests
- UI/SSIM tests
- inspect diffs
- refresh baselines only if the visual changes are intentional

Reason:

- recent work has included orbit-style, timeline, and mission-view UX changes
- we want a clean visual checkpoint before larger architecture changes

## Orbit UX Roadmap

### 1. Trail Background Readability

Status:

- partially addressed in working tree

Goals:

- make the full orbit track in `Trail` mode easier to see by default
- preserve the tail/head emphasis
- keep 2D and 3D independently tunable

Current direction:

- slider value should represent the base trail-context brightness
- optimizer should only dim relative to that base

### 2. Brightness Ownership Bug

Problem:

- manual trail-context brightness changes have felt like they get overridden later

Desired behavior:

- slider is the single source of truth for base brightness
- dynamic overlap refinement applies only a relative dimming factor
- stale refinement jobs must not reapply older absolute values

Implementation principle:

- `final opacity = base opacity * overlap factor`

### 3. Dynamic Overlap Refinement Tuning

Problem:

- refinement is helpful, but only about 60% effective in dense clustered orbit regions

Desired behavior:

- lone segments stay relatively bright
- close, repeated, or overlapping segments dim much more aggressively
- dense local clusters should not dominate the scene

Current tuning direction:

- prefer high-percentile local density instead of simple average density
- normalize against a high percentile of chunk densities instead of a single extreme outlier
- use a steeper dimming curve in dense zones
- if needed later, shorten chunk size for more local control

### 4. Trail Controls

Keep:

- separate 2D and 3D context-brightness controls
- separate 2D and 3D tail-prominence controls

Do not change casually:

- semantic tail-length behavior
- authored mission-specific style intervals

### 5. Authoring Strategy

Current intended split:

- authored style interval files for missions where we care about semantic tails
- fixed tail-length fallback for generic missions

Do not bloat the main orbit transport:

- style metadata should remain sidecar data
- main Chebyshev payload should stay focused on orbit transport

## Refactor Roadmap

### 1. Test Naming Cleanup

Problem:

- generic systems are still tested with placeholder craft ids like `ORB` and `LAND`
- this leaks orbiter/lander semantics into generic code understanding

Goal:

- move generic tests to neutral craft ids like `CRAFT_A`, `CRAFT_B`, `CRAFT_C`
- keep mission-specific names only in mission-specific tests

Priority:

- high, low risk

### 2. Shrink `mission.js`

Problem:

- `src/platform/js/mission.js` is still acting as a large composition root, state bag, and runtime coordinator

Goal:

- keep it as a composition root only
- move domain and runtime wiring concerns into smaller modules with clearer ownership

Priority:

- very high

### 3. Split `mission-state-store.js`

Problem:

- `src/platform/js/core/state/mission-state-store.js` currently mixes:
  - config/session state
  - scene/runtime state
  - ephemeris access concerns
  - view flag concerns
  - bootstrap/runtime hook access

Goal:

- split by ownership and concern

Suggested shape:

- config/session state adapter
- view state adapter
- scene state adapter
- ephemeris/data adapter

Priority:

- very high

### 4. Orbit Styling Module Cleanup

Problem:

- orbit style behavior is spread across several modules:
  - `orbit-trail-style.js`
  - `orbit-style-meta-actions.js`
  - `orbit-overlap-manager.js`
  - `scene-craft-helpers.js`

Goal:

- clean separation between:
  - pure style computation
  - overlap/density computation
  - async worker orchestration
  - scene mutation / DOM / renderer application

Priority:

- high

### 5. Thin Down `settings-actions.js`

Problem:

- `src/platform/js/app/settings-actions.js` still reads like a controller plus renderer mutation hub

Goal:

- settings actions should translate UI intent into app state changes
- scene mutation/render-side application should live elsewhere

Priority:

- high

### 6. Revisit Runtime Wiring Layer

Problem:

- the runtime composition layer is spread across several “entry” and “wireup” files with blurry responsibilities

Main files:

- `mission-runtime-wireup-entry.js`
- `mission-runtime-entry.js`
- `mission-wiring-composition.js`
- `mission-scene-entry.js`

Goal:

- make ownership explicit:
  - composition root
  - runtime dependency assembly
  - scene/runtime service assembly
  - view/controller assembly

Priority:

- medium-high

## Functional Core / Imperative Shell Target

The desired direction remains:

- pure domain logic in `src/platform/js/core/domain/`
- pure plans/selectors/derivations in `src/platform/js/core/plans/`
- scene mutation, DOM mutation, workers, and network/file I/O in the shell

Promising foundation already in place:

- `mission-config.js`
- `origin-compat.js`
- `ui-transition-plan.js`
- `frame-plan.js`
- parts of `scene-state.js`

Main issue now:

- too much imperative glue still sits around those pieces and weakens the architecture

## Suggested Cleanup Order

1. Run SSIM gate and stabilize current visuals
2. Test naming cleanup
3. `mission.js` decomposition
4. `mission-state-store.js` split
5. Orbit-style module boundary cleanup
6. `settings-actions.js` slimming
7. Runtime wiring layer cleanup

## Notes

- Do not start broad refactors while the visual baseline is uncertain.
- Prefer small structural commits over one large “architecture cleanup” commit.
- Keep multi-craft modeling generic: craft A, B, C, not orbiter/lander assumptions in reusable code.
