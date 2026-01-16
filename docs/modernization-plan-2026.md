# Mission.js Modernization Plan (January 2026)

## Executive Summary

This plan outlines the incremental modernization of `mission.js` from a 4,822-line monolithic file into a modular, maintainable architecture. Each iteration is designed to be completable in 1-3 days with automated tests verifying no regressions.

**Key Principle**: Every iteration must pass all existing tests before proceeding.

## Current State Assessment

### What We Have

| Component | Status | Lines | Notes |
|-----------|--------|-------|-------|
| `mission.js` | Monolithic | 4,822 | 162 global `var` declarations |
| `core/constants.js` | Created | 83 | ⚠️ Not properly integrated |
| `core/dom.js` | Created | 289 | ✅ Working |
| `utils/math-utils.js` | Created | 150 | ⚠️ Not imported in mission.js |
| `astro.js` | Working | - | Julian dates, coordinates |
| `astronomy-bodies.js` | Working | - | Moon/Earth via Astronomy Engine |
| `chebyshev.js` | Working | - | Orbit interpolation |

### Test Infrastructure

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `ui.test.js` | ~47 | Visual regression, UI interactions |
| `mission-smoke.test.js` | 16 | Multi-mission smoke tests |
| `chebyshev-accuracy.test.js` | - | Data accuracy |

### Multi-Mission Support (Already Working)

- ✅ Mission selector page (`mission.html`)
- ✅ URL routing (`?mission=cy2`, `?mission=a10`, etc.)
- ✅ Mission-specific `config.json` files
- ✅ Chandrayaan 2, Chandrayaan 3, Apollo 10, Apollo 11 missions

### Critical Issues to Fix

1. **Constants Not Integrated**: `core/constants.js` exists but mission.js re-declares all constants as global `var`s
2. **Math Utils Not Used**: `utils/math-utils.js` exists but isn't imported in mission.js
3. **Global State Pollution**: 162 global `var` declarations
4. **No Clear Module Boundaries**: Rendering, UI, animation, data all mixed

---

## Phase 1: Foundation Fixes (Iterations 1-3)

Fix the incomplete previous work and establish proper module integration.

### Iteration 1: Fix Constants Integration
**Duration**: 1 day
**Goal**: Remove global var re-declarations, use constants module directly

**Changes**:
```javascript
// BEFORE (current - broken)
import { PHYSICS_CONSTANTS } from "./core/constants.js";
var EARTH_RADIUS_KM = PHYSICS_CONSTANTS.EARTH_RADIUS_KM; // Defeats purpose!

// AFTER (correct)
import { PHYSICS_CONSTANTS } from "./core/constants.js";
// Use PHYSICS_CONSTANTS.EARTH_RADIUS_KM directly in code
```

**Tasks**:
1. Create list of all constant usages in mission.js
2. Replace `EARTH_RADIUS_KM` → `PHYSICS_CONSTANTS.EARTH_RADIUS_KM` etc.
3. Remove the 20+ global var constant re-declarations
4. Run full test suite

**Verification**:
```bash
npm test                           # All tests pass
grep -c "^var.*=" mission.js       # Count reduced by ~20
```

**Success Criteria**:
- [ ] All tests pass (47 UI + 16 smoke)
- [ ] No global vars that duplicate constants.js values
- [ ] mission.js line count reduced

---

### Iteration 2: Integrate Math Utils
**Duration**: 1 day
**Goal**: Import and use existing math-utils.js functions

**Changes**:
```javascript
// Add import
import {
    degreesToRadians,
    radiansToDegrees,
    clamp,
    distance3D,
    lerp,
    formatFloat
} from "./utils/math-utils.js";

// Replace inline math with utility calls
```

**Tasks**:
1. Add import statement for math-utils.js
2. Find and replace inline calculations with utility functions
3. Remove any duplicate function definitions
4. Run full test suite

**Verification**:
```bash
npm test                           # All tests pass
grep -c "Math.PI / 180" mission.js # Should be 0
```

