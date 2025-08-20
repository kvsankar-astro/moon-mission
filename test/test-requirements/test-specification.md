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

### Animation State Requirements
- Every test case must leave the animation in a stopped state after completion.
- The play/pause button (`#animate`) must display "Play" text (not "Pause") at test end.
- Animation must be paused before taking any screenshots for visual consistency.

### Screenshot Tolerance Constants
- `EXACT`: 0 pixels - For exact visual matches (critical UI states).
- `LOW`: 10 pixels - For minor rendering differences (standard tests).
- `MID`: 200 pixels - For complex 3D scenes with acceptable variations.

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
- If a test changes the animation state, it must be reverted back entirely.
- Each test must maintain action balance (all "do" actions must have corresponding "undo" actions).
- Action count must equal zero at test completion.
- Each origin (Earth or Moon) will have a default starting state.
- Tests that fail cleanup trigger a force state reset.
- This state is:
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
-- Dimension > 3D is checked (`#dimension-3D`)

### Camera and Zoom State Management Requirements
- Tests requiring optimal viewing must use `storeInitialState()` and `restoreStoredState()` functions.
- Camera zoom state must be preserved before making changes and restored afterward.
- Camera position and orientation must be preserved and restored.
- **Zoom operations use `zoomIn(page, steps)` and `zoomOut(page, steps)` helper functions.** These functions directly manipulate the THREE.js camera position for stable and repeatable zoom behavior.
- Default zoom level is the baseline state for standard viewing.
- Enhanced viewing tests may require specific zoom levels achieved through these functions:
  - **Poles View**: 10 zoom steps in for optimal pole marker visibility.
  - **Polar Axes View**: 12 zoom steps in for clear meridian line visibility.
  - **XYZ Axes View**: Standard zoom (baseline) with XY plane orientation.
  - **Locations View**: 8-10 zoom steps in for clear lunar surface location markers.
  - **Descent Orbit View**: 8 zoom steps in for detailed orbit visualization.
- All zoom changes must be restored using an equivalent `zoomOut()` call at test completion.

### Error Handling Requirements
- Any console error should fail the test unless explicitly ignored.
- **Ignored Error Categories:**
  - Google Analytics failures (google-analytics.com, analytics.js)
  - Network resolution failures (ERR_ADDRESS_INVALID)
  - Missing favicon errors (favicon.ico)
  - WebGL shader compilation errors (THREE.WebGLProgram, Shader Error, VALIDATE_STATUS false)
  - WebGL operation errors (WebGL: INVALID_OPERATION)
- All other console errors are considered test failures.
- Console error filtering is applied automatically during test execution.

### URL and Environment Configuration Requirements
- Tests shall not use hardcoded URLs or ports.
- Base URL configurable via environment variables:
  - `VITE_TEST_BASE_URL`: Complete test URL (e.g., `http://localhost:8001`).
- Test target path: `/chandrayaan3.html` appended to base URL.

### Browser Configuration Requirements
- Tests run in Chromium browser with specific launch arguments:
  - Memory optimization: `--max-old-space-size=4096`
  - Garbage collection access: `--expose-gc`
  - Sandbox prevention: `--no-sandbox`
- Browser mode configurable via environment variables:
  - `HEADLESS=true` for headless mode.
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

### Test 1.1: Initial Page Load and Rendering
**Intent:** Verify the application loads correctly with default Earth view and all controls visible.

**Screenshots Generated:**
- `earth-3d-initial-load.png` - Initial page load with Earth mode and all UI elements.

**Exact Test Procedure:**
1.  Wait for the scene to be ready (`window.animationScenes?.geo?.state === window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE`).
2.  Wait for rendering to stabilize.
3.  Take screenshot `earth-3d-initial-load.png` and compare against baseline with `LOW` tolerance.
4.  Verify Earth mode is checked: `page.isChecked('#origin-earth')` must be `true`.
5.  Verify 3D mode is checked: `page.isChecked('#dimension-3D')` must be `true`.
6.  Verify core UI elements exist: `#animate`, `#settings-panel-button`, `#info-button`, etc.

---

## Test Suite 2: Earth Mode Tests

