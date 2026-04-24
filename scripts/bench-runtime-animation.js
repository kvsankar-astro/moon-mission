#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "playwright";

import { getEffectiveTestBaseUrl } from "../test/local-test-config.js";

const DEFAULTS = {
    baseUrl: getEffectiveTestBaseUrl(process.cwd()),
    mission: "artemis2",
    origin: "earth",
    dimension: "3d",
    rounds: 5,
    warmupMs: 2000,
    durationMs: 10000,
    settleMs: 1000,
    viewportWidth: 1440,
    viewportHeight: 900,
    headless: process.env.HEADLESS !== "false",
    slowMo: Number(process.env.SLOWMO || 0),
    label: "",
    viewAuxPanels: null,
    viewSky: null,
    viewOrbit: null,
    orbitStyle: null,
    cameraPosition: null,
    cameraLook: null,
    plane: null,
};

const LOCAL_ASTRONOMY_BROWSER_FILE = join(
    process.cwd(),
    "node_modules",
    "astronomy-engine",
    "astronomy.browser.js",
);

function parseBoolean(value, fallback = null) {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
        return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
        return false;
    }
    return fallback;
}

function normalizeOrigin(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "moon" || normalized === "lunar") return "moon";
    if (normalized === "relative") return "relative";
    return "earth";
}

function normalizeDimension(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "2d" || normalized === "2") return "2d";
    return "3d";
}

function normalizeOrbitStyle(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "classic" || normalized === "trail") {
        return normalized;
    }
    return null;
}

function normalizeCameraMode(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["manual", "earth", "moon", "spacecraft"].includes(normalized)) {
        return normalized;
    }
    return null;
}

function normalizePlane(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (["DEFAULT", "XY", "YZ", "ZX", "XY-", "YZ-", "ZX-"].includes(normalized)) {
        return normalized;
    }
    return null;
}

function parseArgs(argv) {
    const args = { ...DEFAULTS };

    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        const nextValue = argv[i + 1];

        if (token === "--base-url" && nextValue) {
            args.baseUrl = nextValue;
            i += 1;
        } else if (token === "--mission" && nextValue) {
            args.mission = nextValue;
            i += 1;
        } else if (token === "--origin" && nextValue) {
            args.origin = normalizeOrigin(nextValue);
            i += 1;
        } else if (token === "--dimension" && nextValue) {
            args.dimension = normalizeDimension(nextValue);
            i += 1;
        } else if (token === "--rounds" && nextValue) {
            args.rounds = Number(nextValue);
            i += 1;
        } else if (token === "--warmup-ms" && nextValue) {
            args.warmupMs = Number(nextValue);
            i += 1;
        } else if (token === "--duration-ms" && nextValue) {
            args.durationMs = Number(nextValue);
            i += 1;
        } else if (token === "--settle-ms" && nextValue) {
            args.settleMs = Number(nextValue);
            i += 1;
        } else if (token === "--viewport-width" && nextValue) {
            args.viewportWidth = Number(nextValue);
            i += 1;
        } else if (token === "--viewport-height" && nextValue) {
            args.viewportHeight = Number(nextValue);
            i += 1;
        } else if (token === "--headless" && nextValue) {
            args.headless = parseBoolean(nextValue, args.headless);
            i += 1;
        } else if (token === "--slowmo" && nextValue) {
            args.slowMo = Number(nextValue);
            i += 1;
        } else if (token === "--label" && nextValue) {
            args.label = nextValue;
            i += 1;
        } else if (token === "--view-aux-panels" && nextValue) {
            args.viewAuxPanels = parseBoolean(nextValue);
            i += 1;
        } else if (token === "--view-sky" && nextValue) {
            args.viewSky = parseBoolean(nextValue);
            i += 1;
        } else if (token === "--view-orbit" && nextValue) {
            args.viewOrbit = parseBoolean(nextValue);
            i += 1;
        } else if (token === "--orbit-style" && nextValue) {
            args.orbitStyle = normalizeOrbitStyle(nextValue);
            i += 1;
        } else if (token === "--camera-position" && nextValue) {
            args.cameraPosition = normalizeCameraMode(nextValue);
            i += 1;
        } else if (token === "--camera-look" && nextValue) {
            args.cameraLook = normalizeCameraMode(nextValue);
            i += 1;
        } else if (token === "--plane" && nextValue) {
            args.plane = normalizePlane(nextValue);
            i += 1;
        }
    }

    if (!Number.isFinite(args.rounds) || args.rounds < 1) {
        throw new Error("--rounds must be >= 1");
    }
    if (!Number.isFinite(args.warmupMs) || args.warmupMs < 0) {
        throw new Error("--warmup-ms must be >= 0");
    }
    if (!Number.isFinite(args.durationMs) || args.durationMs < 250) {
        throw new Error("--duration-ms must be >= 250");
    }
    if (!Number.isFinite(args.settleMs) || args.settleMs < 0) {
        throw new Error("--settle-ms must be >= 0");
    }
    if (!Number.isFinite(args.viewportWidth) || args.viewportWidth < 320) {
        throw new Error("--viewport-width must be >= 320");
    }
    if (!Number.isFinite(args.viewportHeight) || args.viewportHeight < 240) {
        throw new Error("--viewport-height must be >= 240");
    }

    return args;
}

