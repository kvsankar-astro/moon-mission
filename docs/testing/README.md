# Chandrayaan-3 Animation Testing

This directory contains comprehensive automated UI tests for the Chandrayaan-3 animation, ensuring functionality across both orbital perspectives and all interaction modes.

## Quick Setup

```bash
npm install
npm test
```

## Test Architecture

### **Comprehensive UI Testing**
- **Framework:** Vitest + Playwright for browser automation
- **Approach:** Parameterized dual-mode testing across geocentric and selenocentric perspectives
- **Coverage:** 58 automated tests with zero-pixel tolerance visual regression testing

### **Dual Orbital Mode Testing**
- **Geocentric Mode:** 29 tests covering Earth-centered orbital perspective
- **Selenocentric Mode:** 29 tests covering Moon-centered orbital perspective
- **Mode Verification:** Automatic orbital origin verification and switching

### **Visual Regression Testing**
- **Zero-pixel tolerance:** Exact screenshot matching for UI consistency
- **11 screenshot tests** covering all rendering modes and UI states
- **Baseline management:** Proper geo/lunar prefixed baseline images

## Test Coverage

### **UI Component Testing**
- **Page Load Verification:** Title, critical UI elements presence
- **Timeline Event Buttons:** All 15 mission events (Launch, EBNs, TLI, LBNs, Landing)
- **Animation Controls:** Play/Pause functionality, speed controls, directional controls
- **Plane Selection:** XY and YZ plane switching with visual verification
- **Dimension Controls:** 2D/3D mode switching with proper state restoration
- **Orbital Origin:** Geocentric (Earth) and Selenocentric (Moon) mode verification

### **Visual Regression Testing**
- **XY Plane Orientation:** Axes alignment verification (Red right, Green up)
- **YZ Plane Orientation:** Axes alignment verification (Green right, Blue up)
- **3D Mode Rendering:** WebGL context and 3D visualization state
- **2D Mode Rendering:** SVG visualization state
- **Mode Restoration:** Proper return to 3D after 2D testing cycles

### **Error Monitoring**
- **Console Error Detection:** Real-time monitoring during all test cases
- **Browser Error Tracking:** Comprehensive error logging with timestamps and locations
- **Stability Verification:** Application state stability after intensive testing

## Test Execution

### **Running Tests**

```bash
# Run all tests once and exit
npm test

# Run tests in watch mode (re-run on file changes)
npx vitest test/baseline-ui.test.js

# Run with specific timeout
npx vitest test/baseline-ui.test.js --run --timeout 300000
```

### **Test Behavior**
- **Duration:** ~4 minutes (240 seconds) for complete dual-mode testing
- **Browser:** Runs in headed mode (visible browser window) for visual debugging
- **Server:** Automatically starts Vite dev server on port 8000
- **Reports:** Generates timestamped CSV and JSON reports in `test/reports/`

### **Watch Mode Commands**
When in watch mode, use these keyboard shortcuts:
- **`q`** - Quit test runner
- **`r`** - Rerun all tests  
- **`f`** - Rerun only failed tests
- **`h`** - Show help

## Test Reports

### **Automated Report Generation**
- **CSV Reports:** `test/reports/pixel-differences-report_{timestamp}.csv`
- **JSON Logs:** `test/reports/test-run-logs_{timestamp}.json`
- **Screenshot Files:** Baseline and current comparison images

### **Report Contents**
- **Pixel Differences:** Exact pixel difference counts for each screenshot test
- **Test Timing:** Detailed timing information for performance analysis
- **Error Tracking:** Console errors with timestamps and locations
- **Test Summary:** Pass/fail status with exact match counts

## File Structure

```
test/
├── baseline-ui.test.js              # Main comprehensive test suite
├── README.md                        # This documentation
├── reports/                         # Generated test reports (ignored by git)
│   ├── pixel-differences-report_*.csv
│   └── test-run-logs_*.json
└── screenshots/
    └── baseline/
        ├── geo-*-baseline.png       # Geocentric mode baselines (tracked)
        ├── lunar-*-baseline.png     # Selenocentric mode baselines (tracked)
        └── *-current.png            # Current comparison files (ignored by git)
```

## Troubleshooting

### **Test Timeouts**
- Most tests have 15-30 second timeouts
- 2D/3D mode switching tests have 35 second timeout
- Increase global timeout if needed: `npx vitest --timeout 300000`

### **Browser Issues**
- Tests run in headed mode - close any stuck browser windows manually
- Press `Ctrl+C` to force quit if browser hangs
- Check if Vite server is still running on port 8000

### **Screenshot Failures**
- Visual differences indicate UI changes or rendering inconsistencies
- Check CSV reports for exact pixel difference counts
- Regenerate baselines if intentional UI changes were made:
  ```bash
  # Delete specific baseline to force regeneration
  rm test/screenshots/baseline/geo-xy-plane-baseline.png
  npm test
  ```

### **Port Conflicts**
- Default port 8000 must be available for Vite dev server
- Change port in test file if needed:
  ```javascript
  await page.goto('http://127.0.0.1:8001/chandrayaan3.html');
  ```

## Technical Architecture

### **Test Framework Stack**
- **Vitest:** Modern test framework with TypeScript support
- **Playwright:** Cross-browser automation and screenshots
- **Chromium:** Browser engine for consistent testing environment

### **Test Execution Flow**
1. **Setup:** Start Vite dev server, launch Chromium browser
2. **Navigation:** Load chandrayaan3.html and wait for orbit data
3. **Dual-Mode Testing:** Run complete test suite in both geocentric and selenocentric modes
4. **Screenshot Comparison:** Capture and compare with zero-pixel tolerance
5. **Report Generation:** Create timestamped CSV and JSON reports
6. **Cleanup:** Close browser and stop server

### **Visual Regression Strategy**
- **Baseline Images:** Git-tracked reference screenshots for comparison
- **Current Images:** Temporary comparison files (git-ignored)
- **Zero Tolerance:** Exact byte-for-byte image matching required
- **Automated Regeneration:** Missing baselines created automatically during test runs