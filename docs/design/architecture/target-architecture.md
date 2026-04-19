# Target Architecture

This document is the single source of truth for runtime architecture and
refactor planning in `moon-mission`.

It replaces the older split between `refactor-audit.md`, earlier revisions of
this document, and the runtime-refactor sections that used to live in the
orbit roadmap. It is grounded in the current codebase as of
`2026-04-19`.

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
2. `mission.js` creates legacy state and the small runtime stores, then
   delegates playback bootstrap to `app/mission-entry-composition.js`, scene
   assembly to `app/mission-scene-composition.js`, runtime root assembly to
   `app/mission-runtime-root.js`, legacy mutable/readonly binding shaping to
   `app/mission-legacy-state-bindings.js`, and the legacy state-cell
   compatibility bridge to `app/mission-state-access.js`.
3. `app/mission-playback-coordination.js` now owns the timeline dock, active
   craft control sync, transport-state sync, and the related planner/shell
   split, while `app/mission-entry-composition.js` owns the event bus and
   animation-controller bootstrap that used to be inline in `mission.js`.
4. `app/mission-app.js` wires browser events and kicks off
   `handlers.initAnimation({ reset: true })`.
5. `app/mission-runtime-handlers-entry.js` delegates startup to
   `app/init-orchestration.js`, which now uses
   `app/startup-animation-plan.js` for boot-time policy.
6. `app/mission-runtime-entry-deps.js`,
   `app/mission-runtime-wireup-deps.js`, and
   `app/runtime-bootstrap-deps.js` build explicit runtime dependency shapes
   before startup and bootstrap orchestration run.
7. `app/init-orchestration.js` and `app/runtime-init.js` initialize config,
   scenes, controls, orbit data, and landing data, then start the RAF loop.
8. Per-frame work flows through `app/scene-frame-orchestration-actions.js`,
   which now uses `app/scene-frame-plan.js`,
   `app/transient-active-event-tracker.js`, and
   `core/plans/frame-plan.js` before applying render and UI intents through
   shell adapters.

### Current layers

| Layer | Current anchors | Notes |
|---|---|---|
| Page shell | `mission.html`, `mission.js`, `app/mission-app.js`, `ui/event-handlers.js` | Browser bootstrap still starts here, but `mission.js` is now mostly top-level composition plus legacy bootstrap setup, and `ui/event-handlers.js` mostly binds together dedicated controllers and grouped control-binding helpers |
| Composition and runtime assembly | `app/mission-runtime-root.js`, `app/mission-runtime-root-context.js`, `app/mission-entry-composition.js`, `app/mission-scene-composition.js`, `app/mission-runtime-handlers-entry.js`, `app/mission-runtime-wireup-entry.js`, `app/mission-runtime-entry.js`, `app/mission-runtime-wireup-deps.js`, `app/mission-runtime-entry-deps.js`, `app/mission-wiring-composition.js`, `app/runtime-bootstrap-actions.js`, `app/runtime-bootstrap-deps.js`, `app/mission-state-access.js`, `app/mission-state-cell-groups.js`, `app/mission-legacy-state-bindings.js` | Clearer dependency builders now exist, playback and scene assembly moved out of `mission.js`, runtime root glue is isolated, legacy state binding maps have their own seam, and handler/wireup entry-context shaping has its own seam; the remaining broad composition pressure is mostly in compatibility/state access |
| Domain and planning core | `core/domain/*.js`, `core/plans/frame-plan.js`, `scene-state.js`, `data/relative-frame-provider.js`, `app/view-application-plan.js`, `app/scene-frame-plan.js`, `app/startup-animation-plan.js` | Strongest functional-core foundation in the repo and the area with the clearest recent refactor wins, now including scene-view transform resolution and control-panel/timeline presentation rules |
| State ports | `core/state/runtime-view-state.js`, `runtime-session-state.js`, `runtime-interaction-state.js`, `runtime-loop-state.js`, `app/scene-view-state.js` | Small stores are good; `scene-view-state.js` now reads scene state first through core helpers, but mirrored legacy writes still make it a transitional compatibility bridge |
| Data and integration | `data/mission-data.js`, `data/cached-resource-loader.js`, `data/ephemeris-provider.js`, `chebyshev.js` | Boundary between pure asset/config resolution and fetch/cache/provider work is much better than before, and generic cache mechanics now have their own seam, but `mission-data.js` still combines mission-specific loader entrypoints with runtime loading concerns |
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
- `core/domain/mission-config-assembly.js`
- `core/domain/ephemeris-manifest.js`
- `core/domain/transient-active-event.js`
- `core/domain/phase-indicator-state.js`
- `core/domain/earth-craft-moon-angle.js`
- `core/domain/scene-view-state-core.js`
- `core/domain/control-panel-timeline-state.js`
- `core/domain/mobile-view-preset-state.js`
- `core/domain/mobile-compose-lock-state.js`
- `core/domain/mobile-compose-timeline-state.js`
- `core/domain/mobile-compose-controls-state.js`
- `core/domain/mobile-shell-tab-state.js`
- `core/domain/mobile-view-fov-state.js`
- `core/domain/mobile-moon-visibility-state.js`
- `core/domain/mobile-shell-layout-state.js`
- `core/plans/frame-plan.js`