function percentile(sortedSamples, percentileValue) {
    if (!sortedSamples.length) return 0;
    if (sortedSamples.length === 1) return sortedSamples[0];
    const index = (percentileValue / 100) * (sortedSamples.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    if (lowerIndex === upperIndex) {
        return sortedSamples[lowerIndex];
    }
    const fraction = index - lowerIndex;
    return (
        sortedSamples[lowerIndex] +
        ((sortedSamples[upperIndex] - sortedSamples[lowerIndex]) * fraction)
    );
}

function roundNumber(value, digits = 3) {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(digits));
}

function resolvePlaneSelector(plane) {
    switch (plane) {
        case "DEFAULT":
            return "#checkbox-lock-default";
        case "XY":
            return "#checkbox-lock-xy";
        case "YZ":
            return "#checkbox-lock-yz";
        case "ZX":
            return "#checkbox-lock-zx";
        case "XY-":
            return "#checkbox-lock-xy-minus";
        case "YZ-":
            return "#checkbox-lock-yz-minus";
        case "ZX-":
            return "#checkbox-lock-zx-minus";
        default:
            return null;
    }
}

function summarizeSeries(samples) {
    const safeSamples = Array.isArray(samples) ? samples.filter((value) => Number.isFinite(value)) : [];
    const count = safeSamples.length;
    if (count === 0) {
        return {
            count: 0,
            total: 0,
            min: 0,
            mean: 0,
            median: 0,
            p95: 0,
            p99: 0,
            max: 0,
            stddev: 0,
            cv: 0,
        };
    }

    const sorted = [...safeSamples].sort((a, b) => a - b);
    const total = safeSamples.reduce((sum, value) => sum + value, 0);
    const mean = total / count;
    const variance = safeSamples.reduce((sum, value) => {
        const delta = value - mean;
        return sum + (delta * delta);
    }, 0) / count;
    const stddev = Math.sqrt(variance);

    return {
        count,
        total,
        min: sorted[0],
        mean,
        median: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1],
        stddev,
        cv: mean === 0 ? 0 : stddev / mean,
    };
}

