# Refactor Audit

This document preserves the useful architecture guidance from the shelf branch
`temp/refactor-audit-shelf-20260328`, but rewrites it in terms of the current
`master` layout.

The prototype modules from that branch were **not** merged into `master`.
Treat them as sketches for future reimplementation, not as code we should
blindly revive.

## Purpose

This audit captures the current architecture hotspots in the mission runtime
and proposes a cleanup order aligned with two design goals:

- clear separation of concerns
- functional core with imperative shell

## Current Shape

The codebase has made real progress toward smaller, more focused modules. The
best examples are:

- `src/platform/js/core/state/runtime-view-state.js`
- `src/platform/js/core/state/runtime-session-state.js`
- `src/platform/js/core/state/runtime-loop-state.js`
- `src/platform/js/core/state/runtime-interaction-state.js`
- `src/platform/js/ui/ui-state.js`
- `src/platform/js/core/domain/mission-config.js`
- `src/platform/js/core/domain/ui-transition-plan.js`

These modules already look like useful building blocks for a cleaner
architecture. The remaining debt is concentrated in orchestration and bridging
layers that still carry too many responsibilities at once.

## Main Hotspots

### 1. `mission.js` is still too large and too central

`src/platform/js/mission.js` remains the main composition root, but it also
owns legacy state bridging, timeline dock setup, event wiring, animation
bootstrap, and a wide dependency graph. As of `2026-04-15`, it is about `889`
lines long and still behaves like a hybrid of:

- composition root
- global state adapter
- runtime bootstrap script
- DOM bootstrap script
- timeline orchestration module

That makes it the primary obstacle to a clean imperative shell.

### 2. `mission-state-store.js` mixes unrelated state concerns

`src/platform/js/core/state/mission-state-store.js` is not just a state store.
It currently combines:

- generic getters/setters
- scene-scoped selectors
- ephemeris access
- direct writes into mutable maps and scene collections
- runtime command bridging
- view-flag patching

This produces a broad "everything store" instead of clear state ports.

### 3. Settings flow still crosses too many boundaries

`src/platform/js/app/settings-actions.js` reads UI state and then immediately
applies behavior across:

- scene mutation
- DOM/SVG mutation
- 3D helper visibility
- orbit style application
- render triggering

That means the same module effectively owns both desired view state and the
concrete rendering side effects of that state.

### 4. Orbit-style ownership is still spread across multiple modules

The orbit trail/background system is split across:

- `src/platform/js/app/orbit-trail-style.js`
- `src/platform/js/app/orbit-style-meta-actions.js`
- `src/platform/js/app/orbit-overlap-manager.js`
- `src/platform/js/app/scene-craft-helpers.js`

The immediate behavior works, but the ownership boundary is still blurry:

- pure style calculation
- metadata interpretation
- overlap refinement orchestration
- application of final opacity/visibility

are all still partially intertwined.

### 5. The runtime composition chain is too layered and "service-locator"-like

The path through:

- `src/platform/js/app/mission-runtime-wireup-entry.js`
- `src/platform/js/app/mission-runtime-entry.js`
- `src/platform/js/app/mission-runtime-wireup-config.js`
- `src/platform/js/app/mission-runtime-wireup.js`
- `src/platform/js/app/mission-runtime-static-deps.js`
- `src/platform/js/app/mission-runtime-handlers-entry.js`
- `src/platform/js/app/mission-wiring-composition.js`
- `src/platform/js/app/mission-scene-entry.js`

does create structure, but the dependency lists are still large enough that the
composition chain feels like repeated remapping of a mega-context object.

### 6. Scene view state still depends on legacy global fallbacks

`src/platform/js/app/scene-view-state.js` is conceptually on the right track,
but it still keeps legacy global zoom/pan and plane-variable semantics alive
for compatibility. That makes the state story harder to reason about:

- some values are scene-scoped
- some values are still effectively global
- the fallback direction is embedded in the module itself

### 7. UI tests have grown into a large implicit product-spec harness

`test/ui.test.js` is valuable and necessary, but it now contains a large amount
of product-specific orchestration logic:

- startup normalization
- deterministic camera stabilization
- control panel choreography
- mission/time targeting
- screenshot-specific state shaping

That is not bad by itself, but test architecture should be part of the refactor
conversation too.

## Boundary Assessment

### Functional Core: what is already good

