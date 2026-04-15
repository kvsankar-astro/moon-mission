/**
 * Production Mission Smoke Tests
 *
 * These tests hit the deployed sankara.net site directly and verify that each
 * public mission can:
 * - load in Earth/3D mode
 * - start from the beginning of its timeline
 * - run at high speed until the mission timeline completes
 * - avoid console and page errors while doing so
 *
 * This suite is intentionally opt-in and is excluded from default local/unit
 * runs. Use `npm run test:prod:missions` to execute it against production.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DEFAULT_PRODUCTION_BASE_URL = 'https://sankara.net/astro/lunar-missions';
const isCI = process.env.CI === 'true';
const CI_MULTIPLIER = isCI ? 2 : 1;

const TIMEOUTS = {
  PAGE_LOAD: 45000 * CI_MULTIPLIER,
  SCENE_READY: 90000 * CI_MULTIPLIER,
  UI_RESPONSE: 5000 * CI_MULTIPLIER,
  PLAYBACK_COMPLETE: 90000 * CI_MULTIPLIER,
  TEST_CASE: 180000 * CI_MULTIPLIER,
  QUICK_DELAY: 200,
  STANDARD_DELAY: 500,
};

const TEST_CONFIG = {
  baseUrl: process.env.PRODUCTION_SMOKE_BASE_URL || DEFAULT_PRODUCTION_BASE_URL,
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOWMO || '0', 10),
  missionFilter: process.env.PROD_MISSION_FILTER || '',
  missionLimit: Number.parseInt(process.env.PROD_MISSION_LIMIT || '', 10),
};

const IGNORED_ERROR_PATTERNS = [
  /favicon\.ico/i,
  /Failed to load resource.*favicon/i,
];

const IGNORED_NETWORK_HOST_PATTERNS = [
  /(^|\.)static\.cloudflareinsights\.com$/i,
  /(^|\.)ssl\.google-analytics\.com$/i,
];

function isIgnoredError(message) {
  return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(message || ''));
}

function isIgnoredNetworkUrl(url) {
  try {
    const host = new URL(url).hostname;
    return IGNORED_NETWORK_HOST_PATTERNS.some(pattern => pattern.test(host));
  } catch {
    return false;
  }
}

function loadMissionCatalog(rootDir = process.cwd()) {
  const catalogPath = join(rootDir, 'assets', 'mission-catalog.json');
  const parsed = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const missions = Array.isArray(parsed?.missions) ? parsed.missions : [];
  const seenIds = new Set();
  let filtered = missions
    .filter((mission) => !mission?.disabled)
    .map((mission) => ({
      id: mission.queryValue || mission.folder || mission.key,
      title: mission.title || mission.queryValue || mission.folder || mission.key,
    }))
    .filter((mission) => {
      if (!mission.id || seenIds.has(mission.id)) return false;
      seenIds.add(mission.id);
      return true;
    });

  if (TEST_CONFIG.missionFilter) {
    const matcher = new RegExp(TEST_CONFIG.missionFilter, 'i');
    filtered = filtered.filter((mission) => matcher.test(mission.id) || matcher.test(mission.title));
  }

  if (Number.isInteger(TEST_CONFIG.missionLimit) && TEST_CONFIG.missionLimit > 0) {
    filtered = filtered.slice(0, TEST_CONFIG.missionLimit);
  }

  return filtered;
}

const MISSIONS = loadMissionCatalog();

function createConsoleAndPageErrorCollectors(page, missionId) {
  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (
      msg.type() === 'error' &&
      !isIgnoredError(text) &&
      !/^Failed to load resource:/i.test(text || '')
    ) {
      consoleErrors.push(text);
      console.log(`[prod-smoke/${missionId}] console error: ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    const message = error?.message || String(error);
    if (!isIgnoredError(message)) {
      pageErrors.push(message);
      console.log(`[prod-smoke/${missionId}] page error: ${message}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || 'request failed';
    if (isIgnoredNetworkUrl(url)) {
      return;
    }
    const entry = `${errorText} @ ${url}`;
    networkErrors.push(entry);
    console.log(`[prod-smoke/${missionId}] network error: ${entry}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 400 || isIgnoredNetworkUrl(url)) {
      return;
    }
    const entry = `HTTP ${status} @ ${url}`;
    networkErrors.push(entry);
    console.log(`[prod-smoke/${missionId}] network error: ${entry}`);
  });

  return { consoleErrors, pageErrors, networkErrors };
}

async function waitForSceneReady(page) {
  await page.waitForSelector('#animate', { timeout: TIMEOUTS.SCENE_READY });

  try {
    await page.waitForFunction(() => {
      const progressBar = document.querySelector('#progressbar');
      if (!progressBar) return true;
      const style = window.getComputedStyle(progressBar);
      return style.display === 'none' || style.visibility === 'hidden';
    }, { timeout: TIMEOUTS.SCENE_READY });
  } catch {
    // Some runtime paths do not show the progress bar.
  }

  await page.waitForSelector('canvas', { timeout: TIMEOUTS.SCENE_READY });

  await page.waitForFunction(() => {
    const initDoneState = window.AnimationScene?.SCENE_STATE_INIT_DONE;
    const addCurveDoneState = window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE;
    const targetState = Number.isFinite(initDoneState) ? initDoneState : addCurveDoneState;
    if (!Number.isFinite(targetState)) return false;

    return (window.animationScenes?.geo?.state ?? -1) >= targetState;
  }, { timeout: TIMEOUTS.SCENE_READY });
}

async function openSettingsPanel(page) {
  const settingsButton = page.locator('#settings-panel-button');
  await settingsButton.waitFor({ timeout: TIMEOUTS.UI_RESPONSE });

  const expanded = await settingsButton.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await page.evaluate(() => document.getElementById('settings-panel-button')?.click());
    await page.waitForFunction(() => {
      const button = document.getElementById('settings-panel-button');
      return button?.getAttribute('aria-expanded') === 'true';
    }, { timeout: TIMEOUTS.UI_RESPONSE });
  }
}

async function closeSettingsPanel(page) {
  const settingsButton = page.locator('#settings-panel-button');
  const expanded = await settingsButton.getAttribute('aria-expanded');
  if (expanded === 'true') {
    await page.evaluate(() => document.getElementById('settings-panel-button')?.click());
    await page.waitForFunction(() => {
      const button = document.getElementById('settings-panel-button');
      return button?.getAttribute('aria-expanded') === 'false';
    }, { timeout: TIMEOUTS.UI_RESPONSE });
  }
}

async function forceEarth3DMode(page) {
  await openSettingsPanel(page);

  if (!await page.isChecked('#origin-earth')) {
    await page.click('#origin-earth');
    await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
  }

  if (!await page.isChecked('#dimension-3D')) {
    await page.click('#dimension-3D');
    await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
  }

  await closeSettingsPanel(page);
}

async function jumpToTimelineStart(page) {
  const firstEnabledEvent = page.locator('#burnbuttons button[aria-disabled="false"]').first();
  if (await firstEnabledEvent.count()) {
    await firstEnabledEvent.click();
    await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
    return;
  }

  await page.evaluate(() => {
    const slider = document.getElementById('timeline-slider');
    if (!(slider instanceof HTMLInputElement)) return;

    slider.value = slider.min || '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(TIMEOUTS.STANDARD_DELAY);
}

async function normalizeSpeedToRealtime(page) {
  const realtime = page.locator('#realtime');
  if (await realtime.count() > 0 && await realtime.first().isVisible()) {
    await realtime.first().click();
    await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
  }
}

async function accelerateSpeedToMax(page, maxClicks = 16) {
  for (let i = 0; i < maxClicks; i += 1) {
    const faster = page.locator('#faster');
    if (await faster.count() === 0 || !await faster.first().isVisible() || !await faster.first().isEnabled()) {
      break;
    }
    await faster.first().click();
    await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
  }
}

async function startAnimation(page) {
  const animateButton = page.locator('#animate');
  await animateButton.waitFor({ timeout: TIMEOUTS.UI_RESPONSE });
  const label = (await animateButton.textContent())?.trim();
  if (label === 'Play') {
    await animateButton.click();
    await page.waitForTimeout(TIMEOUTS.QUICK_DELAY);
  }
}

async function waitForAnimationCompletion(page) {
  await page.waitForFunction(() => {
    const animateButton = document.querySelector('#animate');
    const slider = document.querySelector('#timeline-slider');
    const current = document.getElementById('timeline-current-label');
    const end = document.getElementById('timeline-end-label');

    if (!(animateButton instanceof HTMLElement)) return false;

    const stopped = animateButton.textContent?.trim() === 'Play';
    const labelsMatch = Boolean(
      current?.textContent &&
      end?.textContent &&
      current.textContent.trim() === end.textContent.trim()
    );

    let sliderAtEnd = false;
    if (slider instanceof HTMLInputElement) {
      const value = Number(slider.value);
      const max = Number(slider.max);
      if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
        const tolerance = Math.max(1, Math.abs(max) * 0.001);
        sliderAtEnd = value >= (max - tolerance);
      }
    }

    return stopped && (labelsMatch || sliderAtEnd);
  }, { timeout: TIMEOUTS.PLAYBACK_COMPLETE, polling: 500 });
}

let browser;

describe('Production Mission Smoke Tests', () => {
  beforeAll(async () => {
    if (MISSIONS.length === 0) {
      throw new Error('No missions matched the production smoke filter.');
    }

    const baseArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ];

    const headlessArgs = [
      '--disable-gpu-sandbox',
      '--use-angle=gl',
      '--enable-unsafe-swiftshader',
    ];

    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: TEST_CONFIG.headless ? [...baseArgs, ...headlessArgs] : baseArgs,
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  for (const mission of MISSIONS) {
    it(`runs ${mission.title} (${mission.id}) to completion on production in Earth/3D`, async () => {
      const page = await browser.newPage();
      const { consoleErrors, pageErrors, networkErrors } = createConsoleAndPageErrorCollectors(page, mission.id);

      try {
        const url = `${TEST_CONFIG.baseUrl}/mission.html?mission=${encodeURIComponent(mission.id)}&testMode=true`;
        console.log(`[prod-smoke/${mission.id}] loading ${url}`);

        await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD, waitUntil: 'domcontentloaded' });
        await waitForSceneReady(page);
        await forceEarth3DMode(page);
        await waitForSceneReady(page);
        await jumpToTimelineStart(page);
        await normalizeSpeedToRealtime(page);
        await accelerateSpeedToMax(page);
        await startAnimation(page);
        await waitForAnimationCompletion(page);

        expect(consoleErrors, `Console errors for ${mission.id}`).toHaveLength(0);
        expect(pageErrors, `Page errors for ${mission.id}`).toHaveLength(0);
        expect(networkErrors, `Network errors for ${mission.id}`).toHaveLength(0);
      } finally {
        await page.close();
      }
    }, TIMEOUTS.TEST_CASE);
  }
});
