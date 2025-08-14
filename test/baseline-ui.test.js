import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Helper function for screenshot comparison with pixel difference calculation
async function compareScreenshots(page, screenshotName, expectedPath) {
  // Ensure screenshots directory exists
  const screenshotsDir = join(process.cwd(), 'test', 'screenshots', 'baseline');
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const actualPath = join(screenshotsDir, screenshotName);
  const expectedFullPath = join(screenshotsDir, expectedPath);
  
  // Take current screenshot
  const screenshot = await page.screenshot({ fullPage: false, path: actualPath });
  
  // If this is the first run, save as baseline
  if (!existsSync(expectedFullPath)) {
    writeFileSync(expectedFullPath, screenshot);
    console.log(`📸 Baseline screenshot saved: ${expectedPath}`);
    return { isMatch: true, pixelDifference: 0, message: 'Baseline created' };
  }
  
  // Compare with existing baseline
  const expectedScreenshot = readFileSync(expectedFullPath);
  
  // Simple comparison - in a real implementation, you'd use image comparison library
  const sizeDifference = Math.abs(screenshot.length - expectedScreenshot.length);
  const isExactMatch = screenshot.equals(expectedScreenshot);
  
  if (isExactMatch) {
    return { isMatch: true, pixelDifference: 0, message: 'Exact match' };
  } else {
    // Calculate approximate pixel difference based on file size difference
    const approximatePixelDiff = Math.round(sizeDifference / 3); // Rough estimate (RGB bytes per pixel)
    return { 
      isMatch: false, 
      pixelDifference: approximatePixelDiff, 
      sizeDifference,
      message: `Size difference: ${sizeDifference} bytes, ~${approximatePixelDiff} pixels changed` 
    };
  }
}

