# Camera State Transition Spec

## Purpose

Define an explicit camera interaction model that prevents ambiguous state carry-over between:

- `free`
- `follow(target)`
- `view(from,to)`

This spec is implementation-oriented and exists to prevent the recent class of bugs where:

- semantic `A->B` views leaked offsets into `free` or `follow`
- `follow(target)` entered a degenerate camera/target relationship
- FoV controls remained active outside the modes they semantically belong to
- wheel/manual/auto FoV state drifted out of sync

## Scope

This document covers:

- runtime camera mode definitions
- required state shape
- permitted transitions
- transition-side effects
- invariants
- UI enablement rules
- transition test coverage

This document does not define rendering internals or panel-specific layout.

## Canonical Modes

Exactly one mode is active at a time.

### `free`

User-controlled exploratory camera with no semantic attachment to a target pair.

Properties:

- camera position is independent
- look target is independent
- no mounted source body
- no semantic `from/to` meaning

### `follow(target)`

Camera follows a single target while preserving a nonzero camera-target separation.

Allowed targets for v1:

- `earth`
- `moon`
- `craft`

Properties:

- one semantic target
- no semantic source body
- camera may orbit around the followed target
- follow offset is owned by follow mode only

### `view(from,to)`

Semantic source-to-target mounted view.

V1 allowed pairs:

- `earth -> moon`
- `moon -> earth`
- `craft -> moon`
- `craft -> earth`

Properties:

- camera is mounted at the center of `from`
- camera looks toward `to`
- mounted offset must be zero on entry
- FoV controls are enabled only in this mode

## Required Runtime State

The camera state model must have one explicit source of truth:

```ts
type CameraMode =
  | { kind: "free" }
  | { kind: "follow"; target: "earth" | "moon" | "craft" }
  | {
      kind: "view";
      from: "earth" | "moon" | "craft";
      to: "earth" | "moon" | "craft";
    };
```

Derived/controller state such as mount offsets, follow offsets, orbit-control targets, and auto-FoV internals must not be treated as the authoritative mode.

## Invariants

These rules must hold after every transition and after every user interaction.

### Global

- Exactly one camera mode is active.
- UI selection is derived from camera mode, not vice versa.
- Mode entry must fully initialize any mode-owned state.
- Mode exit must not leak mode-owned state into the next mode.

### `free`

- No mounted source-body offset is active.
- No follow offset is active.
- Camera and look target must define a valid non-degenerate view direction.

### `follow(target)`

- Follow target must be valid and resolvable.
- Camera-target separation must be strictly greater than zero.
- Entering follow mode must not inherit mounted `view(from,to)` offsets.
- Switching follow targets must reinitialize follow state for the new target.

### `view(from,to)`

- `from != to`
- `(from,to)` must be in the allowed pair set for the current mission/runtime.
- Camera position must be at the center of `from`.
- Mounted offset must be zero, except for numerical noise.
- Look direction must be derived from `from -> to`.
- Entering `view(from,to)` must not inherit prior `free` or `follow` offsets.

## Transition Rules

All transitions are explicit. There is no generic "preserve what seems reasonable" path.

### `free -> free`

- Allowed.
- Preserves free camera pose only.

### `free -> follow(target)`

- Allowed.
- Reinitialize follow state from a canonical follow entry for `target`.
- Do not reuse any mounted view state.

### `free -> view(from,to)`

- Allowed if `(from,to)` is valid.
- Snap camera to the center of `from`.
- Initialize mounted look direction toward `to`.
- Initialize FoV state for semantic view mode.

### `follow(a) -> free`

- Allowed.
- Exit to canonical free state or to the current free-policy pose.
- Must clear follow-owned state.

### `follow(a) -> follow(b)`

- Allowed.
- Treat as a fresh entry into `follow(b)`.
- Do not preserve offsets if doing so can place camera and target in a degenerate relationship.

### `follow(target) -> view(from,to)`

- Allowed if `(from,to)` is valid.
- Treat as a fresh entry into `view(from,to)`.
- Mounted state must override any follow state.

### `view(from,to) -> free`

- Allowed.
- Must reset to canonical free camera state.
- Must clear mounted state.
- Must disable view-only FoV interaction.

### `view(from,to) -> follow(target)`

- Allowed.
- Must behave exactly like a fresh entry into `follow(target)`.
- Must not preserve mounted state.

### `view(a,b) -> view(c,d)`

- Allowed if `(c,d)` is valid.
- Treat as a fresh entry into `view(c,d)`.
- Camera must recenter on `c`.