**Success Criteria**:
- [ ] All tests pass
- [ ] math-utils.js imported and used
- [ ] No duplicate math functions in mission.js

---

### Iteration 3: Extract Color Constants
**Duration**: 1 day
**Goal**: Move color definitions to constants module

**Changes**:
```javascript
// Add to core/constants.js
export const COLORS = {
    BLACK: 0x000000,
    EARTH_AXIS: 0xFFFF00,
    MOON_AXIS: 0xFFFF00,
    MOON_SOI: 0x414141,
    NORTH_POLE: 0xff6347,
    SOUTH_POLE: 0x6a5acd,
    ECLIPTIC_PLANE: 0xFFFFE0,
    EQUATORIAL_PLANE: 0xABEBC6,
    PRIMARY_LIGHT: 0xFFFFFF,
    AMBIENT_LIGHT: 0x222222,
};

export const LIGHT_SETTINGS = {
    PRIMARY_INTENSITY: 2.5,
    AMBIENT_INTENSITY: 1.5,
    CRAFT_PRIMARY_INTENSITY: 2.5,
    CRAFT_AMBIENT_INTENSITY: 1.5,
};
```

**Tasks**:
1. Add COLORS and LIGHT_SETTINGS to constants.js
2. Update imports in mission.js
3. Replace color variables with constants
4. Remove global color var declarations
5. Run full test suite

**Verification**:
```bash
npm test                           # All tests pass
grep -c "var.*Color" mission.js    # Should be 0
```

**Success Criteria**:
- [ ] All tests pass
- [ ] All colors defined in constants.js
- [ ] ~15 fewer global vars in mission.js

---

## Phase 2: Extract Pure Functions (Iterations 4-7)

Extract functions with no side effects into dedicated modules.

### Iteration 4: Extract Time/Date Utilities
**Duration**: 2 days
**Goal**: Create `utils/time-utils.js` for date formatting and time calculations

**Functions to Extract**:
- `formatDateOnly()`
- `formatTimeOnly()`
- `formatDateTime()`
- `getHoursMinutes()`
- `formatDuration()`
- Any pure time calculation functions

**New Module**: `assets/platform/js/utils/time-utils.js`

**Verification**:
```bash
npm test                           # All tests pass
# Timeline displays show correct times
```

**Success Criteria**:
- [ ] All tests pass
- [ ] time-utils.js created with 5+ functions
- [ ] All time formatting uses new module

---

### Iteration 5: Extract Coordinate Transforms
**Duration**: 2 days
**Goal**: Create `utils/coordinates.js` for coordinate system conversions

**Functions to Extract**:
- Ecliptic ↔ Equatorial conversions
- Cartesian ↔ Spherical conversions
- Geocentric ↔ Selenocentric transforms
- Rotation matrix operations

**New Module**: `assets/platform/js/utils/coordinates.js`

**Verification**:
```bash
npm test                           # All tests pass
# Spacecraft positions render correctly in both origins
```

**Success Criteria**:
- [ ] All tests pass
- [ ] coordinates.js created
- [ ] Coordinate transforms isolated from rendering code

---

### Iteration 6: Extract Telemetry Calculations
**Duration**: 2 days
**Goal**: Create `utils/telemetry.js` for altitude, velocity, distance calculations

**Functions to Extract**:
- `calculateAltitude()`
- `calculateVelocity()`
- `calculateDistance()`
- `calculateOrbitalElements()`
- Apoapsis/periapsis calculations

**New Module**: `assets/platform/js/utils/telemetry.js`

**Verification**:
```bash
npm test                           # All tests pass
# Telemetry panel shows correct values
```

**Success Criteria**:
- [ ] All tests pass
- [ ] telemetry.js created
- [ ] All spacecraft metrics calculated via new module

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

### Iteration 8: Extract Animation Controller
**Duration**: 3 days
**Goal**: Create `animation/animation-controller.js`

