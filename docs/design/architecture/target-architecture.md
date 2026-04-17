# Target Architecture

This document is the single source of truth for runtime architecture and
refactor planning in `moon-mission`.

It replaces the older split between `refactor-audit.md`, earlier revisions of
this document, and the runtime-refactor sections that used to live in the
orbit roadmap. It is grounded in the current codebase as of
`2026-04-16`.

## Goals

- functional core, imperative shell
- clear separation of concerns
- explicit state ownership
- explicit data, rendering, and UI boundaries
- smaller composition surfaces instead of large context bags
- preserve the current runtime behavior while improving refactorability

## Principles

### Functional core

Pure modules should own:

- mission config parsing and normalization
- event-time resolution
- camera and UI transition policy
- asset and manifest resolution
- frame planning
- telemetry and timeline derivation
- orbit-style math
- scene-state math

Pure modules should not own:

- DOM reads or writes
- D3 or Three.js mutation
- timers or `requestAnimationFrame`
- fetch, caching, or worker lifecycle
- hidden access to globals

### Imperative shell

Effect modules should own:

- DOM reads and writes
- D3/SVG mutation
- Three.js scene mutation
- browser event listeners
- `requestAnimationFrame`, timeouts, and intervals
- fetch, cache, and worker orchestration
- mission-specific UI surfaces such as auxiliary panels

Effect modules should not own:

- core business rules
- reusable calculation logic
- hidden state policy

### Application services

Application services sit between the two. They may compose state ports, domain
logic, and effect ports, but they should prefer to:

- translate user intent into state patches or render intents
- coordinate startup and shutdown
- bridge pure plans to shell adapters

They should avoid becoming effect-heavy controller hubs.

## Current Runtime Shape

### Product surfaces

- `mission.html` is the runtime page shell. It resolves the mission slug, sets
  `window.missionConfig`, and injects the runtime module.
- `src/platform/js/mission.js` is still the main browser bootstrap script for
  the mission runtime.
- `index.html` and `src/platform/js/index-landing.js` are the landing/catalog
  path and are outside the main mission runtime.

### Boot flow

The current mission boot flow is:

1. `mission.html` resolves the mission and loads `src/platform/js/mission.js`.
2. `mission.js` creates legacy state, closure-based runtime stores, the event
   bus, scene/view/runtime entries, and the large `missionStateCells` bridge.
3. `app/mission-app.js` wires browser events and kicks off
   `handlers.initAnimation({ reset: true })`.
4. `app/mission-runtime-handlers-entry.js` delegates startup to
   `app/init-orchestration.js`.
5. `app/init-orchestration.js` and `app/runtime-init.js` initialize config,
   scenes, controls, orbit data, and landing data, then start the RAF loop.
6. Per-frame work flows through `app/scene-frame-orchestration-actions.js`,
   which uses `core/plans/frame-plan.js` and then applies render and UI intents
   through shell adapters.

### Current layers

| Layer | Current anchors | Notes |
|---|---|---|
| Page shell | `mission.html`, `mission.js`, `app/mission-app.js`, `ui/event-handlers.js` | Browser bootstrap, event wiring, startup repair, panel/control behavior |
| Composition and runtime assembly | `app/mission-runtime-handlers-entry.js`, `app/mission-runtime-wireup-entry.js`, `app/mission-runtime-entry.js`, `app/mission-wiring-composition.js`, `app/runtime-bootstrap-actions.js` | Useful separation exists, but there is still repeated remapping of large dependency sets |
| Domain and planning core | `core/domain/*.js`, `core/plans/frame-plan.js`, `scene-state.js`, `data/relative-frame-provider.js` | Strongest functional-core foundation in the repo |
| State ports | `core/state/runtime-view-state.js`, `runtime-session-state.js`, `runtime-interaction-state.js`, `runtime-loop-state.js`, `app/scene-view-state.js` | Small stores are good; `scene-view-state.js` is still transitional because of legacy fallbacks |
| Data and integration | `data/mission-data.js`, `data/ephemeris-provider.js`, `chebyshev.js` | Boundary between pure asset resolution and fetch/cache/provider work is still mixed |
| Render and UI effects | `shell/render/frame-renderer.js`, `shell/ui/frame-ui-updater.js`, `shell/ui/mission-ui-effects.js`, `shell/time/clock-effects.js`, `rendering/*`, `controllers/*` | Effect ownership is clearest here and should be preserved |

## What Is Already Working Well

These modules already fit the target style and should be treated as examples to
preserve and extend.

### Domain and planning core

- `core/domain/mission-config.js`
- `core/domain/camera-policy.js`
- `core/domain/event-time-resolver.js`
- `core/domain/origin-compat.js`
- `core/domain/ui-transition-plan.js`
- `core/domain/mission-asset-resolver.js`
- `core/domain/ephemeris-manifest.js`
- `core/plans/frame-plan.js`

### Narrow state ports

