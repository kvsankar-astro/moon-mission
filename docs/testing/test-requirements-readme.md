# Test Requirements Documentation

This directory contains all test-related specifications, requirements, and research documentation for the Chandrayaan-3 mission visualization test suite.

## Contents

### Core Documentation
- **`test-specification.md`** - Complete test specification document with detailed test cases for both Earth and Moon modes
- **`test-ids-reference.md`** - Reference guide for test IDs and naming conventions

### Research & Analysis
- **`plane-selection-expected-behaviors.md`** - Research findings on orbital plane selection behaviors and expected XYZ axes patterns
- **`plane-selection-observations.json`** - Raw observation data from plane selection research

## Test Implementation

### **Test Suite: `../ui.test.js`**
- 48 tests covering core UI flows across 3D and 2D modes
- Visual regression testing with SSIM-based screenshot comparison
- Baseline images in `test/screenshots/baseline/` (missing baselines are created automatically)
- Per-run SSIM history persisted in `test/screenshots/ssim-history.json`

### **Configuration**
- **Base URL**: controlled via `VITE_TEST_BASE_URL` (defaults to `http://localhost:8111`)
- **Render determinism**: tests use `?testMode=true` to enforce consistent pixel ratio and AA settings
- **Thresholds**: SSIM thresholds are defined in `test/ui.test.js` (single source of truth)

## Purpose

This folder consolidates:
- Test specifications and requirements
- Research findings and behavioral documentation  
- Historical test development insights
- Reference data for test implementation
- Zoom configuration documentation

## Usage

Test developers should refer to these documents when:
1. Implementing new test cases
2. Understanding expected UI behaviors
3. Configuring zoom levels and camera controls
4. Validating test results
5. Updating test specifications

## Test Architecture

### **File Structure**
```
test/
├── ui.test.js                        # Main UI/visual regression suite
├── config/                           # Test configuration files
└── screenshots/
    ├── baseline/                    # baseline images (committed; currently 84)
    ├── current/                     # Runtime screenshots (ignored)
    ├── diff/                        # Optional/manual artifacts (ignored)
    └── ssim-history.json            # SSIM history (written by ui.test.js)
```

### **Test Categories**
- **Earth / Moon origin**: key flows validated in both perspectives
- **3D / 2D rendering**: mode switching and baseline rendering checks
- **Coverage**: UI elements, timeline navigation, view controls, plane selection, stability checks

## Related Files

- **Main test implementation**: `test/ui.test.js`
- **Test configuration**: `test/config/`
- **Baseline images**: `test/screenshots/baseline/`
