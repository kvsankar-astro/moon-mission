# Panel System V1 Spec

> Implementation note: the initial draft below references a floating `Panel Manager` panel. The current V1 direction is lighter: a header-level `Panels` menu plus minimized chips, while keeping the same underlying registry, lifecycle, and layout goals.

## Purpose

Unify the app's desktop panel experience under a single panel framework that supports:

- common window chrome and interaction behavior
- mission-defined default panels
- user-created view panels
- per-mission layout persistence
- a lightweight panel launcher for lifecycle control

This spec is desktop-only for v1.

## Goals

- All desktop panels share a common shell: border, header, title, info button, drag, resize, minimize, close, expand, z-order behavior.
- Default panels come from mission configuration rather than hardcoded UI assumptions.
- Users can create additional `View panels`.
- `View panels` have immutable identity defined by `origin/focus/follow/view/plane/dimension`.
- Panel layouts are saved and restored per mission.
- A `Panel Manager` panel lets users inspect, restore, close, create, and manage panels.

## Non-Goals

- Mobile panel system.
- Named/custom user-saved layouts across a single mission.
- Cross-mission shared layouts.
- Changing a view panel's identity after creation.
- Full docking/snapping/tiling system in v1.

## Panel Types

### 1. View panel

- Renders a mission scene view.
- Identity is the immutable `viewSignature`:
  - `origin`
  - `focus`
  - `follow`
  - `view`
  - `plane`
  - `dimension`
- Users may create new view panels from any valid signature.
- Users may rename them.
- Other mutable settings may vary per panel:
  - locators
  - orbit visibility
  - overlay visibility
  - labels
  - style/render toggles
  - similar per-view presentation state

### 2. Workflow panel

- Mission- or feature-specific panels that do not map cleanly to a view signature.
- Examples today:
  - `Flyby in Focus`
  - `Splashdown in Spotlight`
- These use the shared shell but own specialized internal UI and behavior.

### 3. Panels launcher

- V1 uses a lightweight `Panels` launcher in the header rather than a standalone manager panel.
- The launcher lists mission panels, shows their current state, and exposes restore/open/focus and info actions.
- A dedicated manager panel remains a possible later enhancement, but is out of scope for V1.

## Core Concepts

### Panel shell

- Shared outer frame and interactions.
- Responsible for:
  - title bar
  - panel title
  - info button
  - minimize
  - close
  - delete
  - expand/maximize
  - drag
  - resize
  - focus/z-order
  - persisted geometry

### Panel content

- The inner implementation for a specific panel type.
- Responsible for:
  - rendering
  - panel-specific controls
  - panel-specific state
  - interpreting panel identity/config

### Panel instance

- A concrete panel on screen.
- Has runtime and persisted state.

### Layout

- The set of panel instances for a mission, including:
  - which panels exist
  - which are open/minimized/closed
  - geometry
  - z-order
  - per-panel mutable settings

## Mission Configuration

Each mission may declare default built-in panel behavior in mission config.

Example shape:

```json
{
  "ui": {
    "panels": {
      "defaults": {
        "aux:earth": {
          "enabled": true,
          "defaultState": "open"
        },
        "aux:moon": {
          "enabled": true,
          "defaultState": "minimized"
        },
        "workflow:splashdown": {
          "enabled": true,
          "defaultState": "closed",
          "autoOpenBeforeEvent": true
        }
      }
    }
  }
}
```

Rules:

- Default panels are defined per mission.
- Built-in defaults are keyed by panel registry id.
- If no saved layout exists for a mission, initialize panel lifecycle state from mission config.
- Built-in panel availability can still be mission-conditional.

## Panel Identity and Renaming

For `View panels`:

- Identity is immutable and separate from display title.
- Users may rename the panel title freely.
- The immutable identity must always be inspectable via a shared `Panel Info` action in the shell.

`Panel Info` should show:

- panel type
- whether built-in or user-created
- for view panels, the full `viewSignature`
- optionally read-only internal id

This resolves the tension between user-friendly naming and exact technical identity.

## User Flows

### 1. Mission load

- Load mission config.
- Load saved mission layout if present.
- If absent or invalid, instantiate mission default panels.
- Open panels according to saved/default state.

### 2. Create new view panel

Recommended v1 UX:

- User configures the main/default view using existing controls.
- User clicks `Create View`.
- App opens a small creation dialog or panel:
  - prefilled from current main view signature
  - editable before creation
  - includes title field
  - includes `Create` action
- Result: a new user-created view panel is added to the current mission layout.

Notes:

- This supports "capture current view as a panel" while still allowing edits before creation.
- This action should be available from both the header and the `Panel Manager`.

### 3. Restore and manage panels

- User opens `Panel Manager`.
- Manager lists all panels for the current mission.
- User can:
  - show/open hidden panels
  - restore minimized panels
  - close panels
  - delete panels
  - inspect panel info
  - rename panels
  - create new view panels
  - reset mission layout

### 4. Minimize behavior

- Panel stays alive but leaves workspace view.
- It appears as a chip inside `Panel Manager`.
- `Panel Manager` is the guaranteed restore path.

### 5. Close behavior

- Panel is hidden but retained in the current mission layout.
- It can be reopened from `Panel Manager`.

### 6. Delete behavior

- `Delete` removes the panel from the current mission layout.
- This action should be available from both the shell and the `Panel Manager`.
- `Delete` should be destructive-looking and require confirmation.

Built-in panels:

- `Delete` removes that instance from the current mission's saved layout.
- The panel remains re-addable from `Panel Manager` under an `Available Mission Panels` section.
- `Reset Layout` restores it.

User-created view panels:

