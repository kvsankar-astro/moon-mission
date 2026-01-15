# Test ID Reference Guide

This document provides a complete mapping of test IDs to their purposes for the Chandrayaan-3 test suite.

## Test ID Naming Convention

Format: `{mode}-{category}-{specific}`
- **mode**: `earth` or `moon` 
- **category**: `page`, `animation`, `view`, `controls`, etc.
- **specific**: descriptive identifier

## Complete Test ID Mapping

### Initial Application Load
- `earth-page-load` - Initial page load and rendering verification

### Earth Mode Tests  
- `earth-mode-load` - Page load in Earth mode
- `earth-3d-mode` - 3D mode verification
- `earth-ui-elements` - User interface elements check
- `earth-stellar-sky` - Stellar sky view toggle
- `earth-timeline-nav` - Timeline navigation buttons
- `earth-animation-play` - Animation play control
- `earth-animation-pause` - Animation pause control
- `earth-speed-controls` - Speed controls functionality
- `earth-direction-controls` - Directional controls availability
- `earth-direction-timeline` - Directional controls with timeline verification
- `earth-plane-selection` - Complete plane selection cycle
- `earth-2d-mode` - 2D/3D mode switching (to 2D)
- `earth-poles-view` - Poles view toggle
- `earth-polar-axes` - Polar axes view toggle
- `earth-xyz-axes` - XYZ axes view toggle
- `earth-view-controls` - Additional view controls
- `earth-joyride` - Joy ride control
- `earth-landing` - Landing animation control
- `earth-orbit-toggle` - CY3 orbit display toggle
- `earth-descent-orbit` - CY3 descent orbit toggle
- `earth-3d-restore` - 2D/3D mode switching (restore to 3D)
- `earth-stability` - Final stability check

### Moon Mode Tests
- `moon-mode-suite` - Complete Moon mode test suite (mirrors Earth tests)
- `moon-locations-view` - Locations view (Moon mode only)

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