function summarizeFrameDeltas(samples) {
    const base = summarizeSeries(samples);
    const median = base.median || 0;
    const over16_7 = samples.filter((value) => value > 16.667).length;
    const over33_3 = samples.filter((value) => value > 33.333).length;
    const over50 = samples.filter((value) => value > 50).length;
    const over1_5xMedian = median > 0
        ? samples.filter((value) => value > (median * 1.5)).length
        : 0;
    const over2xMedian = median > 0
        ? samples.filter((value) => value > (median * 2)).length
        : 0;

    return {
        frameCount: base.count,
        totalMeasuredMs: roundNumber(base.total),
        minFrameTimeMs: roundNumber(base.min),
        meanFrameTimeMs: roundNumber(base.mean),
        medianFrameTimeMs: roundNumber(base.median),
        p95FrameTimeMs: roundNumber(base.p95),
        p99FrameTimeMs: roundNumber(base.p99),
        maxFrameTimeMs: roundNumber(base.max),
        frameTimeStdDevMs: roundNumber(base.stddev),
        frameTimeCv: roundNumber(base.cv, 4),
        observedFps: roundNumber(base.mean > 0 ? 1000 / base.mean : 0, 2),
        thresholds: {
            over16_7ms: {
                count: over16_7,
                ratio: roundNumber(base.count ? over16_7 / base.count : 0, 4),
            },
            over33_3ms: {
                count: over33_3,
                ratio: roundNumber(base.count ? over33_3 / base.count : 0, 4),
            },
            over50ms: {
                count: over50,
                ratio: roundNumber(base.count ? over50 / base.count : 0, 4),
            },
            over1_5xMedian: {
                count: over1_5xMedian,
                ratio: roundNumber(base.count ? over1_5xMedian / base.count : 0, 4),
            },
            over2xMedian: {
                count: over2xMedian,
                ratio: roundNumber(base.count ? over2xMedian / base.count : 0, 4),
            },
        },
    };
}

function summarizeEventDurations(samples) {
    const base = summarizeSeries(samples);
    return {
        count: base.count,
        totalDurationMs: roundNumber(base.total),
        meanDurationMs: roundNumber(base.mean),
        medianDurationMs: roundNumber(base.median),
        p95DurationMs: roundNumber(base.p95),
        p99DurationMs: roundNumber(base.p99),
        maxDurationMs: roundNumber(base.max),
    };
}

function mergeScriptTotals(allScriptTotals, nextScriptTotals) {
    const merged = new Map(allScriptTotals);
    for (const script of nextScriptTotals || []) {
        const key = [
            script?.sourceURL || "",
            script?.sourceFunctionName || "",
            script?.invoker || "",
            script?.invokerType || "",
        ].join("|");
        const current = merged.get(key) || {
            sourceURL: script?.sourceURL || "",
            sourceFunctionName: script?.sourceFunctionName || "",
            invoker: script?.invoker || "",
            invokerType: script?.invokerType || "",
            count: 0,
            totalDuration: 0,
            totalForcedStyleAndLayoutDuration: 0,
            maxDuration: 0,
        };

        current.count += Number(script?.count || 0);
        current.totalDuration += Number(script?.totalDuration || 0);
        current.totalForcedStyleAndLayoutDuration += Number(
            script?.totalForcedStyleAndLayoutDuration || 0,
        );
        current.maxDuration = Math.max(current.maxDuration, Number(script?.maxDuration || 0));

        merged.set(key, current);
    }
    return merged;
}

function formatScriptTotals(scriptTotals, limit = 10) {
    return [...scriptTotals.values()]
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .slice(0, limit)
        .map((script) => ({
            sourceURL: script.sourceURL,
            sourceFunctionName: script.sourceFunctionName,
            invoker: script.invoker,
            invokerType: script.invokerType,
            count: script.count,
            totalDurationMs: roundNumber(script.totalDuration),
            totalForcedStyleAndLayoutDurationMs: roundNumber(
                script.totalForcedStyleAndLayoutDuration,
            ),
            maxDurationMs: roundNumber(script.maxDuration),
        }));
}

function aggregateTopLoafs(rounds, limit = 10) {
    return rounds
        .flatMap((round) => round.raw.topLongAnimationFrames || [])
        .sort((a, b) => {
            const left = Number(a?.blockingDuration || a?.duration || 0);
            const right = Number(b?.blockingDuration || b?.duration || 0);
            return right - left;
        })
        .slice(0, limit)
        .map((entry) => ({
            durationMs: roundNumber(entry.duration),
            blockingDurationMs: roundNumber(entry.blockingDuration),
            renderDurationMs: roundNumber(entry.renderDuration),
            styleAndLayoutDurationMs: roundNumber(entry.styleAndLayoutDuration),
            scriptCount: Number(entry.scriptCount || 0),
            topInvoker: entry.topInvoker || "",
            topSourceURL: entry.topSourceURL || "",
        }));
}

