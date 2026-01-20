# Test Configuration Files

This document describes files under `test/config/` that may be used by tests at runtime.

## Contents

### Baseline Configuration
- **`directional-controls-baseline.json`** - Expected timeline values and test sequence patterns for directional navigation controls validation

## Purpose

This folder contains:
- ✅ Runtime configuration files for tests
- ✅ Baseline data files used for comparison during test execution  
- ✅ Test behavior configuration and expected values

## Usage

At the moment, `test/ui.test.js` does not load any files from `test/config/`.

`test/config/directional-controls-baseline.json` is currently a legacy artifact and can be:
- deleted (if confirmed unused), or
- wired back in if we want to validate directional/timeline expectations from a declarative baseline file.

## Related Directories

- **Test implementation**: `test/ui.test.js`
- **Screenshots / SSIM history**: `test/screenshots/`
