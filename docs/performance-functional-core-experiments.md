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