- `core/state/runtime-view-state.js`
- `core/state/runtime-session-state.js`
- `core/state/runtime-interaction-state.js`
- `core/state/runtime-loop-state.js`

### Thin shell adapters

- `shell/render/frame-renderer.js`
- `shell/ui/frame-ui-updater.js`
- `shell/ui/mission-ui-effects.js`
- `shell/time/clock-effects.js`

### Strong transitional seam

- `scene-state.js` is already written as a functional-core module, even though
  it still depends on provider modules from `data/*`.

## Current Boundary Leaks

These are the main places where concerns are still mixed.

### `mission.js`

`mission.js` is smaller in responsibility than the older docs implied, but it
is still too central. It currently mixes:

- legacy state creation
- runtime store creation
- state-cell bridging
- timeline dock syncing
- active craft control syncing
- render entry
- final top-level composition

It should converge toward page bootstrap and composition only.

### `core/state/mission-state-store.js`

This is still the largest state-boundary leak in the runtime. It mixes:

- config and view state access
- scene lookup and mutation
- ephemeris and data access
- runtime hook access
- command bridging
- view flag patching

It behaves like an everything store instead of a set of explicit ports.

### `app/settings-actions.js`

This module still crosses too many boundaries in one place. It:

- reads UI state
- updates runtime view state
- mutates SVG orbit groups
- mutates Three.js scene objects
- applies sky settings
- applies helper visibility
- forces an immediate render

The desired split is:

- a settings intent layer that produces state changes
- a view/render sync layer that owns direct effects

### `app/scene-view-state.js`

This is the right idea, but it still embeds legacy-global fallback for
zoom/pan/plane state. That makes the true source of truth ambiguous.

### `app/scene-frame-orchestration-actions.js`

This file is a promising seam because it already uses `planFrameStep`, but it
still combines:

- transient event latching
- frame-plan execution
- state patch application
- render effect dispatch
- UI effect dispatch
- final `render()` call

The direction should be to keep planning pure and keep this module as a thin
bridge from plan to effects.

### `app/scene-ui-update-actions.js`

This module currently mixes:

- telemetry calculations
- event resolution and display logic
- angle calculations
- ground-track panel coordination
- DOM updates

The calculations should be extracted into pure helpers or view-model builders,
leaving only DOM and panel mutation in the shell.

### `data/mission-data.js`

This file mixes multiple concerns:

- fetch and cache
- config profile overlay loading
- manifest loading
- config normalization and validation
- runtime asset URL resolution

The pure config and manifest logic is already moving into `core/domain/*`. The
remaining fetch/cache concerns should follow that split more clearly.

### `ui/event-handlers.js`

This is no longer just event binding. It also contains:

- control synchronization logic
- mobile layout behavior
- timeline presentation logic
- settings panel behavior
- mission-specific UI affordances

It is a shell module, but it should be decomposed into smaller shell features
instead of remaining a broad UI utility file.

### Runtime composition chain

The chain through:

- `mission-runtime-wireup-entry.js`
- `mission-runtime-entry.js`
- `mission-runtime-wireup-config.js`
- `mission-runtime-wireup.js`
- `mission-runtime-static-deps.js`
- `mission-runtime-handlers-entry.js`
- `mission-wiring-composition.js`
- `runtime-bootstrap-actions.js`

does create structure, but it still relies on repeated remapping of large
dependency sets. The next stage should simplify ownership, not add more
wrapper layers.

## Target Architecture

The target is intentionally conservative. It is meant to fit the current code
and migrate in place rather than force a rewrite.

### 1. Domain and planners

This layer should own pure value-in/value-out logic.

Owns:

- config parsing, normalization, validation, and mission craft resolution
- camera rules
- event time resolution
- asset and manifest resolution
- frame planning
- orbit-style math
- telemetry and event view-model calculations
- scene-state calculations

Current anchors:

- `core/domain/*.js`
- `core/plans/frame-plan.js`
- `scene-state.js`
- pure parts of `app/orbit-trail-style.js`
- future pure helpers extracted from `scene-ui-update-actions.js`

Should not own:

- DOM access
- Three.js or D3 mutation
- timers
- fetch or cache
- hidden access to global runtime state

### 2. State ports

This layer should own narrow mutable state and explicit lookup APIs.

Owns:

- session state
- view state
- interaction state
- loop state
- scene-scoped plane/zoom/pan state
- data-source and load state
- scene and controller registry

Current anchors:

- `core/state/runtime-view-state.js`
- `core/state/runtime-session-state.js`
- `core/state/runtime-interaction-state.js`
- `core/state/runtime-loop-state.js`
- `app/scene-view-state.js`

Target split for `mission-state-store.js`:

- `MissionSessionPort`
- `MissionViewPort`
- `MissionInteractionPort`
- `MissionDataPort`
- `MissionSceneRegistry`

Should not own:

- DOM mutation
- scene mutation
- runtime command wiring
- unrelated cross-cutting responsibilities in one facade

### 3. Application services

This layer should translate between state ports, domain planners, and shell
effects.

Owns:

