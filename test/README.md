# Chandrayaan-3 Animation Testing

This directory contains automated tests for the Chandrayaan-3 animation to ensure functionality is preserved during refactoring.

## Quick Setup

### Windows (PowerShell/CMD)
```cmd
npm install
run-test.cmd
```

### Cross-Platform
```bash
npm install
npm run test:verbose
```

## What the Test Verifies

The test checks the **actual** Chandrayaan-3 application structure:

✅ **Core Libraries**
- THREE.js loaded and accessible
- Math utilities imported correctly (post-refactoring)
- jQuery and D3.js available
- No critical JavaScript errors

✅ **Application Structure** 
- Main HTML containers (`#wrapper`, `#canvas-wrapper`, `#svg-wrapper`)
- UI controls (`#origin-earth`, `#origin-moon`, `#reset`, etc.)
- Stats displays (`#distance-SC-EARTH`, `#velocity-SC-MOON`, etc.)
- Mission configuration loaded correctly

✅ **Functionality**
- Main function exists and is callable
- Application initializes without errors
- WebGL context can be created (if 3D mode)

## Usage During Refactoring

Run this test **after each iteration** to ensure functionality is preserved:

```bash
# Before making changes
npm run test:baseline

# After each refactoring iteration
npm run test:verbose
```

The test should **ALWAYS PASS** throughout the refactoring process.

## Test Files

- `animation-test.js` - Main test script using Puppeteer
- `README.md` - This file
- `../run-test.cmd` - Windows batch file for easy testing
- `../package.json` - Contains test scripts

## Troubleshooting

### "Puppeteer not found" Error
Install dependencies: `npm install`

### "Server failed to start" Error  
Ensure port 8000 is available or change the port in `animation-test.js`

### Test Failures
1. Check for JavaScript errors in browser console
2. Verify all files are in correct locations
3. Ensure no syntax errors in modified code
4. Run `npm run test:verbose` for detailed output

## Technical Details

The test:
1. Starts a local HTTP server (Python or Node.js)
2. Launches headless browser with Puppeteer
3. Loads the actual `chandrayaan3.html` page
4. Verifies all critical elements and libraries are present
5. Reports success/failure with detailed information

No modifications are made to production code - the test works entirely externally.