# Mission.js Modernization Plan (January 2026)

## Executive Summary

This plan outlines the incremental modernization of `mission.js` from a 4,822-line monolithic file into a modular, maintainable architecture. Each iteration is designed to be completable in 1-3 days with automated tests verifying no regressions.

**Key Principle**: Every iteration must pass all existing tests before proceeding.

## Current State Assessment (Updated January 17, 2026)

### What We Have

| Component | Status | Lines/Size | Notes |
|-----------|--------|------------|-------|
| `mission.js` | Refactoring | ~4,300 | AnimationScene class, still large but improving |
| `core/constants.js` | ✅ Working | 83 | PHYSICS, COLORS, LIGHT_SETTINGS integrated |
| `core/dom.js` | ✅ Working | 289 | DOM utilities |
| `utils/math-utils.js` | ✅ Working | 150 | Math utilities |
| `utils/time-utils.js` | ✅ NEW | 220 | Time/date utilities |
| `rendering/camera-controller.js` | ✅ NEW | 225 | Camera management extracted |
| `rendering/spacecraft-renderer.js` | ✅ NEW | 324 | Spacecraft visualization extracted |
| `rendering/light-manager.js` | ✅ NEW | 80 | Two-layer lighting extracted |
| `rendering/earth-renderer.js` | ✅ NEW | 250 | Earth rendering extracted |
| `rendering/moon-renderer.js` | ✅ NEW | 275 | Moon rendering extracted |
| `rendering/sky-renderer.js` | ✅ NEW | 180 | Starfield/constellations extracted |
| `rendering/scene-helpers.js` | ✅ NEW | 260 | Axes/planes/SOI extracted |
| `animation/animation-controller.js` | ✅ NEW | 324 | Animation state management |
| `astro.js` | ✅ Working | - | Julian dates, lunar pole |
| `astronomy-bodies.js` | ✅ Working | - | Moon/Earth via Astronomy Engine |
| `chebyshev.js` | ✅ Working | - | Orbit interpolation |

### Test Infrastructure

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `ui.test.js` | 47 | Visual regression, UI interactions |
| `mission-smoke.test.js` | 16 | Multi-mission smoke tests |
| `chebyshev-accuracy.test.js` | - | Data accuracy |

### Multi-Mission Support (Working)

- ✅ Mission selector page (`mission.html`)
- ✅ URL routing (`?mission=cy2`, `?mission=cy3`, `?mission=apollo10-lm`, `?mission=apollo11-sivb`)
- ✅ Mission-specific `config.json` files
- ✅ Chandrayaan 2, Chandrayaan 3, Apollo 10 LM, Apollo 11 S-IVB missions

### Recent Achievements (January 2026)

1. **7 Renderer Classes Extracted**: Camera, spacecraft, lights, Earth, Moon, sky, scene helpers
2. **Animation Controller Extracted**: Play/pause, speed, timeline management centralized
3. **Two-Layer Lighting System**: Separate lighting for celestial bodies (layer 0) and spacecraft (layer 1)
4. **Constants Integrated**: COLORS and LIGHT_SETTINGS centralized in constants.js
5. **All 47 Visual Regression Tests Passing**: Each extraction verified with SSIM-based comparison

### Remaining Issues

1. ~~**Animation Logic Mixed**~~: ✅ Extracted to AnimationController (Jan 17, 2026)
2. **UI State Scattered**: Settings, view options spread across methods
3. **Event Handlers Inline**: Button clicks, keyboard shortcuts not centralized
4. **Global Variables**: Still has global vars, though reduced from original

---

## Phase 1: Foundation Fixes (Iterations 1-3)

Fix the incomplete previous work and establish proper module integration.

### Iteration 1: Fix Constants Integration ✅ COMPLETED
**Duration**: Completed January 2026
**Goal**: Remove global var re-declarations, use constants module directly

**Status**: ✅ COMPLETED

Constants are properly imported with aliases and used throughout mission.js:

```javascript
// In mission.js (lines 5-13)
import {
    CELESTIAL_BODIES as CB,
    COLORS as COL,
    FORMAT_CONSTANTS as FC,
    LIGHT_SETTINGS as LT,
    PHYSICS_CONSTANTS as PC,
    TIME_CONSTANTS as TC,
    UI_CONSTANTS as UC
} from "./core/constants.js";

// Usage examples:
PC.EARTH_RADIUS_KM    // Physics constants
TC.ONE_MINUTE_MS      // Time constants
UC.ZOOM_SCALE         // UI constants
```

