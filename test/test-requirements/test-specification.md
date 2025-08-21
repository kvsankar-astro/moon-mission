# Chandrayaan-3 Mission Visualization - Test Specification Document

## Overview
This document describes the test cases for validating the Chandrayaan-3 mission visualization application. The application displays the spacecraft's journey from Earth to Moon with various viewing modes and controls.

---

## General Test Requirements

### Screenshot Requirements
- Any screenshot must be taken with the Settings panel closed.
- Screenshots must be taken at full page resolution.
- First-time screenshots automatically become baseline images.
- Visual comparison allows pixel differences within specified tolerance using named constants.
- Screenshot directories are automatically created: `test/screenshots/current` and `test/screenshots/baseline`.

### Screenshot Tolerance Constants
- `EXACT`: 0 pixels - For exact visual matches (critical UI states).
- `APPROX`: 10 pixels - For minor rendering differences (standard tests).
- `BROAD`: 200 pixels - For complex 3D scenes with acceptable variations.

### Screenshot Folder Structure
The test suite uses a standardized screenshot organization:
- **`test/screenshots/baseline/`** - Reference images for visual comparison.
- **`test/screenshots/current/`** - Latest test run screenshots.
- **`test/screenshots/diff/`** - Difference images showing visual changes (auto-generated when differences detected).

### Test Execution Modes
The test script supports two primary execution modes:
- **Baseline Mode**: Generates new baseline images without comparison against existing baselines. Use when updating reference images or creating new test cases.
- **Verify Mode** (default): Compares current screenshots against existing baselines and reports differences. Used for regression testing and validation.

### State Management Requirements
- Every test case must leave the animation in a stopped state after completion.
- The play/pause button (`#animate`) must display "Play" text (not "Pause") at test end.
- Animation must be paused before taking any screenshots for visual consistency.
- If a test changes the animation state, it must be reverted back entirely at the end of the test.
- Each test must maintain action balance (all "do" actions must have corresponding "undo" actions).
- Action count must equal zero at test completion.
- Each origin (Earth or Moon) will have a default starting state.
- Tests that fail cleanup trigger a force state reset.
- This state is (for Earth or Moon origin):
-- Dimension > 3D is checked (`#dimension-3D`)
-- Camera > Default is checked (`#camera-default`)
-- Camera > Zoom level is 1.0 (default zoom)
-- Plane > DEFAULT is checked (`#checkbox-lock-default`)
-- View > Landing is unchecked (`#landing`)
-- View > Joy Ride! is unchecked (`#joyride`)
-- View > CY3 Orbit is checked (`#view-orbit`)
-- View > CY3 Descent orbit is checked (`#view-orbit-descent`)
-- View > Locations is checked (`#view-craters`)
-- View > XYZ Axes is checked (`#view-xyz-axes`)
-- View > Poles is checked (`#view-poles`)
-- View > Polar Axes is checked (`#view-polar-axes`)
-- View > Stellar Sky is checked (`#view-sky`)
-- View > Moon's SOI is unchecked (`#view-moonsoi`)
-- View > Ecliptic Plane is unchecked (`#view-eclipticplane`)
-- View > Equatorial Plane is unchecked (`#view-equatorialplane`)

### Camera and Zoom State Management Requirements
- Tests requiring optimal viewing must preserve and restore camera state.
- Camera zoom state must be preserved before making changes and restored afterward.
- Camera position and orientation must be preserved and restored.
- Default zoom level is the baseline state for standard viewing.
- Enhanced viewing tests may require specific zoom levels for optimal visibility:
  - **Poles View**: Enhanced zoom, XY plane orientation for optimal pole marker visibility.
  - **Polar Axes View**: Enhanced zoom, YZ- orientation plane for clear polar axes visibility.
  - **XYZ Axes View**: Standard zoom, DEFAULT plane orientation.
  - **Locations View**: Enhanced zoom, XY- plane orientation for clear lunar surface location markers.
  - **Descent Orbit View**: Enhanced zoom, XY- plane for detailed orbit visualization.
- All zoom and orientation changes must be restored at test completion to maintain state consistency.

### Error Handling Requirements
- Any console error should fail the test unless explicitly ignored.
- **Ignored Error Categories:**
  - Google Analytics failures (google-analytics.com, analytics.js)
  - Missing favicon errors (favicon.ico)
  - WebGL shader compilation errors (THREE.WebGLProgram, Shader Error, VALIDATE_STATUS false)
  - WebGL operation errors (WebGL: INVALID_OPERATION)
