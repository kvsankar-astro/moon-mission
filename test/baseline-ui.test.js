import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Test run tracking
const testRunId = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
const testResults = [];
const testLogs = [];

// Logging functions
function logTestEvent(level, message, testName = '', details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    testName,
    details
  };
  testLogs.push(logEntry);
  console.log(`[${level}] ${message}${testName ? ` (${testName})` : ''}`);
}

function saveTestRunReports() {
  const reportsDir = join(process.cwd(), 'test', 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save detailed logs
  const logFile = join(reportsDir, `test-run-logs_${testRunId}.json`);
  const logData = {
    testRunId,
    startTime: testLogs[0]?.timestamp || new Date().toISOString(),
    endTime: new Date().toISOString(),
    totalTests: testResults.length,
    logs: testLogs,
    summary: {
      exactMatches: testResults.filter(r => r.pixelDifference === 0).length,
      pixelDifferences: testResults.filter(r => r.pixelDifference > 0).length,
      errors: testResults.filter(r => r.status === 'ERROR').length
    }
  };
  writeFileSync(logFile, JSON.stringify(logData, null, 2));
  
  // Save CSV report
  const csvFile = join(reportsDir, `pixel-differences-report_${testRunId}.csv`);
  const csvHeaders = [
    'TestCase',
    'BaselineImage', 
    'CurrentImage',
    'PixelDiff',
    'SizeDiff',
    'Status',
    'Message',
    'Timestamp'
  ];
  
  const csvRows = [csvHeaders.join(',')];
  testResults.forEach(result => {
    const row = [
      `"${result.testCase}"`,
      `"${result.baselineImage}"`,
      `"${result.currentImage}"`,
      result.pixelDifference,
      result.sizeDifference,
      `"${result.status}"`,
      `"${result.message}"`,
      `"${result.timestamp}"`
    ];
    csvRows.push(row.join(','));
  });
  
  writeFileSync(csvFile, csvRows.join('\n'));
  
  console.log(`\n📊 Test Run Reports Generated:`);
  console.log(`   📋 Logs: ${logFile}`);
  console.log(`   📈 CSV:  ${csvFile}`);
  console.log(`   🎯 Run ID: ${testRunId}`);
  
  return { logFile, csvFile };
}

// Helper function to wait for orbit rendering to complete
async function waitForOrbitRenderingComplete(page, timeout = 20000) {
  // Extended approach: longer waits for orbit rendering stability
  console.log('⏳ Waiting for orbit rendering to complete...');
  await page.waitForTimeout(timeout);
  console.log('✅ Orbit rendering wait completed');
}

// Helper function to ensure complete animation pause and rendering stability
async function ensureStableRenderingState(page) {
  // Click Launch button for consistent timeline position
  await page.click('#burn1');
  await page.waitForTimeout(500);
  
  // Check current button state and pause if needed
  const playButton = await page.locator('#animate:has-text("Play")').count();
  const pauseButton = await page.locator('#animate:has-text("Pause")').count();
  
  if (pauseButton > 0) {
    // Animation is running (Pause button visible), so click to pause
    await page.click('#animate');
    await page.waitForTimeout(500);
    console.log('⏸️  Animation paused for stable rendering');
  } else if (playButton > 0) {
    // Animation already paused (Play button visible), no action needed
    console.log('✅ Animation already paused - stable for screenshots');
  }
  
  // Wait additional time for any residual animations or rendering to complete
  await page.waitForTimeout(2000);
  console.log('✅ Stable rendering state achieved');
}

// Helper function for screenshot comparison with pixel difference calculation
async function compareScreenshots(page, screenshotName, expectedPath, testCase = '') {
  const timestamp = new Date().toISOString();
  
  // Ensure screenshots directory exists
  const screenshotsDir = join(process.cwd(), 'test', 'screenshots', 'baseline');
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const actualPath = join(screenshotsDir, screenshotName);
  const expectedFullPath = join(screenshotsDir, expectedPath);
  
  logTestEvent('INFO', `Taking screenshot: ${screenshotName}`, testCase);
  
  // Take current screenshot
  const screenshot = await page.screenshot({ fullPage: false, path: actualPath });
  
  // If this is the first run, save as baseline
  if (!existsSync(expectedFullPath)) {
    writeFileSync(expectedFullPath, screenshot);
    logTestEvent('INFO', `Baseline screenshot saved: ${expectedPath}`, testCase);
    
    // Record in test results
    testResults.push({
      testCase,
      baselineImage: expectedPath,
      currentImage: screenshotName,
      pixelDifference: 0,
      sizeDifference: 0,
      status: 'BASELINE_CREATED',
      message: 'Baseline created',
      timestamp
    });
    
    return { isMatch: true, pixelDifference: 0, sizeDifference: 0, message: 'Baseline created' };
  }
  
  // Compare with existing baseline
  const expectedScreenshot = readFileSync(expectedFullPath);
  
  // Simple comparison - in a real implementation, you'd use image comparison library
  const sizeDifference = Math.abs(screenshot.length - expectedScreenshot.length);
  const isExactMatch = screenshot.equals(expectedScreenshot);
  
  if (isExactMatch) {
    logTestEvent('SUCCESS', `Screenshot comparison: Exact match`, testCase);
    
    // Record in test results
    testResults.push({
      testCase,
      baselineImage: expectedPath,
      currentImage: screenshotName,
      pixelDifference: 0,
      sizeDifference: 0,
      status: 'EXACT_MATCH',
      message: 'Exact match',
      timestamp
    });
    
    return { isMatch: true, pixelDifference: 0, sizeDifference: 0, message: 'Exact match' };
  } else {
    // Calculate approximate pixel difference based on file size difference
    const approximatePixelDiff = Math.round(sizeDifference / 3); // Rough estimate (RGB bytes per pixel)
    const message = `Size difference: ${sizeDifference} bytes, ~${approximatePixelDiff} pixels changed`;
    
    logTestEvent('WARNING', `Screenshot comparison: ${message}`, testCase);
    
    // Record in test results
    testResults.push({
      testCase,
      baselineImage: expectedPath,
      currentImage: screenshotName,
      pixelDifference: approximatePixelDiff,
      sizeDifference,
      status: 'PIXEL_DIFFERENCE',
      message,
      timestamp
    });
    
    return { 
      isMatch: false, 
      pixelDifference: approximatePixelDiff, 
      sizeDifference,
      message
    };
  }
}

// Test modes configuration
const testModes = [
  {
    name: 'Geocentric (Earth)',
    radioId: '#origin-earth',
    screenshotPrefix: 'geo'
  },
  {
    name: 'Selenocentric (Moon)', 
    radioId: '#origin-moon',
    screenshotPrefix: 'lunar'
  }
];

describe('Chandrayaan-3 UI Baseline Tests', () => {
  let browser, page, server;
  let consoleErrors = [];
  
  beforeAll(async () => {
    logTestEvent('INFO', `Starting test run`, '', { testRunId, timestamp: new Date().toISOString() });
    // Start Vite dev server (Windows compatible)
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    
    server = spawn(npmCmd, ['run', 'dev'], { 
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: isWindows
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Launch browser
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    
    // Set up console error monitoring
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Navigate and wait for data load
    await page.goto('http://127.0.0.1:8000/chandrayaan3.html');
    await page.waitForFunction(() => {
      const progressBar = document.querySelector('#progressbar');
      const playButton = document.querySelector('#animate');
      return progressBar && 
             !progressBar.textContent.includes('Loading orbit data') &&
             playButton && 
             !playButton.disabled;
    }, { timeout: 30000 });
    
    // Wait for initial orbit rendering to complete
    console.log('🌍 Waiting for initial geocentric orbit rendering...');
    await waitForOrbitRenderingComplete(page);
  }, 60000);
  
  afterAll(async () => {
    logTestEvent('INFO', 'Cleaning up test resources');
    await browser?.close();
    server?.kill();
    
    // Generate and save test run reports
    logTestEvent('INFO', 'Generating test run reports');
    const reports = saveTestRunReports();
    logTestEvent('SUCCESS', `Test run completed. Reports saved: ${reports.logFile}, ${reports.csvFile}`);
  }, 30000);

  // Clear console errors before each test
  beforeEach(() => {
    consoleErrors = [];
  });

  // Check for console errors after each test
  afterEach((context) => {
    if (consoleErrors.length > 0) {
      console.log(`❌ Console errors detected during test: ${context.task.name}`);
      consoleErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.text} (${error.timestamp})`);
        if (error.location) {
          console.log(`      Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
      });
      expect(consoleErrors).toHaveLength(0);
    }
  });

  // Function to create test suites for each mode
  function createModeTestSuite(mode) {
    describe(`${mode.name} Mode Tests`, () => {
      
      beforeAll(async () => {
        // Open settings panel first to access mode radio buttons
        await page.click('#settings-panel-button');
        await page.waitForTimeout(500);
        
        // Switch to the specified mode (Earth or Moon)
        console.log(`🔧 Switching to ${mode.name} mode (${mode.radioId})...`);
        await page.click(mode.radioId);
        await page.waitForTimeout(2000); // Increased wait for mode switch
        
        // Verify the mode switch was successful
        const modeVerification = await page.evaluate((radioId) => {
          const element = document.querySelector(radioId + ':checked');
          return {
            isChecked: element ? true : false,
            value: element ? element.value : null
          };
        }, mode.radioId);
        
        console.log(`🔍 Mode verification: ${JSON.stringify(modeVerification)}`);
        if (!modeVerification.isChecked) {
          throw new Error(`Failed to switch to ${mode.name} mode - radio button not checked`);
        }
        
        // Wait for orbit rendering to complete after mode switch
        console.log(`🌍🌙 Mode switch confirmed - waiting for orbit rendering...`);
        await waitForOrbitRenderingComplete(page);
        
        console.log(`✅ ${mode.name} mode ready for comprehensive testing`);
      }, 60000);

      describe('Page Load and UI Elements', () => {
        it('should load the page successfully', async () => {
          expect(await page.title()).toContain('Chandrayaan 3');
        });
        
        it(`should be in ${mode.name} mode`, async () => {
          const modeActive = await page.locator(`${mode.radioId}:checked`).count();
          expect(modeActive).toBe(1);
        });
        
        it('should start in 3D mode', async () => {
          const mode3D = await page.locator('#dimension-3D:checked').count();
          expect(mode3D).toBe(1);
        });
        
        it('should have all critical UI elements present', async () => {
          expect(await page.locator('#animate').count()).toBe(1); // Play button
          expect(await page.locator('#settings-panel-button').count()).toBe(1); // Settings
          expect(await page.locator('#info-button').count()).toBe(1); // Info
          expect(await page.locator('#burn1').count()).toBe(1); // Timeline
          expect(await page.locator('#distance-SC-EARTH').count()).toBe(1); // Telemetry
        });
      });
      
      describe('Timeline Event Buttons', () => {
        const timelineButtons = [
          { name: 'EBN#1', id: '#burn2' },
          { name: 'EBN#2', id: '#burn3' },
          { name: 'EBN#3', id: '#burn4' },
          { name: 'EBN#4', id: '#burn5' },
          { name: 'EBN#5', id: '#burn6' },
          { name: 'TLI', id: '#burn7' },
          { name: 'LBN#1/LOI', id: '#burn8' },
          { name: 'LBN#1', id: '#burn9' },
          { name: 'LBN#2', id: '#burn10' },
          { name: 'LBN#3', id: '#burn11' },
          { name: 'LBN#4', id: '#burn12' },
          { name: 'Vikram Landing', id: '#burn13' },
          { name: 'CY3 Data End', id: '#burn14' },
          { name: 'Now', id: '#burn15' },
          { name: 'Launch', id: '#burn1' }
        ];
        
        timelineButtons.forEach(({ name, id }) => {
          it(`should make ${name} button trigger timeline jump`, async () => {
            const beforeDate = await page.locator('#date').textContent();
            const beforeDistance = await page.locator('#distance-SC-EARTH').textContent();
            
            await page.click(id);
            await page.waitForTimeout(500);
            
            const afterDate = await page.locator('#date').textContent();
            const afterDistance = await page.locator('#distance-SC-EARTH').textContent();
            
            const dateChanged = beforeDate !== afterDate;
            const distanceChanged = beforeDistance !== afterDistance;
            
            // Special case for "Now" button - maps to mission end
            if (name === 'Now') {
              expect(afterDate).toContain('2023'); // Mission ended in 2023
            } else {
              expect(dateChanged || distanceChanged).toBe(true);
            }
          });
        });
      });
      
      describe('Animation Controls', () => {
        it('should start animation when Play is clicked', async () => {
          await page.click('#animate');
          await page.waitForTimeout(500);
          
          const pauseButtonExists = await page.locator('#animate:has-text("Pause")').count();
          expect(pauseButtonExists).toBe(1);
        });
        
        it('should pause animation when Pause is clicked', async () => {
          await page.click('#animate'); // Should be Pause now
          await page.waitForTimeout(300);
          
          const playButtonBack = await page.locator('#animate:has-text("Play")').count();
          expect(playButtonBack).toBe(1);
        });
        
        it('should have speed controls available', async () => {
          expect(await page.locator('#faster').count()).toBe(1);
          expect(await page.locator('#slower').count()).toBe(1);
          expect(await page.locator('#realtime').count()).toBe(1);
        });
        
        it('should have directional controls available', async () => {
          expect(await page.locator('#forward').count()).toBe(1);
          expect(await page.locator('#backward').count()).toBe(1);
        });
      });

      describe('Plane Selection Controls', () => {
        beforeAll(async () => {
          // Ensure settings panel is open for plane controls
          await page.click('#settings-panel-button');
          await page.waitForTimeout(500);
          
          // Uncheck CY3 Orbit and CY3 Descent Orbit for cleaner plane analysis
          await page.click('#view-orbit'); // Uncheck CY3 Orbit
          await page.waitForTimeout(200);
          await page.click('#view-orbit-descent'); // Uncheck CY3 Descent Orbit
          await page.waitForTimeout(500);
          
          // ALWAYS click Launch button for consistent timeline position
          await page.click('#burn1'); // Launch button
          await page.waitForTimeout(500);
          
          // Check current button state and pause if needed
          const playButton = await page.locator('#animate:has-text("Play")').count();
          const pauseButton = await page.locator('#animate:has-text("Pause")').count();
          
          if (pauseButton > 0) {
            // Animation is running (Pause button visible), so click to pause
            await page.click('#animate');
            await page.waitForTimeout(200);
            console.log('🔧 Animation paused at Launch position for consistent plane selection screenshots');
          } else if (playButton > 0) {
            console.log('🔧 Animation already paused at Launch position for consistent plane selection screenshots');
          }
        }, 45000);

        // Helper function to ensure consistent state before each test
        async function ensureConsistentState() {
          // Use enhanced stable rendering state
          await ensureStableRenderingState(page);
          
          // Force XY plane selection (even if it appears checked, need to click for proper 3D state)
          await page.click('#checkbox-lock-xy');
          await page.waitForTimeout(1000);
          console.log('🔧 Forced XY plane selection for consistent 3D orientation');
        }

        it('should switch to XY plane and show correct axes orientation', async () => {
          // Ensure consistent state before screenshot
          await ensureConsistentState();
          
          // Switch to XY plane with extended wait
          await page.click('#checkbox-lock-xy');
          await page.waitForTimeout(2000); // Extended wait for view to update
          
          // Verify XY plane is selected
          const xyPlaneSelected = await page.locator('#checkbox-lock-xy:checked').count();
          expect(xyPlaneSelected).toBe(1);
          
          // Additional stabilization before screenshot
          await ensureStableRenderingState(page);
          
          // Take visual snapshot for XY plane (Green up, Red right)
          const comparison = await compareScreenshots(page, `${mode.screenshotPrefix}-xy-plane-current.png`, `${mode.screenshotPrefix}-xy-plane-baseline.png`, `${mode.name} - XY Plane Orientation`);
          console.log(`🔍 XY Plane comparison: ${comparison.message}`);
          if (comparison.pixelDifference > 0) {
            console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
          }
          
          // Expect exact matches only - 0 pixel tolerance
          expect(comparison.isMatch).toBe(true);
        }, 15000);

        it('should switch to YZ plane and show correct axes orientation', async () => {
          await ensureConsistentState();
          
          await page.click('#checkbox-lock-yz');
          await page.waitForTimeout(2000); // Extended wait for view update
          
          const yzPlaneSelected = await page.locator('#checkbox-lock-yz:checked').count();
          expect(yzPlaneSelected).toBe(1);
          
          // Additional stabilization before screenshot
          await ensureStableRenderingState(page);
          
          // Take visual snapshot for YZ plane (Blue up, Green right)
          const comparison = await compareScreenshots(page, `${mode.screenshotPrefix}-yz-plane-current.png`, `${mode.screenshotPrefix}-yz-plane-baseline.png`, `${mode.name} - YZ Plane Orientation`);
          console.log(`🔍 YZ Plane comparison: ${comparison.message}`);
          if (comparison.pixelDifference > 0) {
            console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
          }
          
          // Expect exact matches only - 0 pixel tolerance
          expect(comparison.isMatch).toBe(true);
        }, 15000);

        afterAll(async () => {
          // Re-enable orbit displays and return to default XY plane
          await page.click('#view-orbit'); // Re-check CY3 Orbit
          await page.waitForTimeout(200);
          await page.click('#view-orbit-descent'); // Re-check CY3 Descent Orbit
          await page.waitForTimeout(200);
          await page.click('#checkbox-lock-xy'); // Return to XY plane
          await page.waitForTimeout(500);
        }, 45000);
      });

      describe('Settings and View Controls', () => {
        it('should open settings panel', async () => {
          await page.click('#settings-panel-button');
          await page.waitForTimeout(500);
          
          const dimensionControlsVisible = await page.locator('#dimension-2D').count();
          expect(dimensionControlsVisible).toBe(1);
        });
        
        it('should switch to 2D mode with proper verification', async () => {
          // Ensure stable rendering state
          await ensureStableRenderingState(page);
          
          // Wait for orbit rendering to complete before taking 3D screenshot
          await waitForOrbitRenderingComplete(page);
          
          // Force XY plane selection for consistent 3D state
          await page.click('#checkbox-lock-xy');
          await page.waitForTimeout(1000);
          console.log('🔧 Forced XY plane for consistent 3D mode screenshot');
          
          // Verify we're in 3D mode initially
          const in3D = await page.locator('#dimension-3D:checked').count();
          expect(in3D).toBe(1);
          
          // Additional stabilization before 3D screenshot
          await ensureStableRenderingState(page);
          
          // Take screenshot in 3D mode (establish baseline)
          const comparison3D = await compareScreenshots(page, `${mode.screenshotPrefix}-3d-mode-current.png`, `${mode.screenshotPrefix}-3d-mode-baseline.png`, `${mode.name} - 3D Mode`);
          console.log(`🔍 3D Mode comparison: ${comparison3D.message}`);
          if (comparison3D.pixelDifference > 0) {
            console.log(`📊 3D Mode pixel difference: ${comparison3D.pixelDifference} pixels`);
          }
          
          // Switch to 2D mode
          await page.click('#dimension-2D');
          
          // 2D mode is instant - no 3D rendering state to wait for
          await page.waitForTimeout(100);
          
          const in2D = await page.locator('#dimension-2D:checked').count();
          expect(in2D).toBe(1);
          
          // 2D is immediate - just ensure animation is paused
          await page.click('#burn1');
          await page.waitForTimeout(200);
          
          // Take screenshot in 2D mode (establish baseline)
          const comparison2D = await compareScreenshots(page, `${mode.screenshotPrefix}-2d-mode-current.png`, `${mode.screenshotPrefix}-2d-mode-baseline.png`, `${mode.name} - 2D Mode`);
          console.log(`🔍 2D Mode comparison: ${comparison2D.message}`);
          if (comparison2D.pixelDifference > 0) {
            console.log(`📊 2D Mode pixel difference: ${comparison2D.pixelDifference} pixels`);
          }
          
          // Expect exact matches only - 0 pixel tolerance
          expect(comparison3D.isMatch).toBe(true);
          expect(comparison2D.isMatch).toBe(true);
        }, 35000);
        
        it('should switch back to 3D mode with loading verification', async () => {
          // Ensure stable rendering state
          await ensureStableRenderingState(page);
          
          // Switch back to 3D mode
          await page.click('#dimension-3D');
          
          // 3D mode needs time to initialize WebGL context and rendering
          await page.waitForTimeout(2000);
          
          // Wait for orbit rendering to complete before taking 3D screenshot
          await waitForOrbitRenderingComplete(page);
          
          // Force XY plane selection for consistent 3D state
          await page.click('#checkbox-lock-xy');
          await page.waitForTimeout(1000);
          console.log('🔧 Forced XY plane for consistent 3D mode restored screenshot');
          
          // Verify we're in 3D mode
          const in3D = await page.locator('#dimension-3D:checked').count();
          expect(in3D).toBe(1);
          
          // Verify 3D canvas is present and loaded
          const canvasExists = await page.locator('canvas').count();
          expect(canvasExists).toBeGreaterThan(0);
          
          // Additional stabilization before screenshot
          await ensureStableRenderingState(page);
          
          // Take screenshot to verify 3D mode restored properly
          const comparison3DRestored = await compareScreenshots(page, `${mode.screenshotPrefix}-3d-mode-restored-current.png`, `${mode.screenshotPrefix}-3d-mode-restored-baseline.png`, `${mode.name} - 3D Mode Restored`);
          console.log(`🔍 3D Mode Restored comparison: ${comparison3DRestored.message}`);
          if (comparison3DRestored.pixelDifference > 0) {
            console.log(`📊 3D Mode Restored pixel difference: ${comparison3DRestored.pixelDifference} pixels`);
          }
          
          // Expect exact matches only - 0 pixel tolerance
          expect(comparison3DRestored.isMatch).toBe(true);
          
          // Close settings and ensure we're back in preferred 3D mode
          await page.keyboard.press('Escape');
          
          // Verify we're in 3D mode (preferred dimension) after all testing
          const finalIn3D = await page.locator('#dimension-3D:checked').count();
          expect(finalIn3D).toBe(1);
          console.log('✅ Confirmed return to preferred 3D mode after dimension testing');
        }, 30000);
      });
      
      describe('Final Verification', () => {
        it(`should remain stable after all tests in ${mode.name} mode`, async () => {
          const modeActive = await page.locator(`${mode.radioId}:checked`).count();
          const telemetryWorking = await page.locator('#distance-SC-EARTH').count();
          const timelineStable = await page.locator('#burn1').count();
          const in3D = await page.locator('#dimension-3D:checked').count();
          
          expect(modeActive).toBe(1);
          expect(telemetryWorking).toBe(1);
          expect(timelineStable).toBe(1);
          expect(in3D).toBe(1); // Confirm we're in preferred 3D mode
          
          console.log(`✅ Final verification: ${mode.name} mode stable, in preferred 3D dimension`);
        });
      });
    });
  }

  // Generate test suites for each mode
  testModes.forEach(mode => {
    createModeTestSuite(mode);
  });
});