**Completed**:
- ✅ All constants imported with short aliases (PC, TC, UC, FC, COL, LT, CB)
- ✅ No redundant global var re-declarations of constants
- ✅ All 47 tests pass

---

### Iteration 2: Integrate Math Utils ✅ COMPLETED
**Duration**: Completed January 2026
**Goal**: Import and use existing math-utils.js functions

**Status**: ✅ COMPLETED

Math utilities are imported and used in mission.js:

```javascript
// In mission.js (line 28)
import { degreesToRadians, distance3D, sphericalToCartesian, velocityToAngle } from "./utils/math-utils.js";
```

**Completed**:
- ✅ math-utils.js imported in mission.js
- ✅ `degreesToRadians()` used for angle conversions
- ✅ `distance3D()` used for distance calculations
- ✅ `sphericalToCartesian()` used for coordinate conversions
- ✅ `velocityToAngle()` used for velocity vector calculations
- ✅ All 47 tests pass

---

### Iteration 3: Extract Color Constants ✅ COMPLETED
**Duration**: Completed January 2026
**Goal**: Move color definitions to constants module

**Status**: ✅ COMPLETED

COLORS and LIGHT_SETTINGS have been added to `core/constants.js` and are used by the extracted rendering modules:

```javascript
// In core/constants.js
export const COLORS = {
    BLACK: 0x000000,
    EARTH_AXIS: 0xFFFF00,
    MOON_AXIS: 0xFFFF00,
    MOON_SOI: 0x414141,
    NORTH_POLE: 0xff6347,
    SOUTH_POLE: 0x6a5acd,
    ECLIPTIC_PLANE: 0xFFFFE0,
    EQUATORIAL_PLANE: 0xABEBC6,
    // ... more colors
};

export const LIGHT_SETTINGS = {
    PRIMARY_INTENSITY: 2.5,
    AMBIENT_INTENSITY: 1.5,
    CRAFT_PRIMARY_INTENSITY: 2.5,
    CRAFT_AMBIENT_INTENSITY: 1.5,
};
```

**Completed**:
- ✅ COLORS exported from constants.js
- ✅ LIGHT_SETTINGS exported from constants.js
- ✅ Used by light-manager.js, earth-renderer.js, moon-renderer.js, scene-helpers.js
- ✅ All 47 tests pass

---

## Phase 2: Extract Pure Functions (Iterations 4-7)

Extract functions with no side effects into dedicated modules.

### Iteration 4: Extract Time/Date Utilities ✅ COMPLETED
**Duration**: Completed January 17, 2026
**Goal**: Create `utils/time-utils.js` for date formatting and time calculations

**Status**: ✅ COMPLETED

Time utilities module created at `assets/platform/js/utils/time-utils.js` with 10 functions:

**Functions Implemented**:
- `createUTCTimestamp(year, month, day, hour, minute)` - Create UTC timestamp from components
- `dateFromConfigComponents(config)` - Create UTC timestamp from config object
- `getDateComponentsUTC(dateOrTimestamp)` - Extract UTC components for ephemeris
- `formatDateTimeIST(dateOrTimestamp)` - Format date/time in IST (ready for future use)
- `formatDateOnly(dateOrTimestamp)` - Format date portion only
- `formatTimeOnly(dateOrTimestamp)` - Format time portion only
- `formatDuration(durationMs, options)` - Human-readable duration formatting
- `getHoursMinutes(dateOrTimestamp, utc)` - Extract hours and minutes
- `padZero(num, length)` - Zero-pad numbers
- `formatHMS(hours, minutes, seconds)` - Format as HH:MM:SS
- `calculateElapsedTime(startMs, endMs)` - Calculate time between timestamps

**Integration**:
- `createUTCTimestamp()` used in `updateLandingTimesFromConfig()` and `getStartAndEndTimes()`
- `getDateComponentsUTC()` used in `setLocation()` for ephemeris calculations
- `formatDateTimeIST()` imported and ready as commented TODO for future date display

**Completed**:
- ✅ All tests pass (48/48)
- ✅ time-utils.js created with 10+ functions
- ✅ Internal time calculations use new module
- ✅ Display format unchanged (TODO commented for future enhancement)

---