### Test 2.1: Page Load in Earth Mode
**Intent:** Verify the page displays correctly when Earth is the center of reference.

**Screenshots Generated:**
- `earth-3d-page-load.png` - Earth-centered view with default settings.

**Exact Test Procedure:**
1.  Verify page title contains "Chandrayaan 3".
2.  Take screenshot `earth-3d-page-load.png` and compare against baseline with `MID` tolerance.

### Test 2.2: 3D Mode Verification
**Intent:** Confirm the visualization starts in 3D mode.

**Exact Test Procedure:**
1.  Verify 3D mode radio button is checked: `page.locator('#dimension-3D:checked').count()` must be 1.

### Test 2.3: User Interface Elements Check
**Intent:** Verify all control panels and buttons are accessible.

**Exact Test Procedure:**
1.  Verify main UI elements exist (`#animate`, `#settings-panel-button`, etc.).
2.  Verify animation control elements exist (`#faster`, `#slower`, etc.).
3.  Open the settings panel.
4.  Verify all 33 elements within the settings panel exist (origin, camera, plane, view, dimension controls).
5.  Close the settings panel.

### Test 2.4: Timeline Navigation Buttons
**Intent:** Verify all mission milestone buttons navigate to correct points in time.

**Exact Test Procedure:**
1.  Iterate through all 14 timeline buttons (`#burn1` to `#burn14`).
2.  For each button, capture telemetry values before the click.
3.  Click the button.
4.  Verify that telemetry values have changed after the click.

### Test 2.5: Animation Play Control
**Intent:** Validates that the Play button correctly starts the orbital animation.

**Exact Test Procedure:**
1.  Ensure animation is paused.
2.  Capture initial telemetry (e.g., date/time).
3.  Click the "Play" button (`#animate`).
4.  Verify the button text changes to "Pause".
5.  Wait for telemetry to change, confirming the animation is running.
6.  Click the "Pause" button to stop the animation for test completion.

### Test 2.6: Animation Pause Control
**Intent:** Validates that the Pause button correctly stops the orbital animation.

**Exact Test Procedure:**
1.  Ensure animation is running.
2.  Click the "Pause" button (`#animate`).
3.  Verify the button text changes to "Play".
4.  Capture telemetry, wait, and capture again to confirm the values have not changed.

### Test 2.7: Speed Controls
**Intent:** Verify animation speed can be adjusted.

**Exact Test Procedure:**
1.  Verify speed control buttons exist (`#faster`, `#slower`, `#realtime`, `#reset`).
2.  Start animation.
3.  Click `#faster` multiple times, sampling the timeline to see increasing speed.
4.  Click `#slower` multiple times, sampling the timeline to see decreasing speed.
5.  Verify that multiple unique timeline values were captured.
6.  Stop animation.

### Test 2.8: Directional Controls Check
**Intent:** Verify directional control buttons are available.

**Exact Test Procedure:**
1.  Verify directional control buttons exist: `#forward`, `#backward`, `#fastforward`, `#fastbackward`.

### Test 2.9: Direction Control with Timeline
**Intent:** Verify directional controls move the timeline correctly.

**Exact Test Procedure:**
1.  Set a baseline by clicking the "Launch" button (`#burn1`).
2.  Click `#forward` 5 times, capturing the timeline value each time.
3.  Click `#fastforward` 5 times, capturing the timeline value each time.
4.  Click `#backward` 5 times, capturing the timeline value each time.
5.  Click `#fastbackward` 5 times, capturing the timeline value each time.
6.  Verify that the set of 21 captured timeline values has more than one unique value.

### Test 2.10: Plane Selection Views
**Intent:** Verify different orbital plane views can be selected.

**Screenshots Generated:**
- `geo-default-plane.png`, `geo-xy-plane.png`, `geo-yz-plane.png`, `geo-zx-plane.png`, `geo-xy--plane.png`, `geo-yz--plane.png`, `geo-zx--plane.png`, `geo-default-final-plane.png`.

