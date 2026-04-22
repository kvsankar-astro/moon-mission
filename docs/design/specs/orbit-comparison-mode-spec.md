# Orbit Comparison Mode Spec

> Status: proposed implementation spec and live work tracker for the orbit comparison feature. The MVP scope below is intentionally narrower than the long-term vision so we can ship a usable comparison mode without multiplying data formats too early.

## Purpose

Add an orbit comparison feature that can show two missions in the same animation while making translunar and lunar-orbit shapes visually comparable.

The feature is primarily about:

- comparing orbit shape, sequence, and mission geometry
- using a fictional comparison clock rather than real UTC/TDB time
- allowing event interleaving between the primary mission and the comparison mission
- normalizing Earth-Moon distance so transfer geometry is easier to compare

This mode is a display/comparison mode, not a new physical ephemeris product.

## Current Recommendation

### Comparison should be a runtime display transform

The current recommendation is to keep physical mission ephemeris files unchanged and apply comparison transforms in JavaScript at runtime.

That means:

- keep existing `geo`, `lunar`, and `relative` Chebyshev assets as physical data
- do not generate pre-normalized comparison Chebyshev for MVP
- compute comparison alignment, normalization, and display-only lighting/spin overrides in runtime code

Rationale:

- comparison time is fictional and pair-specific
- event alignment policy is a product decision, not a data-generation invariant
- telemetry and body-state calculations should remain based on raw physical states
- precomputing comparison variants would multiply asset combinations without a proven need

## Scope

### MVP scope

The MVP scope is:

- compare exactly two missions at a time
- render the feature as a dedicated comparison mode built on top of the existing runtime
- start with a `relative`-style comparison frame
- normalize Earth-Moon distance in that frame
- support a fictional comparison clock `tau`
- interleave events from mission A and mission B on the comparison timeline
- freeze body spins and lighting direction to reduce visual noise
- load the comparison mission as an overlay mission in the same scene rather than as a second full app runtime

### Deferred beyond MVP

These items are explicitly deferred:

- full `geo` comparison mode
- full `lunar` comparison mode
- offline pre-normalized comparison Chebyshev assets
- comparison between more than two missions
- full telemetry parity for both missions everywhere in the UI
- mission-pair-specific authored alignment scripts
- desktop auxiliary panels customized specifically for comparison mode

## Core Concepts

### 1. Primary mission

The mission selected by the existing `mission=` flow.

Responsibilities:

- owns the main mission shell
- provides the base config for the page
- remains the source of truth for existing mission-specific UI that is not yet comparison-aware

### 2. Comparison mission

A second mission loaded as overlay data plus comparison metadata.

Responsibilities:

- contributes craft curves, craft states, and event markers
- does not own the page shell
- uses comparison-mode rendering rules rather than its own mission-specific default camera/lighting behavior

### 3. Comparison clock `tau`

A fictional time parameter used only for comparison mode.

Properties:

- not a real UTC or TDB instant
- maps separately into mission A time and mission B time
- drives event interleaving and scene sampling for both missions

### 4. Comparison frame

A display frame derived from physical mission states.

For MVP:

- Earth remains the origin
- the Earth->Moon line is fixed to `+X`
- Earth-Moon span is normalized to a fixed reference distance

This frame is similar to current `relative` mode, but it is more aggressively non-physical in presentation.

## Normalization Model

### Reference scalar

Let:

- `r_EM(t)` = physical Earth->Moon position vector in the primary physical frame
- `D_ref` = fixed reference Earth-Moon distance used by comparison mode

Then the normalization scalar is:

- `s(t) = D_ref / |r_EM(t)|`

For MVP, every displayed position in compare mode is scaled by `s(t)` after comparison-frame rotation/translation is chosen.

### Relative comparison frame

For the MVP frame:

- Earth is at `(0, 0, 0)`
- Moon is forced to `(D_ref, 0, 0)`
- all mission craft positions are rotated into the Earth->Moon frame and then scaled by `s(t)`

This keeps transfer geometry readable and visually stable.

### Future `geo` and `lunar` comparison views

If comparison is later exposed in `geo` or `lunar` origins, the same scalar still applies.

The rule is:

- origin selection controls translation/rotation
- normalization controls scale

So:

- `geo` compare = Earth-centered inertial-style axes with normalized scale
- `lunar` compare = Moon-centered axes with normalized scale
- `relative` compare = Earth->Moon-axis-fixed frame with normalized scale

## Time Mapping

### MVP policy

MVP uses a simple start-aligned comparison clock mapping:

- define a displayed comparison start for mission A
- define a displayed comparison start for mission B
- preserve each mission's native elapsed-time pace after that start

In other words:

- `tau = 0` means both missions are at their displayed comparison start
- `tau + 1 day` means each mission advances by one day of its own mission time
- shorter missions end earlier on the shared comparison timeline rather than being stretched

### Future refinement

After MVP, the preferred refinement is piecewise event-anchored mapping:

- launch -> TLI
- TLI -> LOI
- LOI -> landing or end-of-window

That will allow better event interleaving when two missions have very different mission durations.

## Rendering Policy

Comparison mode should prioritize visual comparability over physical fidelity.

### Required display overrides

In comparison mode:

- Earth rotation should be frozen
- Moon rotation should be frozen
- sky orientation should be frozen
- Sun direction should be fixed to a comparison-mode direction
- dynamic Earthshine should be disabled or fixed

These are display-only overrides. They must not alter the raw body-state computations used for orbit sampling.

### Why these overrides are needed

Without these overrides:

- body texture spin adds distracting motion unrelated to orbit comparison
- changing Sun direction changes the apparent shape and brightness of bodies
- Earthshine changes Moon appearance across the comparison clock