- All other console errors are considered test failures.
- Console error filtering is applied automatically during test execution.

### URL and Environment Configuration Requirements
- Tests shall not use hardcoded URLs or ports.
- Base URL configurable via environment variables:
  - `VITE_TEST_BASE_URL`: Complete test URL (e.g., `http://localhost:8000`).
- Test target path: `/chandrayaan3.html` appended to base URL.

### Browser Configuration Requirements
- Tests run in Chromium browser with specific launch arguments:
  - Memory optimization: `--max-old-space-size=4096`
  - Garbage collection access: `--expose-gc`
  - Sandbox prevention: `--no-sandbox`
- Browser mode configurable via environment variables:
  - `HEADLESS=true` for headless mode (default should be `false`)
  - `SLOWMO=milliseconds` for slowed interactions.

### Timeout Configuration Requirements
All timeout values shall use named constants, not hardcoded values:

**Scene and Rendering Timeouts:**
- `SCENE_READY_TIMEOUT`: 15000ms - Wait for WebGL context and orbit rendering.
- `STABLE_RENDER_TIMEOUT`: 3000ms - Wait for scene stabilization.
- `ORBIT_RENDER_TIMEOUT`: 20000ms - Wait for orbit curve completion.

**UI Interaction Timeouts:**
- `SETTINGS_PANEL_TIMEOUT`: 8000ms - Settings panel open/close operations.
- `UI_RESPONSE_TIMEOUT`: 3000ms - General UI element interactions.
- `ANIMATION_RESPONSE_TIMEOUT`: 2000ms - Animation start/stop response.

**Screenshot and Comparison Timeouts:**
- `SCREENSHOT_TIMEOUT`: 5000ms - Screenshot capture operations.
- `VISUAL_STABILIZATION_TIMEOUT`: 2500ms - Wait before screenshots.
- `PANEL_CLOSE_TIMEOUT`: 1000ms - Settings panel close delay.

**Test Infrastructure Timeouts:**
- `TEST_CASE_TIMEOUT`: 35000ms - Individual test case timeout.
- `EXTENDED_TEST_TIMEOUT`: 70000ms - Complex tests (plane selection, etc.).
- `CLEANUP_TIMEOUT`: 90000ms - Test cleanup and state reset.

**Short Delays:**
- `QUICK_DELAY`: 200ms - Brief pauses between actions.
- `STANDARD_DELAY`: 500ms - Standard wait for UI updates.
- `EXTENDED_DELAY`: 1000ms - Extended wait for complex operations.

---

## Test Suite 1: Initial Application Load

### Test: Initial Page Load and Rendering
**Test ID:** `earth-3d-initial-load`
**Intent:** Verify the application loads correctly with default Earth view and all controls visible.

**Screenshots Generated:**
- `earth-3d-initial-load.png` - Initial page load with Earth mode and all UI elements.

**Test Procedure:**
1.  Wait for the scene to be ready and rendering to stabilize.
2.  Take screenshot and compare against baseline with APPROX_MATCH tolerance.
3.  Verify Earth mode is active (`#origin-earth` checked).
4.  Verify 3D mode is active (`#dimension-3D` checked).
5.  Verify all core UI elements are present and accessible.
6.  Verify timeline text shows Launch time. 
---

## Test Suite 2: Earth Mode Tests

### Test: Page Load in Earth Mode
**Test ID:** `earth-3d-page-load`
**Intent:** Verify the page displays correctly when Earth is the center of reference.

**Screenshots Generated:**
- `earth-3d-page-load.png` - Earth-centered view with default settings.

**Test Procedure:**
1.  Verify page title contains "Chandrayaan 3".
2.  Take screenshot and compare against baseline with APPROX_MATCH tolerance.

### Test: 3D Mode Verification
**Test ID:** `earth-3d-mode-verification`
**Intent:** Confirm the visualization starts in 3D mode.

**Test Procedure:**
1.  Verify 3D mode radio button is selected (`#dimension-3D:checked`).

### Test: User Interface Elements Check
**Test ID:** `earth-3d-ui-elements-check`
**Intent:** Verify all control panels and buttons are accessible.

**Test Procedure:**
1.  Verify main UI elements are present and accessible.
2.  Verify animation control elements are present.
3.  Open the settings panel.
4.  Verify all settings panel controls are present (origin, camera, plane, view, dimension controls).
5.  Close the settings panel.