**Exact Test Procedure:**
1.  Deselect orbit displays for a clear view.
2.  Iterate through all 8 plane selection checkboxes.
3.  For each plane, click the selector, close the panel, and take a screenshot.
4.  Compare the screenshot against its corresponding baseline with `MID` tolerance.
5.  Restore orbit displays.

### Test 2.11: 2D/3D Mode Switching
**Intent:** Verify switching between 2D and 3D visualization modes.

**Screenshots Generated:**
- `geo-3d-mode.png`
- `geo-2d-mode.png`
- `geo-3d-mode-restored.png`

**Exact Test Procedure:**
1.  Take a screenshot of the initial 3D mode (`geo-3d-mode.png`).
2.  Switch to 2D mode (`#dimension-2D`).
3.  Take a screenshot of the 2D mode (`geo-2d-mode.png`).
4.  Switch back to 3D mode (`#dimension-3D`).
5.  Take a screenshot of the restored 3D mode (`geo-3d-mode-restored.png`).

### Test 2.12: Poles View Toggle
**Intent:** Validates the Poles view control toggle functionality.

**Screenshots Generated:**
- `geo-poles-enabled.png`
- `geo-poles-disabled.png`
- `geo-poles-restored.png`

**Exact Test Procedure:**
1.  Set up an optimal view (XY plane, orbits hidden).
2.  Zoom in 10 steps using `zoomIn(page, 10)`.
3.  Take `geo-poles-enabled.png` screenshot.
4.  Disable poles view (`#view-poles`).
5.  Take `geo-poles-disabled.png` screenshot.
6.  Re-enable poles view.
7.  Take `geo-poles-restored.png` screenshot.
8.  Restore zoom and initial state.

### Test 2.13: Polar Axes View Toggle
**Intent:** Validates the Polar Axes view control toggle functionality.

**Screenshots Generated:**
- `geo-polar-axes-enabled.png`
- `geo-polar-axes-disabled.png`
- `geo-polar-axes-restored.png`

**Exact Test Procedure:**
1.  Set up an optimal view (YZ- plane, orbits hidden).
2.  Zoom in 12 steps using `zoomIn(page, 12)`.
3.  Take `geo-polar-axes-enabled.png` screenshot.
4.  Disable polar axes view (`#view-polar-axes`).
5.  Take `geo-polar-axes-disabled.png` screenshot.
6.  Re-enable polar axes view.
7.  Take `geo-polar-axes-restored.png` screenshot.
8.  Restore zoom and initial state.

### Test 2.14: XYZ Axes View Toggle
**Intent:** Verify coordinate axes can be displayed.

**Screenshots Generated:**
- `geo-xyz-axes-enabled.png`
- `geo-xyz-axes-disabled.png`
- `geo-xyz-axes-restored.png`

**Exact Test Procedure:**
1.  Set up an optimal view (XY plane, orbits hidden).
2.  Take `geo-xyz-axes-enabled.png` screenshot.
3.  Disable XYZ axes view (`#view-xyz-axes`).
4.  Take `geo-xyz-axes-disabled.png` screenshot.
5.  Re-enable XYZ axes view.
6.  Take `geo-xyz-axes-restored.png` screenshot.
7.  Restore initial state.

### Test 2.15: Additional View Controls
**Intent:** Verify other specialized visualization options work correctly.

#### Test 2.15.1: Moon's SOI View
**Screenshots Generated:**
- `earth-3d-moon-soi-view-enabled.png`
- `earth-3d-moon-soi-view-disabled.png`

#### Test 2.15.2: Ecliptic Plane View
**Screenshots Generated:**
- `earth-3d-ecliptic-plane-view-enabled.png`
- `earth-3d-ecliptic-plane-view-disabled.png`

#### Test 2.15.3: Equatorial Plane View
**Screenshots Generated:**
- `earth-3d-equatorial-plane-view-enabled.png`
- `earth-3d-equatorial-plane-view-disabled.png`

### Test 2.16: Joy Ride Control
**Intent:** Verify joy ride camera mode can be activated.

**Screenshots Generated:**
- `geo-joyride-enabled.png`

**Exact Test Procedure:**
1.  Navigate to a suitable timeline point (`#burn3`).
2.  Enable Joy Ride (`#joyride`).
3.  Take `geo-joyride-enabled.png` screenshot and compare.
4.  Disable Joy Ride to clean up.