- startup orchestration
- settings intent handling
- dimension and origin transitions
- frame orchestration
- timeline and event model coordination
- orbit-style policy coordination
- mission data coordination

Current anchors:

- `app/init-orchestration.js`
- `app/runtime-init.js`
- `app/settings-actions.js`
- `app/scene-frame-orchestration-actions.js`
- `app/mission-runtime-handlers-entry.js`
- `app/mission-wiring-composition.js`

Target direction:

- application services may build intents and call explicit effect ports
- application services should not become the new home for direct DOM/Three/D3
  mutation

### 4. Shell and effects

This layer should own direct interaction with the browser and renderers.

Owns:

- page bootstrap
- DOM state and layout
- D3/SVG mutation
- Three.js mutation
- requestAnimationFrame and timeout scheduling
- fetch and cache
- worker lifecycle
- mission-specific panels and feature shells

Current anchors:

- `mission.html`
- `mission.js`
- `app/mission-app.js`
- `ui/event-handlers.js`
- `ui/ui-state.js`
- `shell/*`
- `rendering/*`
- `controllers/*`
- mission-specific panel modules such as
  `app/auxiliary-camera-views.js` and `app/ground-track-panel.js`

## Dependency Rules

### Allowed

- domain and planners -> nothing below them
- state ports -> domain helpers
- application services -> domain helpers + state ports + explicit shell ports
- shell/effects -> browser APIs, DOM, Three.js, D3, workers, fetch
- composition root -> everything

### Not allowed

- domain or planner modules -> DOM, Three.js, D3, timers, fetch
- state ports -> DOM or scene mutation
- settings intent service -> direct renderer mutation
- data normalization helpers -> fetch and cache
- test helpers -> hidden production business logic

## Concrete Refactor Slices

These are ordered by leverage and safety, not by novelty.

### Slice 1: split the state facade

Goals:

- turn `mission-state-store.js` into explicit ports
- stop flattening state, UI, and clock effects into one `stateAccess` object
- make `mission.js` less responsible for state-cell exposure

Expected result:

- clearer ownership
- simpler runtime wiring
- better seams for the settings and frame work

### Slice 2: separate settings intent from effects

Goals:

- keep view-setting interpretation in a settings service
- move SVG, Three.js, sky, helper, and orbit sync into effect modules

Likely source:

- `app/settings-actions.js`

Expected result:

- settings become state-driven
- rendering side effects become easier to test and change

### Slice 3: finish the frame pipeline split

Goals:

- keep `frame-plan.js` pure
- extract transient event, telemetry, and event text calculations into pure
  helpers
- keep `frameRenderer` and `frameUiUpdater` as the only direct effect adapters

Likely sources:

- `app/scene-frame-orchestration-actions.js`
- `app/scene-ui-update-actions.js`

Expected result:

- cleaner per-frame reasoning
- easier performance tuning
- easier UI testing without full scene mutation

### Slice 4: make scene view state truly scene-scoped

Goals:

- move legacy zoom/pan/plane fallback behind an explicit compatibility adapter
- make scene-scoped state the real source of truth

Likely source:

- `app/scene-view-state.js`

Expected result:

- fewer hidden globals
- cleaner origin and dimension switching

### Slice 5: collapse redundant composition layers

Goals:

- simplify the runtime entry and wireup chain
- reduce repeated remapping of large dependency bags
- make ownership explicit across bootstrap, wiring, and runtime services

Likely sources:

- `mission.js`
- `app/mission-runtime-wireup-entry.js`
- `app/mission-runtime-entry.js`
- `app/mission-runtime-wireup-config.js`
- `app/mission-wiring-composition.js`
- `app/runtime-bootstrap-actions.js`

Expected result:

- fewer indirection layers
- composition root that is easier to understand and change

### Slice 6: split data loading from data normalization

Goals:

- keep config and manifest logic in pure domain modules
- make `mission-data.js` a smaller integration module focused on fetch/cache
- keep URL resolution manifest-driven

Expected result:

- a cleaner app/data boundary
- easier testing of config, manifest, and loader behavior independently

### Slice 7: break up large shell modules

Goals:

- decompose `ui/event-handlers.js`
- reduce `mission.js` to bootstrap and top-level coordination only
- keep mission-specific UI features isolated from reusable shell code

Expected result:

- smaller UI change surface
- less incidental coupling between controls, layout, and mission-specific
  behavior

## Guardrails

- move code before rewriting behavior
- preserve current visuals first, then simplify
- prefer explicit ports over broader context objects
- every new pure helper should take all of its inputs explicitly
- mission-specific features should stay at the shell edge unless they expose a
  clearly reusable policy
- run unit tests after structural slices and run the UI/SSIM gate at natural
  checkpoints

## Working Rule

When there is a design choice to make, prefer the option that moves logic
toward:

1. pure planners and selectors
2. narrow state ports
3. explicit effect adapters
4. smaller composition roots

If a change does not improve one of those four things, it is probably not
moving the architecture in the right direction.