### Iteration 5: Consolidate Coordinate/Angle Utilities ✅ COMPLETED
**Duration**: Completed January 17, 2026
**Goal**: Consolidate duplicate angle conversion functions and verify coordinate transforms are in proper modules

**Analysis Findings**:
Coordinate transforms were already properly organized:
- `sphericalToCartesian`, `degreesToRadians`, `radiansToDegrees` → `math-utils.js`
- `rotateToEcliptic` (equatorial↔ecliptic) → `astronomy-bodies.js` (uses Astronomy Engine)
- `getMoonState`, `getEarthFromMoonState` (geocentric↔selenocentric) → `astronomy-bodies.js`

**Problem Found**: Duplicate `deg_to_rad` function in `astro.js` identical to `degreesToRadians` in `math-utils.js`

**Changes Made**:
1. Updated `astro.js` to import `degreesToRadians` from `math-utils.js`
2. Re-exported as `deg_to_rad` alias for backwards compatibility
3. Created `normalizeAndConvertToRadians()` helper for lunar pole calculations
4. Updated `mission.js` to import `degreesToRadians` from `math-utils.js` (not `astro.js`)
5. Removed duplicate implementation from `astro.js`

**Note**: A separate `coordinates.js` module was NOT created because it would be redundant - coordinate transforms are already in their proper modules.

**Completed**:
- ✅ All tests pass (48/48)
- ✅ Duplicate `deg_to_rad` consolidated to use `math-utils.js`
- ✅ `mission.js` uses canonical `degreesToRadians` from `math-utils.js`

---

### Iteration 6: Extract Telemetry Calculations ⏭️ SKIPPED
**Duration**: Evaluated January 17, 2026
**Goal**: Create `utils/telemetry.js` for altitude, velocity, distance calculations

**Analysis Findings**:
The telemetry calculations in mission.js are simple, self-documenting expressions:
- Altitude: `r - bodyRadius` (trivial subtraction)
- Distance: `position.length()` (THREE.js Vector3 method)
- Relative distance: `pos1.distanceTo(pos2)` (THREE.js Vector3 method)
- Velocity: `velocity.length()` (THREE.js Vector3 method)

**Decision**: NOT EXTRACTED - Wrapping these trivial expressions in functions would:
1. Obscure the simple math (`r - pbr` is clearer than `calculateAltitude(r, pbr)`)
2. Add unnecessary abstraction overhead
3. Make the code harder to understand at a glance

The THREE.js Vector3 methods are already optimized and well-named. Simple arithmetic
like `distance - radius = altitude` is immediately clear without abstraction.

**Principle**: Only extract functions when they encapsulate non-trivial logic or
provide meaningful abstraction. Don't wrap single-operator expressions.

---

### Iteration 7: Extract 2D Rendering Utilities
**Duration**: 2 days
**Goal**: Create `rendering/svg-utils.js` for D3/SVG operations

**Functions to Extract**:
- SVG element creation helpers
- D3 scale and axis utilities
- 2D orbit curve generation
- Label positioning

**New Module**: `assets/platform/js/rendering/svg-utils.js`

**Verification**:
```bash
npm test                           # All tests pass
# 2D mode renders correctly
```

**Success Criteria**:
- [ ] All tests pass
- [ ] svg-utils.js created
- [ ] 2D rendering code cleaner

---

## Phase 3: Extract Stateful Components (Iterations 8-12)

Extract components that manage state.

### Iteration 8: Extract Animation Controller ✅ COMPLETED
**Duration**: Completed January 17, 2026
**Goal**: Create `animation/animation-controller.js`

**Status**: ✅ COMPLETED

AnimationController class extracted to `assets/platform/js/animation/animation-controller.js` (324 lines):

**Features Implemented**:
- Play/pause state management with `toggle()`, `play()`, `pause()`
- Speed control with `faster()`, `slower()`, `resetSpeed()`, `setRealtimeSpeed()`
- Timeline navigation: `stepForward()`, `stepBackward()`, `fastForward()`, `fastBackward()`
- Event navigation: `goToStart()`, `goToEnd()`, `goToEvent()`, `goToNow()`
- Animation tick with `tick(currentFrameTime)` for frame updates
- Callback-based architecture for decoupling from DOM/scene