async function attachAstronomyRoute(page) {
    if (!existsSync(LOCAL_ASTRONOMY_BROWSER_FILE)) {
        return;
    }

    const astronomyBrowserSource = readFileSync(LOCAL_ASTRONOMY_BROWSER_FILE, "utf8");
    await page.route(
        "https://unpkg.com/astronomy-engine/astronomy.browser.js",
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/javascript; charset=utf-8",
                body: astronomyBrowserSource,
            });
        },
    );
}

async function setCheckboxState(page, selector, desired, { required = false } = {}) {
    const found = await page.evaluate(
        ({ selector: inputSelector, desiredValue }) => {
            const element = document.querySelector(inputSelector);
            if (!(element instanceof HTMLInputElement)) {
                return false;
            }
            if (element.checked !== desiredValue) {
                element.checked = desiredValue;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            }
            return true;
        },
        { selector, desiredValue: desired },
    );

    if (required && !found) {
        throw new Error(`Required checkbox not found: ${selector}`);
    }
}

async function setRadioState(page, selector, { required = false } = {}) {
    const locator = page.locator(selector);
    const count = await locator.count();
    let found = count > 0;

    if (found) {
        try {
            await locator.first().check({ force: true });
            return;
        } catch {
            // Fall through to DOM-event fallback below.
        }
    }

    found = await page.evaluate((radioSelector) => {
        const element = document.querySelector(radioSelector);
        if (!(element instanceof HTMLInputElement)) {
            return false;
        }
        if (!element.checked) {
            element.checked = true;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            element.click?.();
        }
        return true;
    }, selector);

    if (required && !found) {
        throw new Error(`Required radio input not found: ${selector}`);
    }
}

