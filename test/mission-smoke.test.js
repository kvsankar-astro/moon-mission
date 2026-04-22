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
import { getEffectiveTestBaseUrl } from './local-test-config.js';

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
  baseUrl: getEffectiveTestBaseUrl(process.cwd()),
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOWMO || '0'),
};

// Missions to test (excluding cy3 which has its own comprehensive tests)
const MISSIONS = [
  { id: 'a10', name: 'Apollo 10 Snoopy' },
  { id: 'a11', name: 'Apollo 11 S-IVB' },
  { id: 'artemis2', name: 'Artemis 2' },
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

    // Smoke tests only need the scene bootstrapped and responsive, not
    // necessarily at the stricter add-curve-done state used by CH3 SSIM.
    await page.waitForFunction(
      () => {
        const initDoneState = window.AnimationScene?.SCENE_STATE_INIT_DONE;
        const addCurveDoneState = window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE;
        const targetState = Number.isFinite(initDoneState)
          ? initDoneState
          : addCurveDoneState;
        if (!Number.isFinite(targetState)) return false;

        const isLunarMode = document.querySelector('#origin-moon')?.checked;
        if (isLunarMode) {
          return (window.animationScenes?.lunar?.state ?? -1) >= targetState;
        } else {
          return (window.animationScenes?.geo?.state ?? -1) >= targetState;
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
  const expanded = await settingsButton.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await page.evaluate(() => {
      const button = document.getElementById('settings-panel-button');
      button?.click();
    });
    await page.waitForFunction(() => {
      const button = document.getElementById('settings-panel-button');
      return button?.getAttribute('aria-expanded') === 'true';
    }, { timeout: 5000 });
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
  if (await settingsButton.getAttribute('aria-expanded') === 'true') {
    await page.evaluate(() => {
      const button = document.getElementById('settings-panel-button');
      button?.click();
    });
    await page.waitForFunction(() => {
      const button = document.getElementById('settings-panel-button');
      return button?.getAttribute('aria-expanded') === 'false';
    }, { timeout: 3000 });
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

async function switchDimensionWithPill(page, dimension) {
  const targetSelector = dimension === '2D' ? '#dimension-2D' : '#dimension-3D';
  const pillSelector = dimension === '2D' ? '#dimension-pill-2d' : '#dimension-pill-3d';
  const isCorrectDimension = await page.isChecked(targetSelector).catch(() => false);
  if (isCorrectDimension) {
    return;
  }

  await page.click(pillSelector);
  await page.waitForTimeout(TIMEOUTS.MODE_SWITCH);
}

async function waitForCompareModeReady(page, compareMission) {
  await page.waitForFunction((expectedCompareMission) => {
    const params = new URLSearchParams(window.location.search);
    const compareToggle = document.getElementById('compare-mode-toggle');
    const compareMissionSelect = document.getElementById('compare-mission-select');
    const currentLabel = document.getElementById('timeline-current-label');
    const comparisonButtons = document.querySelectorAll('#burnbuttons .burnbutton--comparison');

    return params.get('mode') === 'compare' &&
      compareToggle?.checked === true &&
      typeof compareMissionSelect?.value === 'string' &&
      compareMissionSelect.value.length > 0 &&
      comparisonButtons.length > 0 &&
      /comparison elapsed/i.test(currentLabel?.textContent || '');
  }, compareMission, { timeout: TIMEOUTS.SCENE_READY });
}

async function getCompareSceneSnapshot(page) {
  return page.evaluate(() => {
    const useLunarScene = !!document.getElementById('origin-moon')?.checked;
    const scene = useLunarScene
      ? (window.animationScenes?.lunar || null)
      : (window.animationScenes?.relative || window.animationScenes?.geo || null);
    const visibleCraftIds = Array.isArray(scene?.visibleCraftIds)
      ? scene.visibleCraftIds.filter(Boolean)
      : [];
    const curveKeys = Object.keys(scene?.curvesById || {});
    const orbitLineKeys = Object.keys(scene?.orbitLinesByBodyId || {});
    const orbitSvgKeys = Object.keys(scene?.orbitSvgPointsByBodyId || {});
    const compareCraftId =
      visibleCraftIds.find((bodyId) => /^CMP_/i.test(bodyId)) ||
      curveKeys.find((bodyId) => /^CMP_/i.test(bodyId)) ||
      orbitLineKeys.find((bodyId) => /^CMP_/i.test(bodyId)) ||
      orbitSvgKeys.find((bodyId) => /^CMP_/i.test(bodyId)) ||
      null;

    return {
      compareCraftId,
      compareMissionValue: document.getElementById('compare-mission-select')?.value || '',
      compareToggleChecked: !!document.getElementById('compare-mode-toggle')?.checked,
      comparisonButtonCount: document.querySelectorAll('#burnbuttons .burnbutton--comparison').length,
      curveKeys,
      originEarthChecked: !!document.getElementById('origin-earth')?.checked,
      originMoonChecked: !!document.getElementById('origin-moon')?.checked,
      originRelativeChecked: !!document.getElementById('origin-relative')?.checked,
      orbitGroupVisible: compareCraftId
        ? (() => {
            const orbitGroup = document.getElementById(`orbit-${compareCraftId}`);
            if (!orbitGroup) return false;
            const style = window.getComputedStyle(orbitGroup);
            return style.display !== 'none' && style.visibility !== 'hidden';
          })()
        : false,
      orbitLineKeys,
      orbitSvgKeys,
      sceneName: scene?.name || null,
      timelineCurrentLabel: document.getElementById('timeline-current-label')?.textContent || '',
      urlOrigin: new URLSearchParams(window.location.search).get('origin'),
      urlMode: new URLSearchParams(window.location.search).get('mode'),
      visibleCraftIds,
    };
  });
}

async function runCompareModeSmokeCase(page, {
  label,
  url,
  expectedOrigin,
}) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const locationUrl = msg.location()?.url || '';
    const isOptionalOrbitStyleMetadata404 =
      type === 'error' &&
      /\/(?:[^/]+-)?style\.json$/i.test(locationUrl);
    const isOptionalVersionCheck404 =
      type === 'error' &&
      /\/deployment\/version\.json(?:\?|$)/i.test(locationUrl);
    if (type === 'error' && !isIgnoredError(text) && !isOptionalOrbitStyleMetadata404 && !isOptionalVersionCheck404) {
      consoleErrors.push({ type, text });
      console.log(`[${label}] Console error: ${text}`);
    }
  });

  page.on('pageerror', error => {
    const message = error.message;
    if (!isIgnoredError(message)) {
      pageErrors.push(message);
      console.log(`[${label}] Page error: ${message}`);
    }
  });

  console.log(`[${label}] Loading: ${url}`);
  await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD });

  await waitForSceneReady(page, '3D');
  await waitForCompareModeReady(page, 'artemis1');
  await page.waitForFunction(() => {
    const useLunarScene = !!document.getElementById('origin-moon')?.checked;
    const scene = useLunarScene
      ? (window.animationScenes?.lunar || null)
      : (window.animationScenes?.relative || window.animationScenes?.geo || null);
    const compareCraftId = Object.keys(scene?.curvesById || {})
      .find((bodyId) => /^CMP_/i.test(bodyId));
    if (!compareCraftId) return false;
    return Object.prototype.hasOwnProperty.call(scene?.orbitLinesByBodyId || {}, compareCraftId);
  }, { timeout: TIMEOUTS.SCENE_READY });

  const initialSnapshot = await getCompareSceneSnapshot(page);
  expect(initialSnapshot.urlMode).toBe('compare');
  expect(initialSnapshot.compareToggleChecked).toBe(true);
  expect(initialSnapshot.compareMissionValue).toMatch(/^(art1|artemis1)$/);
  expect(initialSnapshot.comparisonButtonCount).toBeGreaterThan(0);
  expect(initialSnapshot.timelineCurrentLabel).toMatch(/comparison elapsed/i);
  expect(initialSnapshot.visibleCraftIds.length).toBeGreaterThanOrEqual(2);
  expect(initialSnapshot.compareCraftId).toBeTruthy();
  expect(initialSnapshot.curveKeys).toContain(initialSnapshot.compareCraftId);
  expect(initialSnapshot.orbitLineKeys).toContain(initialSnapshot.compareCraftId);

  if (expectedOrigin === 'relative') {
    expect(initialSnapshot.urlOrigin).toBe(null);
    expect(initialSnapshot.originRelativeChecked).toBe(true);
    expect(initialSnapshot.originEarthChecked).toBe(false);
    expect(initialSnapshot.originMoonChecked).toBe(false);
  } else if (expectedOrigin === 'geo') {
    expect(initialSnapshot.urlOrigin).toBe('geo');
    expect(initialSnapshot.originEarthChecked).toBe(true);
    expect(initialSnapshot.originRelativeChecked).toBe(false);
    expect(initialSnapshot.originMoonChecked).toBe(false);
  } else if (expectedOrigin === 'lunar') {
    expect(initialSnapshot.urlOrigin).toBe('lunar');
    expect(initialSnapshot.originMoonChecked).toBe(true);
    expect(initialSnapshot.originEarthChecked).toBe(false);
    expect(initialSnapshot.originRelativeChecked).toBe(false);
  }

  const comparisonEventButtons = page.locator('#burnbuttons .burnbutton--comparison');
  expect(await comparisonEventButtons.count()).toBeGreaterThan(0);
  await comparisonEventButtons.first().click();
  await page.waitForTimeout(750);

  await switchDimensionWithPill(page, '2D');
  await waitForSceneReady(page, '2D');
  await page.waitForFunction(() => {
    const useLunarScene = !!document.getElementById('origin-moon')?.checked;
    const scene = useLunarScene
      ? (window.animationScenes?.lunar || null)
      : (window.animationScenes?.relative || window.animationScenes?.geo || null);
    const compareCraftId = Object.keys(scene?.orbitSvgPointsByBodyId || {})
      .find((bodyId) => /^CMP_/i.test(bodyId));
    if (!compareCraftId) return false;
    const orbitGroup = document.getElementById(`orbit-${compareCraftId}`);
    if (!orbitGroup) return false;
    const orbitPoints = scene?.orbitSvgPointsByBodyId?.[compareCraftId];
    return Array.isArray(orbitPoints) && orbitPoints.length > 1;
  }, { timeout: TIMEOUTS.SCENE_READY });

  const twoDSnapshot = await getCompareSceneSnapshot(page);
  expect(twoDSnapshot.visibleCraftIds.length).toBeGreaterThanOrEqual(2);
  expect(twoDSnapshot.compareCraftId).toBeTruthy();
  expect(twoDSnapshot.orbitSvgKeys).toContain(twoDSnapshot.compareCraftId);
  expect(twoDSnapshot.orbitGroupVisible).toBe(true);

  await switchDimensionWithPill(page, '3D');
  await waitForSceneReady(page, '3D');
  await page.waitForFunction(() => {
    const useLunarScene = !!document.getElementById('origin-moon')?.checked;
    const scene = useLunarScene
      ? (window.animationScenes?.lunar || null)
      : (window.animationScenes?.relative || window.animationScenes?.geo || null);
    const compareCraftId = Object.keys(scene?.curvesById || {})
      .find((bodyId) => /^CMP_/i.test(bodyId));
    if (!compareCraftId) return false;
    return Object.prototype.hasOwnProperty.call(scene?.orbitLinesByBodyId || {}, compareCraftId);
  }, { timeout: TIMEOUTS.SCENE_READY });

  const finalSnapshot = await getCompareSceneSnapshot(page);
  expect(finalSnapshot.compareCraftId).toBeTruthy();
  expect(finalSnapshot.curveKeys).toContain(finalSnapshot.compareCraftId);
  expect(finalSnapshot.orbitLineKeys).toContain(finalSnapshot.compareCraftId);

  expect(consoleErrors, `Console errors in ${label}`).toHaveLength(0);
  expect(pageErrors, `Page errors in ${label}`).toHaveLength(0);
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

describe('Mission Compare Smoke Tests', () => {
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

  it('keeps both mission trajectories visible across compare-mode 3D and 2D', async () => {
    const page = await browser.newPage();
    try {
      await runCompareModeSmokeCase(page, {
        label: 'compare/relative',
        url: `${TEST_CONFIG.baseUrl}/mission.html?mission=cy3&mode=compare&compareMission=artemis1&testMode=true`,
        expectedOrigin: 'relative',
      });
    } finally {
      await page.close();
    }
  }, TIMEOUTS.TEST_CASE * 2);

  it('keeps both mission trajectories visible across geo compare-mode 3D and 2D', async () => {
    const page = await browser.newPage();

    try {
      await runCompareModeSmokeCase(page, {
        label: 'compare/geo',
        url: `${TEST_CONFIG.baseUrl}/mission.html?mission=cy3&mode=compare&compareMission=artemis1&origin=geo&testMode=true`,
        expectedOrigin: 'geo',
      });
    } finally {
      await page.close();
    }
  }, TIMEOUTS.TEST_CASE * 2);

  it('keeps both mission trajectories visible across lunar compare-mode 3D and 2D', async () => {
    const page = await browser.newPage();

    try {
      await runCompareModeSmokeCase(page, {
        label: 'compare/lunar',
        url: `${TEST_CONFIG.baseUrl}/mission.html?mission=cy3&mode=compare&compareMission=artemis1&origin=lunar&testMode=true`,
        expectedOrigin: 'lunar',
      });
    } finally {
      await page.close();
    }
  }, TIMEOUTS.TEST_CASE * 2);
});

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