### Pure application planners

- `app/view-application-plan.js`
- `app/scene-frame-plan.js`
- `app/startup-animation-plan.js`

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
- `app/scene-telemetry-ui-actions.js`
- `app/scene-phase-ui-actions.js`
- `app/scene-active-event-ui-actions.js`
- `ui/settings-panel-controller.js`
- `ui/keyboard-shortcuts-controller.js`
- `ui/desktop-chrome-autohide.js`
- `ui/header-blurb-controller.js`
- `ui/header-pill-strip-controller.js`
- `ui/camera-pill-controller.js`
- `ui/plane-pill-controller.js`
- `ui/view-settings-pill-controller.js`
- `ui/focus-pill-controller.js`
- `ui/control-panel-timeline-controller.js`
- `ui/main-control-bindings.js`
- `ui/mobile-transport-sync.js`
- `ui/mobile-view-preset-sync.js`
- `ui/mobile-compose-lock-sync.js`
- `ui/mobile-compose-timeline-sync.js`
- `ui/mobile-compose-controls-sync.js`
- `ui/mobile-shell-tab-sync.js`
- `ui/mobile-view-fov-sync.js`
- `ui/mobile-moon-visibility-sync.js`
- `ui/mobile-shell-layout-sync.js`

### Healthier coordination seams

- `app/mission-playback-coordination.js`
- `app/runtime-ui-control-groups.js`

### Healthier composition seams

- `app/mission-runtime-root.js`
- `app/mission-runtime-root-context.js`
- `app/mission-entry-composition.js`
- `app/mission-scene-composition.js`
- `app/mission-legacy-state-bindings.js`

### Focused integration helpers

- `data/cached-resource-loader.js`

### Strong transitional seam

- `scene-state.js` is already written as a functional-core module, even though
  it still depends on provider modules from `data/*`.
- `app/mission-state-access.js` now isolates the legacy compatibility cell map
  from `mission.js`, and `app/mission-state-cell-groups.js` now isolates the
  runtime view/session/interaction buckets inside that bridge, even though the
  public compatibility surface is still broader than the end-state port model.

## Current Boundary Leaks

These are the main places where concerns are still mixed.

### `mission.js`

`mission.js` is now materially thinner than the older docs implied, but it is
still a transitional bootstrap root. It currently mixes:

- legacy state creation
- runtime store creation
- closure-based access to legacy bootstrap state
- final top-level composition
- global exposure and remaining browser bootstrap glue

It is no longer the place where playback bootstrap, scene-entry dependency
bags, runtime-root wrapper glue, or the bulky legacy binding maps live, and
that is real progress. The remaining target is for it to converge toward page
bootstrap, legacy-state setup, and minimal composition only.

### `core/state/mission-state-store.js`

This is no longer one of the main architecture risks.

