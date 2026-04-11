# System Design

This is the design index for the lunar mission app.  
All design-focused documents live under `docs/design/`.

## 1) Product Surfaces

- `index.html`: landing page with mission cards and launch entry points.
- `mission.html`: mission runtime shell (selector + 2D/3D visualization), with:
  - Header pill strip (`#header-pill-strip`) for quick mission/view controls.
  - Settings panel (`#settings-panel`) for full control coverage and advanced options.
  - Mission-specific overlay panels where needed. Artemis II currently adds:
    - `Flyby in Focus`: composer-style auxiliary camera panel
    - `Splashdown in Spotlight`: sidebar + `2D`/`3D` ground-track panel
- `orbit-data.html`: data-source coverage/audit view.
- `assets-status.html`: runtime asset-size/status view.

## 2) Runtime Architecture (High-Level)

### Functional core + imperative shell

- Core computations are isolated in pure/state-centric helpers where possible (`src/platform/js/core/*`).
- Imperative orchestration (DOM, rendering, event wiring, playback loop) is handled in app/shell modules (`src/platform/js/app/*`, controllers, UI actions).

### Main runtime layers

- State and domain:
  - `src/platform/js/scene-state.js`
  - `src/platform/js/core/state/*`
  - `src/platform/js/core/*`
- Data loading + interpolation:
  - `src/platform/js/data/*`
  - `src/platform/js/chebyshev.js`
- Rendering:
  - 2D controller and helpers (`src/platform/js/controllers/animation-2d-controller.js`)
  - 3D controller and helpers (`src/platform/js/controllers/animation-3d-controller.js`, `src/platform/js/rendering/*`)
- Orchestration/UI:
  - `src/platform/js/app/*`
  - `src/platform/js/ui/*`

### UI Control Synchronization Model

- The header pill strip and settings panel are synchronized UI surfaces over shared runtime state.
- `src/platform/js/ui/event-handlers.js` maps pill actions to canonical settings inputs and keeps active/pressed state synchronized both ways.
- `src/platform/js/ui/ui-state.js` remains the source for reading/applying view setting values consumed by runtime actions.
- Some pills also launch mission-specific panels instead of only toggling settings state.
  - Artemis II `Flyby` restores the `Flyby in Focus` auxiliary composer panel.
  - Artemis II `Splashdown` opens `Splashdown in Spotlight`.

## 3) Frame/Origin Model

Runtime supports:
- `geo` (Earth-centered inertial workflow)
- `lunar` (Moon-centered workflow)
- `relative` (URL mode, Earth->Moon axis-fixed frame)

Relative mode is URL-driven (`mode=relative`) and can trigger reload-based transitions with preserved timeline time.

Detailed design:
- [relative-mode.md](relative-mode.md)

## 4) Orbit Data Model

Mission config and manifests are mission-local:
- `assets/<mission>/data/config.json`
- `assets/<mission>/data/ephemeris-manifest.json`

Runtime ephemeris providers:
- `chebyshev`
- `npz`
- `astronomy`

Current default mission behavior uses Chebyshev for major bodies.

Chebyshev file format and semantics:
- [chebyshev-format-spec.md](chebyshev-format-spec.md)

## 5) Mission/Craft Model

- Multi-craft missions are modeled with `crafts[]` + `primaryCraftId`.
- Runtime visibility, labels, and timeline strips are craft-aware.
- Mission event buttons are config-driven with dynamic events (`now`, `<craft>DataEnd` style patterns).

Example event-sourcing deep dive:
- [chandrayaan1-event-sourcing.md](chandrayaan1-event-sourcing.md)

## 6) Visual Systems

- 2D view: SVG/D3 line/path rendering.
- 3D view: Three.js mesh/line/lighting pipeline.
- Orbit styles:
  - `Classic`
  - `Trail` (track + tail controls and style sidecars)
- Optional auxiliary camera panels for desktop multi-view workflows.
- Artemis II extends that panel system with two higher-level mission workflows:
  - `Flyby in Focus`
    - implemented in `src/platform/js/app/auxiliary-camera-views.js`
    - uses the composer-style panel shell and flyby-specific timeline window
  - `Splashdown in Spotlight`
    - implemented in `src/platform/js/app/ground-track-panel.js`
    - combines a left-hand timeline/event sidebar with either a Leaflet `2D` map or a Three.js `3D` globe
    - highlights the app-generated post-HORIZONS splashdown continuation separately from the public JPL segment

Rendering/UX design investigations:
- [moon-rendering-research-and-plan.md](moon-rendering-research-and-plan.md)
- [sun-rendering-earthrise-research.md](sun-rendering-earthrise-research.md)
- [orbit-ux-and-refactor-roadmap.md](orbit-ux-and-refactor-roadmap.md)
- [orion-procedural-model-generation.md](orion-procedural-model-generation.md)

## 7) Performance and Refactor Direction

Performance and architecture experiments:
- [performance-functional-core-experiments.md](performance-functional-core-experiments.md)

## 8) Data Boundary Design

App repo (`moon-mission`):
- runtime code, mission config, UI assets

Data repo (`moon-mission-data`):
- generated orbit artifacts and staged runtime media

Design intent: keep runtime code evolution independent from heavy generated asset churn.

## 9) Testing and Release Design Links

- Workflow guide (commands/CI/conventions): [../developer.md](../developer.md)
- Test strategy: [../testing.md](../testing.md)

---

When adding new design docs, place them under `docs/design/` and link them from this file.
