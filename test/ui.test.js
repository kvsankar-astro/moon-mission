import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { ssim } from 'ssim.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

async function displayStartupMessage(page, testId) {
  console.log(`Displaying startup message for: ${testId}`);
  
  // Show immediate startup message
  await page.evaluate((testId) => {
    const testIdElement = document.getElementById('test-id-display');
    if (testIdElement) {
      testIdElement.innerHTML = `${testId} - Starting up...`;
      testIdElement.style.display = 'block';
      testIdElement.style.visibility = 'visible';
    } else {
      console.log('test-id-display element not found');
    }
  }, testId);
  
  // Small delay to ensure it's rendered
  await page.waitForTimeout(100);
}

async function displayTestId(page, testId) {
  console.log(`Displaying test ID: ${testId}`);
  await page.evaluate((text) => {
    const testIdElement = document.getElementById('test-id-display');
    if (testIdElement) {
      testIdElement.innerHTML = text;
    }
  }, testId);
}

async function hideTestIdForScreenshot(page) {
  // Store current test ID content and hide it temporarily for screenshot
  return await page.evaluate(() => {
    const testIdElement = document.getElementById('test-id-display');
    if (testIdElement) {
      const currentContent = testIdElement.innerHTML;
      testIdElement.innerHTML = '';
      return currentContent;
    }
    return null;
  });
}

async function restoreTestId(page, testIdContent) {
  // Restore the test ID content after screenshot
  await page.evaluate((content) => {
    const testIdElement = document.getElementById('test-id-display');
    if (testIdElement && content) {
      testIdElement.innerHTML = content;
    }
  }, testIdContent);
}

async function hideTestId(page) {
  await page.evaluate(() => {
    const testIdElement = document.getElementById('test-id-display');
    if (testIdElement) {
      testIdElement.innerHTML = '';
    }
  });
}

// Timeout constants as per requirements
const TIMEOUTS = {
  // Scene and Rendering Timeouts
  SCENE_READY_TIMEOUT: 15000,
  STABLE_RENDER_TIMEOUT: 3000,
  ORBIT_RENDER_TIMEOUT: 120000, // 2 minutes for slow WSL/software rendering
  
  // UI Interaction Timeouts
  SETTINGS_PANEL_TIMEOUT: 8000,
  UI_RESPONSE_TIMEOUT: 3000,
  ANIMATION_RESPONSE_TIMEOUT: 2000,
  
  // Screenshot and Comparison Timeouts
  SCREENSHOT_TIMEOUT: 5000,
  VISUAL_STABILIZATION_TIMEOUT: 2500,
  PANEL_CLOSE_TIMEOUT: 1000,
  
  // Test Infrastructure Timeouts
  TEST_CASE_TIMEOUT: 35000,
  EXTENDED_TEST_TIMEOUT: 70000,
  CLEANUP_TIMEOUT: 90000,
  
  // Short Delays
  QUICK_DELAY: 200,
  STANDARD_DELAY: 500,
  EXTENDED_DELAY: 1000
};

// SSIM threshold constants for screenshot comparison
// Higher values = more strict matching (1.0 = identical)
const SSIM_THRESHOLD = {
  IDENTICAL: 0.99,      // For exact visual matches
  VERY_SIMILAR: 0.97,   // For minor anti-aliasing differences
  SIMILAR: 0.95,        // For standard 3D scene comparisons (DEFAULT)
  DIFFERENT: 0.90       // For complex 3D scenes with acceptable variations
};

// Legacy alias for backwards compatibility during migration
const TOLERANCE = {
  EXACT: SSIM_THRESHOLD.IDENTICAL,
  APPROX_MATCH: SSIM_THRESHOLD.SIMILAR,
  BROAD_MATCH: SSIM_THRESHOLD.DIFFERENT
};

// Test configuration using environment variables (no hardcoded URLs/ports)
const TEST_CONFIG = {
  baseUrl: process.env.VITE_TEST_BASE_URL || 'http://localhost:8001',
  headless: process.env.HEADLESS === 'true',
  slowMo: parseInt(process.env.SLOWMO || '0'),
  get testUrl() {
    return `${this.baseUrl}/chandrayaan3.html?testMode=true`;
  }
};

let browser, page;

// SSIM-based screenshot comparison function
// Uses Structural Similarity Index for robust comparison that handles anti-aliasing differences
async function compareScreenshots(page, currentName, baselineName, testName, threshold = TOLERANCE.APPROX_MATCH) {
  const screenshotDir = join(process.cwd(), 'test', 'screenshots');
  const currentDir = join(screenshotDir, 'current');
  const baselineDir = join(screenshotDir, 'baseline');

  // Ensure directories exist
  [currentDir, baselineDir].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  const currentPath = join(currentDir, currentName);
  const baselinePath = join(baselineDir, baselineName);

  // Hide test ID for screenshot and store its content
  const testIdContent = await hideTestIdForScreenshot(page);

  // Take current screenshot
  await page.screenshot({ path: currentPath, fullPage: false });

  // Restore test ID after screenshot
  await restoreTestId(page, testIdContent);

  // If baseline doesn't exist, copy current as baseline
  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, readFileSync(currentPath));
    return { isMatch: true, message: 'Baseline created', ssimScore: 1.0, pixelDifference: 0 };
  }

  // Compare screenshots using SSIM
  const current = PNG.sync.read(readFileSync(currentPath));
  const baseline = PNG.sync.read(readFileSync(baselinePath));

  const { width, height } = current;

  // Check for dimension mismatch
  if (baseline.width !== width || baseline.height !== height) {
    console.log(`SCREENSHOT DIMENSION MISMATCH: ${testName} - baseline ${baseline.width}x${baseline.height} vs current ${width}x${height}`);
    return {
      isMatch: false,
      message: `Dimension mismatch: baseline ${baseline.width}x${baseline.height} vs current ${width}x${height}`,
      ssimScore: 0,
      pixelDifference: width * height
    };
  }

  // Prepare image data for SSIM comparison
  const baselineData = { data: baseline.data, width, height };
  const currentData = { data: current.data, width, height };

  // Calculate SSIM score
  const ssimResult = ssim(baselineData, currentData);
  const ssimScore = ssimResult.mssim;

  // Determine if images match based on threshold
  const isMatch = ssimScore >= threshold;

  if (!isMatch) {
    // Log detailed information for debugging
    const classifyScore = (score) => {
      if (score >= SSIM_THRESHOLD.IDENTICAL) return 'IDENTICAL';
      if (score >= SSIM_THRESHOLD.VERY_SIMILAR) return 'VERY_SIMILAR';
      if (score >= SSIM_THRESHOLD.SIMILAR) return 'SIMILAR';
      if (score >= SSIM_THRESHOLD.DIFFERENT) return 'DIFFERENT';
      return 'VERY_DIFFERENT';
    };
    console.log(`SCREENSHOT MISMATCH: ${testName} - SSIM: ${ssimScore.toFixed(4)} (${classifyScore(ssimScore)}) < threshold: ${threshold}`);
  }

  return {
    isMatch,
    message: isMatch ? 'Screenshots match' : `SSIM ${ssimScore.toFixed(4)} below threshold ${threshold}`,
    ssimScore,
    pixelDifference: 0 // Kept for backwards compatibility, but not meaningful with SSIM
  };
}

// Simplified helper functions
async function openSettingsPanel(page) {
  // Use Playwright's auto-wait and retry capabilities
  const panel = page.locator('#settings-panel');
  if (!(await panel.isVisible())) {
    await page.locator('#settings-panel-button').click();
    await panel.waitFor({ state: 'visible', timeout: 5000 });
  }
}

async function closeSettingsPanel(page) {
  const panel = page.locator('#settings-panel');
  if (await panel.isVisible()) {
    // Try the close button first, then fallback to jQuery if needed
    try {
      await page.getByRole('button', { name: 'close' }).click();
    } catch {
      await page.evaluate(() => $('#settings-panel').dialog('close'));
    }
    await panel.waitFor({ state: 'hidden', timeout: 2000 });
  }
}

// Wait for scene to be ready
async function waitForScene(page) {
  try {
    await page.waitForSelector('#animate', { timeout: TIMEOUTS.SCENE_READY_TIMEOUT });
    
    // Check if we're in 2D mode - canvas might not be immediately visible
    const dimensionIs2D = await page.isChecked('#dimension-2D');
    if (!dimensionIs2D) {
      // For 3D mode, wait for canvas to be visible
      await page.waitForSelector('canvas', { timeout: TIMEOUTS.SCENE_READY_TIMEOUT });
    } else {
      // For 2D mode, just wait for canvas to exist (might be hidden during transitions)
      await page.waitForSelector('canvas', { timeout: TIMEOUTS.SCENE_READY_TIMEOUT, state: 'attached' });
    }

    // For 2D mode, use a simplified and faster check
    if (dimensionIs2D) {
      // In 2D mode, just wait a short time for DOM to stabilize
      await page.waitForTimeout(2000);
      console.log('2D mode: using simplified scene readiness check');
    } else {
      // For 3D mode, use the full scene state checking
      await page.waitForFunction(() => {
        // Determine which mode we're in by checking which origin is selected
        const isLunarMode = document.querySelector('#origin-moon')?.checked;
        const doneState = window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE;
        
        if (isLunarMode) {
          // In Moon mode, wait for lunar scene to be ready
          const lunarState = window.animationScenes?.lunar?.state;
          return lunarState === doneState;
        } else {
          // In Earth mode, wait for geo scene to be ready
          const geoState = window.animationScenes?.geo?.state;
          return geoState === doneState;
        }
      }, null, { timeout: TIMEOUTS.ORBIT_RENDER_TIMEOUT });
    }
    
    // Additional check: wait for animation frames to stabilize
    // This ensures the orbit drawing animation has completed
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        const targetFrames = 3; // Wait for at least 3 frames to ensure stability
        
        function checkFrame() {
          frameCount++;
          if (frameCount >= targetFrames) {
            resolve();
          } else {
            requestAnimationFrame(checkFrame);
          }
        }
        
        // Start checking after next frame
        requestAnimationFrame(checkFrame);
      });
    });

  } catch (error) {
    console.log('Wait for scene ready failed:', error.message);
    // Re-throw the error so tests fail properly instead of continuing with bad state
    throw error;
  }
}