**Architecture**:
```javascript
var animationController = new AnimationController({
    onTimeChange: (time) => { /* sync animTime, update scene */ },
    onPlayStateChange: (isPlaying) => { /* sync UI state */ },
    onSpeedChange: (multiplier, isRealtime) => { /* sync speed state */ }
});

animationController.configure({
    startTime: startTime,
    endTime: endTime,
    stepDurationMs: stepDuration,
    stepsPerHop: 60
});
```

**Completed**:
- ✅ All tests pass (47/47)
- ✅ Animation state isolated in controller
- ✅ UI controls communicate via controller callbacks
- ✅ Backward compatibility maintained via global state sync

---

### Iteration 9: Extract Camera Controller ✅ COMPLETED
**Duration**: Completed January 17, 2026
**Goal**: Create `rendering/camera-controller.js`

**Status**: ✅ COMPLETED

CameraController class extracted to `assets/platform/js/rendering/camera-controller.js` (225 lines):

**Features Implemented**:
- Three camera types: main perspective, craft-attached, drone-attached
- TrackballControls integration for user interaction
- Methods: `createMainCamera()`, `createCraftCamera()`, `createDroneCamera()`
- Methods: `setPosition()`, `setFov()`, `setUp()`, `getDistanceFromOrigin()`
- Methods: `updateAspect()`, `dispose()`

**Completed**:
- ✅ CameraController class created
- ✅ Main, craft, and drone cameras managed
- ✅ TrackballControls integrated
- ✅ AnimationScene uses CameraController via property references
- ✅ All 47 tests pass

---

### Iteration 10: Extract UI State Manager
**Duration**: 2 days
**Goal**: Create `ui/ui-state.js` for UI state management

**Responsibilities**:
- Settings panel state
- View options (3D/2D, Earth/Moon origin)
- Display preferences
- Panel visibility

**New Module**: `assets/platform/js/ui/ui-state.js`

**Verification**:
```bash
npm test                           # All tests pass
# UI state persists correctly across interactions
```

**Success Criteria**:
- [ ] All tests pass
- [ ] UI state centralized
- [ ] Settings changes propagate correctly

---

### Iteration 11: Extract Scene Builder ✅ LARGELY COMPLETED
**Duration**: Completed January 16-17, 2026
**Goal**: Create modular rendering classes for THREE.js scene construction

**Status**: ✅ LARGELY COMPLETED (via individual renderer classes)

Instead of a single SceneBuilder, rendering has been split into 7 specialized classes:

| Class | File | Lines | Responsibility |
|-------|------|-------|----------------|
| `CameraController` | camera-controller.js | 225 | Camera management |
| `SpacecraftRenderer` | spacecraft-renderer.js | 324 | Spacecraft + drone |
| `LightManager` | light-manager.js | 80 | Two-layer lighting |
| `EarthRenderer` | earth-renderer.js | 250 | Earth sphere + axis |
| `MoonRenderer` | moon-renderer.js | 275 | Moon sphere + axis |
| `SkyRenderer` | sky-renderer.js | 180 | Starfield + constellations |
| `SceneHelpers` | scene-helpers.js | 260 | Axes, planes, SOI |

**Architecture**:
- Each renderer is self-contained with `create()` and `dispose()` methods
- AnimationScene orchestrates all renderers
- Two-layer lighting: Layer 0 for celestial bodies, Layer 1 for spacecraft
- Property references maintained for backward compatibility

**Completed**:
- ✅ Earth/Moon mesh creation isolated
- ✅ Spacecraft rendering isolated (geometric + GLTF modes)
- ✅ Lighting setup isolated
- ✅ Axes and planes isolated
- ✅ Sky/starfield isolated
- ✅ All 47 tests pass

**Remaining (for full Scene Builder)**:
- [ ] Orbit curve generation (still in mission.js)
- [ ] Scene initialization orchestration

---

### Iteration 12: Extract Event Handlers
**Duration**: 2 days
**Goal**: Create `ui/event-handlers.js` for UI event binding

**Responsibilities**:
- Button click handlers
- Keyboard shortcuts
- Settings change handlers
- Window resize handling

**New Module**: `assets/platform/js/ui/event-handlers.js`

**Verification**:
```bash
npm test                           # All tests pass
# All UI interactions work correctly
```

**Success Criteria**:
- [ ] All tests pass
- [ ] Event handlers isolated
- [ ] mission.js significantly smaller

---

## Phase 4: Architecture Refinement (Iterations 13-15)