It is now a thin compatibility wrapper around explicit port builders and a
legacy flattener. The remaining issue is not the file itself, but that some
runtime consumers still depend on the flattened compatibility surface exposed
through `app/mission-state-access.js`.

### `app/mission-state-access.js`

This is a useful transitional seam because the legacy compatibility map no
longer lives in `mission.js`.

It is healthier than it used to be: local state-cell assembly lives here now,
the older dead shim layer is gone, and the runtime view/session/interaction
groups now live in `app/mission-state-cell-groups.js` instead of being inlined
inside the compatibility bridge.

The remaining leak is that it still exposes a broad compatibility surface
because runtime consumers still depend on the generic state-cell contract. The
target is to keep shrinking this bridge as explicit ports replace generic
cells.

### `app/settings-actions.js`

This seam is healthier than it used to be. `view-application-plan.js` and
`scene-view-plan-application.js` now carry much of the planning and effect
application split, and `settings-actions.js` is mostly orchestration.

The remaining leak is that view-setting changes still fan out through broader
runtime wiring and shared bridges instead of a smaller dedicated settings
service surface.

### `app/scene-view-state.js`

This is materially better than it was.

Plane and transform reads now flow through `core/domain/scene-view-state-core.js`,
and zoom/pan reads are scene-first instead of legacy-global-first.

The remaining transitional behavior is that writes still mirror into legacy
globals and plane compatibility paths still exist for older consumers. The
true source of truth is much clearer now, but not completely isolated yet.

### `app/scene-frame-orchestration-actions.js`

This seam is much better than it was. `scene-frame-plan.js` now owns frame-plan
input assembly, and `transient-active-event-tracker.js` owns transient event
latching.

The remaining rule is to keep this module thin. It should stay a bridge from
plan to effects and should not grow back into a place that owns calculations or
UI policy.

### `app/init-orchestration.js`

Startup policy is also in better shape than before because
`startup-animation-plan.js` now owns the boot-time decision tree.

The remaining mixed concerns are:

- polling for orbit-data readiness
- timeout scheduling for view reapplication
- startup control re-enable behavior
- camera/view settling order

This is no longer one of the worst seams, but it still needs to stay on the
application-service side of the boundary and avoid reabsorbing policy logic.

### `app/scene-ui-update-actions.js`

This seam is now much healthier than it was.

Telemetry, phase, and active-event rendering now live in:

- `app/scene-telemetry-ui-actions.js`
- `app/scene-phase-ui-actions.js`
- `app/scene-active-event-ui-actions.js`

and the remaining `scene-ui-update-actions.js` surface is mostly a composition
wrapper across those smaller UI shells.

The remaining cleanup is to decide whether that wrapper stays as a small
composition seam or disappears into `scene-frame-ui-actions.js`. Either way, it
is no longer one of the major architecture blockers.

### `app/runtime-ui-controls.js`

This seam is healthier than it was.

`app/runtime-ui-control-groups.js` now splits:

- navigation and repeat-button handling
- lock actions
- camera actions
- mode and landing toggles
- moon render profile actions
- burn actions

The remaining leak is that `app/runtime-ui-controls.js` still flattens those
concerns into one runtime control surface for legacy consumers. It should keep
moving toward grouped adapters with narrower consumers instead of rebuilding a
broad controller hub.

### `data/mission-data.js`

This file mixes multiple concerns:

- fetch and cache
- generic cached resource loading
- config profile overlay loading
- manifest loading
- config normalization and validation
- runtime asset URL resolution

The pure config profile/source rules now have an explicit home in
`core/domain/mission-data-resolvers.js`, config assembly now lives in
`core/domain/mission-config-assembly.js`, generic cache mechanics now live in
`data/cached-resource-loader.js`, and asset-path resolution already leans on
`core/domain/mission-asset-resolver.js`.

The remaining work is to keep `mission-data.js` focused on runtime loading and
mission-specific entrypoints instead of letting more generic loader concerns or
data-policy logic drift back into it.

### `ui/event-handlers.js`

This is no longer one of the main architecture blockers.

It now delegates most of the shell surface into smaller adapters such as:

- `ui/settings-panel-controller.js`
- `ui/keyboard-shortcuts-controller.js`
- `ui/desktop-chrome-autohide.js`
- `ui/header-blurb-controller.js`
- `ui/header-pill-strip-controller.js`
- `ui/camera-pill-controller.js`
- `ui/plane-pill-controller.js`
- `ui/view-settings-pill-controller.js`
- `ui/focus-pill-controller.js`
- `ui/main-control-bindings.js`
- `ui/mobile-transport-sync.js`
- `ui/mobile-view-preset-sync.js`
- `ui/mobile-compose-lock-sync.js`
- `ui/mobile-compose-timeline-sync.js`
- `ui/mobile-compose-controls-sync.js`
- `ui/mobile-shell-tab-sync.js`
- `ui/mobile-view-fov-sync.js`
- `ui/mobile-moon-visibility-sync.js`
- `ui/mobile-shell-layout-sync.js`

The remaining mixed concerns are now more concentrated:

- a few final top-level button bindings
- some bootstrap-level control wiring around already-extracted controllers

At this point it is acting like the composition file it was supposed to become.
The remaining work is minor cleanup, not a major breakup campaign.

### Runtime composition chain

The chain through:

- `mission.js`
- `mission-runtime-root.js`
- `mission-entry-composition.js`
- `mission-scene-composition.js`
- `mission-runtime-wireup-entry.js`
- `mission-runtime-entry.js`
- `mission-runtime-wireup-config.js`
- `mission-runtime-wireup.js`
- `mission-runtime-static-deps.js`
- `mission-runtime-handlers-entry.js`
- `mission-wiring-composition.js`
- `runtime-bootstrap-actions.js`

does create structure, and it is now noticeably clearer than it was when
`mission.js` owned most of that wiring inline. It still relies on repeated
remapping of large dependency sets, though, especially around state access and
runtime bootstrap. The next stage needs to simplify ownership instead of adding
more wrapper layers.

## Progress Snapshot

As of `2026-04-19`, the repo is roughly `97-98%` of the way to the target
architecture.

What has improved materially:

- runtime composition now uses explicit dependency builders more often instead
  of one giant runtime bag
- bootstrap and startup decision logic have dedicated planner-style modules
- runtime UI control composition has grouped builders instead of one broad
  inline control bucket
- mission playback coordination moved out of `mission.js`, with explicit dock
  and craft-control planners plus a smaller UI shell
- runtime root assembly now lives in `app/mission-runtime-root.js` instead of
  being hand-wired inline in `mission.js`
- playback bootstrap now lives in `app/mission-entry-composition.js`, so event
  bus creation, animation-controller wiring, and startup transport sync are no
  longer owned directly by `mission.js`
- scene-entry dependency assembly now lives in
  `app/mission-scene-composition.js`, which also owns the render bridge and
  scene-only imports
- the legacy state-cell compatibility map now lives in
  `app/mission-state-access.js` instead of `mission.js`
- `mission-state-access.js` now also owns local state-cell bucket assembly, so
  `mission.js` no longer hand-builds each legacy cell inline
- legacy mutable and readonly bootstrap binding maps now live in
  `app/mission-legacy-state-bindings.js` instead of the middle of `mission.js`
- runtime view/session/interaction compatibility buckets now live in
  `app/mission-state-cell-groups.js`, keeping `mission-state-access.js`
  thinner and more obviously transitional
- view application has a clearer plan/apply split
- frame orchestration now preserves the functional-core boundary longer in the
  hot path
- several frame/UI calculations already live in small pure helpers
- scene telemetry UI planning now lives in
  `core/domain/scene-telemetry-ui-state.js`, with
  `app/scene-telemetry-ui-actions.js` owning the shell-side rendering and
  unit-control binding
- phase and active-event updates now have their own shell adapters in
  `app/scene-phase-ui-actions.js` and
  `app/scene-active-event-ui-actions.js`, leaving
  `app/scene-ui-update-actions.js` mostly as composition
- the mobile shell surface is now split into dedicated adapters for transport,
  presets, compose lock, compose timeline, compose controls, tab state, FoV,
  moon visibility, and layout