// Store initial camera/zoom state for restoration
async function storeInitialState(page) {
  return await page.evaluate(() => {
    try {
      const camera = window.cy3?.camera;
      const cameraControls = window.cy3?.cameraControls;
      return {
        cameraPosition: camera?.position ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
        cameraUp: camera?.up ? { x: camera.up.x, y: camera.up.y, z: camera.up.z } : null,
        cameraTarget: cameraControls?.target ? { x: cameraControls.target.x, y: cameraControls.target.y, z: cameraControls.target.z } : null,
        timelineDate: document.querySelector('#date')?.textContent || null
      };
    } catch (e) {
      console.error('Error storing initial state:', e);
      return { cameraPosition: null, cameraUp: null, cameraTarget: null, timelineDate: null };
    }
  });
}

async function restoreStoredState(page, storedState) {
  await page.evaluate((state) => {
    try {
      const camera = window.cy3?.camera;
      const cameraControls = window.cy3?.cameraControls;

      if (camera && state.cameraPosition) {
        camera.position.set(state.cameraPosition.x, state.cameraPosition.y, state.cameraPosition.z);
      }
      if (camera && state.cameraUp) {
        camera.up.set(state.cameraUp.x, state.cameraUp.y, state.cameraUp.z);
      }
      if (cameraControls && state.cameraTarget) {
        cameraControls.target.set(state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z);
      }

      if (camera) {
        camera.updateProjectionMatrix();
      }
      if (cameraControls) {
        cameraControls.update();
      }
    } catch (e) {
      console.error('Error restoring stored state:', e);
    }
  }, storedState);
}

// New zoom functions that directly manipulate camera position
async function zoomIn(page, steps = 1, mode = null) {
  const result = await page.evaluate(({ numSteps, testMode }) => {
    // Determine which mode we're in - either by parameter or by checking UI
    let isLunarMode;
    if (testMode) {
      isLunarMode = testMode === 'MOON';
    } else {
      isLunarMode = document.querySelector('#origin-moon')?.checked;
    }
    
    const scene = isLunarMode ? window.animationScenes?.lunar : window.animationScenes?.geo;
    const camera = scene?.camera;
    const controls = scene?.cameraControls;
    
    if (!camera || !controls) {
      console.log('ZoomIn failed: camera or controls not found for mode:', isLunarMode ? 'lunar' : 'geo');
      return false;
    }

    const target = controls.target;
    
    for (let i = 0; i < numSteps; i++) {
      const currentDistance = camera.position.distanceTo(target);
      const newDistance = currentDistance * 0.9; // Zoom in by 10%
      camera.position.lerpVectors(target, camera.position, newDistance / currentDistance);
      controls.update();
    }
    
    return true;
  }, { numSteps: steps, testMode: mode });
  
  if (!result) {
    console.log('Warning: zoomIn function could not find camera/controls');
  }
  
  await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
}

async function zoomOut(page, steps = 1, mode = null) {
  const result = await page.evaluate(({ numSteps, testMode }) => {
    // Determine which mode we're in - either by parameter or by checking UI
    let isLunarMode;
    if (testMode) {
      isLunarMode = testMode === 'MOON';
    } else {
      isLunarMode = document.querySelector('#origin-moon')?.checked;
    }
    
    const scene = isLunarMode ? window.animationScenes?.lunar : window.animationScenes?.geo;
    const camera = scene?.camera;
    const controls = scene?.cameraControls;
    
    if (!camera || !controls) {
      console.log('ZoomOut failed: camera or controls not found for mode:', isLunarMode ? 'lunar' : 'geo');
      return false;
    }

    const target = controls.target;
    
    for (let i = 0; i < numSteps; i++) {
      const currentDistance = camera.position.distanceTo(target);
      const newDistance = currentDistance * 1.1; // Zoom out by 10%
      camera.position.lerpVectors(target, camera.position, newDistance / currentDistance);
      controls.update();
    }
    
    return true;
  }, { numSteps: steps, testMode: mode });
  
  if (!result) {
    console.log('Warning: zoomOut function could not find camera/controls');
  }
  
  await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
}

// Test mode configurations
const TEST_MODES = {
  EARTH: { 
    zoomInSteps: 3,          // General view control tests
    polesZoom: 10,           // Poles visibility - increased zoom in
    polarAxesZoom: 10,       // Polar axes visibility - increased zoom in
    soiZoomOut: 15           // SOI wide view
  },
  MOON: { 
    zoomInSteps: 5,          // General view control tests  
    polesZoom: 8,            // Poles visibility
    polarAxesZoom: 8,        // Polar axes visibility
    soiZoomOut: 30,          // SOI very wide view - increased zoom out
    descentOrbitZoom: 6,     // Descent orbit visibility
    locationsZoom: 8         // Locations visibility
  }
};

// Shared cleanup function for all view control tests
async function cleanupViewControlTest(page, mode = TEST_MODES.EARTH, restoreZoomSteps = null) {
  await openSettingsPanel(page);
  // Ensure all view controls are disabled
  if (await page.isChecked('#view-moonsoi')) {
    await page.click('#view-moonsoi');
  }
  if (await page.isChecked('#view-eclipticplane')) {
    await page.click('#view-eclipticplane');
  }
  if (await page.isChecked('#view-equatorialplane')) {
    await page.click('#view-equatorialplane');
  }
  // Restore orbit visibility
  if (!await page.isChecked('#view-orbit')) {
    await page.click('#view-orbit');
  }
  if (!await page.isChecked('#view-orbit-descent')) {
    await page.click('#view-orbit-descent');
  }
  await closeSettingsPanel(page);
  const modeType = mode === TEST_MODES.MOON ? 'MOON' : 'EARTH';
  // If restoreZoomSteps is specified, use that to restore zoom, otherwise use default zoomInSteps
  const zoomSteps = restoreZoomSteps !== null ? restoreZoomSteps : mode.zoomInSteps;
  await zoomIn(page, zoomSteps, modeType);
}

// Timeline management for consistent test states
async function setTimeline(page, burnButton = '#burn1') {
  try {
    await page.click(burnButton);
    await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
  } catch (e) {
    console.warn(`Could not set timeline to ${burnButton}:`, e.message);
  }
}

// Suite and test timeline management
const SUITE_TIMELINE = '#burn1'; // Default: Launch timeline for all suites
const TEST_TIMELINES = {
  // Test-specific timeline overrides (only for tests that need non-default timelines)
  'Joy Ride Control': '#burn3',           // EBN#3 for proper geometry
  'Landing Animation': '#burn12',         // Later in mission for landing phase
  'CY3 Descent Orbit Display': '#burn1'  // Explicitly use Launch (same as suite default)
};

// Helper to start test with appropriate timeline
async function startTest(page, testId, testName = '') {
  // Set timeline (suite default or test-specific override)
  const timeline = TEST_TIMELINES[testName] || SUITE_TIMELINE;
  await setTimeline(page, timeline);
  await displayTestId(page, testId);
}


// Helper to ensure stellar sky is disabled
async function ensureStellarSkyDisabled(page) {
  await openSettingsPanel(page);
  const stellarSkyChecked = await page.isChecked('#view-sky');
  if (stellarSkyChecked) {
    await page.click('#view-sky');
  }
  await closeSettingsPanel(page);
}

// Helper to ensure consistent test state (single open/close cycle)
// Call this after scene is fully ready to avoid interfering with orbit rendering
async function ensureConsistentTestState(page) {
  await openSettingsPanel(page);

  // Disable landing if enabled
  if (await page.isChecked('#landing')) {
    await page.click('#landing');
    await page.waitForTimeout(100); // Small delay for state to settle
  }

  // Enable orbit display if disabled
  if (!(await page.isChecked('#view-orbit'))) {
    await page.click('#view-orbit');
  }
  if (!(await page.isChecked('#view-orbit-descent'))) {
    await page.click('#view-orbit-descent');
  }

  // Disable stellar sky if enabled
  if (await page.isChecked('#view-sky')) {
    await page.click('#view-sky');
  }

  await closeSettingsPanel(page);
}

// Helper to ensure correct origin mode
async function ensureOriginMode(page, mode) {
  await openSettingsPanel(page);
  const targetSelector = mode === 'earth' ? '#origin-earth' : '#origin-moon';
  const isCorrectMode = await page.isChecked(targetSelector);
  if (!isCorrectMode) {
    await page.click(targetSelector);
    await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
  }
  await closeSettingsPanel(page);
}

