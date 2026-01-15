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
- 35 tests covering all functionality
- Visual regression testing with baseline images
- Centralized zoom configuration using `TEST_MODES`
- Scene state handling for both Earth and Moon modes
- Sky background management for consistent testing

### **Configuration**
- **Zoom Configuration**: Centralized `TEST_MODES` with specific zoom levels
  - Earth poles/polar axes: 10 steps
  - Moon SOI: 30 steps
  - Zoom restoration after SOI tests
- **Scene Management**: Context-aware scene state checking
- **Visual Consistency**: Sky background disabled during tests

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
├── ui.test.js                        # Main test suite (35 tests)
├── config/                           # Test configuration files
├── test-requirements/               # This documentation directory
└── screenshots/
    ├── baseline/                    # 67 baseline images (committed)
    ├── current/                     # Runtime screenshots (ignored)
    ├── diff/                        # Difference images (ignored)
    └── analysis/                    # Analysis output (ignored)
```

### **Test Categories**
- **Earth Mode**: 21 tests (page load, controls, view toggles, mode switching)
- **Moon Mode**: 14 tests (specialized lunar functionality, locations, landing)
- **Coverage**: UI elements, timeline navigation, view controls, plane selection, mode switching

## Related Files

- **Main test implementation**: `../ui.test.js`
- **Test configuration**: `../config/`
- **Baseline images**: `../screenshots/baseline/` (67 PNG files)
- **TypeScript support**: `../../src/types/globals.d.ts`