These modules are close to the desired style and should be treated as examples
to preserve and extend:

- `src/platform/js/core/state/runtime-view-state.js`
- `src/platform/js/core/state/runtime-session-state.js`
- `src/platform/js/core/domain/mission-config.js`
- `src/platform/js/core/domain/ui-transition-plan.js`
- `src/platform/js/core/domain/origin-compat.js`

Common traits:

- closure-based state or pure data transforms
- no direct DOM access
- no scene mutation
- small, explicit responsibilities

### Imperative Shell: what is already good

These modules are correctly effect-oriented:

- `src/platform/js/ui/ui-state.js`
- `src/platform/js/shell/time/clock-effects.js`
- parts of `src/platform/js/app/mission-app.js`

Common traits:

- direct DOM/event/timer work
- little or no domain logic

### Mixed Modules: the main refactor targets

These modules most strongly violate the desired separation:

- `src/platform/js/mission.js`
- `src/platform/js/core/state/mission-state-store.js`
- `src/platform/js/app/settings-actions.js`
- `src/platform/js/app/scene-view-state.js`
- `src/platform/js/app/orbit-style-meta-actions.js`
- `src/platform/js/app/orbit-overlap-manager.js`

## Prototype Modules Preserved As Ideas

The shelf branch proposed these modules:

- `mission-bootstrap-state.js`
- `mission-view-sync-actions.js`
- `mission-state-core-port.js`
- `mission-state-data-port.js`
- `mission-state-runtime-port.js`
- `mission-state-scene-port.js`
- `mission-state-port-helpers.js`

Those names and boundaries are still useful design cues, but the actual files
from the shelf branch were not integrated. Future work should re-evaluate those
boundaries against the current runtime instead of copying the prototypes
verbatim.

## First Cleanup Slice

The safest first cleanup slice is structural, not behavioral.

### Slice A: document and isolate runtime ports

Goal:

- reduce hidden coupling without changing visuals or mission behavior

Work:

1. Extract a `MissionBootstrapState` layer from `mission.js`
   - runtime state creation
   - legacy state bridging setup
   - state cell construction

2. Split `mission-state-store.js` into narrower ports:
   - state access
   - scene runtime access
   - ephemeris/data access
   - runtime command bridge

3. Keep `mission-runtime-entry.js` from merging state, UI, and clock effects
   into one flat object.
   Instead pass smaller ports/effect groups explicitly.

Why this first:

- low risk to visuals
- high leverage for all later refactors
- makes later settings/orbit cleanup easier

### Slice B: slim the settings path

Goal:

- make settings updates state-driven instead of side-effect-driven

Work:

1. keep `settings-actions.js` focused on:
   - origin switching
   - dimension switching
   - requested view patch creation

2. move direct scene/DOM mutation into a dedicated sync layer:
   - orbit visibility sync
   - helper visibility sync
   - trail styling sync

Why second:

- user-facing behavior depends on it
- this is where recent UX changes have accumulated the most coupling

### Slice C: orbit-style boundary cleanup

Goal:

- make orbit rendering easier to reason about and tune

Work:

1. keep `orbit-trail-style.js` purely computational
2. move metadata normalization out of render application paths
3. keep overlap manager focused on scheduling and job lifecycle
4. centralize final opacity composition in one place

## Test Architecture Notes

The screenshot harness should be treated as part of the architecture.

Recommended future cleanup:

- extract common Playwright helpers from `test/ui.test.js`
- isolate deterministic camera/timeline setup helpers
- separate state-orchestration helpers from capture/assert helpers

This is not the first cleanup slice, but it should be tracked because it
affects how confidently we can refactor the runtime.

## Guardrails For The Refactor

- keep the working tree clean between slices
- run `npm run test:unit` after each structural change
- use SSIM runs at natural checkpoints, not after every tiny refactor
- prefer moving code before rewriting logic
- preserve current behavior first, then simplify

## Summary

The codebase is not far from a cleaner architecture, but feature pressure has
outpaced cleanup in the orchestration layer.

The biggest issues are not deep domain mistakes. They are:

- oversized runtime entry/composition modules
- an oversized mission state facade
- settings/orbit rendering paths that mix state, policy, and side effects

The best next move is to start with structural extraction around runtime ports
and composition boundaries, then slim the settings/orbit paths once those seams
exist.

See also:

- [target-architecture.md](target-architecture.md)
