// Screenshot the main scene in Follow Moon mode at a specific scene time.
// Companion to shoot-craft-to-moon-at.mjs for parity comparison.
// Usage: node scripts/moon-tune/shoot-follow-moon-at.mjs <label> [iso-utc]
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const LABEL = process.argv[2] || "follow-moon-shot";
const ISO = process.argv[3] || "2026-04-06T22:41:21Z";
const TARGET_MS = Date.parse(ISO);

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
    try {
        await page.waitForFunction(() => !/loading.*high-?resolution/i.test(document.body.textContent || ""), { timeout: 30000 });
    } catch {}
    await page.waitForTimeout(2500);

    // Engage Follow Moon mode (look at moon).
    await page.click("#follow-pill-moon").catch(() => {});
    await page.waitForTimeout(1500);

    // Scrub to target.
    if (Number.isFinite(TARGET_MS)) {
        await page.evaluate((t) => {
            const scene = (window.animationScenes || {})[Object.keys(window.animationScenes || {})[0]];
            if (!scene) return;
            scene.setTime?.(t);
            scene.setSimulationTime?.(t);
            scene.scrubToTime?.(t);
            scene.timeline?.setTime?.(t);
            scene.animationController?.setTime?.(t);
            scene.setAnimTime?.(t);
        }, TARGET_MS);
        await page.waitForTimeout(2500);
    }

    const t = await page.evaluate(() => {
        const scene = (window.animationScenes || {})[Object.keys(window.animationScenes || {})[0]];
        return scene?.scope?.time ? new Date(scene.scope.time).toISOString() : null;
    });
    console.log("scene time:", t, "(target:", ISO + ")");
    await page.screenshot({ path: path.join(OUT, `${LABEL}.png`), fullPage: false });
    console.log("wrote", `${LABEL}.png`);
} finally {
    await browser.close();
}
