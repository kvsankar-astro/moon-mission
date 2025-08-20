# Test Configuration Files

This directory contains configuration files used by the test suite at runtime.

## Contents

### Baseline Configuration
- **`directional-controls-baseline.json`** - Expected timeline values and test sequence patterns for directional navigation controls validation

## Purpose

This folder contains:
- ✅ Runtime configuration files for tests
- ✅ Baseline data files used for comparison during test execution  
- ✅ Test behavior configuration and expected values

## Usage

These files are automatically loaded by the test suite during execution:
- Tests compare actual results against baseline values
- Configuration files define expected behaviors and test sequences
- Files are read programmatically by `baseline-ui.test.js`

## Related Directories

- **Test implementation**: `../baseline-ui.test.js`
- **Test requirements**: `../test-requirements/` 
- **Test results**: `../reports/` and `../screenshots/`