### Test: Timeline Navigation Buttons
**Test ID:** `earth-3d-timeline-navigation`
**Intent:** Verify all mission milestone buttons navigate to correct points in time.

**Test Procedure:**
1.  Iterate through all timeline milestone buttons (#burn1 through #burn14).
2.  For each button, capture telemetry values before activation.
3.  Activate the button.
4.  Verify that telemetry values have changed after activation.
5.  For Launch button (#burn1), verify date contains "Jul".

### Test: Animation Play Control
**Test ID:** `earth-3d-animation-play-control`
**Intent:** Validates that the Play button correctly starts the orbital animation.

**Test Procedure:**
1.  Ensure animation is paused.
2.  Capture initial telemetry values.
3.  Activate the Play button.
4.  Verify the button state changes to indicate animation is running.
5.  Wait for telemetry to change, confirming the animation is active.
6.  Stop the animation for test completion.

### Test: Animation Pause Control
**Test ID:** `earth-3d-animation-pause-control`
**Intent:** Validates that the Pause button correctly stops the orbital animation.
**TODO** To be merged with `earth-3d-animation-play-control`

**Test Procedure:**
1.  Ensure animation is paused.
2.  Activate the Pause button.
3.  Verify the button state changes to indicate animation is stopped.
4.  Capture telemetry values multiple times to confirm animation is paused.

### Test: Speed Controls
**Test ID:** `earth-3d-speed-controls`
**Intent:** Verify animation speed can be adjusted.

**Test Procedure:**
1.  Verify speed control buttons are present.
2.  Start animation.
3.  Increase animation speed multiple times, sampling timeline to verify speed changes.
4.  Decrease animation speed multiple times, sampling timeline to verify speed changes.
5.  Verify that speed changes are reflected in timeline progression.
6.  Stop animation.

### Test: Directional Controls Check
**Test ID:** `earth-3d-directional-controls-check`
**Intent:** Verify directional control buttons are available.

**Test Procedure:**
1.  Verify directional control buttons are present and accessible.

### Test: Direction Control with Timeline
**Test ID:** `earth-3d-directional-controls-timeline`
**Intent:** Verify directional controls move the timeline correctly.

**Test Procedure:**
1.  Set a baseline timeline position.
2.  Use forward controls multiple times, capturing timeline values.
3.  Use fast forward controls multiple times, capturing timeline values.
4.  Use backward controls multiple times, capturing timeline values.
5.  Use fast backward controls multiple times, capturing timeline values.
6.  Verify that timeline values change in response to directional controls.

### Test: Plane Selection Views
**Test ID:** `earth-3d-plane-selection`
**Intent:** Verify different orbital plane views can be selected.

**Screenshots Generated:**
- `earth-3d-plane-selection-default.png`
- `earth-3d-plane-selection-xy.png`
- `earth-3d-plane-selection-yz.png`
- `earth-3d-plane-selection-zx.png`
- `earth-3d-plane-selection-xy-minus.png`
- `earth-3d-plane-selection-yz-minus.png`
- `earth-3d-plane-selection-zx-minus.png`
- `earth-3d-plane-selection-default-final.png`

**Test Procedure:**
1.  Configure view for optimal plane visualization.
2.  Iterate through all plane selection options.
3.  For each plane, activate selection and capture screenshot.
4.  Compare screenshots against baselines with medium tolerance.
5.  Restore original view configuration.

### Test: 2D/3D Mode Switching
**Test ID:** `earth-2d-3d-mode-switching`
**Intent:** Verify switching between 2D and 3D visualization modes.
**TODO** Move towards the end of the suite

**Screenshots Generated:**
- `earth-2d-3d-mode-switching-3d-initial.png`
- `earth-2d-3d-mode-switching-2d.png`
- `earth-2d-3d-mode-switching-3d-restored.png`

**Test Procedure:**
1.  Capture screenshot of initial 3D mode.
2.  Switch to 2D mode.
3.  Capture screenshot of 2D mode.
4.  Switch back to 3D mode.
5.  Capture screenshot of restored 3D mode.

### Test: Poles View Toggle
**Test ID:** `earth-3d-poles-toggle`
**Intent:** Validates the Poles view control toggle functionality.

**Screenshots Generated:**
- `earth-3d-poles-toggle-enabled.png`
- `earth-3d-poles-toggle-disabled.png`
- `earth-3d-poles-toggle-restored.png`

**Test Procedure:**
1.  Set up optimal viewing configuration for pole visibility.
2.  Apply enhanced zoom for optimal pole marker visibility.
3.  Capture screenshot with poles enabled.
4.  Disable poles view.
5.  Capture screenshot with poles disabled.
6.  Re-enable poles view.
7.  Capture screenshot with poles restored.
8.  Restore original zoom and view configuration.

### Test: Polar Axes View Toggle
**Test ID:** `earth-3d-polar-axes-toggle`
**Intent:** Validates the Polar Axes view control toggle functionality.

**Screenshots Generated:**
- `earth-3d-polar-axes-toggle-enabled.png`
- `earth-3d-polar-axes-toggle-disabled.png`
- `earth-3d-polar-axes-toggle-restored.png`

**Test Procedure:**
1.  Set up optimal viewing configuration for polar axes visibility.
2.  Apply enhanced zoom for optimal meridian line visibility.
3.  Capture screenshot with polar axes enabled.
4.  Disable polar axes view.
5.  Capture screenshot with polar axes disabled.
6.  Re-enable polar axes view.
7.  Capture screenshot with polar axes restored.
8.  Restore original zoom and view configuration.

### Test: XYZ Axes View Toggle
**Test ID:** `earth-3d-xyz-axes-toggle`
**Intent:** Verify coordinate axes can be displayed.

**Screenshots Generated:**
- `earth-3d-xyz-axes-toggle-enabled.png`
- `earth-3d-xyz-axes-toggle-disabled.png`
- `earth-3d-xyz-axes-toggle-restored.png`

**Test Procedure:**
1.  Set up optimal viewing configuration for coordinate axes visibility.
2.  Capture screenshot with XYZ axes enabled.
3.  Disable XYZ axes view.
4.  Capture screenshot with XYZ axes disabled.
5.  Re-enable XYZ axes view.
6.  Capture screenshot with XYZ axes restored.
7.  Restore original view configuration.

### Additional View Controls
**Intent:** Verify other specialized visualization options work correctly.

#### Test: Moon's SOI View
**Test ID:** `earth-3d-moon-soi-view`
**Screenshots Generated:**
- `earth-3d-moon-soi-view-enabled.png`
- `earth-3d-moon-soi-view-disabled.png`

#### Test: Ecliptic Plane View
**Test ID:** `earth-3d-ecliptic-plane-view`
**Screenshots Generated:**
- `earth-3d-ecliptic-plane-view-enabled.png`
- `earth-3d-ecliptic-plane-view-disabled.png`

#### Test: Equatorial Plane View
**Test ID:** `earth-3d-equatorial-plane-view`
**Screenshots Generated:**
- `earth-3d-equatorial-plane-view-enabled.png`
- `earth-3d-equatorial-plane-view-disabled.png`

### Test: Joy Ride Control
**Test ID:** `earth-3d-joy-ride`
**Intent:** Verify joy ride camera mode can be activated.

**Screenshots Generated:**
- `earth-3d-joy-ride-enabled.png`

**Test Procedure:**
1.  Navigate to suitable timeline position for joy ride demonstration.
2.  Enable Joy Ride camera mode.
3.  Capture screenshot and compare against baseline.
4.  Disable Joy Ride to restore normal camera mode.

### Test: CY3 Orbit Display
**Test ID:** `earth-3d-cy3-orbit-display`
**Intent:** Verify main orbit path can be toggled.

**Screenshots Generated:**
- `earth-3d-cy3-orbit-display-checked.png`
- `earth-3d-cy3-orbit-display-unchecked.png`
- `earth-3d-cy3-orbit-display-restored.png`

**Test Procedure:**
1.  Ensure orbit display is enabled.
2.  Capture screenshot with orbit visible.
3.  Disable orbit display.
4.  Capture screenshot with orbit hidden.
5.  Re-enable orbit display.
6.  Capture screenshot with orbit restored and compare consistency.

### Test: Final Stability Check
**Test ID:** `earth-3d-final-stability-check`
**Intent:** Verify application remains stable after all Earth mode tests.

**Screenshots Generated:**
- `earth-3d-final-stability-check-initial.png`
- `earth-3d-final-stability-check-final.png`

**Test Procedure:**
1.  Capture initial stability screenshot.
2.  Verify core functional elements remain present and properly configured.
3.  Perform responsiveness test with multiple timeline interactions.
4.  Capture final stability screenshot.

---

## Test Suite 3: Moon Mode Tests

### General Procedure
- Before running this suite, the origin is switched to Moon (`#origin-moon`).
- The tests from Suite 2 are conceptually repeated, but with Moon as the reference point.
- Screenshots use test IDs starting with `moon-3d-` instead of `earth-3d-`.

### Test: Page Load in Moon Mode
**Test ID:** `moon-3d-page-load`
**Screenshots Generated:** `moon-3d-page-load.png`

### Test: 3D Mode Verification
**Test ID:** `moon-3d-mode-verification`
(No screenshots)

### Test: Plane Selection Views
**Test ID:** `moon-3d-plane-selection`
**Screenshots Generated:** 
- `moon-3d-plane-selection-default.png`
- `moon-3d-plane-selection-xy.png`
- `moon-3d-plane-selection-yz.png`
- `moon-3d-plane-selection-zx.png`
- `moon-3d-plane-selection-xy-minus.png`
- `moon-3d-plane-selection-yz-minus.png`
- `moon-3d-plane-selection-zx-minus.png`
- `moon-3d-plane-selection-default-final.png`

### Test: 2D/3D Mode Switching
**Test ID:** `moon-2d-3d-mode-switching`
**Screenshots Generated:** 
- `moon-2d-3d-mode-switching-3d-initial.png`
- `moon-2d-3d-mode-switching-2d.png`
- `moon-2d-3d-mode-switching-3d-restored.png`

### Test: Poles View Toggle
**Test ID:** `moon-3d-poles-toggle`
**Screenshots Generated:** 
- `moon-3d-poles-toggle-enabled.png`
- `moon-3d-poles-toggle-disabled.png`
- `moon-3d-poles-toggle-restored.png`

### Test: Polar Axes View Toggle
**Test ID:** `moon-3d-polar-axes-toggle`
**Screenshots Generated:** 
- `moon-3d-polar-axes-toggle-enabled.png`
- `moon-3d-polar-axes-toggle-disabled.png`
- `moon-3d-polar-axes-toggle-restored.png`

### Test: XYZ Axes View Toggle
**Test ID:** `moon-3d-xyz-axes-toggle`
**Screenshots Generated:** 
- `moon-3d-xyz-axes-toggle-enabled.png`
- `moon-3d-xyz-axes-toggle-disabled.png`
- `moon-3d-xyz-axes-toggle-restored.png`

### Additional View Controls

#### Test: Moon's SOI View
**Test ID:** `moon-3d-moon-soi-view`
**Screenshots Generated:**
- `moon-3d-moon-soi-view-enabled.png`
- `moon-3d-moon-soi-view-disabled.png`

#### Test: Ecliptic Plane View
**Test ID:** `moon-3d-ecliptic-plane-view`
**Screenshots Generated:**
- `moon-3d-ecliptic-plane-view-enabled.png`
- `moon-3d-ecliptic-plane-view-disabled.png`

#### Test: Equatorial Plane View
**Test ID:** `moon-3d-equatorial-plane-view`
**Screenshots Generated:**
- `moon-3d-equatorial-plane-view-enabled.png`
- `moon-3d-equatorial-plane-view-disabled.png`

### Test: CY3 Orbit Display
**Test ID:** `moon-3d-cy3-orbit-display`
**Intent:** Verify main orbit path can be toggled.
**Screenshots Generated:** 
- `moon-3d-cy3-orbit-display-checked.png`
- `moon-3d-cy3-orbit-display-unchecked.png`

### Test: CY3 Descent Orbit Display
**Test ID:** `moon-3d-cy3-descent-orbit-display`
**Intent:** Verify descent orbit path can be toggled.
**Screenshots Generated:** 
- `moon-3d-cy3-descent-orbit-display-checked.png`
- `moon-3d-cy3-descent-orbit-display-unchecked.png`
- `moon-3d-cy3-descent-orbit-display-restored.png`

### Test: Landing Animation
**Test ID:** `moon-3d-landing-animation`
**Intent:** Verify landing sequence animation can be triggered.
**Screenshots Generated:** `moon-3d-landing-animation-enabled.png`

### Test: Locations View
**Test ID:** `moon-3d-locations-view-toggle`
**Intent:** Verify Moon surface locations can be displayed.
**Screenshots Generated:** 
- `moon-3d-locations-view-toggle-enabled.png`
- `moon-3d-locations-view-toggle-disabled.png`
- `moon-3d-locations-view-toggle-restored.png`

---

## Test Suite 4: Earth Mode 2D Tests

### General Procedure
- Switch to Earth mode (`#origin-earth`) and 2D dimension (`#dimension-2D`)
- These tests validate 2D SVG rendering functionality for Earth-centered views
- 2D mode has instant readiness - no 3D scene waiting required

### Test: Page Load in Earth 2D Mode
**Test ID:** `earth-2d-page-load`
**Intent:** Verify Earth 2D mode loads correctly with SVG rendering.
**Screenshots Generated:** `earth-2d-page-load.png`

### Test: 2D Mode Verification
**Test ID:** `earth-2d-mode-verification`
**Intent:** Confirm 2D mode radio button is properly selected.

### Test: Timeline Navigation in 2D Mode
**Test ID:** `earth-2d-timeline-navigation`
**Intent:** Verify timeline navigation works in 2D mode.

### Test: Animation Controls in 2D Mode
**Test ID:** `earth-2d-animation-controls`
**Intent:** Verify play/pause animation controls work in 2D mode.

### Test: Plane Selection in 2D Mode
**Test ID:** `earth-2d-plane-selection`
**Intent:** Verify plane selection works in 2D SVG mode.
**Screenshots Generated:** 
- `earth-2d-plane-selection-default.png`
- `earth-2d-plane-selection-xy.png`
- `earth-2d-plane-selection-yz.png`
- `earth-2d-plane-selection-zx.png`
- `earth-2d-plane-selection-xy-minus.png`
- `earth-2d-plane-selection-yz-minus.png`
- `earth-2d-plane-selection-zx-minus.png`
- `earth-2d-plane-selection-default-final.png`

---

## Test Suite 5: Moon Mode 2D Tests

### General Procedure
- Switch to Moon mode (`#origin-moon`) and 2D dimension (`#dimension-2D`)
- These tests validate 2D SVG rendering functionality for Moon-centered views
- 2D mode has instant readiness - no 3D scene waiting required

### Test: Page Load in Moon 2D Mode
**Test ID:** `moon-2d-page-load`
**Intent:** Verify Moon 2D mode loads correctly with SVG rendering.
**Screenshots Generated:** `moon-2d-page-load.png`

### Test: 2D Mode Verification in Moon Mode
**Test ID:** `moon-2d-mode-verification`
**Intent:** Confirm 2D mode radio button is properly selected.

### Test: Plane Selection in Moon 2D Mode
**Test ID:** `moon-2d-plane-selection`
**Intent:** Verify plane selection works in 2D SVG mode for lunar views.
**Screenshots Generated:**
- `moon-2d-plane-selection-xy.png`
- `moon-2d-plane-selection-yz.png`
- `moon-2d-plane-selection-default.png`

---

## Test Suite 6: Full Run Tests

### General Requirements
Full Run Tests execute complete Chandrayaan-3 mission animations from Launch timeline to natural mission completion (CY3 Data End in September 2023).

**Core Functionality:**
1. **Natural Completion Detection**: Tests wait for animation to complete naturally, not artificially stopped at arbitrary time
2. **Timeline Verification**: Final timeline must show mission end (September 2023) with "CY3 Data End" 
3. **Speed Acceleration**: Use Faster button clicks to complete mission within test timeout window
4. **Speed Restoration**: Undo all Faster clicks with equivalent Slower clicks at test end
5. **Play/Pause State Management**: Verify Play button functionality and final stopped state

**Test Flow Pattern:**
1. Configure mode (Earth/Moon), dimension (2D/3D), timeline (Launch), and plane
2. Wait for scene readiness (3D only - 2D is instant)  
3. Apply optimal zoom for orbit visibility (3D only)
4. Start animation with Play button
5. Accelerate with multiple Faster clicks  
6. Wait for natural completion (Play button reappears + stable timeline)
7. Restore original speed with Slower clicks
8. Reset zoom to original level (3D only)
9. Verify final timeline shows mission completion

**Timeout Requirements:**
- Individual test timeout: 120000ms (2 minutes)
- Natural completion detection: Poll every 5 seconds for up to 24 attempts
- Timeline stability: Require 2 consecutive identical readings

### Test: Earth 3D Full Run Test
**Test ID:** `earth-3d-full-run`
**Intent:** Execute complete mission animation in Earth 3D mode.
**Configuration:** Earth mode, 3D dimension, XY plane, Launch timeline
**Zoom Strategy:** Zoomed out enough to view the whole orbit
**Speed Strategy:** 5x Faster clicks with equivalent Slower restoration

### Test: Moon 3D Full Run Test
**Test ID:** `moon-3d-full-run`
**Intent:** Execute complete mission animation in Moon 3D mode.
**Configuration:** Moon mode, 3D dimension, YZ- plane, Launch timeline
**Zoom Strategy:** Zommed out enough to view the whole orbit
**Speed Strategy:** 5x Faster clicks with equivalent Slower restoration

### Test: Earth 2D Full Run Test
**Test ID:** `earth-2d-full-run`
**Intent:** Execute complete mission animation in Earth 2D mode.
**Configuration:** Earth mode, 2D dimension, XY plane, Launch timeline  
**Zoom Strategy:** None required (2D SVG mode)
**Speed Strategy:** 5x Faster clicks with equivalent Slower restoration

### Test: Moon 2D Full Run Test
**Test ID:** `moon-2d-full-run`
**Intent:** Execute complete mission animation in Moon 2D mode.
**Configuration:** Moon mode, 2D dimension, XY plane, Launch timeline
**Zoom Strategy:** None required (2D SVG mode) 
**Speed Strategy:** 5x Faster clicks with equivalent Slower restoration

## Suggested Implementation/Design

This section provides specific implementation guidance for the test requirements defined above. While the requirements section focuses on what needs to be tested, this section provides specific technical approaches for how to implement those tests.

### Camera and Zoom Implementation Details

**Zoom Functions:**
- Use `zoomIn(page, steps)` and `zoomOut(page, steps)` helper functions that directly manipulate the THREE.js camera position for stable and repeatable zoom behavior.
- Specific zoom levels for enhanced viewing tests:
  - **Poles View**: 10 zoom steps in (`zoomIn(page, 10)`)
  - **Polar Axes View**: 12 zoom steps in (`zoomIn(page, 12)`) 
  - **Locations View**: 8-10 zoom steps in (`zoomIn(page, 8)` or `zoomIn(page, 10)`)
  - **Descent Orbit View**: 8 zoom steps in (`zoomIn(page, 8)`)

**State Management:**
- Use `storeInitialState()` and `restoreStoredState()` functions for tests requiring optimal viewing.
- All zoom changes must be restored using equivalent `zoomOut()` calls at test completion.

### Scene Readiness Implementation

**3D Scene Waiting:**
- Wait for scene readiness using: `window.animationScenes?.geo?.state === window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE`
- For Moon mode, check: `window.animationScenes?.lunar?.state === window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE`

**2D Mode Handling:**
- 2D mode is instantly ready - no scene waiting required
- Skip 3D-specific initialization waits for 2D tests

### UI Element Selectors

**Core Controls:**
- Animation control: `#animate` (shows "Play" or "Pause" text)
- Speed controls: `#faster`, `#slower`, `#realtime`, `#reset`
- Direction controls: `#forward`, `#backward`, `#fastforward`, `#fastbackward`
- Settings panel: `#settings-panel-button`

**Timeline Navigation:**
- Timeline buttons: `#burn1` through `#burn14` (14 total milestone buttons)
- Special timeline points:
  - Launch: `#burn1`
  - EBN#3 (for Joy Ride): `#burn3` 
  - Landing phase: `#burn12`

**Mode and Dimension Controls:**
- Origin selection: `#origin-earth`, `#origin-moon`
- Dimension selection: `#dimension-3D`, `#dimension-2D`
- Plane selection: `#checkbox-lock-default`, `#checkbox-lock-xy`, `#checkbox-lock-yz`, `#checkbox-lock-zx`, etc.

**View Controls:**
- Orbit displays: `#view-orbit`, `#view-orbit-descent`
- Coordinate systems: `#view-xyz-axes`, `#view-poles`, `#view-polar-axes`
- Special views: `#view-moonsoi`, `#view-eclipticplane`, `#view-equatorialplane`
- Animation features: `#joyride`, `#landing`
- Surface features: `#view-craters` (locations)

### Screenshot Implementation Details

**File Naming Convention:**
- Earth mode: `geo-` prefix (e.g., `geo-3d-initial-load.png`)
- Moon mode: `lunar-` prefix (e.g., `lunar-3d-page-load.png`)
- 2D Earth mode: `earth-2d-` prefix (e.g., `earth-2d-page-load.png`)
- 2D Moon mode: `moon-2d-` prefix (e.g., `moon-2d-page-load.png`)

**Tolerance Constants:**
- Use `TOLERANCE.EXACT` (0 pixels) for critical UI states
- Use `TOLERANCE.LOW` (10 pixels) for minor rendering differences
- Use `TOLERANCE.MID` (200 pixels) for complex 3D scenes

### Test Execution Implementation

**Animation State Verification:**
- Check if animation is running: `page.locator('#animate:has-text("Pause")').count() > 0`
- Check if animation is stopped: `page.locator('#animate:has-text("Play")').count() > 0`
- Verify state changes after button clicks

**Timeline Value Sampling:**
- Capture telemetry values before and after operations to verify changes
- Use multiple samples to confirm animation speed changes
- Ensure timeline progression reflects control inputs

**Settings Panel Management:**
- Open panel, make changes, close panel before screenshots
- Verify panel closes completely before visual comparisons
- Use appropriate timeouts for panel animations

### Full Run Test Implementation

**Core Implementation Pattern:**
```javascript
// 1. Configure mode and wait for readiness
await setMode(page, 'geo'); // or 'lunar'
await setDimension(page, '3D'); // or '2D'  
await setTimeline(page, '#burn1'); // Launch timeline
await setPlane(page, 'XY'); // or other plane
await waitForScene(page); // 3D only

// 2. Apply zoom (3D only)
await zoomOut(page, 20, 'EARTH'); // or 40, 'MOON'

// 3. Start animation
await page.click('#animate');
await page.waitForTimeout(300);

// 4. Speed up animation
const fasterClickCount = 5;
for (let i = 0; i < fasterClickCount; i++) {
  await page.click('#faster');
  await page.waitForTimeout(50);
}

// 5. Wait for natural completion
// Implementation: Poll for stable timeline + Play button

// 6. Restore speed
for (let i = 0; i < fasterClickCount; i++) {
  await page.click('#slower');
  await page.waitForTimeout(50);  
}

// 7. Reset zoom (3D only)
await zoomIn(page, 20, 'EARTH');

// 8. Verify completion
// Check timeline contains mission end indicators
```

**Natural Completion Detection:**
- Poll every 5 seconds for up to 24 attempts (2 minutes total)
- Check for Play button reappearance: `#animate:has-text("Play")`
- Verify timeline stability with multiple consecutive identical readings
- Confirm timeline text shows mission completion (September 2023, "CY3 Data End")

**Zoom Configuration:**
- Earth 3D Full Run: 20x zoom out for comprehensive orbital trajectory viewing
- Moon 3D Full Run: 40x zoom out for wide-angle selenocentric orbit visualization
- Use XY plane for optimal orbital mechanics visualization
- Apply zoom before animation starts, restore after completion

**Speed Acceleration Strategy:**
- Use 5 "Faster" clicks for optimal balance of speed and completion time
- Apply equivalent "Slower" clicks to restore original speed
- Use minimal delays (50ms) between speed control interactions

**Extended Plane Selection:**
- Support minus planes: `XY-` → `#checkbox-lock-xy-minus`
- Support minus planes: `YZ-` → `#checkbox-lock-yz-minus`  
- Support minus planes: `ZX-` → `#checkbox-lock-zx-minus`

### Browser Configuration Implementation

**Launch Arguments:**
```javascript
await chromium.launch({
  headless: TEST_CONFIG.headless,
  slowMo: TEST_CONFIG.slowMo,
  args: [
    '--no-sandbox',
    '--max-old-space-size=4096',
    '--expose-gc'
  ]
});
```

**Environment Variables:**
- `VITE_TEST_BASE_URL`: Base URL (e.g., `http://localhost:8001`)
- `HEADLESS=true`: Run in headless mode
- `SLOWMO=milliseconds`: Slow down interactions

### Error Handling Implementation

**Console Error Filtering:**
```javascript
// Ignore these error patterns:
- /google-analytics\.com|analytics\.js/
- /favicon\.ico/
- /THREE\.WebGLProgram.*Shader Error/
- /VALIDATE_STATUS false/
- /WebGL: INVALID_OPERATION/

// All other console errors should fail the test
```

This implementation section provides the specific technical details needed to build tests that meet the functional requirements defined in the main specification.