## FoV Rules

FoV behavior is mode-bound, not input-bound.

### Enablement

FoV UI and FoV wheel interaction are enabled only in `view(from,to)`.

For v1, this means:

- enabled for `earth -> moon`
- enabled for `moon -> earth`
- enabled for `craft -> moon`
- enabled for `craft -> earth`

FoV UI and FoV wheel interaction are disabled in:

- `free`
- `follow(earth)`
- `follow(moon)`
- `follow(craft)`

### Behavior

- Manual FoV, slider FoV, numeric-input FoV, and wheel FoV all update the same underlying FoV state.
- Auto-FoV and manual FoV must be mutually consistent:
  - any manual FoV input exits auto mode
  - auto recompute updates all visible FoV UI controls
- FoV precision is one decimal place in UI.
- Numeric entry accepts numeric values in `nnn.n` style.
- FoV lower bound must be below `1.0` degree.

### Auto-FoV Fit Rule

Auto-FoV must fit the target body into the visible mission viewport, not the raw canvas.

The fit calculation must exclude:

- the top pill/header strips
- the bottom control/timeline region

The same visible-band fit rule must apply consistently for all bodies, including Earth and Moon.

## UI Mapping Rules

### Mode selection UI

- `Free` selects `free`
- `Follow X` selects `follow(x)`
- `A->B` selects `view(a,b)`

### De-selection behavior

- Releasing `A->B` returns to `free`
- Releasing `Follow X` returns to `free`
- Leaving one explicit mode for another is always a full transition, not a partial mutation

### UI authority

- The UI reflects runtime mode state.
- Hidden or disabled controls must not continue to mutate camera state through stale events.
- If a control is not enabled for the current mode, its handlers must no-op defensively.

## Transition Test Matrix

At minimum, automated tests must cover the following matrix.

| From | To | Expected assertion |
| --- | --- | --- |
| `free` | `follow(moon)` | nonzero follow offset |
| `free` | `follow(craft)` | nonzero follow offset |
| `free` | `earth->moon` | camera centered on Earth |
| `free` | `craft->moon` | camera centered on Craft |
| `follow(moon)` | `free` | follow state cleared; valid free view |
| `follow(craft)` | `free` | follow state cleared; valid free view |
| `follow(earth)` | `moon->earth` | camera centered on Moon |
| `follow(craft)` | `craft->earth` | camera centered on Craft |
| `earth->moon` | `free` | canonical free camera restored |
| `craft->moon` | `free` | canonical free camera restored |
| `earth->moon` | `follow(moon)` | nonzero follow offset; no mounted leakage |
| `craft->earth` | `follow(craft)` | nonzero follow offset; no mounted leakage |
| `earth->moon` | `moon->earth` | camera recenters on Moon |
| `craft->moon` | `craft->earth` | camera recenters on Craft |

## FoV Test Matrix

At minimum:

| Mode | FoV UI visible | FoV input active | Expected |
| --- | --- | --- | --- |
| `free` | no | no | slider, wheel, numeric input do nothing |
| `follow(moon)` | no | no | slider, wheel, numeric input do nothing |
| `earth->moon` | yes | yes | slider, wheel, numeric input stay in sync |
| `moon->earth` | yes | yes | slider, wheel, numeric input stay in sync |
| `craft->moon` | yes | yes | auto/manual transitions stay in sync |
| `craft->earth` | yes | yes | auto-fit respects visible viewport band |

Additional assertions:

- wheel FoV changes are smooth, not jumpy
- FoV may go below `1.0`
- auto-FoV fits Earth and Moon consistently against the visible viewport band
- switching from `view(from,to)` to `free` disables further FoV mutation immediately

## Implementation Guidance

The implementation should behave like a small state machine:

1. Resolve requested target mode.
2. Validate the transition.
3. Fully initialize the destination mode.
4. Clear state owned by the previous mode.
5. Sync UI from resulting mode state.

Avoid:

- preserving offsets across mode families
- inferring mode from controller internals
- leaving UI handlers active when their mode is inactive
- updating only part of the camera state on transition

## Acceptance Criteria

- No transition from `view(from,to)` to `free` or `follow(target)` can produce a degenerate view.
- No semantic `view(from,to)` can retain an old offset from a previous mode.
- `follow(target)` always starts with a valid nonzero camera-target separation.
- FoV controls are active only in allowed `view(from,to)` modes.
- Wheel/manual/auto FoV remain synchronized.
- Auto-FoV fits the target body within the visible mission viewport band.
