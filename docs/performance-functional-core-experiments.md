# Functional Core Performance Experiments

This document tracks experiment-driven performance work on the functional core.

## Experiment 1: Skip Next-State SC Lookup for 2D Frame Path

### Hypothesis
2D frame rendering does not require a forward ephemeris sample (`nextPosition` / `nextVelocity`) for spacecraft orientation, so skipping that second lookup should reduce per-frame functional-core cost.

### Change
- `assets/platform/js/core/plans/frame-plan.js`
  - Added `includeNextState` to scene-state options.
  - Sets `includeNextState: false` for `currentDimension === "2D"`.
- `assets/platform/js/scene-state.js`
  - `computeBodyState("SC", ...)` now skips the second ephemeris query when `includeNextState === false` and reuses current state as next state.
- Tests
  - Updated `test/frame-plan.test.js` for 2D/3D `includeNextState` assertions.
  - Added `test/scene-state.test.js` to verify SC ephemeris query count behavior.
- Bench tools
  - Added `scripts/bench-functional-core-scene-state.js`.
  - Added `scripts/bench-functional-core-sc-body-state.js`.

### Measurement
- Scene benchmark command:
  - `node scripts/bench-functional-core-scene-state.js --config geo --rounds 7 --samples 5000 --warmup 1000 --include-next-state false`
- Targeted SC benchmark commands:
  - `node scripts/bench-functional-core-sc-body-state.js --rounds 10 --samples 15000 --warmup 4000 --include-next-state true`
  - `node scripts/bench-functional-core-sc-body-state.js --rounds 10 --samples 15000 --warmup 4000 --include-next-state false`

### Result
- Targeted SC path shows consistent improvement when `includeNextState=false`.
- Representative aggregate:
  - mean: `0.001011 ms` -> `0.000620 ms`
  - p95: `0.001200 ms` -> `0.000700 ms`
  - p99: `0.001810 ms` -> `0.001170 ms`

### Validation
- Unit tests: pass.
- UI tests: pass.
- SSIM regressions: `0`.

## Experiment 2: Remove Redundant Ephemeris Work in Scene Composition

### Hypothesis
Two avoidable costs were present in the scene-state functional core:
- `includeNextState` was not being forwarded through `computeSceneState`, so 2D scene computation still performed unnecessary SC next-state lookups.
- Relative GEO mode computed Moon ephemeris twice per frame (Sun-frame transform + body-state pass).

Reducing these redundant ephemeris queries should improve frame-time consistency and average cost without changing rendering behavior.

### Change
- `assets/platform/js/scene-state.js`
  - `computeSceneState` now forwards `includeNextState` to body-state computation.
  - Relative GEO computation now reuses the Moon ephemeris state already fetched for Sun-direction frame transform.
  - `computeBodyState("MOON", "geo", ...)` accepts optional `precomputedBodyEphemeris.MOON`.
- `scripts/bench-functional-core-scene-state.js`
  - Added `--frame-mode` argument (`inertial` or `relative`) for reproducible mode-specific benchmarking.
- `test/scene-state.test.js`
  - Added coverage for `computeSceneState` forwarding `includeNextState`.
  - Added coverage that relative mode performs only one Moon ephemeris lookup.
  - Added coverage for `computeBodyState` Moon precomputed-state reuse.

### Measurement
- Relative-mode benchmark (before change):
  - `computeSceneState` with `frameMode=relative`, `includeNextState=false`
  - Aggregate mean-of-means: `0.024713 ms`
  - Aggregate mean p95: `0.027287 ms`
  - Aggregate mean p99: `0.084250 ms`
- Relative-mode benchmark (after change):
  - `node scripts/bench-functional-core-scene-state.js --config geo --frame-mode relative --rounds 8 --samples 6000 --warmup 1500 --include-next-state false`
  - Aggregate mean-of-means: `0.016381 ms`
  - Aggregate mean p95: `0.018700 ms`
  - Aggregate mean p99: `0.045200 ms`
- Inertial-mode check after forwarding `includeNextState`:
  - `--frame-mode inertial --include-next-state true`: mean-of-means `0.015956 ms`
  - `--frame-mode inertial --include-next-state false`: mean-of-means `0.015123 ms`

### Result
- Relative GEO path improved substantially after removing duplicate Moon lookup:
  - mean-of-means improved by ~`33.7%`
  - mean p95 improved by ~`31.5%`
  - mean p99 improved by ~`46.3%`
- Inertial path also improved modestly when `includeNextState=false` is active in scene-state composition.
