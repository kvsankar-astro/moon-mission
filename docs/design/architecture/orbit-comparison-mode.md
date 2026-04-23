# Orbit Comparison Mode

Reference document for the shipped compare-mode feature.  Captures the
behaviour the runtime implements today, the URL contract that drives it, and
the invariants that new changes must preserve.

## Purpose

Compare two missions in the same animation so translunar and lunar-orbit
shapes are visually comparable.  The feature is about:

- comparing orbit shape, sequence, and mission geometry
- using a fictional comparison clock rather than real UTC/TDB time
- interleaving events from both missions on one timeline
- normalising Earth-Moon distance so transfer geometry is easy to read

Compare mode is a display/comparison mode, not a new physical ephemeris
product.  Raw mission ephemeris is never rewritten.

## URL Contract

The landing-page launcher builds these URLs; they can also be typed directly.

| Parameter | Values | Meaning |
| --- | --- | --- |
| `mission` | any mission folder under `assets/` | primary mission; owns the page shell |
| `mode` | `compare` | activates compare mode |
| `compareMission` | any mission folder | comparison (secondary) mission loaded as overlay |
| `origin` | `geo`, `lunar`, `relative` (default `relative`) | scene origin; compare mode *always* runs in the relative frame, regardless of origin selection |
| `comparePrimaryEvent` | primary mission event key (e.g. `launch`) | alignment anchor on the primary timeline; defaults to launch-like event |
| `compareSecondaryEvent` | secondary mission event key | alignment anchor on the secondary timeline; defaults to launch-like event |

Example:

```
mission.html?mission=artemis2&mode=compare&compareMission=artemis1&origin=relative
```

Compare mode is restricted to the relative frame — the origin selector can be
used to move between geo, lunar, and relative while compare mode is active,
but the normalization and time-mapping transforms always apply the
relative-frame rules.

## Core Concepts

### Primary mission

Selected by the existing `mission=` flow.  Owns the page shell and the base
config.  Remains the source of truth for any mission-specific UI that is not
compare-aware.

### Comparison mission

Loaded as overlay data plus comparison metadata.  Contributes craft curves,
craft states, and event markers.  Does **not** own the page shell and
follows comparison-mode rendering rules rather than its own mission defaults.
The comparison mission's primary craft is injected into the runtime as a
synthetic craft id of the form `CMP_<MISSION>_<CRAFT>`.

### Comparison clock `tau`

A fictional time parameter used only in compare mode.  It is not a real UTC
or TDB instant; it maps separately into mission A time and mission B time,
and it drives event interleaving and scene sampling for both missions.

### Comparison frame

For the relative-frame compare view:

- Earth is at `(0, 0, 0)`
- the Earth→Moon line is fixed to `+X`
- Earth–Moon span is normalised to a fixed reference distance

This is more aggressively non-physical than normal relative mode, but it
keeps transfer geometry readable and stable.

## Normalization Model

### Reference scalar

Let:

- `r_EM(t)` = physical Earth→Moon position vector at time `t`
- `D_ref` = fixed reference Earth-Moon distance used by compare mode
  (`COMPARISON_REFERENCE_DISTANCE_KM` in `comparison-display.js`)

Then the per-frame normalisation scalar is:

```
s(t) = D_ref / |r_EM(t)|
```

Every displayed position in compare mode is scaled by `s(t)` after
comparison-frame rotation/translation is chosen.

### Relative comparison frame

- Earth at `(0, 0, 0)`
- Moon forced to `(D_ref, 0, 0)`
- craft positions are rotated into the Earth→Moon frame and then scaled by
  `s(t)`

### Mission-of-record for the anchor

`s(t)` is computed from *whichever* mission has a valid Moon sample at the
scene time.  Normally that is the primary mission.  When the primary's Moon
data ends before the compare-display window ends (for example, Artemis 2 is
primary and we scrub past its HORIZONS end), the scene uses the
comparison mission's Moon through the overlay alias
(`CMP_<MISSION>_<CRAFT>__MOON`).  Both the scene Moon body and the scale
resolver resolve to the same mission-of-record so they stay consistent.

## Time Mapping

### Single-anchor policy

Compare mode uses a single-anchor `tau` mapping:

- choose exactly one anchor pair `A_Ex` and `B_Ey`
- by default each side uses a launch-like event; fall back to mission start
- preserve each mission's native elapsed-time pace after that anchor

`tau = 0` means the selected anchor pair is aligned on the shared
comparison clock.  `tau + 1 day` means each mission advances by one day of
its own mission time.  Shorter missions end earlier on the shared compare
timeline rather than being stretched.

### Event interleaving rule

- for each mission event, `offset = eventTime − selectedAnchorTime`
- place the event on the shared timeline at `compareAnchor + offset`
- merge both missions' events into one list and sort by that shared time
- ties favour primary-mission events, then sort by label for stability

## Rendering Policy

Compare mode prioritises visual comparability over physical fidelity.

### Required display overrides