Establish clean architecture with clear module boundaries.

### Iteration 13: Create Mission Data Manager
**Duration**: 2 days
**Goal**: Create `data/mission-data.js` for mission-specific data handling

**Responsibilities**:
- Load mission config
- Load orbit data (Chebyshev)
- Cache data
- Provide data to components

**New Module**: `assets/platform/js/data/mission-data.js`

**Verification**:
```bash
npm test                           # All tests pass
# All missions load data correctly
```

---

### Iteration 14: Create Event Bus
**Duration**: 2 days
**Goal**: Create `core/event-bus.js` for inter-module communication

**Responsibilities**:
- Pub/sub event system
- Decouple modules
- Enable loose coupling

**New Module**: `assets/platform/js/core/event-bus.js`

**Events**:
- `animation:play`, `animation:pause`, `animation:timeChanged`
- `camera:lockOn`, `camera:viewChanged`
- `settings:originChanged`, `settings:dimensionChanged`
- `mission:loaded`, `mission:changed`

**Verification**:
```bash
npm test                           # All tests pass
# Modules communicate via events
```

---

### Iteration 15: Refactor Main Entry Point
**Duration**: 2 days
**Goal**: Slim down mission.js to orchestration only

**Target**: mission.js should be ~500 lines, primarily:
- Module imports
- Initialization sequence
- Top-level orchestration

**Verification**:
```bash
npm test                           # All tests pass
wc -l mission.js                   # < 600 lines
```

---

## Phase 5: Future Enhancements (Optional)

These iterations are optional and depend on project needs.

### Iteration 16: jQuery UI Migration
**Goal**: Replace jQuery UI with Micromodal.js (247KB → 1.9KB)

### Iteration 17: Camera System Redesign
**Goal**: Implement "from-to" camera system per camera-redesign-proposal.md

### Iteration 18: Plugin Architecture
**Goal**: Make missions truly pluggable without code changes

### Iteration 19: TypeScript Migration
**Goal**: Add TypeScript for better maintainability

---

## Test Verification Protocol

Every iteration MUST follow this protocol:

### Before Starting
```bash
# Run full test suite, confirm baseline
npm test
# Record: X tests passing, Y seconds
```

### During Development
```bash
# Run tests frequently
npm test -- --reporter=dot    # Quick feedback
```

### Before Committing
```bash
# Full verification
npm test                      # All tests pass
npm run lint                  # No lint errors (if configured)

# Visual verification
npm run dev                   # Start dev server
# Manually verify key functionality:
# - 3D mode renders
# - 2D mode renders
# - Animation plays
# - Mission switching works
```