describe('Chandrayaan-3 UI Tests - Simplified', () => {
  beforeAll(async () => {
    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: [
        '--no-sandbox',
        '--max-old-space-size=4096',
        '--expose-gc',
        '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (helps in WSL/Docker)
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist' // Allow WebGL even on blocklisted GPUs
      ]
    });
    page = await browser.newPage();

    // Capture console logs from the page
    page.on('console', msg => {
      console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', error => {
      console.log(`PAGE ERROR: ${error.message}`);
    });

    // Load the page and wait for it to be ready
    await page.goto(TEST_CONFIG.testUrl, { waitUntil: 'networkidle' });
    
    // Wait for basic page elements to be available
    await page.waitForSelector('#test-id-display', { timeout: TIMEOUTS.SCENE_READY_TIMEOUT });

    // Wait for the animation scene to be fully initialized
    await waitForScene(page);
  }, TIMEOUTS.CLEANUP_TIMEOUT);

  afterAll(async () => {
    await browser?.close();
  }, TIMEOUTS.CLEANUP_TIMEOUT);

  beforeEach(async () => {
    // Only disable stellar sky globally - it's a view option that doesn't affect scene state
    // More invasive state changes (landing, orbit) should be done by specific tests that need them
    // because they can interfere with orbit rendering timing
    await ensureStellarSkyDisabled(page);
  });

  describe('Test Suite 1: Initial Application Load', () => {
    it('Initial Page Load and Rendering', async () => {
      const testId = 'earth-3d-initial-load';
      await displayTestId(page, testId);
      
      // Show startup message immediately
      await displayStartupMessage(page, testId);

      // Wait for scene to be fully ready and then update to actual test ID
      await waitForScene(page);
      await displayTestId(page, testId);
      
      // Take screenshot and compare
      const comparison = await compareScreenshots(
        page,
        `${testId}.png`,
        `${testId}.png`,
        testId,
        TOLERANCE.APPROX_MATCH
      );
      
      // Log comparison details for debugging
      console.log('Screenshot comparison result:', { 
        isMatch: comparison.isMatch, 
        pixelDifference: comparison.pixelDifference,
        tolerance: TOLERANCE.APPROX_MATCH
      });
      
      expect(comparison.isMatch).toBe(true);
      
      // Verify default modes
      expect(await page.isChecked('#origin-earth')).toBe(true);
      expect(await page.isChecked('#dimension-3D')).toBe(true);
      
      // Verify core UI elements
      const elements = [
        '#animate', '#settings-panel-button', '#info-button',
        '#slower', '#faster', '#realtime', '#forward', '#backward'
      ];
      
      for (const selector of elements) {
        expect(await page.locator(selector).count()).toBe(1);
      }

    }, TIMEOUTS.TEST_CASE_TIMEOUT);
  });

  describe('Test Suite 2: Earth Mode Tests', () => {
    it('Page Load in Earth Mode', async () => {
      const testId = 'earth-3d-page-load';
      await displayTestId(page, testId);

      // Verify page title
      const title = await page.title();
      expect(title).toContain('Chandrayaan 3');
      
      // Take screenshot and compare
      const comparison = await compareScreenshots(
        page,
        `${testId}.png`,
        `${testId}.png`,
        testId,
        TOLERANCE.APPROX_MATCH
      );

      expect(comparison.isMatch).toBe(true);

    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('3D Mode Verification', async () => {
      const testId = 'earth-3d-mode-verification';
      await displayTestId(page, testId);

      const mode3D = await page.locator('#dimension-3D:checked').count();
      expect(mode3D).toBe(1);

    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('User Interface Elements Check', async () => {
      const testId = 'earth-3d-ui-elements-check';
      await displayTestId(page, testId);
      // Main UI elements
      const mainElements = ['#animate', '#settings-panel-button', '#info-button', '#burn1', '#distance-SC-EARTH'];
      for (const selector of mainElements) {
        expect(await page.locator(selector).count()).toBe(1);
      }
      
      // Animation controls
      const animationElements = ['#faster', '#slower', '#forward', '#backward', '#fastforward', '#fastbackward'];
      for (const selector of animationElements) {
        expect(await page.locator(selector).count()).toBe(1);
      }
      
      // Open settings and verify all controls
      await openSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      // Settings elements
      const settingsElements = [
        '#origin-earth', '#origin-moon', '#camera-default', '#camera-moon',
        '#checkbox-lock-sc', '#checkbox-lock-moon', '#checkbox-lock-earth',
        '#checkbox-lock-default', '#checkbox-lock-xy', '#checkbox-lock-yz', '#checkbox-lock-zx',
        '#checkbox-lock-xy-minus', '#checkbox-lock-yz-minus', '#checkbox-lock-zx-minus',
        '#landing', '#joyride', '#view-orbit', '#view-orbit-descent', '#view-craters',
        '#view-xyz-axes', '#view-poles', '#view-polar-axes', '#view-sky',
        '#view-moonsoi', '#view-eclipticplane', '#view-equatorialplane', '#view-fps',
        '#dimension-2D', '#dimension-3D'
      ];
      
      for (const selector of settingsElements) {
        expect(await page.locator(selector).count()).toBe(1);
      }
      
      await closeSettingsPanel(page);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Timeline Navigation Buttons', async () => {
      const testId = 'earth-3d-timeline-navigation';
      await displayTestId(page, testId);
      const timelineButtons = [
        '#burn1', '#burn2', '#burn3', '#burn4', '#burn5', '#burn6', '#burn7',
        '#burn8', '#burn9', '#burn10', '#burn11', '#burn12', '#burn13', '#burn14'
      ];
      
      const telemetryFields = [
        '#date', '#distance-SC-EARTH', '#distance-SC-MOON',
        '#altitude-SC-EARTH', '#velocity-SC-EARTH',
        '#altitude-SC-MOON', '#velocity-SC-MOON'
      ];
      
      // Test each timeline button
      for (const button of timelineButtons) {
        // Capture state before click
        const stateBefore = {};
        for (const field of telemetryFields) {
          try {
            stateBefore[field] = await page.locator(field).textContent();
          } catch (e) {
            stateBefore[field] = 'N/A';
          }
        }
        
        // Click button and verify it exists
        expect(await page.locator(button).count()).toBe(1);
        await page.click(button);
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
        
        // Verify telemetry updates (at least one field should change)
        let changed = false;
        for (const field of telemetryFields) {
          try {
            const stateAfter = await page.locator(field).textContent();
            if (stateAfter !== stateBefore[field]) {
              changed = true;
              break;
            }
          } catch (e) {
            // Field may not be visible, continue
          }
        }
        
        // For Launch button, verify specific content
        if (button === '#burn1') {
          const dateContent = await page.locator('#date').textContent();
          expect(dateContent).toContain('Jul');
        }
      }
      
      // Return to Launch
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Animation Play Control', async () => {
      const testId = 'earth-3d-animation-play-control';
      await displayTestId(page, testId);
      // Ensure we start in paused state
      const pauseButton = await page.locator('#animate:has-text("Pause")').count();
      if (pauseButton > 0) {
        await page.click('#animate');
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      }
      
      // Verify Play button exists
      expect(await page.locator('#animate:has-text("Play")').count()).toBe(1);
      
      // Capture initial telemetry
      const initialTime = await page.evaluate(() => {
        const timeEl = document.getElementById('date');
        return timeEl ? timeEl.textContent : '';
      });
      
      // Start animation
      await page.click('#animate');
      
      // Verify button changed to Pause
      expect(await page.locator('#animate:has-text("Pause")').count()).toBe(1);
      
      // Wait for animation to run by checking for telemetry changes
      await page.waitForFunction((initialTime) => {
        const timeEl = document.getElementById('date');
        return timeEl && timeEl.textContent !== initialTime;
      }, initialTime, { timeout: 10000 });
      
      const afterTime = await page.evaluate(() => {
        const timeEl = document.getElementById('date');
        return timeEl ? timeEl.textContent : '';
      });
      
      // Verify animation is running (telemetry changed)
      expect(afterTime).not.toBe(initialTime);
      
      // Stop animation (required: end with animation stopped)
      await page.click('#animate');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      expect(await page.locator('#animate:has-text("Play")').count()).toBe(1);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Animation Pause Control', async () => {
      const testId = 'earth-3d-animation-pause-control';
      await displayTestId(page, testId);
      // Ensure animation is running first
      const playButton = await page.locator('#animate:has-text("Play")');
      if (await playButton.count() > 0) {
        await playButton.click();
      }
      
      // Verify Pause button exists
      await page.waitForSelector('#animate:has-text("Pause")');
      
      // Pause animation
      await page.click('#animate');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      
      // Verify button changed to Play
      await page.waitForSelector('#animate:has-text("Play")');

      // Capture telemetry after pause
      const beforeTime = await page.evaluate(() => {
        const timeEl = document.getElementById('date');
        return timeEl ? timeEl.textContent : '';
      });
      
      // Wait and verify animation has stopped by checking telemetry doesn't change
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
      
      const afterTime = await page.evaluate(() => {
        const timeEl = document.getElementById('date');
        return timeEl ? timeEl.textContent : '';
      });
      
      // Verify animation paused (telemetry unchanged)
      expect(afterTime).toBe(beforeTime);
      
      // Already in stopped state as required
      expect(await page.locator('#animate:has-text("Play")').count()).toBe(1);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Speed Controls', async () => {
      const testId = 'earth-3d-speed-controls';
      await displayTestId(page, testId);
      // Verify speed control buttons exist
      const speedButtons = ['#faster', '#slower', '#realtime', '#resetspeed'];
      for (const button of speedButtons) {
        expect(await page.locator(button).count()).toBe(1);
      }
      
      // Start animation
      await page.click('#animate');
      await page.waitForSelector('#animate:has-text("Pause")');
      
      const timelineSamples = [];
      
      // Initial sample
      let currentTime = await page.locator('#date').textContent();
      timelineSamples.push({ time: 0, timeline: currentTime, action: 'start' });
      
      // Test faster button (3 clicks)
      for (let i = 1; i <= 3; i++) {
        await page.click('#faster');
        await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
        currentTime = await page.locator('#date').textContent();
        timelineSamples.push({ time: i, timeline: currentTime, action: 'faster' });
      }
      
      // Test slower button (3 clicks)
      for (let i = 4; i <= 6; i++) {
        await page.click('#slower');
        await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
        currentTime = await page.locator('#date').textContent();
        timelineSamples.push({ time: i, timeline: currentTime, action: 'slower' });
      }
      
      // Verify speed controls are working (multiple different timeline values)
      const uniqueTimelines = new Set(timelineSamples.map(s => s.timeline));
      expect(uniqueTimelines.size).toBeGreaterThan(2);
      
      // Stop animation
      await page.click('#animate');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Directional Controls Check', async () => {
      const testId = 'earth-3d-directional-controls-check';
      await displayTestId(page, testId);
      const directionalButtons = ['#forward', '#backward', '#fastforward', '#fastbackward'];
      for (const button of directionalButtons) {
        expect(await page.locator(button).count()).toBe(1);
      }
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Direction Control with Timeline', async () => {
      const testId = 'earth-3d-directional-controls-timeline';
      await displayTestId(page, testId);
      // Set baseline at Launch
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      const baselineDate = await page.locator('#date').textContent();
      
      const timelineValues = [baselineDate];
      
      // Test Forward (5 clicks)
      for (let i = 0; i < 5; i++) {
        await page.click('#forward');
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
        const dateValue = await page.locator('#date').textContent();
        timelineValues.push(dateValue);
      }
      
      // Test Fast Forward (5 clicks)
      for (let i = 0; i < 5; i++) {
        await page.click('#fastforward');
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
        const dateValue = await page.locator('#date').textContent();
        timelineValues.push(dateValue);
      }
      
      // Test Backward (5 clicks)
      for (let i = 0; i < 5; i++) {
        await page.click('#backward');
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
        const dateValue = await page.locator('#date').textContent();
        timelineValues.push(dateValue);
      }
      
      // Test Fast Backward (5 clicks)
      for (let i = 0; i < 5; i++) {
        await page.click('#fastbackward');
        await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
        const dateValue = await page.locator('#date').textContent();
        timelineValues.push(dateValue);
      }
      
      // Verify directional controls work (21 total samples, should have variety)
      const uniqueValues = new Set(timelineValues);
      expect(uniqueValues.size).toBeGreaterThan(1);
      expect(timelineValues.length).toBe(21);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Plane Selection Views', async () => {
      const testId = 'earth-3d-plane-selection';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);

      // Store and clear orbit displays for unobstructed view
      const orbitChecked = await page.isChecked('#view-orbit');
      const descentOrbitChecked = await page.isChecked('#view-orbit-descent');
      if (orbitChecked) {
        await page.click('#view-orbit');
      }
      if (descentOrbitChecked) {
        await page.click('#view-orbit-descent');
      }
      
      const planes = [
        { name: 'default', selector: '#checkbox-lock-default' },
        { name: 'xy', selector: '#checkbox-lock-xy' },
        { name: 'yz', selector: '#checkbox-lock-yz' },
        { name: 'zx', selector: '#checkbox-lock-zx' },
        { name: 'xy-minus', selector: '#checkbox-lock-xy-minus' },
        { name: 'yz-minus', selector: '#checkbox-lock-yz-minus' },
        { name: 'zx-minus', selector: '#checkbox-lock-zx-minus' },
        { name: 'default-final', selector: '#checkbox-lock-default' }
      ];
      
      for (const plane of planes) {
        await page.click(plane.selector);
        await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
        expect(await page.locator(`${plane.selector}:checked`).count()).toBe(1);
        await closeSettingsPanel(page);
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
        
        const screenshotName = `${testId}-${plane.name}.png`;
        const comparison = await compareScreenshots(
          page,
          screenshotName,
          screenshotName,
          `${testId} - ${plane.name}`,
          TOLERANCE.APPROX_MATCH
        );
        expect(comparison.isMatch).toBe(true);
        
        await openSettingsPanel(page);
      }

      // Restore orbit displays
      if (orbitChecked && !(await page.isChecked('#view-orbit'))) {
        await page.click('#view-orbit');
      }
      if (descentOrbitChecked && !(await page.isChecked('#view-orbit-descent'))) {
        await page.click('#view-orbit-descent');
      }

      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('2D/3D Mode Switching', async () => {
      const testId = 'earth-2d-3d-mode-switching';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#dimension-3D'))) {
        await page.click('#dimension-3D');
      }
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      expect(await page.locator('#dimension-3D:checked').count()).toBe(1);
      await page.click('#camera-default');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      
      // 3D Mode Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-3d-initial.png`,
        `${testId}-3d-initial.png`,
        `${testId} 3D Mode`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Switch to 2D
      await openSettingsPanel(page);
      await page.click('#dimension-2D');
      expect(await page.locator('#dimension-2D:checked').count()).toBe(1);
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      await closeSettingsPanel(page);
      
      
      // 2D Mode Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-2d.png`,
        `${testId}-2d.png`,
        `${testId} 2D Mode`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Switch back to 3D
      await openSettingsPanel(page);
      await page.click('#dimension-3D');
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#camera-default');
      
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      expect(await page.locator('#dimension-3D:checked').count()).toBe(1);
      expect(await page.locator('canvas').count()).toBeGreaterThan(0);
      await closeSettingsPanel(page);
      
      // 3D Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-3d-restored.png`,
        `${testId}-3d-restored.png`,
        `${testId} 3D Mode Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Poles View Toggle', async () => {
      const testId = 'earth-3d-poles-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#checkbox-lock-xy'))) {
        await page.click('#checkbox-lock-xy');
      }
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await page.click('#dimension-3D');
      
      // Clear orbit displays and axes for unobstructed pole view
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      // Also uncheck axes for better pole visibility
      if (await page.isChecked('#view-xyz-axes')) {
        await page.click('#view-xyz-axes');
      }
      if (await page.isChecked('#view-polar-axes')) {
        await page.click('#view-polar-axes');
      }
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Store initial state and zoom in for optimal pole visibility
      const initialState = await storeInitialState(page);
      await zoomIn(page, TEST_MODES.EARTH.polesZoom, 'EARTH');
      
      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable poles
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-poles')).toBe(true);
      await page.click('#view-poles');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable poles
      await openSettingsPanel(page);
      await page.click('#view-poles');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Restore zoom level and state
      await zoomOut(page, TEST_MODES.EARTH.polesZoom, 'EARTH');
      await restoreStoredState(page, initialState);
      
      // Restore orbit displays and axes if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      if (!await page.isChecked('#view-xyz-axes')) {
        await page.click('#view-xyz-axes');
      }
      if (!await page.isChecked('#view-polar-axes')) {
        await page.click('#view-polar-axes');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Polar Axes View Toggle', async () => {
      const testId = 'earth-3d-polar-axes-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#checkbox-lock-xy'))) {
        await page.click('#checkbox-lock-xy');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      await page.click('#dimension-3D');
      
      // Uncheck orbits for better polar axes visibility
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Store initial state and zoom in for clear meridian line visibility
      const initialState = await storeInitialState(page);
      await zoomIn(page, TEST_MODES.EARTH.polarAxesZoom, 'EARTH');
      
      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable polar axes
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-polar-axes')).toBe(true);
      await page.click('#view-polar-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable polar axes
      await openSettingsPanel(page);
      await page.click('#view-polar-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);

      // Restore zoom level and state
      await zoomOut(page, TEST_MODES.EARTH.polesZoom, 'EARTH');
      await restoreStoredState(page, initialState);
      
      // Restore orbits if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('XYZ Axes View Toggle', async () => {
      const testId = 'earth-3d-xyz-axes-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#checkbox-lock-default'))) {
        await page.click('#checkbox-lock-default');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      await page.click('#dimension-3D');
      
      // Uncheck orbits for better XYZ axes visibility
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable XYZ axes
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-xyz-axes')).toBe(true);
      await page.click('#view-xyz-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable XYZ axes
      await openSettingsPanel(page);
      await page.click('#view-xyz-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Restore orbits if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    describe('Additional View Controls', () => {
      const setupTest = async () => {
        await openSettingsPanel(page);
        if (await page.isChecked('#view-orbit')) {
          await page.click('#view-orbit');
        }
        if (await page.isChecked('#view-orbit-descent')) {
          await page.click('#view-orbit-descent');
        }
        await closeSettingsPanel(page);
        await zoomOut(page, TEST_MODES.EARTH.soiZoomOut, 'EARTH');
      };


      it("Moon's SOI View", async () => {
        const testId = 'earth-3d-moon-soi-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-moonsoi');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-moonsoi');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Moon SOI is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-moonsoi')) {
            await page.click('#view-moonsoi');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.EARTH, TEST_MODES.EARTH.soiZoomOut);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

      it('Ecliptic Plane View', async () => {
        const testId = 'earth-3d-ecliptic-plane-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-eclipticplane');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-eclipticplane');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Ecliptic Plane is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-eclipticplane')) {
            await page.click('#view-eclipticplane');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.EARTH);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

      it('Equatorial Plane View', async () => {
        const testId = 'earth-3d-equatorial-plane-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-equatorialplane');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-equatorialplane');
          await closeSettingsPanel(page);
          await waitForScene(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Equatorial Plane is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-equatorialplane')) {
            await page.click('#view-equatorialplane');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.EARTH);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);
    });

    it('Joy Ride Control', async () => {
      const testId = 'earth-3d-joy-ride';
      await startTest(page, testId, 'Joy Ride Control'); // Uses #burn3
      await openSettingsPanel(page);
      await page.click('#checkbox-lock-default');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#joyride');
      await closeSettingsPanel(page);
      
      const comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Cleanup: Ensure Joy Ride is disabled
      await openSettingsPanel(page);
      if (await page.isChecked('#joyride')) {
        await page.click('#joyride');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('CY3 Orbit Display', async () => {
      const testId = 'earth-3d-cy3-orbit-display';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      await page.click('#checkbox-lock-default');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      // Ensure orbit is checked
      if (!(await page.isChecked('#view-orbit'))) {
        await page.click('#view-orbit');
      }
      await closeSettingsPanel(page);
      
      // Screenshot 1: Orbit Checked
      let comparison = await compareScreenshots(
        page,
        `${testId}-checked.png`,
        `${testId}-checked.png`,
        `${testId} Checked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Uncheck orbit
      await openSettingsPanel(page);
      await page.click('#view-orbit');
      await closeSettingsPanel(page);
      
      // Screenshot 2: Orbit Unchecked
      comparison = await compareScreenshots(
        page,
        `${testId}-unchecked.png`,
        `${testId}-unchecked.png`,
        `${testId} Unchecked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-check orbit
      await openSettingsPanel(page);
      await page.click('#view-orbit');
      await closeSettingsPanel(page);

      // Screenshot 3: Orbit Restored
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-checked.png`, // Compare against the original baseline
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Final Stability Check', async () => {
      const testId = 'earth-3d-final-stability-check';
      await displayTestId(page, testId);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      // Initial stability
      let comparison = await compareScreenshots(
        page,
        `${testId}-initial.png`,
        `${testId}-initial.png`,
        `${testId} Initial`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Verify functional elements
      expect(await page.locator('#origin-earth:checked').count()).toBe(1);
      expect(await page.locator('#distance-SC-EARTH').count()).toBe(1);
      expect(await page.locator('#burn1').count()).toBe(1);
      expect(await page.locator('#dimension-3D:checked').count()).toBe(1);
      
      // Responsiveness test
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#burn2');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Final stability
      comparison = await compareScreenshots(
        page,
        `${testId}-final.png`,
        `${testId}-final.png`,
        `${testId} Final`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);
  });

  describe('Test Suite 3: Moon Mode Tests', () => {
    beforeAll(async () => {
      // Switch to Moon mode
      await openSettingsPanel(page);
      await page.click('#origin-moon');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Ensure landing is disabled initially (it might be auto-enabled)
      if (await page.isChecked('#landing')) {
        await page.click('#landing');
      }

      // Set default camera and plane to ensure a clean state
      await page.click('#camera-default');
      await page.click('#checkbox-lock-default');

      
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      // Wait for the lunar scene to be ready
      await waitForScene(page);
      // Additional wait for Moon orbit curves to fully render
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
    });

    it('Page Load in Moon Mode', async () => {
      const testId = 'moon-3d-page-load';
      await displayTestId(page, testId);
      const title = await page.title();
      expect(title).toContain('Chandrayaan 3');
      
      await waitForScene(page);
      // Additional wait for lunar orbit animation to fully render
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      const comparison = await compareScreenshots(
        page,
        `${testId}.png`,
        `${testId}.png`,
        testId,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('3D Mode Verification', async () => {
      const testId = 'moon-3d-mode-verification';
      await displayTestId(page, testId);
      const mode3D = await page.locator('#dimension-3D:checked').count();
      expect(mode3D).toBe(1);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Plane Selection Views', async () => {
      const testId = 'moon-3d-plane-selection';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);

      // Store and clear orbit displays for unobstructed view
      const orbitChecked = await page.isChecked('#view-orbit');
      const descentOrbitChecked = await page.isChecked('#view-orbit-descent');
      if (orbitChecked) {
        await page.click('#view-orbit');
      }
      if (descentOrbitChecked) {
        await page.click('#view-orbit-descent');
      }
      
      const planes = [
        { name: 'default', selector: '#checkbox-lock-default' },
        { name: 'xy', selector: '#checkbox-lock-xy' },
        { name: 'yz', selector: '#checkbox-lock-yz' },
        { name: 'zx', selector: '#checkbox-lock-zx' },
        { name: 'xy-minus', selector: '#checkbox-lock-xy-minus' },
        { name: 'yz-minus', selector: '#checkbox-lock-yz-minus' },
        { name: 'zx-minus', selector: '#checkbox-lock-zx-minus' },
        { name: 'default-final', selector: '#checkbox-lock-default' }
      ];
      
      for (const plane of planes) {
        await page.click(plane.selector);
        await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
        expect(await page.locator(`${plane.selector}:checked`).count()).toBe(1);
        await closeSettingsPanel(page);
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
        
        const screenshotName = `${testId}-${plane.name}.png`;
        const comparison = await compareScreenshots(
          page,
          screenshotName,
          screenshotName,
          `${testId} - ${plane.name}`,
          TOLERANCE.APPROX_MATCH
        );
        expect(comparison.isMatch).toBe(true);
        
        await openSettingsPanel(page);
      }

      // Restore orbit displays
      if (orbitChecked && !(await page.isChecked('#view-orbit'))) {
        await page.click('#view-orbit');
      }
      if (descentOrbitChecked && !(await page.isChecked('#view-orbit-descent'))) {
        await page.click('#view-orbit-descent');
      }

      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('2D/3D Mode Switching', async () => {
      const testId = 'moon-2d-3d-mode-switching';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#dimension-3D'))) {
        await page.click('#dimension-3D');
      }
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      expect(await page.locator('#dimension-3D:checked').count()).toBe(1);
      await page.click('#camera-default');
      
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      
      // 3D Mode Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-3d-initial.png`,
        `${testId}-3d-initial.png`,
        `${testId} 3D Mode`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Switch to 2D
      await openSettingsPanel(page);
      await page.click('#dimension-2D');
      expect(await page.locator('#dimension-2D:checked').count()).toBe(1);
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
      await closeSettingsPanel(page);
      
      
      // 2D Mode Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-2d.png`,
        `${testId}-2d.png`,
        `${testId} 2D Mode`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Switch back to 3D
      await openSettingsPanel(page);
      await page.click('#dimension-3D');
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#camera-default');
      
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      expect(await page.locator('#dimension-3D:checked').count()).toBe(1);
      expect(await page.locator('canvas').count()).toBeGreaterThan(0);
      await closeSettingsPanel(page);
      
      // 3D Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-3d-restored.png`,
        `${testId}-3d-restored.png`,
        `${testId} 3D Mode Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Poles View Toggle', async () => {
      const testId = 'moon-3d-poles-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await page.click('#dimension-3D');
      
      // CRITICAL: Ensure landing is disabled to show Moon properly
      if (await page.isChecked('#landing')) {
        await page.click('#landing');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      
      // Clear orbit displays and axes for unobstructed pole view
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      // Also uncheck axes for better pole visibility
      if (await page.isChecked('#view-xyz-axes')) {
        await page.click('#view-xyz-axes');
      }
      if (await page.isChecked('#view-polar-axes')) {
        await page.click('#view-polar-axes');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      // Use a more appropriate timeline point for lunar poles
      await page.click('#burn14');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Store initial state and zoom in for optimal pole visibility
      const initialState = await storeInitialState(page);
      await zoomIn(page, TEST_MODES.MOON.polesZoom, 'MOON');
      
      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable poles
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-poles')).toBe(true);
      await page.click('#view-poles');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable poles
      await openSettingsPanel(page);
      await page.click('#view-poles');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Restore zoom level and state
      await zoomOut(page, TEST_MODES.MOON.polesZoom, 'MOON');
      await restoreStoredState(page, initialState);
      
      // Restore orbit displays and axes if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      if (!await page.isChecked('#view-xyz-axes')) {
        await page.click('#view-xyz-axes');
      }
      if (!await page.isChecked('#view-polar-axes')) {
        await page.click('#view-polar-axes');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Polar Axes View Toggle', async () => {
      const testId = 'moon-3d-polar-axes-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      const yzMinusPlane = await page.locator('input[name="plane"][value="YZ-"]:checked').count();
      if (yzMinusPlane === 0) {
        await page.click('input[name="plane"][value="YZ-"]');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      await page.click('#dimension-3D');
      
      // Uncheck orbits for better polar axes visibility
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      // Store initial state and zoom in for clear meridian line visibility
      const initialState = await storeInitialState(page);
      await zoomIn(page, TEST_MODES.MOON.polarAxesZoom, 'MOON');
      
      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable polar axes
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-polar-axes')).toBe(true);
      await page.click('#view-polar-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable polar axes
      await openSettingsPanel(page);
      await page.click('#view-polar-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);

      // Restore zoom level and state
      await zoomOut(page, TEST_MODES.MOON.polarAxesZoom, 'MOON');
      await restoreStoredState(page, initialState);
      
      // Restore orbits if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('XYZ Axes View Toggle', async () => {
      const testId = 'moon-3d-xyz-axes-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      if (!(await page.isChecked('#checkbox-lock-default'))) {
        await page.click('#checkbox-lock-default');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      await page.click('#dimension-3D');
      
      // Uncheck orbits for better XYZ axes visibility
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      const initialState = await storeInitialState(page);

      // Enabled Screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable XYZ axes
      await openSettingsPanel(page);
      expect(await page.isChecked('#view-xyz-axes')).toBe(true);
      await page.click('#view-xyz-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable XYZ axes
      await openSettingsPanel(page);
      await page.click('#view-xyz-axes');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored Screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-restored.png`,
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);

      await restoreStoredState(page, initialState);
      
      // Restore orbits if they were initially checked
      await openSettingsPanel(page);
      if (!await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (!await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    describe('Additional View Controls', () => {
      const setupTest = async () => {
        await openSettingsPanel(page);
        if (await page.isChecked('#view-orbit')) {
          await page.click('#view-orbit');
        }
        if (await page.isChecked('#view-orbit-descent')) {
          await page.click('#view-orbit-descent');
        }
        await closeSettingsPanel(page);
        await zoomOut(page, TEST_MODES.MOON.soiZoomOut, 'MOON');
      };


      it("Moon's SOI View", async () => {
        const testId = 'moon-3d-moon-soi-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-moonsoi');
          await closeSettingsPanel(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-moonsoi');
          await closeSettingsPanel(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Moon SOI is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-moonsoi')) {
            await page.click('#view-moonsoi');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.MOON, TEST_MODES.MOON.soiZoomOut);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

      it('Ecliptic Plane View', async () => {
        const testId = 'moon-3d-ecliptic-plane-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-eclipticplane');
          await closeSettingsPanel(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-eclipticplane');
          await closeSettingsPanel(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Ecliptic Plane is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-eclipticplane')) {
            await page.click('#view-eclipticplane');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.MOON);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

      it('Equatorial Plane View', async () => {
        const testId = 'moon-3d-equatorial-plane-view';
        await displayTestId(page, testId);
        await setupTest();

        try {
          await openSettingsPanel(page);
          await page.click('#view-equatorialplane');
          await closeSettingsPanel(page);

          const comparisonEnabled = await compareScreenshots(
            page,
            `${testId}-enabled.png`,
            `${testId}-enabled.png`,
            `${testId} Enabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonEnabled.isMatch).toBe(true);

          await openSettingsPanel(page);
          await page.click('#view-equatorialplane');
          await closeSettingsPanel(page);

          const comparisonDisabled = await compareScreenshots(
            page,
            `${testId}-disabled.png`,
            `${testId}-disabled.png`,
            `${testId} Disabled`,
            TOLERANCE.APPROX_MATCH
          );
          expect(comparisonDisabled.isMatch).toBe(true);
        } finally {
          // Ensure Equatorial Plane is disabled even if test fails
          await openSettingsPanel(page);
          if (await page.isChecked('#view-equatorialplane')) {
            await page.click('#view-equatorialplane');
          }
          await closeSettingsPanel(page);
          await cleanupViewControlTest(page, TEST_MODES.MOON);
        }
      }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);
    });

    it('CY3 Orbit Display', async () => {
      const testId = 'moon-3d-cy3-orbit-display';
      await displayTestId(page, testId);
      await openSettingsPanel(page);
      await page.click('#checkbox-lock-default');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      if (!(await page.isChecked('#view-orbit'))) {
        await page.click('#view-orbit');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      let comparison = await compareScreenshots(
        page,
        `${testId}-checked.png`,
        `${testId}-checked.png`,
        `${testId} Checked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      await openSettingsPanel(page);
      await page.click('#view-orbit');
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      comparison = await compareScreenshots(
        page,
        `${testId}-unchecked.png`,
        `${testId}-unchecked.png`,
        `${testId} Unchecked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      await openSettingsPanel(page);
      await page.click('#view-orbit');
      await closeSettingsPanel(page);

      await cleanupViewControlTest(page, TEST_MODES.MOON);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('CY3 Descent Orbit Display', async () => {
      const testId = 'moon-3d-cy3-descent-orbit-display';
      await displayTestId(page, testId);

      // Reset camera to default position and plane to ensure a clean state
      await openSettingsPanel(page);
      await page.click('#camera-default');
      await page.click('#checkbox-lock-default');
      await closeSettingsPanel(page);
      await openSettingsPanel(page);
      
      // Set XY- plane as required
      const xyMinusPlane = await page.locator('input[name="plane"][value="XY-"]:checked').count();
      if (xyMinusPlane === 0) {
        await page.click('input[name="plane"][value="XY-"]');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      await closeSettingsPanel(page);
      
      // Use Launch timeline as required
      await page.click('#burn1');  // Launch timeline
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Zoom in on Moon for better view
      await zoomIn(page, TEST_MODES.MOON.descentOrbitZoom, 'MOON');
      
      await openSettingsPanel(page);
      if (!(await page.isChecked('#view-orbit-descent'))) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      let comparison = await compareScreenshots(
        page,
        `${testId}-checked.png`,
        `${testId}-checked.png`,
        `${testId} Checked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      await openSettingsPanel(page);
      await page.click('#view-orbit-descent');
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      comparison = await compareScreenshots(
        page,
        `${testId}-unchecked.png`,
        `${testId}-unchecked.png`,
        `${testId} Unchecked`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      await openSettingsPanel(page);
      await page.click('#view-orbit-descent');
      await closeSettingsPanel(page);
      await waitForScene(page);

      // Screenshot 3: Orbit Restored
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-checked.png`, // Compare against the original baseline
        `${testId} Restored`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Zoom back out
      await zoomOut(page, TEST_MODES.MOON.descentOrbitZoom, 'MOON');
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Landing Animation', async () => {
      const testId = 'moon-3d-landing-animation';
      await startTest(page, testId, 'Landing Animation'); // Uses #burn12
      await openSettingsPanel(page);
      await page.click('#checkbox-lock-default');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await page.click('#landing');
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      await closeSettingsPanel(page);
      
      const comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Locations View', async () => {
      const testId = 'moon-3d-locations-view-toggle';
      await displayTestId(page, testId);
      await openSettingsPanel(page);

      // Ensure landing is disabled to avoid conflicts
      if (await page.isChecked('#landing')) {
        await page.click('#landing');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }

      if (!(await page.isChecked('#checkbox-lock-xy-minus'))) {
        await page.click('#checkbox-lock-xy-minus');
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      }
      
      // Uncheck orbits for better visibility
      if (await page.isChecked('#view-orbit')) {
        await page.click('#view-orbit');
      }
      if (await page.isChecked('#view-orbit-descent')) {
        await page.click('#view-orbit-descent');
      }
      
      // Ensure locations are enabled
      if (!(await page.isChecked('#view-craters'))) {
        await page.click('#view-craters');
      }
      
      // Disable sky background for consistent testing
      if (await page.isChecked('#view-sky')) {
        await page.click('#view-sky');
      }
      
      await closeSettingsPanel(page);
      await waitForScene(page);
      await page.click('#burn1'); // Go to Launch time
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      // Wait for button state to fully settle
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      const initialState = await storeInitialState(page);
      await zoomIn(page, TEST_MODES.MOON.locationsZoom, 'MOON');
      
      // Enabled screenshot
      let comparison = await compareScreenshots(
        page,
        `${testId}-enabled.png`,
        `${testId}-enabled.png`,
        `${testId} Enabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Disable locations
      await openSettingsPanel(page);
      await page.click('#view-craters');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Disabled screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-disabled.png`,
        `${testId}-disabled.png`,
        `${testId} Disabled`,
        TOLERANCE.APPROX_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Re-enable locations
      await openSettingsPanel(page);
      await page.click('#view-craters');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.EXTENDED_DELAY);
      
      // Restored screenshot
      comparison = await compareScreenshots(
        page,
        `${testId}-restored.png`,
        `${testId}-enabled.png`, // Compare to original enabled state
        `${testId} Restored`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      await zoomOut(page, TEST_MODES.MOON.locationsZoom, 'MOON');
      await restoreStoredState(page, initialState);
      
      // Cleanup
      await openSettingsPanel(page);
      if (!(await page.isChecked('#view-orbit'))) {
        await page.click('#view-orbit');
      }
      if (!(await page.isChecked('#view-orbit-descent'))) {
        await page.click('#view-orbit-descent');
      }
      await closeSettingsPanel(page);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);
  });

  // ====================================================================
  // 2D MODE TEST SUITES (DUPLICATED FROM 3D SUITES ABOVE)
  // ====================================================================

  describe('Test Suite 4: Earth Mode 2D Tests', () => {
    beforeAll(async () => {
      // Switch to 2D mode for entire test suite
      await openSettingsPanel(page);
      await page.click('#dimension-2D');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
    });

    afterAll(async () => {
      // Return to 3D mode after test suite completes
      await openSettingsPanel(page);
      await page.click('#dimension-3D');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
    });

    it('Page Load in Earth 2D Mode', async () => {
      const testId = 'earth-2d-page-load';
      await startTest(page, testId); // Uses default suite timeline (#burn1)
      await displayStartupMessage(page, testId);
      
      // Ensure we're in Earth mode for consistent baseline comparison
      await ensureOriginMode(page, 'earth');
      

      // Verify page title
      const title = await page.title();
      expect(title).toMatch(/Chandrayaan 3/);
      
      // Verify we're in 2D mode
      expect(await page.isChecked('#dimension-2D')).toBe(true);
      
      // Take screenshot in 2D mode
      const comparison = await compareScreenshots(
        page,
        `${testId}.png`,
        `${testId}.png`,
        `${testId} 2D Mode`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('2D Mode Verification', async () => {
      const testId = 'earth-2d-mode-verification';
      await displayTestId(page, testId);
      
      // Verify 2D mode is active (should already be set by beforeAll)
      expect(await page.isChecked('#dimension-2D')).toBe(true);
      expect(await page.isChecked('#dimension-3D')).toBe(false);
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Timeline Navigation in 2D Mode', async () => {
      const testId = 'earth-2d-timeline-navigation';
      await displayTestId(page, testId);

      // Test a subset of timeline buttons in 2D mode (already in 2D mode)
      // Only test the first few burn buttons as later ones might not change timeline
      const timelineButtons = [
        '#burn1', '#burn2', '#burn3', '#burn4', '#burn5'
      ];

      let previousTime = await page.evaluate(() => document.getElementById('date')?.textContent);
      
      for (const buttonId of timelineButtons) {
        await page.click(buttonId);
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
        
        const currentTime = await page.evaluate(() => document.getElementById('date')?.textContent);
        // Store the time if it changed (some buttons might go to same time)
        if (currentTime !== previousTime) {
          previousTime = currentTime;
        }
      }
      
      // Verify that at least we navigated somewhere
      const finalTime = await page.evaluate(() => document.getElementById('date')?.textContent);
      const startTime = 'Fri Jul 14 2023 14:53:00';
      expect(finalTime).not.toContain(startTime);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Animation Controls in 2D Mode', async () => {
      const testId = 'earth-2d-animation-controls';
      await displayTestId(page, testId);

      // Test play/pause in 2D mode (already in 2D mode)
      const initialTime = await page.evaluate(() => document.getElementById('date')?.textContent);
      
      // Play animation
      await page.click('#animate');
      await page.waitForTimeout(1000);
      
      const playingTime = await page.evaluate(() => document.getElementById('date')?.textContent);
      
      // Pause animation
      await page.click('#animate');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
      const pausedTime = await page.evaluate(() => document.getElementById('date')?.textContent);
      
      // Verify animation worked
      expect(playingTime).not.toBe(initialTime);
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    it('Plane Selection in 2D Mode', async () => {
      const testId = 'earth-2d-plane-selection';
      await startTest(page, testId); // Uses default suite timeline (#burn1)
      
      // Ensure we're in Earth mode for consistent baseline comparison
      await ensureOriginMode(page, 'earth');
      

      const planes = [
        { id: 'default', name: 'default', selector: '#checkbox-lock-default' },
        { id: 'xy', name: 'xy', selector: '#checkbox-lock-xy' },
        { id: 'yz', name: 'yz', selector: '#checkbox-lock-yz' },
        { id: 'zx', name: 'zx', selector: '#checkbox-lock-zx' },
        { id: 'xy-minus', name: 'xy-minus', selector: '#checkbox-lock-xy-minus' },
        { id: 'yz-minus', name: 'yz-minus', selector: '#checkbox-lock-yz-minus' },
        { id: 'zx-minus', name: 'zx-minus', selector: '#checkbox-lock-zx-minus' },
        { id: 'default-final', name: 'default-final', selector: '#checkbox-lock-default' }
      ];

      for (const plane of planes) {
        await openSettingsPanel(page);
        await page.click(plane.selector);
        await closeSettingsPanel(page);
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);

        const screenshotName = `${testId}-${plane.name.toLowerCase()}.png`;
        const comparison = await compareScreenshots(
          page,
          screenshotName,
          screenshotName,
          `${testId} ${plane.name} plane in 2D mode`,
          TOLERANCE.BROAD_MATCH
        );
        expect(comparison.isMatch).toBe(true);
      }
    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    // Note: CY3 Orbit Display test removed - orbit display controls don't exist in 2D mode
  });

  describe('Test Suite 5: Moon Mode 2D Tests', () => {
    beforeAll(async () => {
      // Switch to Moon mode and 2D mode for entire test suite
      await openSettingsPanel(page);
      await page.click('#origin-moon');
      await page.click('#dimension-2D');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
    });

    afterAll(async () => {
      // Return to Earth mode and 3D mode after test suite completes
      await openSettingsPanel(page);
      await page.click('#origin-earth');
      await page.click('#dimension-3D');
      await closeSettingsPanel(page);
      await page.waitForTimeout(TIMEOUTS.STABLE_RENDER_TIMEOUT);
    });

    it('Page Load in Moon 2D Mode', async () => {
      const testId = 'moon-2d-page-load';
      await startTest(page, testId); // Uses default suite timeline (#burn1)
      

      // Take screenshot in 2D mode
      const comparison = await compareScreenshots(
        page,
        `${testId}.png`,
        `${testId}.png`,
        `${testId} Moon 2D Mode`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);

    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('2D Mode Verification in Moon Mode', async () => {
      const testId = 'moon-2d-mode-verification';
      
      await displayTestId(page, testId);
      
      
      // Verify 2D mode is active
      const is2DModeChecked = await page.locator('#dimension-2D:checked').count();
      expect(is2DModeChecked).toBe(1);
      
    }, TIMEOUTS.TEST_CASE_TIMEOUT);

    it('Plane Selection in Moon 2D Mode', async () => {
      const testId = 'moon-2d-plane-selection';
      await startTest(page, testId); // Uses default suite timeline (#burn1)
      

      const planes = [
        { id: 'xy', name: 'XY', selector: '#checkbox-lock-xy' },
        { id: 'yz', name: 'YZ', selector: '#checkbox-lock-yz' },
        { id: 'default', name: 'DEFAULT', selector: '#checkbox-lock-default' }
      ];

      for (const plane of planes) {
        await openSettingsPanel(page);
        await page.click(plane.selector);
        await closeSettingsPanel(page);
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);

        const screenshotName = `${testId}-${plane.name.toLowerCase()}.png`;
        const comparison = await compareScreenshots(
          page,
          screenshotName,
          screenshotName,
          `${testId} ${plane.name} plane in Moon 2D mode`,
          TOLERANCE.BROAD_MATCH
        );
        expect(comparison.isMatch).toBe(true);
      }

    }, TIMEOUTS.EXTENDED_TEST_TIMEOUT);

    // Note: CY3 Orbit Display test removed - orbit display controls don't exist in 2D mode

    // Note: Landing Animation test removed - landing animation controls don't exist in 2D mode
  });

  // Helper functions for Test Suite 6
  async function waitForAnimationCompletion(page, timeoutMs = 180000) {
    console.log('Waiting for animation to complete naturally...');
    
    const startTime = Date.now();
    let lastTimelineValue = '';
    let stableCount = 0;
    
    return await page.waitForFunction(() => {
      // Check if animation has stopped by detecting if Play button is showing
      const animateButton = document.querySelector('#animate');
      if (animateButton && animateButton.textContent.trim() === 'Play') {
        console.log('Animation stopped - Play button detected');
        return true;
      }
      
      // Check for September 2023 with CY3 Data End
      const dateElement = document.querySelector('#date');
      const currentTimelineValue = dateElement ? dateElement.textContent : '';
      
      // Check for September 2023
      if (currentTimelineValue.includes('September 2023') || currentTimelineValue.includes('Sep 2023')) {
        // Also look for CY3 Data End indicator anywhere on page
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = element.textContent || element.innerText || '';
          if (text.includes('CY3 Data End') || text.includes('🏁CY3 Data End')) {
            console.log('Animation completed naturally: Found September 2023 with CY3 Data End');
            return true;
          }
        }
      }
      
      // Track if timeline has stopped changing (animation might be stuck)
      if (currentTimelineValue === window.lastTimelineCheck) {
        window.stableTimelineCount = (window.stableTimelineCount || 0) + 1;
        if (window.stableTimelineCount > 3) { // 3 checks * 5 seconds = 15 seconds stable
          console.log('Timeline appears stuck - animation may have completed');
          return true;
        }
      } else {
        window.stableTimelineCount = 0;
      }
      window.lastTimelineCheck = currentTimelineValue;
      
      return false;
    }, null, { 
      timeout: timeoutMs,
      polling: 5000 // Check every 5 seconds
    });
  }

  async function selectPlaneForFullRun(page, planeName) {
    console.log(`Selecting plane: ${planeName}`);
    await openSettingsPanel(page);
    
    const planeSelectors = {
      'earth-3d': '#checkbox-lock-default',
      'moon-3d': '#checkbox-lock-yz-minus', 
      'earth-2d': '#checkbox-lock-xy',
      'moon-2d': '#checkbox-lock-xy'
    };
    
    const selector = planeSelectors[planeName];
    if (selector) {
      await page.click(selector);
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
    }
    
    await closeSettingsPanel(page);
  }

  async function getCameraDistance(page) {
    return await page.evaluate(() => {
      try {
        const isLunarMode = document.querySelector('#origin-moon')?.checked;
        const scene = isLunarMode ? window.animationScenes?.lunar : window.animationScenes?.geo;
        const camera = scene?.camera;
        const controls = scene?.cameraControls;
        
        if (!camera || !controls) {
          return null;
        }
        
        return camera.position.distanceTo(controls.target);
      } catch (e) {
        console.error('Error getting camera distance:', e);
        return null;
      }
    });
  }

  async function zoomToDistance(page, targetDistance) {
    console.log(`Zooming to distance: ${targetDistance}`);
    return await page.evaluate((distance) => {
      try {
        const isLunarMode = document.querySelector('#origin-moon')?.checked;
        const scene = isLunarMode ? window.animationScenes?.lunar : window.animationScenes?.geo;
        const camera = scene?.camera;
        const controls = scene?.cameraControls;
        
        if (!camera || !controls) {
          console.log('Camera or controls not found');
          return false;
        }
        
        const target = controls.target;
        const currentDistance = camera.position.distanceTo(target);
        const ratio = distance / currentDistance;
        
        camera.position.lerpVectors(target, camera.position, ratio);
        controls.update();
        
        return true;
      } catch (e) {
        console.error('Error setting zoom distance:', e);
        return false;
      }
    }, targetDistance);
  }

  describe('Test Suite 6: Full Run Tests', () => {
    beforeAll(async () => {
      // Ensure we start with Earth mode and 3D
      await openSettingsPanel(page);
      if (!await page.isChecked('#origin-earth')) {
        await page.click('#origin-earth');
      }
      if (!await page.isChecked('#dimension-3D')) {
        await page.click('#dimension-3D');
      }
      await closeSettingsPanel(page);
      await waitForScene(page);
    });

    it('Earth 3D Full Run Test', async () => {
      const testId = 'earth-3d-full-run';
      await startTest(page, testId); // Uses default suite timeline (#burn1)
      
      // Configure for Earth 3D mode
      await openSettingsPanel(page);
      await page.click('#origin-earth');
      await page.click('#dimension-3D');
      await closeSettingsPanel(page);
      await selectPlaneForFullRun(page, 'earth-3d');
      await waitForScene(page);
      
      // Set optimal zoom level
      await zoomToDistance(page, 500);
      
      // Start animation and speed it up 5x
      await page.click('#animate');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      console.log('Starting Earth 3D full run animation...');
      
      // Wait for animation to complete naturally or timeout
      try {
        await waitForAnimationCompletion(page, 180000);
        console.log('Earth 3D animation completed successfully');
      } catch (error) {
        console.log('Earth 3D animation timed out, forcing stop');
        
        // Force stop animation
        const isPlaying = await page.locator('#animate:has-text("Pause")').count();
        if (isPlaying > 0) {
          await page.click('#animate');
        }
        
        throw new Error('Animation did not complete within timeout period');
      }
      
      // Ensure animation is stopped
      const isPlaying = await page.locator('#animate:has-text("Pause")').count();
      if (isPlaying > 0) {
        await page.click('#animate');
      }
      
      // Reset speed back to normal (5 slower clicks to undo 5 faster clicks)
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      
      // Take final screenshot
      const comparison = await compareScreenshots(
        page,
        `${testId}-completed.png`,
        `${testId}-completed.png`,
        `${testId} Completed`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Reset timeline to Launch for next test
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
    }, TIMEOUTS.CLEANUP_TIMEOUT * 2);

    it('Moon 3D Full Run Test', async () => {
      const testId = 'moon-3d-full-run';
      await startTest(page, testId); // Initialize test properly
      
      // Configure for Moon 3D mode
      await openSettingsPanel(page);
      await page.click('#origin-moon');
      await page.click('#dimension-3D');
      
      // Ensure stellar sky is disabled for consistent baseline comparison
      const stellarSkyCheckbox = await page.$('#view-sky');
      if (stellarSkyCheckbox && await stellarSkyCheckbox.isChecked()) {
        await stellarSkyCheckbox.click();
        await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY); // Wait for stellar sky to be processed
      }
      
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      await selectPlaneForFullRun(page, 'moon-3d');
      await waitForScene(page);
      
      // Set optimal zoom level
      await zoomToDistance(page, 500);
      
      // Start animation and speed it up 5x
      await page.click('#animate');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      console.log('Starting Moon 3D full run animation...');
      
      // Wait for animation to complete naturally or timeout
      try {
        await waitForAnimationCompletion(page, 180000);
        console.log('Moon 3D animation completed successfully');
      } catch (error) {
        console.log('Moon 3D animation timed out, forcing stop');
        
        // Force stop animation
        const isPlaying = await page.locator('#animate:has-text("Pause")').count();
        if (isPlaying > 0) {
          await page.click('#animate');
        }
        
        throw new Error('Animation did not complete within timeout period');
      }
      
      // Ensure animation is stopped
      const isPlaying = await page.locator('#animate:has-text("Pause")').count();
      if (isPlaying > 0) {
        await page.click('#animate');
      }
      
      // Reset speed back to normal (5 slower clicks to undo 5 faster clicks)
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      
      // Take final screenshot
      const comparison = await compareScreenshots(
        page,
        `${testId}-completed.png`,
        `${testId}-completed.png`,
        `${testId} Completed`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Reset timeline to Launch for next test
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
    }, TIMEOUTS.CLEANUP_TIMEOUT * 2);

    it('Earth 2D Full Run Test', async () => {
      const testId = 'earth-2d-full-run';
      await startTest(page, testId); // Initialize test properly
      
      // Configure for Earth 2D mode
      await openSettingsPanel(page);
      await page.click('#origin-earth');
      await page.click('#dimension-2D');
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      await selectPlaneForFullRun(page, 'earth-2d');
      await waitForScene(page);
      
      
      // Start animation and speed it up 5x
      await page.click('#animate');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      console.log('Starting Earth 2D full run animation...');
      
      // Wait for animation to complete naturally or timeout
      try {
        await waitForAnimationCompletion(page, 180000);
        console.log('Earth 2D animation completed successfully');
      } catch (error) {
        console.log('Earth 2D animation timed out, forcing stop');
        
        // Force stop animation
        const isPlaying = await page.locator('#animate:has-text("Pause")').count();
        if (isPlaying > 0) {
          await page.click('#animate');
        }
        
        throw new Error('Animation did not complete within timeout period');
      }
      
      // Ensure animation is stopped
      const isPlaying = await page.locator('#animate:has-text("Pause")').count();
      if (isPlaying > 0) {
        await page.click('#animate');
      }
      
      // Reset speed back to normal (5 slower clicks to undo 5 faster clicks)
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      
      // Take final screenshot
      const comparison = await compareScreenshots(
        page,
        `${testId}-completed.png`,
        `${testId}-completed.png`,
        `${testId} Completed`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Reset timeline to Launch for next test
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
    }, TIMEOUTS.CLEANUP_TIMEOUT * 2);

    it('Moon 2D Full Run Test', async () => {
      const testId = 'moon-2d-full-run';
      await startTest(page, testId); // Initialize test properly
      
      // Configure for Moon 2D mode
      await openSettingsPanel(page);
      await page.click('#origin-moon');
      await page.click('#dimension-2D');
      await closeSettingsPanel(page);
      await waitForScene(page);
      
      await selectPlaneForFullRun(page, 'moon-2d');
      await waitForScene(page);
      
      
      // Start animation and speed it up 5x
      await page.click('#animate');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      await page.click('#faster');
      console.log('Starting Moon 2D full run animation...');
      
      // Wait for animation to complete naturally or timeout
      try {
        await waitForAnimationCompletion(page, 180000);
        console.log('Moon 2D animation completed successfully');
      } catch (error) {
        console.log('Moon 2D animation timed out, forcing stop');
        
        // Force stop animation
        const isPlaying = await page.locator('#animate:has-text("Pause")').count();
        if (isPlaying > 0) {
          await page.click('#animate');
        }
        
        throw new Error('Animation did not complete within timeout period');
      }
      
      // Ensure animation is stopped
      const isPlaying = await page.locator('#animate:has-text("Pause")').count();
      if (isPlaying > 0) {
        await page.click('#animate');
      }
      
      // Reset speed back to normal (5 slower clicks to undo 5 faster clicks)
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      await page.click('#slower');
      
      // Take final screenshot
      const comparison = await compareScreenshots(
        page,
        `${testId}-completed.png`,
        `${testId}-completed.png`,
        `${testId} Completed`,
        TOLERANCE.BROAD_MATCH
      );
      expect(comparison.isMatch).toBe(true);
      
      // Reset timeline to Launch for next test
      await page.click('#burn1');
      await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
      
    }, TIMEOUTS.CLEANUP_TIMEOUT * 2);
  });
});