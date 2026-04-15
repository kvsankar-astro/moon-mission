# Mobile Experience V1 Spec

## Objective

Redesign the mobile mission experience to be scene-first, readable, and touch-friendly, while keeping desktop behavior unchanged.

This spec applies to the long-running branch:

- `feature/mobile-experience`

## Design Direction

Use a **bottom navigation + focused card screens** model (not carousel-only, not long-scroll-only).

Rationale:

- Better discoverability than carousel-only.
- Lower cognitive load than showing all controls at once.
- Easier to map mission workflows to predictable destinations.

## Information Architecture

Mobile has 4 primary tabs:

1. `Mission`
2. `Orbit`
3. `Views`
4. `Compose`

### 1) Mission Tab

Purpose: status and timeline comprehension first.

Contains:

- Info card (phase, elapsed time, key metrics)
- Event countdown / next milestone
- Compact timeline scrubber
- Minimal play controls (Play/Pause, speed, realtime)

### 2) Orbit Tab

Purpose: primary orbit exploration.

Contains:

- One orbit card with mode switch: `2D | 3D`
- Origin controls: `Earth | Moon | Relative`
- Axes controls: show/hide essentials only
- Advanced toggles moved behind `More`

### 3) Views Tab

Purpose: camera composition use cases.

Contains sub-cards (swipe or segmented switch within tab):

- `Craft -> Earth`
- `Craft -> Moon`
- `Earth -> Moon`

Notes:

- Only one sub-view actively rendering at a time.
- Others stay paused/snapshot to reduce thermal/load pressure.

### 4) Compose Tab

Purpose: advanced composition workflows.

Contains:

- `Earth Rise Composer` entry and related controls

Note:

- Feature-gated until composer integration lands from its worktree.

## Control Density Rules

- Keep always-visible controls minimal per tab.
- Move secondary toggles to a single `More` sheet/drawer.
- Do not duplicate the full desktop control panel on mobile.

## Interaction Rules

- Minimum touch target size: `44px`.
- Primary actions reachable with one thumb.
- Predictable close/back behavior for overlays.
- No hidden critical actions behind gesture-only discovery.

## Artemis II Special Panels

Artemis II currently carries two mission-specific overlay workflows in addition to the generic mobile shell:

- `Flyby in Focus`
  - launched from the `Flyby` focus pill
  - presents the lunar flyby composer workflow instead of a generic camera card
- `Splashdown in Spotlight`
  - launched from the `Splashdown` focus pill
  - auto-opens on initial Artemis II load
  - uses a full-height left-hand timeline/event sidebar and a right-hand `2D` map / `3D` globe viewport
  - keeps second-level (`-1s`, `+1s`) and minute-level (`-1m`, `+1m`) transport controls
  - shows RTC-3 through splashdown return events, dual-unit metrics, and a provenance note for the app-generated final descent

Mobile implementations should preserve the same workflow meaning as desktop for these panels, even if the exact placement and sizing rules differ.

## Rendering/Performance Rules

- Single active heavy renderer at a time (especially in `Views`).
- Defer non-visible panels.
- Avoid expensive continuous updates for off-screen components.

## Visual Principles

- Scene-first composition (canvas remains dominant).
- Readability over density (higher hierarchy contrast).
- Stable footer/nav zones to reduce accidental input.

## Rollout Slices

### Slice A: Shell + Navigation

- Mobile bottom nav scaffold
- Tab routing/state
- Placeholder cards

### Slice B: Mission + Orbit Core

- Mission card + compact timeline
- Orbit tab with 2D/3D and origin/axes essentials

### Slice C: Views

- Three camera view sub-cards
- Single-active-render policy

### Slice D: Compose Integration

- Earth Rise Composer tab integration (feature-flagged until ready)

### Slice E: Polish + QA

- Accessibility pass
- Touch ergonomics pass
- Mobile SSIM-safe verification strategy and smoke tests

## Acceptance Criteria (V1)

- Mobile view no longer presents dense desktop-style control rows.
- User can complete core workflows from tab structure without opening settings.
- Runtime remains smooth on mid-tier mobile hardware.
- Desktop layout and behavior remain unaffected.