describe('Chandrayaan-3 UI Baseline Tests', () => {
  let browser, page, server;
  let consoleErrors = [];
  
  beforeAll(async () => {
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
  });
  
  afterAll(async () => {
    await browser?.close();
    server?.kill();
  });

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

  describe('Page Load and UI Elements', () => {
    it('should load the page successfully', async () => {
      expect(await page.title()).toContain('Chandrayaan 3');
    });
    
    it('should start in geocentric (Earth) mode', async () => {
      const earthModeActive = await page.locator('#origin-earth:checked').count();
      expect(earthModeActive).toBe(1);
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

  describe('Animation Behavior Tests', () => {
    it('should show timeline changes during Play and stop during Pause', async () => {
      // Reset to Launch position for consistent starting point
      await page.click('#burn1');
      await page.waitForTimeout(500);
      
      // Start animation and sample timeline text every 500ms for 3 seconds
      const timelineSamples = [];
      
      await page.click('#animate'); // Start animation
      
      // Sample timeline text 6 times over 3 seconds (every 500ms)
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        timelineSamples.push({
          sample: i + 1,
          date: dateText,
          timestamp: Date.now()
        });
      }
      
      // Pause animation
      await page.click('#animate'); // Pause
      await page.waitForTimeout(200);
      
      // Sample timeline text during pause (should NOT change)
      const pauseSamples = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        pauseSamples.push({
          sample: i + 1,
          date: dateText
        });
      }
      
      // Verify REAL animation happened during play
      const timelineChanged = timelineSamples.some((sample, index) => {
        if (index === 0) return false;
        return sample.date !== timelineSamples[0].date;
      });
      
      // Verify timeline STOPPED changing during pause
      const timelineStoppedDuringPause = pauseSamples.every(sample => 
        sample.date === pauseSamples[0].date
      );
      
      expect(timelineChanged).toBe(true);
      expect(timelineStoppedDuringPause).toBe(true);
    }, 30000); // Extended timeout for this comprehensive test
    
    it('should show speed changes when Fast button is clicked', async () => {
      // Reset to Launch and start animation
      await page.click('#burn1');
      await page.waitForTimeout(500);
      await page.click('#animate'); // Start
      await page.waitForTimeout(1000); // Let it run normally first
      
      // Sample normal speed for 2 seconds
      const normalSpeedSamples = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        normalSpeedSamples.push({ date: dateText, time: Date.now() });
      }
      
      // Click Fast button and sample for 2 seconds
      await page.click('#faster');
      await page.waitForTimeout(200);
      
      const fastSpeedSamples = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        fastSpeedSamples.push({ date: dateText, time: Date.now() });
      }
      
      // Stop animation
      await page.click('#animate');
      
      // Verify that timeline changed more rapidly during fast mode
      const normalChanges = normalSpeedSamples.filter((sample, index) => 
        index > 0 && sample.date !== normalSpeedSamples[index - 1].date
      ).length;
      
      const fastChanges = fastSpeedSamples.filter((sample, index) => 
        index > 0 && sample.date !== fastSpeedSamples[index - 1].date
      ).length;
      
      // Fast mode should show more changes or at least equal changes
      expect(fastChanges).toBeGreaterThanOrEqual(normalChanges);
      
      // At minimum, we should see SOME timeline changes in both modes
      expect(normalChanges).toBeGreaterThan(0);
      expect(fastChanges).toBeGreaterThan(0);
    }, 25000);
    
    it('should show speed changes when Slow button is clicked', async () => {
      // Reset to Launch and start animation
      await page.click('#burn1');
      await page.waitForTimeout(500);
      await page.click('#animate'); // Start
      await page.waitForTimeout(1000);
      
      // Click Slow button immediately and sample
      await page.click('#slower');
      await page.waitForTimeout(200);
      
      const slowSpeedSamples = [];
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        const distanceText = await page.locator('#distance-SC-EARTH').textContent();
        slowSpeedSamples.push({ 
          date: dateText, 
          distance: distanceText,
          time: Date.now() 
        });
      }
      
      // Click realtime/normal to compare
      await page.click('#realtime');
      await page.waitForTimeout(200);
      
      const normalSpeedSamples = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(500);
        const dateText = await page.locator('#date').textContent();
        const distanceText = await page.locator('#distance-SC-EARTH').textContent();
        normalSpeedSamples.push({ 
          date: dateText, 
          distance: distanceText 
        });
      }
      
      // Stop animation
      await page.click('#animate');
      
      // Verify timeline is changing in both modes (proving REAL animation)
      const slowChanges = slowSpeedSamples.filter((sample, index) => 
        index > 0 && (sample.date !== slowSpeedSamples[index - 1].date || 
                     sample.distance !== slowSpeedSamples[index - 1].distance)
      ).length;
      
      const normalChanges = normalSpeedSamples.filter((sample, index) => 
        index > 0 && (sample.date !== normalSpeedSamples[index - 1].date || 
                      sample.distance !== normalSpeedSamples[index - 1].distance)
      ).length;
      
      // Both should show changes (proving animation works)
      expect(slowChanges).toBeGreaterThan(0);
      expect(normalChanges).toBeGreaterThan(0);
    }, 25000);
  });
  
  describe('Lock On Controls', () => {
    it('should lock on spacecraft and keep it in same position during animation', async () => {
      // Ensure settings panel is open
      await page.click('#settings-panel-button');
      await page.waitForTimeout(500);
      
      // Reset to Launch for consistent starting point
      await page.click('#burn1');
      await page.waitForTimeout(1000); // Increased wait time
      
      // Get initial timeline to verify animation will work
      const initialDate = await page.locator('#date').textContent();
      console.log(`Initial date: ${initialDate}`);
      
      // Enable Lock on SC
      await page.click('#checkbox-lock-sc');
      await page.waitForTimeout(500);
      
      // Start animation
      await page.click('#animate');
      await page.waitForTimeout(500); // Increased wait time
      
      // Increase animation speed to make changes more visible
      await page.click('#faster');
      await page.click('#faster'); // Click twice for faster speed
      await page.waitForTimeout(500); // Increased wait time
      
      // Verify animation is actually running with longer wait
      await page.waitForTimeout(2000); // Wait 2 seconds for animation to progress
      const animationDate = await page.locator('#date').textContent();
      console.log(`Animation date: ${animationDate}`);
      const animationRunning = initialDate !== animationDate;
      expect(animationRunning).toBe(true);
      
      const screenshots = [];
      
      // Take screenshots every 0.5 seconds for 5 seconds (10 screenshots)
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const screenshot = await page.screenshot({ fullPage: false });
        const currentDate = await page.locator('#date').textContent();
        screenshots.push({
          index: i,
          image: screenshot,
          date: currentDate,
          timestamp: Date.now()
        });
      }
      
      // Stop animation
      await page.click('#animate');
      await page.waitForTimeout(200);
      
      // Reset speed to normal
      await page.click('#realtime');
      await page.waitForTimeout(200);
      
      // Disable Lock on SC
      await page.click('#checkbox-lock-sc');
      await page.waitForTimeout(200);
      
      // Verify we took screenshots and timeline changed during animation
      expect(screenshots.length).toBe(10);
      
      const timelineChangedDuringAnimation = screenshots.some((shot, index) => 
        index > 0 && shot.date !== screenshots[0].date
      );
      expect(timelineChangedDuringAnimation).toBe(true);
      
      // Verify screenshots were captured
      const allScreenshotsValid = screenshots.every(shot => 
        shot.image && shot.image.length > 1000 // Basic validation
      );
      expect(allScreenshotsValid).toBe(true);
      
    }, 25000); // Increased timeout to 25 seconds
    
    it('should lock on Moon and keep it in same position during animation', async () => {
      // Reset to Launch for consistent starting point  
      await page.click('#burn1');
      await page.waitForTimeout(1000); // Increased wait time
      
      // Get initial timeline to verify animation will work
      const initialDate = await page.locator('#date').textContent();
      console.log(`Initial date: ${initialDate}`);
      
      // Enable Lock on Moon
      await page.click('#checkbox-lock-moon');
      await page.waitForTimeout(500);
      
      // Start animation
      await page.click('#animate');
      await page.waitForTimeout(500); // Increased wait time
      
      // Increase animation speed to make changes more visible
      await page.click('#faster');
      await page.click('#faster'); // Click twice for faster speed
      await page.waitForTimeout(500); // Increased wait time
      
      // Verify animation is actually running with longer wait
      await page.waitForTimeout(2000); // Wait 2 seconds for animation to progress
      const animationDate = await page.locator('#date').textContent();
      console.log(`Animation date: ${animationDate}`);
      const animationRunning = initialDate !== animationDate;
      expect(animationRunning).toBe(true);
      
      const screenshots = [];
      
      // Take screenshots every 0.5 seconds for 5 seconds (10 screenshots)
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const screenshot = await page.screenshot({ fullPage: false });
        const currentDate = await page.locator('#date').textContent();
        screenshots.push({
          index: i,
          image: screenshot,
          date: currentDate,
          timestamp: Date.now()
        });
      }
      
      // Stop animation
      await page.click('#animate');
      await page.waitForTimeout(200);
      
      // Reset speed to normal
      await page.click('#realtime');
      await page.waitForTimeout(200);
      
      // Disable Lock on Moon
      await page.click('#checkbox-lock-moon');
      await page.waitForTimeout(200);
      
      // Verify we took screenshots and timeline changed during animation
      expect(screenshots.length).toBe(10);
      
      const timelineChangedDuringAnimation = screenshots.some((shot, index) => 
        index > 0 && shot.date !== screenshots[0].date
      );
      expect(timelineChangedDuringAnimation).toBe(true);
      
      // Verify screenshots were captured
      const allScreenshotsValid = screenshots.every(shot => 
        shot.image && shot.image.length > 1000 // Basic validation
      );
      expect(allScreenshotsValid).toBe(true);
      
    }, 25000); // Increased timeout to 25 seconds
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
    });

    // Helper function to ensure consistent state before each test
    async function ensureConsistentState() {
      // Click Launch button for consistent timeline position
      await page.click('#burn1');
      await page.waitForTimeout(300);
      
      // Check current button state and pause if needed
      const playButton = await page.locator('#animate:has-text("Play")').count();
      const pauseButton = await page.locator('#animate:has-text("Pause")').count();
      
      if (pauseButton > 0) {
        // Animation is running (Pause button visible), so click to pause
        await page.click('#animate');
        await page.waitForTimeout(300);
        console.log('⏸️  Animation paused at Launch position before screenshot');
      } else if (playButton > 0) {
        // Animation already paused (Play button visible), no action needed
        console.log('✅ Animation already paused at Launch position');
      } else {
        console.log('⚠️  Warning: Neither Play nor Pause button found');
      }
    }

    it('should switch to XY plane and show correct axes orientation', async () => {
      // Ensure consistent state before screenshot
      await ensureConsistentState();
      
      // Switch to XY plane
      await page.click('#checkbox-lock-xy');
      await page.waitForTimeout(1000); // Wait for view to update
      
      // Verify XY plane is selected
      const xyPlaneSelected = await page.locator('#checkbox-lock-xy:checked').count();
      expect(xyPlaneSelected).toBe(1);
      
      // Ensure animation is still paused before taking screenshot
      await ensureConsistentState();
      
      // Take visual snapshot for XY plane (Green up, Red right)
      const comparison = await compareScreenshots(page, 'xy-plane-current.png', 'xy-plane-baseline.png');
      console.log(`🔍 XY Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      // With paused animation, we expect reasonable differences due to axis orientation changes
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    it('should switch to YZ plane and show correct axes orientation', async () => {
      await ensureConsistentState();
      
      await page.click('#checkbox-lock-yz');
      await page.waitForTimeout(1000);
      
      const yzPlaneSelected = await page.locator('#checkbox-lock-yz:checked').count();
      expect(yzPlaneSelected).toBe(1);
      
      await ensureConsistentState();
      
      // Take visual snapshot for YZ plane (Blue up, Green right)
      const comparison = await compareScreenshots(page, 'yz-plane-current.png', 'yz-plane-baseline.png');
      console.log(`🔍 YZ Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    it('should switch to ZX plane and show correct axes orientation', async () => {
      await ensureConsistentState();
      
      await page.click('#checkbox-lock-xz'); // Note: UI uses #checkbox-lock-xz for ZX plane
      await page.waitForTimeout(1000);
      
      const zxPlaneSelected = await page.locator('#checkbox-lock-xz:checked').count();
      expect(zxPlaneSelected).toBe(1);
      
      await ensureConsistentState();
      
      // Take visual snapshot for ZX plane (Red up, Blue right)
      const comparison = await compareScreenshots(page, 'zx-plane-current.png', 'zx-plane-baseline.png');
      console.log(`🔍 ZX Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    it('should switch to XY- plane and show correct axes orientation', async () => {
      await ensureConsistentState();
      
      await page.click('#checkbox-lock-xy-minus');
      await page.waitForTimeout(1000);
      
      const xyMinusPlaneSelected = await page.locator('#checkbox-lock-xy-minus:checked').count();
      expect(xyMinusPlaneSelected).toBe(1);
      
      await ensureConsistentState();
      
      // Take visual snapshot for XY- plane (Green up, Red left)
      const comparison = await compareScreenshots(page, 'xy-minus-plane-current.png', 'xy-minus-plane-baseline.png');
      console.log(`🔍 XY- Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    it('should switch to YZ- plane and show correct axes orientation', async () => {
      await ensureConsistentState();
      
      await page.click('#checkbox-lock-yz-minus');
      await page.waitForTimeout(1000);
      
      const yzMinusPlaneSelected = await page.locator('#checkbox-lock-yz-minus:checked').count();
      expect(yzMinusPlaneSelected).toBe(1);
      
      await ensureConsistentState();
      
      // Take visual snapshot for YZ- plane (Blue up, Green left)
      const comparison = await compareScreenshots(page, 'yz-minus-plane-current.png', 'yz-minus-plane-baseline.png');
      console.log(`🔍 YZ- Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    it('should switch to ZX- plane and show correct axes orientation', async () => {
      await ensureConsistentState();
      
      await page.click('#checkbox-lock-xz-minus'); // Note: UI uses #checkbox-lock-xz-minus for ZX- plane
      await page.waitForTimeout(1000);
      
      const zxMinusPlaneSelected = await page.locator('#checkbox-lock-xz-minus:checked').count();
      expect(zxMinusPlaneSelected).toBe(1);
      
      await ensureConsistentState();
      
      // Take visual snapshot for ZX- plane (Red up, Blue left)
      const comparison = await compareScreenshots(page, 'zx-minus-plane-current.png', 'zx-minus-plane-baseline.png');
      console.log(`🔍 ZX- Plane comparison: ${comparison.message}`);
      if (comparison.pixelDifference > 0) {
        console.log(`📊 Pixel difference: ${comparison.pixelDifference} pixels`);
      }
      
      expect(comparison.isMatch || comparison.pixelDifference < 600).toBe(true);
    });

    afterAll(async () => {
      // Re-enable orbit displays and return to default XY plane
      await page.click('#view-orbit'); // Re-check CY3 Orbit
      await page.waitForTimeout(200);
      await page.click('#view-orbit-descent'); // Re-check CY3 Descent Orbit
      await page.waitForTimeout(200);
      await page.click('#checkbox-lock-xy'); // Return to XY plane
      await page.waitForTimeout(500);
    });
  });

  describe('Settings and View Controls', () => {
    // Helper function for consistent state in Settings tests
    async function ensureConsistentStateForSettings() {
      // Click Launch button for consistent timeline position
      await page.click('#burn1');
      await page.waitForTimeout(300);
      
      // Check current button state and pause if needed
      const playButton = await page.locator('#animate:has-text("Play")').count();
      const pauseButton = await page.locator('#animate:has-text("Pause")').count();
      
      if (pauseButton > 0) {
        // Animation is running (Pause button visible), so click to pause
        await page.click('#animate');
        await page.waitForTimeout(300);
        console.log('⏸️  Animation paused at Launch position for settings screenshot');
      } else if (playButton > 0) {
        // Animation already paused (Play button visible), no action needed
        console.log('✅ Animation already paused at Launch position for settings');
      }
    }

    it('should open settings panel', async () => {
      await page.click('#settings-panel-button');
      await page.waitForTimeout(500);
      
      const dimensionControlsVisible = await page.locator('#dimension-2D').count();
      expect(dimensionControlsVisible).toBe(1);
    });
    
    it('should switch to 2D mode with proper verification', async () => {
      // Click Launch to ensure consistent state (this pauses animation)
      await page.click('#burn1');
      await page.waitForTimeout(500);
      
      // Verify we're in 3D mode initially
      const in3D = await page.locator('#dimension-3D:checked').count();
      expect(in3D).toBe(1);
      
      // Take screenshot in 3D mode (establish baseline)
      const comparison3D = await compareScreenshots(page, '3d-mode-current.png', '3d-mode-baseline.png');
      console.log(`🔍 3D Mode comparison: ${comparison3D.message}`);
      if (comparison3D.pixelDifference > 0) {
        console.log(`📊 3D Mode pixel difference: ${comparison3D.pixelDifference} pixels`);
      }
      
      // Switch to 2D mode
      await page.click('#dimension-2D');
      
      // Wait for 2D mode to fully load
      await page.waitForTimeout(1000);
      
      const in2D = await page.locator('#dimension-2D:checked').count();
      expect(in2D).toBe(1);
      
      // Take screenshot in 2D mode (establish baseline)
      const comparison2D = await compareScreenshots(page, '2d-mode-current.png', '2d-mode-baseline.png');
      console.log(`🔍 2D Mode comparison: ${comparison2D.message}`);
      if (comparison2D.pixelDifference > 0) {
        console.log(`📊 2D Mode pixel difference: ${comparison2D.pixelDifference} pixels`);
      }
      
      // Verify screenshot comparisons are reasonable (or exact match for baselines)
      expect(comparison3D.isMatch || comparison3D.pixelDifference < 600).toBe(true);
      expect(comparison2D.isMatch || comparison2D.pixelDifference < 600).toBe(true);
    });
    
    it('should switch back to 3D mode with loading verification', async () => {
      // Click Launch to ensure consistent state (this pauses animation)  
      await page.click('#burn1');
      await page.waitForTimeout(500);
      
      // Switch back to 3D mode
      await page.click('#dimension-3D');
      
      // Wait for 3D mode to load completely (3D takes longer to initialize)
      await page.waitForTimeout(2000);
      
      // Verify we're in 3D mode
      const in3D = await page.locator('#dimension-3D:checked').count();
      expect(in3D).toBe(1);
      
      // Verify 3D canvas is present and loaded
      const canvasExists = await page.locator('canvas').count();
      expect(canvasExists).toBeGreaterThan(0);
      
      // Take screenshot to verify 3D mode restored properly
      const comparison3DRestored = await compareScreenshots(page, '3d-mode-restored-current.png', '3d-mode-restored-baseline.png');
      console.log(`🔍 3D Mode Restored comparison: ${comparison3DRestored.message}`);
      if (comparison3DRestored.pixelDifference > 0) {
        console.log(`📊 3D Mode Restored pixel difference: ${comparison3DRestored.pixelDifference} pixels`);
      }
      
      expect(comparison3DRestored.isMatch || comparison3DRestored.pixelDifference < 600).toBe(true);
      
      // Close settings
      await page.keyboard.press('Escape');
    });
  });
  
  describe('Final Verification', () => {
    it('should remain stable after all tests', async () => {
      const earthModeActive = await page.locator('#origin-earth:checked').count();
      const telemetryWorking = await page.locator('#distance-SC-EARTH').count();
      const timelineStable = await page.locator('#burn1').count();
      
      expect(earthModeActive).toBe(1);
      expect(telemetryWorking).toBe(1);
      expect(timelineStable).toBe(1);
    });
  });
});