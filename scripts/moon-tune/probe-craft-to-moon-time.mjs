// Probe whether the Craft to Moon view is reachable at the user's target
// timestamp (2026-04-07 04:11:21 IST = 2026-04-06 22:41:21 UTC).
//
// Reports: scene time after scrub, ephemeris availability for SC/MOON at that
// time, current camera-mode (positionMode/lookMode), and a screenshot of the
// scene + the moon aux panel content.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const TARGET_MS = Date.UTC(2026, 3, 6, 22, 41, 21);
const OUT = path.resolve("tmp/moon-tune/shots");
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--headless=new", "--disable-dev-shm-usage", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"],
});
try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    const baseUrl = process.env.MOON_TUNE_BASE_URL || "http://127.0.0.1:7275";
    await page.goto(`${baseUrl}/mission.html?mission=artemis2`, { waitUntil: "networkidle" });
    await page.waitForTimeout(8000);

    // 1. Probe ephemeris coverage for SC and MOON at target time, plus active
    //    Craft -> Moon panel state, BEFORE scrubbing.
    const before = await page.evaluate((targetMs) => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        if (!scene) return { ok: false, reason: "no scene" };
        const probe = (bodyId) => {
            const range = scene.bodySources?.getEphemerisRange?.(bodyId)
                ?? scene.cachedRanges?.[bodyId]
                ?? null;
            return { bodyId, range };
        };
        // Best-effort: see what the runtime reports about its time.
        const tNow = scene.scope?.time
            ?? scene.latestSceneState?.time
            ?? null;
        // Look for the Craft -> Moon aux panel.
        const moonPanelExists = !!document.querySelector("[data-aux-panel-id=\"moon\"], #aux-camera-panel-moon, .aux-camera-view");
        const auxRoots = Array.from(document.querySelectorAll(".aux-camera-view, [data-aux-panel-id]"))
            .map((el) => el.getAttribute("data-aux-panel-id") || el.id || el.className).slice(0, 8);
        return {
            ok: true,
            sceneTimeIsoNow: tNow ? new Date(tNow).toISOString() : null,
            moonPanelExists,
            auxRoots,
            probes: {
                sc: probe("SC"),
                moon: probe("MOON"),
            },
            preferredCraftIds: scene.preferredCraftIds || null,
        };
    }, TARGET_MS);
    console.log("BEFORE:", JSON.stringify(before, null, 2));

    // 2. Try to scrub the timeline. The runtime exposes timeline via various
    //    paths; try a sequence and report which one took.
    const scrubResult = await page.evaluate((targetMs) => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        if (!scene) return { ok: false, reason: "no scene" };
        const tried = [];
        const tryFn = (label, fn) => {
            try {
                const r = fn();
                tried.push({ label, ok: true, value: r === undefined ? "undefined" : String(r) });
                return true;
            } catch (e) {
                tried.push({ label, ok: false, err: e.message });
            }
            return false;
        };
        // Common public APIs encountered in this repo.
        tryFn("scene.setTime", () => scene.setTime?.(targetMs));
        tryFn("scene.setSimulationTime", () => scene.setSimulationTime?.(targetMs));
        tryFn("scene.scrubToTime", () => scene.scrubToTime?.(targetMs));
        tryFn("scene.timeline.setTime", () => scene.timeline?.setTime?.(targetMs));
        tryFn("animationController.setTime", () => scene.animationController?.setTime?.(targetMs));
        tryFn("scene.setAnimTime", () => scene.setAnimTime?.(targetMs));
        // Fallback: tweak the timeline scrubber range input if present.
        const slider = document.querySelector('#mainTimeSlider, input[type="range"][name="time"], #timeline-slider');
        if (slider) {
            tryFn("timeline-slider.value", () => {
                slider.value = String(targetMs);
                slider.dispatchEvent(new Event("input", { bubbles: true }));
                slider.dispatchEvent(new Event("change", { bubbles: true }));
            });
        }
        return { ok: true, tried };
    }, TARGET_MS);
    console.log("SCRUB:", JSON.stringify(scrubResult, null, 2));

    await page.waitForTimeout(2500);

    const after = await page.evaluate((targetMs) => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        if (!scene) return null;
        const t = scene.scope?.time
            ?? scene.latestSceneState?.time
            ?? null;
        return {
            sceneTimeIso: t ? new Date(t).toISOString() : null,
            sceneTimeMs: t,
            targetMs,
            offsetMs: t != null ? t - targetMs : null,
            // SC + MOON state availability at this time.
            scAvailable: scene.latestSceneState?.bodies?.SC?.available ?? null,
            moonAvailable: scene.latestSceneState?.bodies?.MOON?.available ?? null,
        };
    }, TARGET_MS);
    console.log("AFTER:", JSON.stringify(after, null, 2));

    // 3. Try opening the Craft to Moon aux panel and screenshot it.
    const openMoon = await page.evaluate(() => {
        // Try chip dock first (the minimized panel button).
        const chipMoon = Array.from(document.querySelectorAll(".aux-camera-chip"))
            .find((b) => /Craft.*Moon|Moon/i.test(b.textContent || b.getAttribute("aria-label") || ""));
        if (chipMoon) {
            chipMoon.click();
            return { clicked: "chip", text: chipMoon.textContent };
        }
        // Try mobile-view-preset button.
        const mobileBtn = document.querySelector('[data-mobile-view-preset="moon"]');
        if (mobileBtn) {
            mobileBtn.click();
            return { clicked: "mobile-preset" };
        }
        return { clicked: null };
    });
    console.log("OPEN MOON:", openMoon);

    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(OUT, "probe-craft-to-moon-fullpage.png"), fullPage: false });
    // Try to crop to the moon panel.
    const moonHandle = await page.$("[data-aux-panel-id=\"moon\"], #aux-camera-panel-moon");
    if (moonHandle) {
        await moonHandle.screenshot({ path: path.join(OUT, "probe-craft-to-moon-panel.png") });
        console.log("wrote panel shot");
    }
} finally {
    await browser.close();
}