- the mobile shell now also has matching pure helpers for preset selection,
  compose lock, compose timeline, compose controls, tab transitions, FoV,
  moon visibility, and layout math
- header chrome behavior is split into dedicated shell controllers for desktop
  autohide, the header blurb, and the pill strip
- camera follow/view pill behavior and plane preset release behavior now live
  in dedicated controllers instead of the middle of `ui/event-handlers.js`
- shared origin/dimension/toggle/landing/locator/orbit-label behavior now
  lives in `ui/view-settings-pill-controller.js`
- Artemis flyby/splashdown focus affordances now live in
  `ui/focus-pill-controller.js`
- control-panel height, timeline-dock height, carousel presentation, and
  upcoming-event selection policy now live in
  `core/domain/control-panel-timeline-state.js`, with the shell binding in
  `ui/control-panel-timeline-controller.js`
- mission config profile/source logic now has a dedicated pure seam in
  `core/domain/mission-data-resolvers.js`, leaving `mission-data.js` more
  clearly responsible for runtime loading and caches
- mission config profile/manifest assembly now lives in
  `core/domain/mission-config-assembly.js`
- generic cached mission-data loaders now share a dedicated helper in
  `data/cached-resource-loader.js`
- scene view transform reads now flow through
  `core/domain/scene-view-state-core.js`, and `app/scene-view-state.js` now
  reads scene state before falling back to legacy globals
- runtime handler and wireup entry-context shaping now lives in
  `app/mission-runtime-root-context.js` instead of being assembled inline in
  `mission.js`
- `ui/event-handlers.js` is now acting much more like a composition file that
  binds together smaller shell features instead of directly owning most of
  their state machines
- main control controller creation, bind order, and raw DOM hookup now live in
  `ui/main-control-bindings.js` instead of the middle of
  `ui/event-handlers.js`

What still dominates the remaining risk:

- `data/mission-data.js`
- `app/mission-state-access.js` and the remaining broad compatibility surface
- the final legacy/bootstrap residue in `mission.js`
- mirrored legacy compatibility paths in `app/scene-view-state.js`

Progress by refactor slice:

| Slice | Status | Notes |
|---|---|---|
| 1. split the state facade | essentially done | narrow runtime stores exist, `mission-state-access.js` owns compatibility, `mission-state-cell-groups.js` owns the runtime compatibility buckets, and `mission-state-store.js` is only a thin wrapper; the remaining work is shrinking the compatibility contract itself when future features touch it |
| 2. separate settings intent from effects | in progress | view planning/application split landed, but settings still fan out through wider runtime wiring |
| 3. finish the frame pipeline split | close to done | `frame-plan.js`, transient event planning, `scene-frame-plan.js`, and the scene telemetry/phase/event UI split are all in place; the remaining work is mostly final composition cleanup rather than core logic extraction |
| 4. make scene view state truly scene-scoped | close to done | structure exists, transform reads are scene-first, and the remaining work is mostly isolating mirrored legacy compatibility paths |
| 5. collapse redundant composition layers | essentially done | runtime wiring, root assembly, playback bootstrap, scene composition, legacy binding maps, state-access builders, and root-context shaping are all thinner; the remaining broad surfaces are mostly intentional compatibility bridges |
| 6. split data loading from data normalization | close to done | pure config/source helpers, config assembly, and generic cached loader mechanics now have explicit seams; the remaining work is deciding whether any further split in `mission-data.js` would reduce real coupling or just add indirection |
| 7. break up large shell modules | essentially done | `mission.js` is much smaller, the scene/UI shell is decomposed, and `ui/event-handlers.js` now behaves like a composition seam rather than a controller hub |

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
- `core/domain/scene-telemetry-ui-state.js`

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

Status: in progress

Goals:

- turn `mission-state-store.js` into explicit ports
- stop flattening state, UI, and clock effects into one `stateAccess` object
- keep moving state-cell exposure behind dedicated builders instead of
  `mission.js`

Expected result:

- clearer ownership
- simpler runtime wiring
- better seams for the settings and frame work

### Slice 2: separate settings intent from effects

