/**
 * Mission Smoke Tests
 *
 * These tests run animations for various missions in different configurations
 * (Earth/Moon origin, 2D/3D) and verify no console errors occur.
 *
 * Unlike the CY3 UI tests which use image comparison, these tests are purely
 * functional smoke tests to ensure missions load and run without errors.
 */

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// CI environments need longer timeouts due to software WebGL rendering
const isCI = process.env.CI === 'true';
const CI_MULTIPLIER = isCI ? 3 : 1;

const TIMEOUTS = {
  PAGE_LOAD: 30000 * CI_MULTIPLIER,
  SCENE_READY: 60000 * CI_MULTIPLIER,
  ANIMATION_RUN: 3000 * CI_MULTIPLIER,  // Reduced - we speed up animation significantly
  MODE_SWITCH: 5000 * CI_MULTIPLIER,
  TEST_CASE: 60000 * CI_MULTIPLIER,  // Reduced from 120s
};

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.VITE_TEST_BASE_URL || 'http://localhost:8111',
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOWMO || '0'),
};

// Missions to test (excluding cy3 which has its own comprehensive tests)
const MISSIONS = [
  { id: 'a10', name: 'Apollo 10 Snoopy' },
  { id: 'a11', name: 'Apollo 11 S-IVB' },
  { id: 'cy2', name: 'Chandrayaan 2' },
];

// Test configurations: origin/dimension combinations
const CONFIGS = [
  { origin: 'earth', dimension: '3D', label: 'Earth/3D' },
  { origin: 'moon', dimension: '3D', label: 'Moon/3D' },
  { origin: 'earth', dimension: '2D', label: 'Earth/2D' },
  { origin: 'moon', dimension: '2D', label: 'Moon/2D' },
];

// Patterns to ignore in console error checking
const IGNORED_ERROR_PATTERNS = [
  /favicon\.ico/i,
  /Failed to load resource.*favicon/i,
];