**Responsibilities**:
- Play/pause state
- Speed control
- Timeline position
- Animation loop management

**New Module**: `assets/platform/js/animation/animation-controller.js`

**Verification**:
```bash
npm test                           # All tests pass
# Animation controls work: play, pause, speed, timeline
```

**Success Criteria**:
- [ ] All tests pass
- [ ] Animation state isolated in controller
- [ ] UI controls communicate via controller

---

### Iteration 9: Extract Camera Controller
**Duration**: 3 days
**Goal**: Create `rendering/camera-controller.js`

**Responsibilities**:
- Camera position and target
- Lock-on functionality
- Preset views (XY, YZ, ZX planes)
- Zoom controls

**New Module**: `assets/platform/js/rendering/camera-controller.js`

**Verification**:
```bash
npm test                           # All tests pass
# Camera controls work: lock-on, planes, zoom
```

**Success Criteria**:
- [ ] All tests pass
- [ ] Camera logic isolated
- [ ] Lock-on bugs easier to debug

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

### Iteration 11: Extract Scene Builder
**Duration**: 3 days
**Goal**: Create `rendering/scene-builder.js` for THREE.js scene construction

**Responsibilities**:
- Create Earth, Moon, spacecraft meshes
- Create orbit curves
- Set up lighting
- Create axes and planes

**New Module**: `assets/platform/js/rendering/scene-builder.js`

**Verification**:
```bash
npm test                           # All tests pass
# 3D scene renders correctly with all objects
```

**Success Criteria**:
- [ ] All tests pass
- [ ] Scene construction isolated
- [ ] Easy to add new celestial bodies

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
| 1 | Fix Constants Integration | 🔄 | -/- | - |
| 2 | Integrate Math Utils | 🔄 | -/- | - |
| 3 | Extract Color Constants | 🔄 | -/- | - |
| 4 | Extract Time Utils | 🔄 | -/- | - |
| 5 | Extract Coordinates | 🔄 | -/- | - |
| 6 | Extract Telemetry | 🔄 | -/- | - |
| 7 | Extract 2D Rendering | 🔄 | -/- | - |
| 8 | Animation Controller | 🔄 | -/- | - |
| 9 | Camera Controller | 🔄 | -/- | - |
| 10 | UI State Manager | 🔄 | -/- | - |
| 11 | Scene Builder | 🔄 | -/- | - |
| 12 | Event Handlers | 🔄 | -/- | - |
| 13 | Mission Data Manager | 🔄 | -/- | - |
| 14 | Event Bus | 🔄 | -/- | - |
| 15 | Refactor Entry Point | 🔄 | -/- | - |

**Legend**: 🔄 Planned | 🚧 In Progress | ✅ Complete | ⚠️ Blocked

---

## Success Metrics

### Quantitative Goals

| Metric | Current | Target |
|--------|---------|--------|
| mission.js lines | 4,822 | < 600 |
| Global vars | 162 | < 20 |
| Modules | 7 | 15+ |
| Max function length | 200+ | < 50 |
| Test count | 63 | 80+ |

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

## Appendix: Module Dependency Graph (Target)

```
mission.js (entry point, ~500 lines)
├── core/
│   ├── constants.js
│   ├── dom.js
│   └── event-bus.js
├── utils/
│   ├── math-utils.js
│   ├── time-utils.js
│   ├── coordinates.js
│   └── telemetry.js
├── data/
│   ├── mission-data.js
│   └── chebyshev.js
├── rendering/
│   ├── scene-builder.js
│   ├── camera-controller.js
│   └── svg-utils.js
├── animation/
│   └── animation-controller.js
├── ui/
│   ├── ui-state.js
│   └── event-handlers.js
└── external/
    ├── astro.js
    └── astronomy-bodies.js
```

---

*Created: January 2026*
*Based on: claude-mission-js-refactoring-proposal.md, gemini-mission-js-refactoring-proposal.md*