### Test 2.17: CY3 Orbit Display
**Intent:** Verify main orbit path can be toggled.

**Screenshots Generated:**
- `geo-cy3-orbit-checked.png`
- `geo-cy3-orbit-unchecked.png`
- `geo-cy3-orbit-checked-again.png`

**Exact Test Procedure:**
1.  Ensure orbit is checked (`#view-orbit`).
2.  Take `geo-cy3-orbit-checked.png` screenshot.
3.  Uncheck orbit.
4.  Take `geo-cy3-orbit-unchecked.png` screenshot.
5.  Re-check orbit.
6.  Take `geo-cy3-orbit-checked-again.png` and compare against the first screenshot.

### Test 2.18: Final Stability Check
**Intent:** Verify application remains stable after all Earth mode tests.

**Screenshots Generated:**
- `geo-stability-initial.png`
- `geo-stability-final.png`

**Exact Test Procedure:**
1.  Take an initial stability screenshot (`geo-stability-initial.png`).
2.  Verify core functional elements are still present and in the correct state.
3.  Perform a quick responsiveness test by clicking several timeline buttons.
4.  Take a final stability screenshot (`geo-stability-final.png`).

---

## Test Suite 3: Moon Mode Tests

### General Procedure
- Before running this suite, the origin is switched to Moon (`#origin-moon`).
- The tests from Suite 2 are conceptually repeated, but with Moon as the reference point. Screenshots are prefixed with `lunar-` instead of `geo-`.

### Test 3.1: Page Load in Moon Mode
**Screenshots Generated:** `lunar-page-load.png`

### Test 3.2: 3D Mode Verification
(No screenshots)

### Test 3.3: Plane Selection Views
**Screenshots Generated:** `lunar-default-plane.png`, `lunar-xy-plane.png`, etc.

### Test 3.4: 2D/3D Mode Switching
**Screenshots Generated:** `lunar-3d-mode.png`, `lunar-2d-mode.png`, `lunar-3d-mode-restored.png`

### Test 3.5: Poles View Toggle
**Screenshots Generated:** `lunar-poles-enabled.png`, `lunar-poles-disabled.png`, `lunar-poles-restored.png`
**Note:** Uses `zoomIn(page, 10)`.

### Test 3.6: Polar Axes View Toggle
**Screenshots Generated:** `lunar-polar-axes-enabled.png`, `lunar-polar-axes-disabled.png`, `lunar-polar-axes-restored.png`
**Note:** Uses `zoomIn(page, 12)`.

### Test 3.7: XYZ Axes View Toggle
**Screenshots Generated:** `lunar-xyz-axes-enabled.png`, `lunar-xyz-axes-disabled.png`, `lunar-xyz-axes-restored.png`

### Test 3.8: Additional View Controls

#### Test 3.8.1: Moon's SOI View
**Screenshots Generated:**
- `moon-3d-moon-soi-view-enabled.png`
- `moon-3d-moon-soi-view-disabled.png`

#### Test 3.8.2: Ecliptic Plane View
**Screenshots Generated:**
- `moon-3d-ecliptic-plane-view-enabled.png`
- `moon-3d-ecliptic-plane-view-disabled.png`

#### Test 3.8.3: Equatorial Plane View
**Screenshots Generated:**
- `moon-3d-equatorial-plane-view-enabled.png`
- `moon-3d-equatorial-plane-view-disabled.png`

### Test 3.9: CY3 Orbit Display
**Screenshots Generated:** `lunar-cy3-orbit-checked.png`, `lunar-cy3-orbit-unchecked.png`

### Test 3.10: CY3 Descent Orbit Display
**Intent:** Verify descent orbit path can be toggled.
**Screenshots Generated:** `lunar-cy3-descent-orbit-checked.png`, `lunar-cy3-descent-orbit-unchecked.png`, `lunar-cy3-descent-orbit-checked-again.png`
**Note:** Uses XY- plane and zooms in 8 steps.

