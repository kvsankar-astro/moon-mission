# Target Architecture

This document preserves the target-architecture guidance from the shelf branch
`temp/refactor-audit-shelf-20260328`, adapted to the current `master`
codebase.

It is meant to answer three questions clearly:

1. What are the major runtime objects/modules we want?
2. What does each one own?
3. What dependencies are allowed between them?

This target is intentionally conservative. It is designed to fit the current
codebase and migrate toward better boundaries without requiring a full rewrite.

## Design Goals

- functional core where practical
- imperative shell at the edges
- explicit state ownership
- explicit rendering ownership
- minimal legacy leakage into new modules
- predictable test seams

## Architectural Layers

### 1. Core Domain

Pure functions and pure data transforms.

Examples that already fit this layer well:

- `core/domain/mission-config.js`
- `core/domain/origin-compat.js`
- `core/domain/ui-transition-plan.js`
- `core/plans/frame-plan.js`

Target rule:

- no DOM
- no Three.js scene mutation
- no D3 mutation
- no timers
- no direct global state access

### 2. Core State

Small closure-based stores that own a specific slice of state.

Examples that already fit reasonably well:

- `core/state/runtime-view-state.js`
- `core/state/runtime-session-state.js`
- `core/state/runtime-loop-state.js`
- `core/state/runtime-interaction-state.js`

Target rule:

- may hold mutable state
- may expose getters/setters
- should not mutate scenes or DOM directly
- should not hide unrelated responsibilities behind one giant facade

### 3. Application Services

Application-level coordination that combines core state, domain logic, and
ports, but still avoids direct DOM/scene mutation where possible.

This is where we want to place:

- state translation
- intent handling
- scene/view sync planning
- timeline/orbit-style decision logic

### 4. Shell / Effects

Imperative boundary layer.

This is where direct effects belong:

- DOM reads/writes
- D3 mutation
- Three.js scene mutation
- worker scheduling
- timers
- browser event listeners
- Playwright orchestration in tests

## Desired Runtime Objects

## A. Composition Root

### `MissionAppBootstrap`

Responsibility:

- create the runtime
- wire modules together
- expose only the minimal app start hooks

Owns:

- top-level dependency construction
- creation order
- handoff to startup

Should not own:

- timeline behavior
- scene mutation logic
- view patching logic
- business rules

Current likely home:

- extracted from `src/platform/js/mission.js`

## B. State Ports

These should replace the current oversized state facade.

### `MissionSessionState`

Responsibility:

- animation time
- play/pause
- joy ride flag
- landing flag

Current basis:

- `core/state/runtime-session-state.js`

### `MissionViewState`

Responsibility:

- current origin/config
- dimension
- view flags
- orbit style choice
- user-controlled trail settings

Current basis:

- `core/state/runtime-view-state.js`

### `MissionInteractionState`

Responsibility:

- transient input state
- mouse-down state
- timeout handles
- dimension transition markers

Current basis:

- `core/state/runtime-interaction-state.js`

### `MissionSceneViewState`

Responsibility:

- per-scene plane selection
- per-scene zoom/pan
- per-scene view transform state

Should eventually own:

- all plane/zoom/pan state currently leaking through legacy globals

Current basis:

- `app/scene-view-state.js`

### `MissionDataState`

Responsibility:

- ephemeris source status
- loaded Chebyshev/NPZ references
- landing data references
- body-source mapping

This should be separate from user/session/view state.

### `MissionSceneRegistry`

Responsibility:

- animation scenes by origin
- scene lookup
- controller lookup

This is a runtime object registry, not a general state store.

## C. Application Services

## 1. Startup and Composition

### `MissionRuntimeBuilder`

Responsibility:

- accept explicit ports/dependencies
- produce the runtime services needed by the app

This replaces the current mega-context remapping chain.

Current sources to simplify:

- `mission-runtime-wireup-entry.js`
- `mission-runtime-entry.js`
- `mission-runtime-wireup-config.js`
- `mission-runtime-wireup.js`
- `mission-runtime-static-deps.js`
- `mission-runtime-handlers-entry.js`
- `mission-wiring-composition.js`

### `MissionStartupService`

Responsibility:

- initialize scenes
- load initial data
- apply initial mission state
- start animation loop

Current likely extraction source:

- `mission-runtime-bootstrap.js`
- `mission-app.js`
- `mission.js`

## 2. View State and Settings

### `MissionSettingsService`

Responsibility:

- translate UI intent into view-state changes
- coordinate origin/dimension transitions
- produce a desired view patch

Should not:

- mutate DOM directly
- mutate Three.js scene objects directly

Current likely extraction source:

- `settings-actions.js`

### `MissionViewSyncService`

Responsibility:

- apply current view state to scenes and DOM

Owns:

- orbit visibility sync
- helper visibility sync
- sky visibility sync
- trail style application

This is where imperative scene/DOM mutation belongs.

The shelf branch prototyped this idea as `mission-view-sync-actions.js`, but
that file should be treated as a sketch, not as a direct merge target.

## 3. Timeline

### `MissionTimelineService`

Responsibility:

- timeline event selection
- current marker resolution
- craft availability band data
- current dock model

Should produce:

- a plain timeline view model

### `TimelineDockEffects`

Responsibility:

- bind the dock
- render the dock UI
- dispatch seek/marker events

Current likely anchor:

- `timeline-dock-controller.js`

This separates timeline computation from dock mutation.

## 4. Orbit Style

### `OrbitStyleResolver`