- `Delete` removes them from the current mission layout entirely.

`Panel Manager` exception:

- It may be minimized or closed to a chip.
- It should not be deletable.

### 7. Expand behavior

- Temporary enlarged/maximized workspace mode.
- Does not alter panel identity.
- Restoring exits to previous geometry.

## Panel Manager Requirements

The manager must:

- list all current mission panels
- distinguish built-in vs user-created
- show open/minimized/hidden state
- expose actions:
  - open/restore
  - minimize
  - close
  - delete
  - rename
  - info
  - create view
  - reset layout

Recommended sections:

- `Open Panels`
- `Minimized`
- `Closed`
- `Available Mission Panels`

Recommended row contents:

- title
- type badge
- state badge
- info button
- action buttons

## Layout Persistence

Scope:

- per mission only
- desktop only

Persistence includes:

- panel instances
- panel type/kind
- panel title
- built-in vs user-created
- visibility state:
  - open
  - minimized
  - hidden
  - maximized
- geometry:
  - x
  - y
  - width
  - height
- z-order
- per-panel mutable settings
- for view panels, immutable `viewSignature`

Suggested storage key:

```text
moon-mission:panel-layout:v1:<missionKey>
```

Rules:

- Save on meaningful layout changes with debounce.
- Clamp offscreen panels on load and on resize.
- If persisted layout is invalid or partially incompatible, recover gracefully:
  - keep valid panels
  - rebuild missing defaults as needed

## Data Model

Suggested runtime model:

```ts
type PanelKind = "view" | "workflow" | "manager";

type ViewSignature = {
  origin: string;
  focus: string;
  follow: string;
  view: string;
  plane: string;
  dimension: string;
};

type PanelFrameState = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  hidden: boolean;
  maximized: boolean;
};

type PanelInstance = {
  id: string;
  kind: PanelKind;
  panelType: string;
  builtIn: boolean;
  title: string;
  frame: PanelFrameState;
  viewSignature?: ViewSignature;
  contentState?: Record<string, unknown>;
};
```

Interpretation:

- `kind` is high-level category.
- `panelType` is implementation key, like `view`, `flyby-focus`, `splashdown`, `panel-manager`.
- `contentState` stores mutable per-panel settings.

## Validation Rules

For `View panels`:

- `viewSignature` must be valid for current mission/runtime.
- Validation checks:
  - origin allowed
  - dimension allowed
  - plane allowed
  - focus/follow/view combination supported
- Invalid signatures should not crash restore.

Preferred v1 behavior:

- Keep the row in `Panel Manager` with an unavailable state and a reason if feasible.
- Otherwise drop the panel gracefully and rebuild defaults as needed.

## Shared Panel Shell Requirements

Visual consistency across all panel types:

- same border language
- same title bar layout
- same button placement and styles
- same drag affordance
- same resize affordance
- same focus treatment
- same spacing, radius, and shadow tokens

Functional consistency:

- click brings panel to front
- drag from title bar
- resize from shell edge/corner
- keyboard-focusable controls
- shell buttons have consistent meaning everywhere

Shared shell controls:

- title
- info
- minimize
- expand
- close
- delete

Recommended v1 info behavior:

- the shell owns one shared info UI
- every panel's `Info` button opens the same style of info popover/panel
- the shell always shows standard fields:
  - title
  - panel type
  - built-in vs user-created
  - internal id
- for `View panels`, it also shows the full immutable `viewSignature`
- for `Workflow panels`, it shows the canonical workflow/panel kind
- panel content may optionally append extra read-only fields, but the container and structure stay common

## Implementation Direction

Current code suggests three migration targets:

- auxiliary camera panels in `src/platform/js/app/auxiliary-camera-views.js`
- splashdown panel in `src/platform/js/app/ground-track-panel.js`
- legacy dialog/settings/info surfaces

Recommended refactor direction:

1. Introduce a generic `PanelManager` runtime module.
   - owns registry of panel instances
   - owns persistence
   - owns z-order
   - owns panel lifecycle
2. Introduce a reusable `PanelShell`.
   - shared DOM/CSS creation
   - shared drag/resize/minimize/maximize/close/delete behavior
3. Convert existing auxiliary camera panels.
   - map current preset panels into built-in panels
   - move their frame behavior into shared shell
   - keep their specialized render content as panel content
4. Convert splashdown panel.
   - keep internal content module
   - remove duplicate shell/drag/layout code
   - register it as a workflow panel
5. Add `Panel Manager` panel.
   - initial lifecycle surface
6. Add `Create View` flow.
   - seed from current main view
   - create user panel instance
   - persist immediately

## V1 Defaults

For a mission with configured defaults:

- built-in default panels are created from mission config
- layout starts from config if no saved state exists
- `Panel Manager` exists by default but may start hidden or minimized
- mobile path is ignored for this system

## Open Questions

- Should shell `Close` on user-created panels always hide rather than delete, even though `Delete` is also present?
- Should minimized panels also appear as external chips outside `Panel Manager` in addition to the manager chip list?
- Should `Create View` use a dialog, an inline mini-form in `Panel Manager`, or both?

## Acceptance Criteria

- A mission can define its default desktop panels in config.
- On first load, those panels appear with consistent shared shell styling and behavior.
- The user can drag, resize, minimize, expand, close, delete, and restore all desktop panels consistently.
- The user can create a new view panel from a valid view signature.
- The new view panel preserves immutable identity and separate user-editable title.
- The user can inspect panel identity through a common shell `Info` action.
- The app restores the same panel layout when reloading the same mission.
- Splashdown and existing auxiliary view panels participate in the same panel framework.
- `Panel Manager` can manage the lifecycle of all panels in the mission.