Status: in progress

Goals:

- keep view-setting interpretation in a settings service
- move SVG, Three.js, sky, helper, and orbit sync into effect modules

Likely source:

- `app/settings-actions.js`
- `app/view-application-plan.js`
- `app/scene-view-plan-application.js`

Expected result:

- settings become state-driven
- rendering side effects become easier to test and change

### Slice 3: finish the frame pipeline split

Status: in progress

Goals:

- keep `frame-plan.js` pure
- extract transient event, telemetry, and event text calculations into pure
  helpers
- keep `frameRenderer` and `frameUiUpdater` as the only direct effect adapters

Likely sources:

- `app/scene-frame-orchestration-actions.js`
- `app/scene-frame-plan.js`
- `app/scene-ui-update-actions.js`

Expected result:

- cleaner per-frame reasoning
- easier performance tuning
- easier UI testing without full scene mutation

Current note:

- the scene telemetry/phase/event UI split is now in place
- the remaining work is mostly deciding how small the final composition wrapper
  should be around those adapters

### Slice 4: make scene view state truly scene-scoped

Status: lightly started

Goals:

- move legacy zoom/pan/plane fallback behind an explicit compatibility adapter
- make scene-scoped state the real source of truth

Likely source:

- `app/scene-view-state.js`

Expected result:

- fewer hidden globals
- cleaner origin and dimension switching

### Slice 5: collapse redundant composition layers

Status: in progress

Goals:

- simplify the runtime entry and wireup chain
- reduce repeated remapping of large dependency bags
- make ownership explicit across bootstrap, wiring, and runtime services

Likely sources:

- `app/mission-runtime-root.js`
- `app/mission-entry-composition.js`
- `app/mission-scene-composition.js`
- `mission.js`
- `app/mission-runtime-wireup-entry.js`
- `app/mission-runtime-entry.js`
- `app/mission-runtime-entry-deps.js`
- `app/mission-runtime-wireup-config.js`
- `app/mission-runtime-wireup-deps.js`
- `app/mission-wiring-composition.js`
- `app/runtime-bootstrap-actions.js`
- `app/runtime-bootstrap-deps.js`
- `app/init-orchestration.js`
- `app/startup-animation-plan.js`

Expected result:

- fewer indirection layers
- composition root that is easier to understand and change

### Slice 6: split data loading from data normalization

Status: partially prepared

Goals:

- keep config and manifest logic in pure domain modules
- make `mission-data.js` a smaller integration module focused on fetch/cache
- keep URL resolution manifest-driven

Expected result:

- a cleaner app/data boundary
- easier testing of config, manifest, and loader behavior independently

### Slice 7: break up large shell modules

Status: well underway

Goals:

- keep decomposing `ui/event-handlers.js`
- reduce `mission.js` to bootstrap and top-level coordination only
- keep mission-specific UI features isolated from reusable shell code

Expected result:

- smaller UI change surface
- less incidental coupling between controls, layout, and mission-specific
  behavior

## Remaining Work

The planned architecture work is effectively complete. What remains is optional
follow-on cleanup when future product changes naturally touch these seams.

### Optional follow-on A: keep shrinking the compatibility surface

Likely touch points:

- `app/mission-state-access.js`
- `app/mission-state-cell-groups.js`
- `mission.js`

Goal:

- replace broad state-cell consumers with narrower ports when those callers are
  touched anyway
- keep `mission.js` at legacy bootstrap and top-level composition only

### Optional follow-on B: only split `mission-data.js` further if coupling returns

Likely touch points:

- `data/mission-data.js`
- `data/cached-resource-loader.js`

Goal:

- keep `mission-data.js` as the mission-specific facade
- leave generic cached loader behavior in dedicated helpers
- avoid adding more layers unless a real concern boundary starts drifting again

### Optional follow-on C: keep shell composition thin

Likely touch points:

- `ui/event-handlers.js`
- `app/runtime-ui-controls.js`

Goal:

- keep these files acting as bind/composition seams
- avoid rebuilding broad grouped control surfaces where narrower adapters
  already exist

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