Responsibility:

- pure trail/classic style decisions
- opacity composition rules
- tail/head visual resolution
- background opacity resolution from metadata

Current basis:

- pure parts of `orbit-trail-style.js`

### `OrbitStyleMetadataService`

Responsibility:

- normalize and store authored style metadata
- answer style metadata queries for a scene/body

Should not:

- directly mutate scene materials

Current likely extraction source:

- `orbit-style-meta-actions.js`

### `OrbitOverlapService`

Responsibility:

- decide whether dynamic overlap refinement is needed
- schedule worker jobs
- manage stale job invalidation

Should not:

- decide final visual policy beyond returning dimming factors

Current likely extraction source:

- `orbit-overlap-manager.js`

### `OrbitRenderSyncService`

Responsibility:

- take view state + style state + overlap factors
- apply final orbit line/SVG properties

This should be the only place where final orbit appearance is pushed into
rendered scene objects.

## 5. Craft Selection and Visibility

### `MissionCraftVisibilityService`

Responsibility:

- canonical visible craft ids
- active craft selection
- primary craft fallback rules

Should expose:

- pure selection/visibility decisions

Current likely extraction source:

- pure parts of `scene-craft-helpers.js`

### `MissionCraftRenderSyncService`

Responsibility:

- apply visible/active craft state to:
  - 3D craft visibility
  - orbit visibility
  - attached cameras/drones
  - 2D orbit visibility groups

This separates craft policy from craft scene mutation.

## D. Shell / Effect Modules

These should stay explicitly imperative.

### `MissionUiEffects`

Responsibility:

- DOM updates
- panel visibility
- info/status text

### `MissionSceneEffects`

Responsibility:

- Three.js object mutation
- D3 orbit group mutation
- helper visibility mutation

### `WorkerEffects`

Responsibility:

- worker creation
- worker message transport

### `ClockEffects`

Responsibility:

- timeouts
- intervals
- animation frame interactions

Current likely anchor:

- `src/platform/js/shell/time/clock-effects.js`

## Dependency Rules

## Allowed

- core domain -> nothing below it
- core state -> core domain
- application services -> core domain + core state + shell ports
- shell/effects -> browser, DOM, Three.js, D3, workers
- composition root -> everything

## Not Allowed

- core domain -> shell/effects
- core state -> DOM/scene mutation
- settings intent service -> direct Three.js/D3 mutation
- metadata services -> direct material mutation
- test helpers -> hidden production business logic

## Desired Replacements For Current Hotspots

### Replace `mission.js` with:

- `MissionAppBootstrap`
- `MissionBootstrapState`
- `MissionTimelineService`
- startup wiring only

### Replace `mission-state-store.js` with:

- `MissionSessionState`
- `MissionViewState`
- `MissionInteractionState`
- `MissionDataState`
- `MissionSceneRegistry`
- small explicit access ports where needed

### Replace `settings-actions.js` ownership with:

- `MissionSettingsService` for intent/state changes
- `MissionViewSyncService` for scene/DOM application

### Replace orbit-style blending spread with:

- `OrbitStyleResolver`
- `OrbitStyleMetadataService`
- `OrbitOverlapService`
- `OrbitRenderSyncService`

## Concrete Responsibility Table

| Module / Service | Owns | Does Not Own |
|---|---|---|
| `MissionAppBootstrap` | startup composition | business rules, scene sync |
| `MissionSessionState` | playback/session flags and time | DOM, scene mutation |
| `MissionViewState` | origin/dimension/view flags | DOM, scene mutation |
| `MissionSceneViewState` | per-scene plane/zoom/pan | global DOM state |
| `MissionDataState` | loaded ephemeris references/status | user view state |
| `MissionSceneRegistry` | scene/controller lookup | scene policy logic |
| `MissionSettingsService` | interpret UI intent into state changes | direct DOM/scene mutation |
| `MissionViewSyncService` | apply view state to renderers | UI input interpretation |
| `MissionTimelineService` | timeline model computation | dock DOM mutation |
| `TimelineDockEffects` | dock DOM mutation | timeline policy |
| `OrbitStyleResolver` | pure orbit style decisions | scene mutation |
| `OrbitStyleMetadataService` | metadata normalization/query | material mutation |
| `OrbitOverlapService` | overlap job lifecycle | final appearance policy |
| `OrbitRenderSyncService` | apply final orbit appearance | user settings interpretation |
| `MissionCraftVisibilityService` | craft visibility/active selection rules | scene mutation |
| `MissionCraftRenderSyncService` | apply craft visibility to scene | visibility policy |

## First Refactor Slice Against This Target

The first slice should be structural and low risk.

### Slice 1

- extract `MissionBootstrapState` from `mission.js`
- split `mission-state-store.js` into narrower ports
- stop flattening state + UI + clock effects into one object in runtime entry

Expected result:

- smaller composition root
- explicit runtime boundaries
- easier second slice for settings/orbit sync

### Slice 2

- split `settings-actions.js` into:
  - intent/state service
  - view sync service

### Slice 3

- split orbit-style modules into:
  - resolver
  - metadata service
  - overlap service
  - render sync

## Migration Strategy

- move code before rewriting behavior
- preserve current runtime/test behavior first
- keep legacy compatibility in explicit adapters
- replace broad `ctx` objects with narrower ports gradually

## Relationship To The Audit

See also:

- [refactor-audit.md](refactor-audit.md)

That document explains the current problems. This document defines the desired
destination.