function isIgnoredError(message) {
  return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

let browser;

describe('Mission Smoke Tests', () => {
  beforeAll(async () => {
    const baseArgs = [
      '--no-sandbox',
      '--max-old-space-size=4096',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ];

    const headlessArgs = [
      '--disable-gpu-sandbox',
      '--use-angle=gl',
      '--enable-unsafe-swiftshader',
    ];

    const headedArgs = [
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
    ];

    const launchArgs = TEST_CONFIG.headless
      ? [...baseArgs, ...headlessArgs]
      : [...baseArgs, ...headedArgs];

    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: launchArgs,
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // Generate basic smoke tests for each mission
  for (const mission of MISSIONS) {
    describe(`${mission.name} (${mission.id})`, () => {

      // Generate tests for each configuration
      for (const config of CONFIGS) {
        it(`runs without errors in ${config.label}`, async () => {
          const page = await browser.newPage();
          const consoleErrors = [];
          const pageErrors = [];

          try {
            // Set up console error collection
            page.on('console', msg => {
              const text = msg.text();
              const type = msg.type();

              if (type === 'error' && !isIgnoredError(text)) {
                consoleErrors.push({ type, text });
                console.log(`[${mission.id}/${config.label}] Console error: ${text}`);
              }
            });

            page.on('pageerror', error => {
              const message = error.message;
              if (!isIgnoredError(message)) {
                pageErrors.push(message);
                console.log(`[${mission.id}/${config.label}] Page error: ${message}`);
              }
            });

            // Navigate to mission page
            const url = `${TEST_CONFIG.baseUrl}/mission.html?mission=${mission.id}&testMode=true`;
            console.log(`[${mission.id}/${config.label}] Loading: ${url}`);
            await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD });

            // Wait for initial scene to load
            await waitForSceneReady(page, config.dimension);

            // Switch to target configuration if needed
            await switchToConfig(page, config);

            // Wait for scene to be ready after config switch
            await waitForSceneReady(page, config.dimension);

            // Run animation for a bit
            await runAnimation(page);

            // Assert no errors occurred
            expect(consoleErrors, `Console errors in ${mission.id} ${config.label}`).toHaveLength(0);
            expect(pageErrors, `Page errors in ${mission.id} ${config.label}`).toHaveLength(0);

            console.log(`[${mission.id}/${config.label}] PASSED - No errors`);

          } finally {
            await page.close();
          }
        }, TIMEOUTS.TEST_CASE);
      }
    });
  }
});

/**
 * Wait for scene to be ready
 */
async function waitForSceneReady(page, dimension) {
  // Wait for animate container
  await page.waitForSelector('#animate', { timeout: TIMEOUTS.SCENE_READY });

  // Wait for loading to complete
  try {
    await page.waitForFunction(
      () => {
        const progressBar = document.querySelector('#progressbar');
        if (!progressBar) return true;
        const style = window.getComputedStyle(progressBar);
        return style.display === 'none' || style.visibility === 'hidden';
      },
      { timeout: TIMEOUTS.SCENE_READY }
    );
  } catch {
    // Progress bar might not exist, that's okay
  }

  // Check current dimension setting
  const is2DMode = await page.isChecked('#dimension-2D').catch(() => dimension === '2D');

  if (!is2DMode) {
    // For 3D mode, wait for canvas and scene state
    await page.waitForSelector('canvas', { timeout: TIMEOUTS.SCENE_READY });

    // Wait for scene state to indicate completion
    await page.waitForFunction(
      () => {
        const doneState = window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE;
        if (!doneState) return false;

        const isLunarMode = document.querySelector('#origin-moon')?.checked;
        if (isLunarMode) {
          return window.animationScenes?.lunar?.state === doneState;
        } else {
          return window.animationScenes?.geo?.state === doneState;
        }
      },
      { timeout: TIMEOUTS.SCENE_READY }
    );
  } else {
    // For 2D mode, just wait for DOM to stabilize (no SVG selector needed)
    await page.waitForTimeout(3000);
  }
}

/**
 * Switch to target origin and dimension configuration
 */
async function switchToConfig(page, config) {
  // Open settings panel
  const settingsButton = page.locator('#settings-panel-button');
  const settingsPanel = page.locator('#settings-panel');

  if (!(await settingsPanel.isVisible())) {
    await settingsButton.click();
    await settingsPanel.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Set origin (Earth/Moon)
  const originSelector = config.origin === 'earth' ? '#origin-earth' : '#origin-moon';
  const isCorrectOrigin = await page.isChecked(originSelector);
  if (!isCorrectOrigin) {
    await page.click(originSelector);
    await page.waitForTimeout(TIMEOUTS.MODE_SWITCH);
  }

  // Set dimension (2D/3D)
  const dimensionSelector = config.dimension === '2D' ? '#dimension-2D' : '#dimension-3D';
  const isCorrectDimension = await page.isChecked(dimensionSelector);
  if (!isCorrectDimension) {
    await page.click(dimensionSelector);
    await page.waitForTimeout(TIMEOUTS.MODE_SWITCH);
  }

  // Close settings panel
  if (await settingsPanel.isVisible()) {
    try {
      await page.getByRole('button', { name: 'close' }).click();
    } catch {
      await page.evaluate(() => $('#settings-panel').dialog('close'));
    }
    await settingsPanel.waitFor({ state: 'hidden', timeout: 2000 });
  }
}

/**
 * Run animation for a period and let it play
 */
async function runAnimation(page) {
  // Click play button and speed up significantly
  try {
    const playButton = page.locator('#animate');
    if (await playButton.isVisible()) {
      await playButton.click();
      await page.waitForTimeout(200);

      // Speed up animation by clicking Faster button many times (aim for ~5s playthrough)
      const fasterButton = page.locator('#faster');
      if (await fasterButton.isVisible()) {
        for (let i = 0; i < 10; i++) {
          await fasterButton.click();
          await page.waitForTimeout(50);
        }
      }
    }
  } catch {
    // Play button might not exist or be disabled
  }

  // Let animation run briefly at high speed
  await page.waitForTimeout(TIMEOUTS.ANIMATION_RUN);

  // Jump to different timeline points using event buttons and fast-forward
  try {
    const eventButtons = page.locator('#burnbuttons button');
    const count = await eventButtons.count();

    if (count > 0) {
      // Click first event
      await eventButtons.first().click();
      await page.waitForTimeout(500);

      // Use >> button to fast-forward to end
      const ffButton = page.locator('#fastforward');
      if (await ffButton.isVisible()) {
        await ffButton.click();
        await page.waitForTimeout(500);
      }

      // Click last event
      if (count > 1) {
        await eventButtons.last().click();
        await page.waitForTimeout(500);
      }
    }
  } catch {
    // Event buttons might not exist
  }
}

/**
 * Click all event buttons and verify no errors
 */
async function clickAllEvents(page) {
  const eventButtons = page.locator('#burnbuttons button');
  const count = await eventButtons.count();
  const clickedEvents = [];

  for (let i = 0; i < count; i++) {
    const button = eventButtons.nth(i);
    const buttonText = await button.textContent();
    await button.click();
    await page.waitForTimeout(500);
    clickedEvents.push(buttonText);
  }

  return clickedEvents;
}

// Missions to test for event clicking (non-CY2/CY3 missions)
const EVENT_TEST_MISSIONS = [
  { id: 'a10', name: 'Apollo 10 Snoopy' },
  { id: 'a11', name: 'Apollo 11 S-IVB' },
];

describe('Mission Event Tests', () => {
  let browser;

  beforeAll(async () => {
    const baseArgs = [
      '--no-sandbox',
      '--max-old-space-size=4096',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ];

    const headlessArgs = [
      '--disable-gpu-sandbox',
      '--use-angle=gl',
      '--enable-unsafe-swiftshader',
    ];

    const headedArgs = [
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
    ];

    const launchArgs = TEST_CONFIG.headless
      ? [...baseArgs, ...headlessArgs]
      : [...baseArgs, ...headedArgs];

    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: launchArgs,
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  for (const mission of EVENT_TEST_MISSIONS) {
    describe(`${mission.name} (${mission.id}) Events`, () => {

      it('clicks all events in Earth/3D without errors', async () => {
        const page = await browser.newPage();
        const consoleErrors = [];
        const pageErrors = [];

        try {
          // Set up error collection
          page.on('console', msg => {
            const text = msg.text();
            const type = msg.type();
            if (type === 'error' && !isIgnoredError(text)) {
              consoleErrors.push({ type, text });
              console.log(`[${mission.id}/Events] Console error: ${text}`);
            }
          });

          page.on('pageerror', error => {
            const message = error.message;
            if (!isIgnoredError(message)) {
              pageErrors.push(message);
              console.log(`[${mission.id}/Events] Page error: ${message}`);
            }
          });

          // Load mission
          const url = `${TEST_CONFIG.baseUrl}/mission.html?mission=${mission.id}&testMode=true`;
          console.log(`[${mission.id}/Events] Loading: ${url}`);
          await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD });

          // Wait for scene to be ready
          await waitForSceneReady(page, '3D');

          // Click all events
          const clickedEvents = await clickAllEvents(page);
          console.log(`[${mission.id}/Events] Clicked ${clickedEvents.length} events: ${clickedEvents.join(', ')}`);

          // Assert no errors
          expect(consoleErrors, `Console errors clicking events in ${mission.id}`).toHaveLength(0);
          expect(pageErrors, `Page errors clicking events in ${mission.id}`).toHaveLength(0);

          console.log(`[${mission.id}/Events] PASSED - All ${clickedEvents.length} events clicked without errors`);

        } finally {
          await page.close();
        }
      }, TIMEOUTS.TEST_CASE);

      it('clicks all events in Moon/3D without errors', async () => {
        const page = await browser.newPage();
        const consoleErrors = [];
        const pageErrors = [];

        try {
          // Set up error collection
          page.on('console', msg => {
            const text = msg.text();
            const type = msg.type();
            if (type === 'error' && !isIgnoredError(text)) {
              consoleErrors.push({ type, text });
              console.log(`[${mission.id}/Events/Moon] Console error: ${text}`);
            }
          });

          page.on('pageerror', error => {
            const message = error.message;
            if (!isIgnoredError(message)) {
              pageErrors.push(message);
              console.log(`[${mission.id}/Events/Moon] Page error: ${message}`);
            }
          });

          // Load mission
          const url = `${TEST_CONFIG.baseUrl}/mission.html?mission=${mission.id}&testMode=true`;
          console.log(`[${mission.id}/Events/Moon] Loading: ${url}`);
          await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD });

          // Wait for scene to be ready
          await waitForSceneReady(page, '3D');

          // Switch to Moon origin
          await switchToConfig(page, { origin: 'moon', dimension: '3D' });
          await waitForSceneReady(page, '3D');

          // Click all events
          const clickedEvents = await clickAllEvents(page);
          console.log(`[${mission.id}/Events/Moon] Clicked ${clickedEvents.length} events: ${clickedEvents.join(', ')}`);

          // Assert no errors
          expect(consoleErrors, `Console errors clicking events in ${mission.id} Moon mode`).toHaveLength(0);
          expect(pageErrors, `Page errors clicking events in ${mission.id} Moon mode`).toHaveLength(0);

          console.log(`[${mission.id}/Events/Moon] PASSED - All ${clickedEvents.length} events clicked without errors`);

        } finally {
          await page.close();
        }
      }, TIMEOUTS.TEST_CASE);
    });
  }
})