That extra motion is useful in physical mission playback but works against comparison readability.

## Data and Runtime Model

### Raw ephemeris

Comparison mode continues to use raw mission ephemeris:

- mission A `config.json` and Chebyshev data
- mission B `config.json` and Chebyshev data

### Comparison transforms

Comparison transforms are computed in runtime code after ephemeris sampling:

- time mapping
- frame alignment
- Earth-Moon normalization
- display-only lighting/spin policy

### Scene composition strategy

The recommended implementation strategy is:

- keep one scene/runtime shell
- load comparison mission craft/body series as overlay mission data
- render comparison mission craft as additional craft-like scene objects

This is preferred over running two independent mission runtimes inside one page.

## UI Model

### MVP UI requirements

The MVP should provide:

- a way to enable comparison mode
- a way to choose the comparison mission
- a clear label that the timeline is comparison-relative rather than real mission time
- an interleaved event strip for both missions
- distinct visual identity for primary vs comparison craft and events

### MVP UI constraints

The MVP does not need to expose every existing mission control surface in fully comparison-aware form.

It is acceptable for MVP to:

- treat the primary mission as the shell owner
- provide comparison-focused controls in a limited surface first
- keep some mission-specific panels disabled in comparison mode

## State and Module Boundaries

### New comparison-mode state should own

- whether comparison mode is active
- which mission is the comparison mission
- comparison time mapping parameters
- comparison frame settings
- frozen lighting/spin settings

### Existing physical state should continue to own

- raw mission config
- raw Chebyshev and NPZ data
- body ephemeris lookup
- raw telemetry calculations

This separation is important so comparison mode remains a presentation layer.

## Invariants

These rules must hold in comparison mode:

- raw ephemeris data remains unmodified
- comparison transforms are deterministic from mission pair + comparison clock state
- Earth-Moon displayed distance is constant in MVP comparison view
- both missions are sampled from their own raw time domains
- body spins and Sun direction remain stable across the comparison clock
- event ordering in the comparison timeline is based on mapped comparison time, not raw mission time

## Implementation Notes

### Recommended first implementation path

1. comparison-mode state and routing
2. comparison mission data loading
3. comparison time mapping
4. normalized relative-frame transform
5. 3D and 2D multi-mission rendering
6. comparison event timeline
7. UI polish and control-surface constraints

### Current prerequisite already completed

One prerequisite change is already done:

- 3D controller now updates every craft body present in scene state instead of only the active craft

This change landed in:

- `src/platform/js/controllers/animation-3d-controller.js`
- `test/animation-3d-controller.test.js`

## Risks

### 1. Single-mission assumptions in runtime state

Large parts of the current shell still assume one `globalConfig` and one mission-owned event set.

Impact:

- comparison mission data must be introduced carefully as overlay state rather than trying to reuse every primary-mission assumption directly

### 2. UI drift between physical mode and comparison mode

Not every control makes semantic sense in comparison mode.

Impact:

- the UI must explicitly disable, hide, or reinterpret controls that are physically meaningful but comparison-hostile

### 3. Timeline expectations

Users may assume the comparison timeline is real mission time.

Impact:

- comparison mode must label the clock clearly as relative/fictional

## Test Coverage Targets

Comparison mode should eventually include tests for:

- comparison clock mapping for two missions
- normalized Earth-Moon displayed span stability
- fixed Sun direction and frozen body rotations in compare mode
- interleaved event ordering
- mission overlay rendering in 2D and 3D
- mode transitions into and out of comparison mode

## Work Tracking

### Completed

- [x] Document decision: comparison normalization is a runtime display transform, not pre-normalized offline Chebyshev
- [x] Document decision: comparison mode freezes body spins and lighting direction for readability
- [x] Remove 3D single-active-craft rendering blocker by updating all craft bodies present in scene state
- [x] Add targeted regression coverage for the 3D multi-craft prerequisite
- [x] Add `mode=compare` runtime parsing while reusing the existing relative-frame pipeline
- [x] Thread compare-mode render intent through frame planning without changing raw scene-state sampling
- [x] Apply initial compare-mode 3D display overrides for frozen Earth/Moon spin, frozen sky time, fixed Sun direction, and disabled dynamic Earthshine
- [x] Load `compareMission` from the URL and merge the comparison mission into runtime config as a synthetic compare craft/body
- [x] Reuse the existing support-Chebyshev merge path so the comparison craft can ride the normal 2D/3D multi-craft orbit loaders
- [x] Map comparison-craft display time into source-mission time by preserving native elapsed-time pace at the ephemeris lookup layer
- [x] Extend compare-mode playback bounds to the longer displayed mission duration so longer overlays are not truncated at the primary mission end
- [x] Default compare-mode craft visibility to the primary craft plus the comparison craft overlay
- [x] Keep compare-mode startup UI synchronized so the comparison picker, default visible craft pair, and interleaved event strip stay aligned after load
- [x] Override comparison-overlay craft colors so primary and comparison trajectories stay visually distinct
- [x] Normalize comparison overlay craft/orbits against the overlay mission Moon anchor so lunar loops stay centered on the shared compare-mode Moon

### In progress

- [x] Define comparison-mode routing and runtime state shape
- [x] Define comparison mission loading contract
- [ ] Define comparison event interleaving rules

### MVP next

- [x] Add comparison mission selector UI
- [x] Build normalized relative-frame transform in runtime
- [ ] Render comparison mission craft/orbits in 3D
- [ ] Render comparison mission craft/orbits in 2D
- [x] Add interleaved comparison event strip
- [x] Label comparison timeline as fictional/relative

### Deferred

- [ ] Add `geo` comparison view
- [ ] Add `lunar` comparison view
- [ ] Evaluate whether any comparison transforms should later be precomputed offline for performance