async function waitForScene(page) {
    const sceneReadyTimeoutMs = 15000;
    const orbitRenderTimeoutMs = 120000;

    await page.waitForSelector("#animate", { timeout: sceneReadyTimeoutMs });
    const renderCanvasSelector = "#canvas-wrapper canvas";

    const dimensionIs2D = await page.isChecked("#dimension-2D");
    if (dimensionIs2D) {
        await page.waitForSelector(renderCanvasSelector, {
            timeout: sceneReadyTimeoutMs,
            state: "attached",
        });
        await page.waitForTimeout(2000);
    } else {
        await page.waitForSelector(renderCanvasSelector, {
            timeout: sceneReadyTimeoutMs,
            state: "visible",
        });
        await page.waitForFunction(() => {
            const doneState = window.AnimationScene?.SCENE_STATE_ADD_CURVE_DONE;
            const isRelativeMode = !!document.querySelector("#origin-relative")?.checked;
            const isLunarMode = !!document.querySelector("#origin-moon")?.checked;
            const sceneKey = isRelativeMode
                ? (window.animationScenes?.relative ? "relative" : "geo")
                : (isLunarMode ? "lunar" : "geo");
            const sceneState = window.animationScenes?.[sceneKey]?.state;
            return sceneState === doneState;
        }, null, { timeout: orbitRenderTimeoutMs });

        await page.waitForFunction(() => {
            const isRelativeMode = !!document.querySelector("#origin-relative")?.checked;
            const isLunarMode = !!document.querySelector("#origin-moon")?.checked;
            const sceneKey = isRelativeMode
                ? (window.animationScenes?.relative ? "relative" : "geo")
                : (isLunarMode ? "lunar" : "geo");
            const scene = window.animationScenes?.[sceneKey];
            if (!scene?.initialized3D) {
                return false;
            }

            const primaryCraftId = scene.primaryCraftId || "SC";
            const primaryCurveCount = Array.isArray(scene.curvesById?.[primaryCraftId])
                ? scene.curvesById[primaryCraftId].length
                : 0;
            const primaryOrbitLineCount = Array.isArray(scene.orbitLinesByBodyId?.[primaryCraftId])
                ? scene.orbitLinesByBodyId[primaryCraftId].length
                : 0;

            return primaryCurveCount > 1 && primaryOrbitLineCount > 0;
        }, null, { timeout: orbitRenderTimeoutMs });
    }

    await page.evaluate(() => new Promise((resolve) => {
        let framesRemaining = 3;
        function tick() {
            framesRemaining -= 1;
            if (framesRemaining <= 0) {
                resolve();
                return;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }));
}

async function ensureAnimationPaused(page) {
    await page.waitForSelector("#animate", { timeout: 15000 });
    const isPlaying = await page.locator("#animate:has-text(\"Pause\")").count();
    if (isPlaying > 0) {
        await page.locator("#animate").click();
        await page.waitForSelector("#animate:has-text(\"Play\")", { timeout: 5000 });
    }
}

async function startAnimation(page) {
    const isPaused = await page.locator("#animate:has-text(\"Play\")").count();
    if (isPaused > 0) {
        await page.locator("#animate").click();
        await page.waitForSelector("#animate:has-text(\"Pause\")", { timeout: 5000 });
    }
}

async function configurePage(page, args) {
    await page.goto(
        `${args.baseUrl.replace(/\/$/, "")}/mission.html?mission=${encodeURIComponent(args.mission)}`,
        { waitUntil: "networkidle" },
    );

    await waitForScene(page);
    await ensureAnimationPaused(page);

    const originSelector = args.origin === "moon"
        ? "#origin-moon"
        : args.origin === "relative"
            ? "#origin-relative"
            : "#origin-earth";
    const dimensionSelector = args.dimension === "2d" ? "#dimension-2D" : "#dimension-3D";

    await setRadioState(page, originSelector, { required: true });
    await setRadioState(page, dimensionSelector, { required: true });

    if (typeof args.viewAuxPanels === "boolean") {
        await setCheckboxState(page, "#view-aux-camera-panels", args.viewAuxPanels);
    }
    if (typeof args.viewSky === "boolean") {
        await setCheckboxState(page, "#view-sky", args.viewSky);
    }
    if (typeof args.viewOrbit === "boolean") {
        await setCheckboxState(page, "#view-orbit", args.viewOrbit);
    }
    if (args.orbitStyle) {
        const selector = args.orbitStyle === "trail"
            ? "#orbit-style-trail"
            : "#orbit-style-classic";
        await setRadioState(page, selector);
    }
    if (args.cameraPosition) {
        await setRadioState(
            page,
            `input[name="camera-position-pill"][value="${args.cameraPosition}"]`,
        );
    }
    if (args.cameraLook) {
        await setRadioState(
            page,
            `input[name="camera-look-pill"][value="${args.cameraLook}"]`,
        );
    }
    if (args.plane) {
        const planeSelector = resolvePlaneSelector(args.plane);
        if (planeSelector) {
            await setRadioState(page, planeSelector);
        }
    }

    await waitForScene(page);
    await page.waitForTimeout(args.settleMs);
}

async function collectRoundTelemetry(page, { warmupMs, durationMs }) {
    return await page.evaluate(async ({ warmupMs: warmup, durationMs: duration }) => {
        function getSupportedTypes() {
            if (
                typeof PerformanceObserver === "undefined" ||
                !Array.isArray(PerformanceObserver.supportedEntryTypes)
            ) {
                return [];
            }
            return PerformanceObserver.supportedEntryTypes;
        }

        function getDateText() {
            return document.querySelector("#date")?.textContent?.trim() || "";
        }

        function getActiveSceneKey() {
            const isRelativeMode = !!document.querySelector("#origin-relative")?.checked;
            const isLunarMode = !!document.querySelector("#origin-moon")?.checked;
            if (isRelativeMode) {
                return window.animationScenes?.relative ? "relative" : "geo";
            }
            return isLunarMode ? "lunar" : "geo";
        }

        function getActiveSceneStateTime() {
            const sceneKey = getActiveSceneKey();
            const stateTime = window.animationScenes?.[sceneKey]?.stateTime;
            return Number.isFinite(stateTime) ? Number(stateTime) : null;
        }

        function getModeSnapshot() {
            const origin = document.querySelector("#origin-relative")?.checked
                ? "relative"
                : (document.querySelector("#origin-moon")?.checked ? "moon" : "earth");
            const dimension = document.querySelector("#dimension-2D")?.checked ? "2d" : "3d";
            return { origin, dimension };
        }

        const supportedEntryTypes = getSupportedTypes();
        const supportsLongTask = supportedEntryTypes.includes("longtask");
        const supportsLongAnimationFrame = supportedEntryTypes.includes("long-animation-frame");

        await new Promise((resolve) => window.setTimeout(resolve, warmup));

        const frameDeltasMs = [];
        const longTaskDurationsMs = [];
        const loafDurationsMs = [];
        const loafBlockingDurationsMs = [];
        const topLongAnimationFrames = [];
        const loafScriptTotals = new Map();
        const observers = [];

        function flushEntries(observer, handler) {
            if (!observer) return;
            for (const entry of observer.takeRecords()) {
                handler(entry);
            }
        }

        function pushTopLoaf(entry, scripts) {
            const renderDuration = entry.renderStart
                ? ((entry.startTime + entry.duration) - entry.renderStart)
                : 0;
            const styleAndLayoutDuration = entry.styleAndLayoutStart
                ? ((entry.startTime + entry.duration) - entry.styleAndLayoutStart)
                : 0;
            const scriptArray = Array.isArray(scripts) ? scripts : [];
            topLongAnimationFrames.push({
                duration: Number(entry.duration || 0),
                blockingDuration: Number(entry.blockingDuration || 0),
                renderDuration,
                styleAndLayoutDuration,
                scriptCount: scriptArray.length,
                topInvoker: scriptArray[0]?.invoker || "",
                topSourceURL: scriptArray[0]?.sourceURL || "",
            });
            topLongAnimationFrames.sort((left, right) => {
                const leftScore = Number(left.blockingDuration || left.duration || 0);
                const rightScore = Number(right.blockingDuration || right.duration || 0);
                return rightScore - leftScore;
            });
            if (topLongAnimationFrames.length > 10) {
                topLongAnimationFrames.length = 10;
            }
        }

        function trackLoafScripts(scripts) {
            const scriptArray = Array.isArray(scripts) ? scripts : [];
            for (const script of scriptArray) {
                const key = [
                    script?.sourceURL || "",
                    script?.sourceFunctionName || "",
                    script?.invoker || "",
                    script?.invokerType || "",
                ].join("|");
                const current = loafScriptTotals.get(key) || {
                    sourceURL: script?.sourceURL || "",
                    sourceFunctionName: script?.sourceFunctionName || "",
                    invoker: script?.invoker || "",
                    invokerType: script?.invokerType || "",
                    count: 0,
                    totalDuration: 0,
                    totalForcedStyleAndLayoutDuration: 0,
                    maxDuration: 0,
                };

                const scriptDuration = Number(script?.duration || 0);
                const layoutDuration = Number(script?.forcedStyleAndLayoutDuration || 0);
                current.count += 1;
                current.totalDuration += scriptDuration;
                current.totalForcedStyleAndLayoutDuration += layoutDuration;
                current.maxDuration = Math.max(current.maxDuration, scriptDuration);
                loafScriptTotals.set(key, current);
            }
        }

        if (supportsLongTask) {
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    longTaskDurationsMs.push(Number(entry.duration || 0));
                }
            });
            longTaskObserver.observe({ type: "longtask" });
            observers.push(longTaskObserver);
        }

        if (supportsLongAnimationFrame) {
            const loafObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
                    loafDurationsMs.push(Number(entry.duration || 0));
                    loafBlockingDurationsMs.push(Number(entry.blockingDuration || 0));
                    pushTopLoaf(entry, scripts);
                    trackLoafScripts(scripts);
                }
            });
            loafObserver.observe({ type: "long-animation-frame" });
            observers.push(loafObserver);
        }

        const measurementStartDateText = getDateText();
        const measurementStartSceneStateTime = getActiveSceneStateTime();
        const measurementStartTime = performance.now();
        let previousFrameTimestamp = null;

        await new Promise((resolve) => {
            function step(timestamp) {
                if (previousFrameTimestamp !== null) {
                    frameDeltasMs.push(timestamp - previousFrameTimestamp);
                }
                previousFrameTimestamp = timestamp;

                if ((timestamp - measurementStartTime) >= duration) {
                    resolve();
                    return;
                }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });

        for (const observer of observers) {
            flushEntries(observer, (entry) => {
                if (entry.entryType === "longtask") {
                    longTaskDurationsMs.push(Number(entry.duration || 0));
                    return;
                }
                if (entry.entryType === "long-animation-frame") {
                    const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
                    loafDurationsMs.push(Number(entry.duration || 0));
                    loafBlockingDurationsMs.push(Number(entry.blockingDuration || 0));
                    pushTopLoaf(entry, scripts);
                    trackLoafScripts(scripts);
                }
            });
            observer.disconnect();
        }

        return {
            support: {
                longTask: supportsLongTask,
                longAnimationFrame: supportsLongAnimationFrame,
            },
            environment: {
                userAgent: navigator.userAgent,
                devicePixelRatio: window.devicePixelRatio || 1,
                hardwareConcurrency: navigator.hardwareConcurrency || null,
                viewportWidth: window.innerWidth || 0,
                viewportHeight: window.innerHeight || 0,
                ...getModeSnapshot(),
            },
            measurement: {
                warmupMs: warmup,
                durationMs: duration,
                dateTextStart: measurementStartDateText,
                dateTextEnd: getDateText(),
                sceneStateTimeStart: measurementStartSceneStateTime,
                sceneStateTimeEnd: getActiveSceneStateTime(),
            },
            frameDeltasMs,
            longTaskDurationsMs,
            loafDurationsMs,
            loafBlockingDurationsMs,
            topLongAnimationFrames,
            loafScriptTotals: [...loafScriptTotals.values()],
        };
    }, { warmupMs, durationMs });
}