### Commit Message Format
```
Iteration N: Brief description

- Extracted X to new module Y
- Removed N global variables
- Tests: X/X passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Progress Tracking

| Iteration | Description | Status | Tests | Date |
|-----------|-------------|--------|-------|------|
| 1 | Fix Constants Integration | ✅ | 47/47 | Jan 2026 |
| 2 | Integrate Math Utils | ✅ | 47/47 | Jan 2026 |
| 3 | Extract Color Constants | ✅ | 47/47 | Jan 2026 |
| 4 | Extract Time Utils | ✅ | 48/48 | Jan 17, 2026 |
| 5 | Consolidate Angle Utils | ✅ | 48/48 | Jan 17, 2026 |
| 6 | Extract Telemetry | ⏭️ | N/A | Jan 17, 2026 |
| 7 | Extract 2D Rendering | 🔄 | -/- | - |
| 8 | Animation Controller | ✅ | 47/47 | Jan 17, 2026 |
| 9 | Camera Controller | ✅ | 47/47 | Jan 17, 2026 |
| 10 | UI State Manager | 🔄 | -/- | - |
| 11 | Scene Builder | ✅ | 47/47 | Jan 16-17, 2026 |
| 12 | Event Handlers | 🔄 | -/- | - |
| 13 | Mission Data Manager | 🔄 | -/- | - |
| 14 | Event Bus | 🔄 | -/- | - |
| 15 | Refactor Entry Point | 🔄 | -/- | - |

**Legend**: 🔄 Planned | 🚧 In Progress | ✅ Complete | ⏭️ Skipped | ⚠️ Blocked

### Additional Completions (Not in Original Plan)

The following renderer classes were extracted as part of Iteration 11:

| Class | Extracted | Lines | Tests |
|-------|-----------|-------|-------|
| SpacecraftRenderer | Jan 17, 2026 | 324 | 47/47 |
| LightManager | Jan 17, 2026 | 80 | 47/47 |
| EarthRenderer | Jan 17, 2026 | 250 | 47/47 |
| MoonRenderer | Jan 17, 2026 | 275 | 47/47 |
| SkyRenderer | Jan 16, 2026 | 180 | 47/47 |
| SceneHelpers | Jan 16, 2026 | 260 | 47/47 |

---

## Success Metrics

### Quantitative Goals

| Metric | Original | Current (Jan 2026) | Target |
|--------|----------|-------------------|--------|
| mission.js lines | 4,822 | ~4,300 | < 600 |
| Global vars | 162 | ~100 (est.) | < 20 |
| Modules | 7 | 16 | 15+ |
| Max function length | 200+ | ~150 | < 50 |
| Test count | 63 | 63 | 80+ |
| Extracted renderers | 0 | 7 | 7 ✅ |
| Core utilities | 2 | 4 | 5+ |

### Qualitative Goals

- [ ] New developer can understand architecture in < 1 hour
- [ ] Adding a new mission requires only config.json
- [ ] Bug fixes are localized to single modules
- [ ] Unit tests possible for individual modules

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Breaking changes | Small iterations, test after each |
| Performance regression | Profile before/after Phase 3 |
| Module coupling | Event bus for communication |

### Process Risks

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict iteration boundaries |
| Test gaps | Add tests before extracting |
| Lost functionality | Manual smoke test checklist |

---

## Manual Smoke Test Checklist

Run after each iteration:

- [ ] Mission selector page loads
- [ ] CY3 mission loads and animates
- [ ] CY2 mission loads and animates
- [ ] Apollo 10 mission loads
- [ ] Apollo 11 mission loads
- [ ] 3D mode renders Earth, Moon, spacecraft
- [ ] 2D mode renders orbits
- [ ] Earth/Moon origin switch works
- [ ] Animation play/pause works
- [ ] Speed controls work
- [ ] Timeline events clickable
- [ ] Camera lock-on works
- [ ] Plane selection works
- [ ] No console errors

---

## Appendix: Module Dependency Graph

### Current State (January 2026)

```
mission.js (AnimationScene class, ~4,300 lines)
├── core/
│   ├── constants.js ✅
│   └── dom.js ✅
├── utils/
│   ├── math-utils.js ✅
│   └── time-utils.js ✅
├── animation/ ✅ NEW
│   └── animation-controller.js ✅
├── rendering/ ✅
│   ├── camera-controller.js ✅
│   ├── spacecraft-renderer.js ✅
│   ├── light-manager.js ✅
│   ├── earth-renderer.js ✅
│   ├── moon-renderer.js ✅
│   ├── sky-renderer.js ✅
│   └── scene-helpers.js ✅
├── external/
│   ├── astro.js ✅
│   ├── astronomy-bodies.js ✅
│   └── chebyshev.js ✅
└── third-party/
    ├── THREE.js
    ├── D3.js
    └── jQuery/jQuery UI
```

### Target State

```
mission.js (entry point, ~500 lines)
├── core/
│   ├── constants.js ✅
│   ├── dom.js ✅
│   └── event-bus.js 🔄
├── utils/
│   ├── math-utils.js ✅
│   ├── time-utils.js ✅
│   ├── coordinates.js 🔄
│   └── telemetry.js 🔄
├── data/
│   ├── mission-data.js 🔄
│   └── chebyshev.js ✅
├── rendering/
│   ├── camera-controller.js ✅
│   ├── spacecraft-renderer.js ✅
│   ├── light-manager.js ✅
│   ├── earth-renderer.js ✅
│   ├── moon-renderer.js ✅
│   ├── sky-renderer.js ✅
│   ├── scene-helpers.js ✅
│   └── svg-utils.js 🔄
├── animation/
│   └── animation-controller.js ✅
├── ui/
│   ├── ui-state.js 🔄
│   └── event-handlers.js 🔄
└── external/
    ├── astro.js ✅
    └── astronomy-bodies.js ✅
```

**Legend**: ✅ Complete | 🔄 Planned

---

*Created: January 2026*
*Based on: claude-mission-js-refactoring-proposal.md, gemini-mission-js-refactoring-proposal.md*
