# Test ID Reference Guide

This document provides a mapping of the current test IDs (used by `test/ui.test.js`) to their purposes.

## Test ID Naming Convention

Format: `{origin}-{dimension}-{intent}` (plus optional state suffixes)
- **origin**: `earth` or `moon`
- **dimension**: `2d` or `3d`
- **intent**: short description of what’s being exercised

## Complete Test ID Mapping

### Earth 3D (Core)
- `earth-3d-initial-load` - Initial load and first stable render
- `earth-3d-page-load` - Page renders correctly in Earth/3D default state
- `earth-3d-mode-verification` - Confirms 3D mode is active
- `earth-3d-ui-elements-check` - Critical UI elements present
- `earth-3d-timeline-navigation` - Timeline nav buttons behave correctly
- `earth-3d-animation-play-control` - Play control starts animation
- `earth-3d-animation-pause-control` - Pause control stops animation
- `earth-3d-speed-controls` - Faster/slower/reset/realtime controls
- `earth-3d-directional-controls-check` - Direction buttons present/usable
- `earth-3d-directional-controls-timeline` - Direction controls move timeline
- `earth-3d-plane-selection` - Plane selection cycles and stabilizes
- `earth-2d-3d-mode-switching` - Switch to 2D and restore to 3D

### Earth 3D (View Toggles)
- `earth-3d-poles-toggle` - Poles visibility toggle
- `earth-3d-polar-axes-toggle` - Polar axes toggle
- `earth-3d-xyz-axes-toggle` - XYZ axes toggle
- `earth-3d-moon-soi-view` - Moon SOI toggle (lunar missions only)
- `earth-3d-ecliptic-plane-view` - Ecliptic plane toggle
- `earth-3d-equatorial-plane-view` - Equatorial plane toggle
- `earth-3d-joy-ride` - Joy Ride toggle
- `earth-3d-cy3-orbit-display` - CY3 orbit visibility toggle
- `earth-3d-final-stability-check` - End-to-end stability snapshot/check

### Moon 3D
- `moon-3d-page-load` - Page renders correctly in Moon/3D
- `moon-3d-mode-verification` - Confirms Moon origin + 3D mode
- `moon-3d-plane-selection` - Plane selection cycle in Moon/3D
- `moon-2d-3d-mode-switching` - Switch to 2D and restore to 3D (Moon origin)
- `moon-3d-poles-toggle` - Poles toggle in Moon/3D
- `moon-3d-polar-axes-toggle` - Polar axes toggle in Moon/3D
- `moon-3d-xyz-axes-toggle` - XYZ axes toggle in Moon/3D
- `moon-3d-moon-soi-view` - Moon SOI toggle
- `moon-3d-ecliptic-plane-view` - Ecliptic plane toggle
- `moon-3d-equatorial-plane-view` - Equatorial plane toggle
- `moon-3d-cy3-orbit-display` - CY3 orbit visibility toggle
- `moon-3d-cy3-descent-orbit-display` - CY3 descent orbit toggle
- `moon-3d-landing-animation` - Landing toggle/flow
- `moon-3d-locations-view-toggle` - Locations/craters toggle

### 2D Smoke Coverage
- `earth-2d-page-load` - Page load in Earth/2D
- `earth-2d-mode-verification` - Confirms 2D mode is active (Earth origin)
- `earth-2d-timeline-navigation` - Timeline navigation works in 2D
- `earth-2d-animation-controls` - Animation controls in 2D
- `earth-2d-plane-selection` - Plane selection in 2D
- `moon-2d-page-load` - Page load in Moon/2D
- `moon-2d-mode-verification` - Confirms 2D mode is active (Moon origin)
- `moon-2d-plane-selection` - Plane selection in Moon/2D

### Full-Run Flows
- `earth-3d-full-run` - Runs the full Earth/3D sequence (no screenshots beyond final)
- `moon-3d-full-run` - Runs the full Moon/3D sequence
- `earth-2d-full-run` - Runs the full Earth/2D sequence
- `moon-2d-full-run` - Runs the full Moon/2D sequence

## Usage in Test Implementation

When implementing tests, use these IDs for:
- Test case identification in code
- Screenshot naming conventions
- Test reporting and validation
- Test filtering and selection

## Benefits of Proper Test IDs

✅ **Clear identification** - Easy to understand test purpose  
✅ **Consistent naming** - Follows predictable pattern  
✅ **Better organization** - Logical grouping by mode and category  
✅ **Improved debugging** - Quick identification of failing tests  
✅ **Enhanced reporting** - Professional test result summaries