async function runRound(browser, args) {
    const page = await browser.newPage({
        viewport: {
            width: args.viewportWidth,
            height: args.viewportHeight,
        },
    });

    try {
        await attachAstronomyRoute(page);
        await configurePage(page, args);
        await startAnimation(page);
        const raw = await collectRoundTelemetry(page, args);
        await ensureAnimationPaused(page);
        return raw;
    } finally {
        await page.close();
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const baseArgs = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
    ];
    const headlessArgs = [
        "--disable-gpu-sandbox",
        "--use-angle=gl",
        "--enable-unsafe-swiftshader",
    ];
    const headedArgs = [
        "--enable-gpu-rasterization",
        "--enable-zero-copy",
    ];

    const browser = await chromium.launch({
        headless: args.headless,
        slowMo: args.slowMo,
        args: args.headless
            ? [...baseArgs, ...headlessArgs]
            : [...baseArgs, ...headedArgs],
    });

    try {
        const rounds = [];
        let mergedScriptTotals = new Map();

        for (let roundIndex = 0; roundIndex < args.rounds; roundIndex += 1) {
            const raw = await runRound(browser, args);
            const frameSummary = summarizeFrameDeltas(raw.frameDeltasMs);
            const longTaskSummary = raw.support.longTask
                ? summarizeEventDurations(raw.longTaskDurationsMs)
                : null;
            const loafSummary = raw.support.longAnimationFrame
                ? summarizeEventDurations(raw.loafDurationsMs)
                : null;
            const loafBlockingSummary = raw.support.longAnimationFrame
                ? summarizeEventDurations(raw.loafBlockingDurationsMs)
                : null;

            mergedScriptTotals = mergeScriptTotals(mergedScriptTotals, raw.loafScriptTotals);

            rounds.push({
                index: roundIndex + 1,
                raw,
                summary: {
                    playbackAdvanced:
                        raw.measurement.sceneStateTimeStart !== raw.measurement.sceneStateTimeEnd ||
                        raw.measurement.dateTextStart !== raw.measurement.dateTextEnd,
                    frame: frameSummary,
                    longTask: longTaskSummary,
                    longAnimationFrame: loafSummary,
                    longAnimationFrameBlocking: loafBlockingSummary,
                    topLongAnimationFrames: (raw.topLongAnimationFrames || []).slice(0, 5).map((entry) => ({
                        durationMs: roundNumber(entry.duration),
                        blockingDurationMs: roundNumber(entry.blockingDuration),
                        renderDurationMs: roundNumber(entry.renderDuration),
                        styleAndLayoutDurationMs: roundNumber(entry.styleAndLayoutDuration),
                        scriptCount: Number(entry.scriptCount || 0),
                        topInvoker: entry.topInvoker || "",
                        topSourceURL: entry.topSourceURL || "",
                    })),
                },
            });
        }

        const overallFrameSamples = rounds.flatMap((round) => round.raw.frameDeltasMs || []);
        const overallLongTaskSamples = rounds.flatMap((round) => round.raw.longTaskDurationsMs || []);
        const overallLoafSamples = rounds.flatMap((round) => round.raw.loafDurationsMs || []);
        const overallLoafBlockingSamples = rounds.flatMap((round) => round.raw.loafBlockingDurationsMs || []);

        const support = rounds[0]?.raw?.support || { longTask: false, longAnimationFrame: false };
        const environment = rounds[0]?.raw?.environment || {};

        const output = {
            benchmark: "runtime-animation",
            label: args.label || "",
            runAt: new Date().toISOString(),
            params: {
                baseUrl: args.baseUrl,
                mission: args.mission,
                origin: args.origin,
                dimension: args.dimension,
                rounds: args.rounds,
                warmupMs: args.warmupMs,
                durationMs: args.durationMs,
                settleMs: args.settleMs,
                viewportWidth: args.viewportWidth,
                viewportHeight: args.viewportHeight,
                headless: args.headless,
                viewAuxPanels: args.viewAuxPanels,
                viewSky: args.viewSky,
                viewOrbit: args.viewOrbit,
                orbitStyle: args.orbitStyle,
                cameraPosition: args.cameraPosition,
                cameraLook: args.cameraLook,
                plane: args.plane,
            },
            environment,
            support,
            interpretation: args.headless
                ? "Headless runs are useful for relative checks, but headed GPU-backed runs are recommended for meaningful runtime performance numbers."
                : "Headed runs are preferred for real animation-performance comparisons on the local machine.",
            rounds: rounds.map((round) => ({
                round: round.index,
                playbackAdvanced: round.summary.playbackAdvanced,
                dateTextStart: round.raw.measurement.dateTextStart,
                dateTextEnd: round.raw.measurement.dateTextEnd,
                sceneStateTimeStart: round.raw.measurement.sceneStateTimeStart,
                sceneStateTimeEnd: round.raw.measurement.sceneStateTimeEnd,
                frame: round.summary.frame,
                longTask: round.summary.longTask,
                longAnimationFrame: round.summary.longAnimationFrame,
                longAnimationFrameBlocking: round.summary.longAnimationFrameBlocking,
                topLongAnimationFrames: round.summary.topLongAnimationFrames,
            })),
            overall: {
                frame: summarizeFrameDeltas(overallFrameSamples),
                longTask: support.longTask ? summarizeEventDurations(overallLongTaskSamples) : null,
                longAnimationFrame: support.longAnimationFrame
                    ? summarizeEventDurations(overallLoafSamples)
                    : null,
                longAnimationFrameBlocking: support.longAnimationFrame
                    ? summarizeEventDurations(overallLoafBlockingSamples)
                    : null,
                roundMeanFrameTimeMs: summarizeEventDurations(
                    rounds.map((round) => round.summary.frame.meanFrameTimeMs),
                ),
                playbackAdvancedRounds: rounds.filter((round) => round.summary.playbackAdvanced).length,
                topLongAnimationFrames: aggregateTopLoafs(rounds),
                topLongAnimationFrameScripts: formatScriptTotals(mergedScriptTotals),
            },
        };

        console.log(JSON.stringify(output, null, 2));
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});