### Test 3.11: Landing Animation
**Intent:** Verify landing sequence animation can be triggered.
**Screenshots Generated:** `lunar-landing-enabled.png`
**Note:** Navigates to `#burn12` before enabling `#landing`.

### Test 3.12: Locations View
**Intent:** Verify Moon surface locations can be displayed.
**Screenshots Generated:** `lunar-locations-enabled.png`, `lunar-locations-disabled.png`, `lunar-locations-restored.png`
**Note:** Uses XY- plane and zooms in 8-10 steps.

---

## Test Case Validation Checklist

This checklist tracks the validation status of each test case.

### Test Suite 1: Initial Application Load

| Test ID | Test Name | Execution ✓ | Specific Req ✓ | Generic Req ✓ |
|---------|-----------|-------------|----------------|----------------|
| 1.1 | Initial Page Load and Rendering | ⬜ | ⬜ | ⬜ |

### Test Suite 2: Earth Mode Tests

| Test ID | Test Name | Execution ✓ | Specific Req ✓ | Generic Req ✓ |
|---------|-----------|-------------|----------------|----------------|
| 2.1 | Page Load in Earth Mode | ⬜ | ⬜ | ⬜ |
| 2.2 | 3D Mode Verification | ⬜ | ⬜ | ⬜ |
| 2.3 | User Interface Elements Check | ⬜ | ⬜ | ⬜ |
| 2.4 | Timeline Navigation Buttons | ⬜ | ⬜ | ⬜ |
| 2.5 | Animation Play Control | ⬜ | ⬜ | ⬜ |
| 2.6 | Animation Pause Control | ⬜ | ⬜ | ⬜ |
| 2.7 | Speed Controls | ⬜ | ⬜ | ⬜ |
| 2.8 | Directional Controls Check | ⬜ | ⬜ | ⬜ |
| 2.9 | Direction Control with Timeline | ⬜ | ⬜ | ⬜ |
| 2.10 | Plane Selection Views | ⬜ | ⬜ | ⬜ |
| 2.11 | 2D/3D Mode Switching | ⬜ | ⬜ | ⬜ |
| 2.12 | Poles View Toggle | ⬜ | ⬜ | ⬜ |
| 2.13 | Polar Axes View Toggle | ⬜ | ⬜ | ⬜ |
| 2.14 | XYZ Axes View Toggle | ⬜ | ⬜ | ⬜ |
| 2.15 | Additional View Controls | ⬜ | ⬜ | ⬜ |
| 2.16 | Joy Ride Control | ⬜ | ⬜ | ⬜ |
| 2.17 | CY3 Orbit Display | ⬜ | ⬜ | ⬜ |
| 2.18 | Final Stability Check | ⬜ | ⬜ | ⬜ |

### Test Suite 3: Moon Mode Tests

| Test ID | Test Name | Execution ✓ | Specific Req ✓ | Generic Req ✓ |
|---------|-----------|-------------|----------------|----------------|
| 3.1 | Page Load in Moon Mode | ⬜ | ⬜ | ⬜ |
| 3.2 | 3D Mode Verification | ⬜ | ⬜ | ⬜ |
| 3.3 | Plane Selection Views | ⬜ | ⬜ | ⬜ |
| 3.4 | 2D/3D Mode Switching | ⬜ | ⬜ | ⬜ |
| 3.5 | Poles View Toggle | ⬜ | ⬜ | ⬜ |
| 3.6 | Polar Axes View Toggle | ⬜ | ⬜ | ⬜ |
| 3.7 | XYZ Axes View Toggle | ⬜ | ⬜ | ⬜ |
| 3.8 | Additional View Controls | ⬜ | ⬜ | ⬜ |
| 3.9 | CY3 Orbit Display | ⬜ | ⬜ | ⬜ |
| 3.10 | CY3 Descent Orbit Display | ⬜ | ⬜ | ⬜ |
| 3.11 | Landing Animation | ⬜ | ⬜ | ⬜ |
| 3.12 | Locations View | ⬜ | ⬜ | ⬜ |

**Legend:**
- ⬜ Not validated
- ✅ Validated and passing
- ❌ Validated but failing
- ⚠️ Partially validated