- Earth rotation frozen
- Moon rotation frozen
- sky orientation frozen
- Sun direction fixed to a compare-mode direction
- dynamic Earthshine disabled or fixed

These overrides are display-only; they must not alter the raw body-state
computations used for orbit sampling.

### Orbit rendering

Both missions' craft curves are rendered through the normal multi-craft
orbit pipeline.  The compare-craft id appears as an entry in
`scene.planetsForLocations`; curves and body states are produced by the
same `generateBodyCurve`/`normalizeComparisonCurveVectors` path that handles
the primary craft, with the scale resolver applied per-vector.

Post-horizon generated (dashed) overlays are scoped to the primary mission
only.  The compare craft's entire window is real, alignment-mapped HORIZONS
data, so it is drawn as a normal solid trajectory.

## Data and Runtime Model

### Raw ephemeris

Compare mode uses raw mission ephemeris unchanged:

- primary mission `config.json` and Chebyshev data
- comparison mission `config.json` and Chebyshev data

Both missions' `relative-<CRAFT>-cheb.json` files are loaded; the secondary
mission's `SC` and `MOON` series are merged into the primary scene's
Chebyshev bucket under compare-specific alias ids
(`CMP_<MISSION>_<CRAFT>` and `CMP_<MISSION>_<CRAFT>__MOON`).  That merge is
performed by `mergeComparisonNormalizationSupportSeries` in
`orbit-load-actions.js` during the usual support-chebyshev load pass.

### Runtime composition

One scene/runtime shell.  Comparison mission craft/body series are loaded as
overlay mission data.  Comparison mission craft render as additional
craft-like scene objects — not as a second mission runtime.

## State and Module Boundaries

### Compare-mode state owns

- whether compare mode is active
- which mission is the comparison mission
- comparison time mapping parameters
- comparison frame settings
- frozen lighting/spin settings

### Existing physical state still owns

- raw mission config
- raw Chebyshev and NPZ data
- body ephemeris lookup
- raw telemetry calculations

This separation is what keeps compare mode a presentation layer.

## Invariants

These rules must hold in compare mode:

- raw ephemeris data remains unmodified
- comparison transforms are deterministic from mission pair + `tau`
- Earth–Moon displayed distance is constant at `D_ref` across the entire
  compare window, regardless of which mission's Moon anchors it at any
  given sample
- both missions are sampled from their own raw time domains, via the
  alignment offset (`mapComparisonBodyTimeMs`)
- body spins and Sun direction remain stable across `tau`
- event ordering in the comparison timeline is based on mapped compare
  time, not raw mission time

## Implementation Map

Principal files:

| File | Role |
| --- | --- |
| `src/platform/js/app/comparison-overlay-loader.js` | Parses URL, loads secondary mission config and manifest, builds `globalConfig.comparisonOverlay` |
| `src/platform/js/core/domain/comparison-overlay.js` | Pure helpers: compare-craft id builders, alignment anchor resolution, `mapComparisonBodyTimeMs` |
| `src/platform/js/core/domain/comparison-display.js` | `createNormalizedComparisonDisplayState`, `resolveComparisonNormalizationScaleFromDistance`, `COMPARISON_REFERENCE_DISTANCE_KM` |
| `src/platform/js/app/comparison-normalization.js` | Per-vector scale resolver for orbit curves |
| `src/platform/js/app/orbit-load-actions.js` | Merges the secondary mission's `SC` / `MOON` series under compare aliases |
| `src/platform/js/scene-state.js` | Uses the alias for the scene Moon when the primary Moon is past its data end |
| `src/platform/js/ui/compare-mode-controller.js` | Compare-panel UI glue |
| `src/platform/js/app/relative-mode.js` | URL state sync for alignment events and compare origin |

## Tests

- `test/compare-artemis-scaling.test.js` — functional test that exercises
  the normalization pipeline against real Artemis 1 / Artemis 2 Chebyshev
  data in both orderings, including the past-primary-end regime
- `test/mission-smoke.test.js` — Playwright compare smoke ("Mission Compare
  Smoke Tests"), covers dual craft/orbit rendering across 2D/3D and
  interleaved events
- `test/compare-mode-controller.test.js`, `test/compare-mode-ui-model.test.js`,
  `test/compare-panel-controller.test.js` — compare-UI unit tests
- `test/index-landing-compare-smoke.test.js` — landing-page launcher smoke

## Deferred

Not shipped yet:

- compare-panel usability shortcuts: preset alignment choices (`Launch`,
  `TLI`, `LOI`, `Landing`, `End`), `Swap Missions` action
- expanded browser-level regression coverage for compare-mode UI surfaces
- polish on remaining compare-aware auxiliary UI surfaces that still
  inherit single-mission assumptions
- evaluation of whether any comparison transforms should later be
  precomputed offline for performance
- comparison between more than two missions
- offline pre-normalised comparison Chebyshev assets
- full telemetry parity for both missions everywhere in the UI
- mission-pair-specific authored alignment scripts
