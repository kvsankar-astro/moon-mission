// Screenshot the Craft to Moon aux panel at a specific scene time.
// Usage: node scripts/moon-tune/shoot-craft-to-moon-at.mjs <label> [iso-utc]
//   label    : output label, e.g. "before-iter3"
//   iso-utc  : target time in ISO UTC, defaults to 2026-04-06T22:41:21Z
//              (7 Apr 2026 04:11:21 AM IST)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const LABEL = process.argv[2] || "craft-to-moon-shot";
const ISO = process.argv[3] || "2026-04-06T22:41:21Z";
const TARGET_MS = Date.parse(ISO);
if (!Number.isFinite(TARGET_MS)) {
    console.error("Invalid ISO time:", ISO);
    process.exit(1);
}

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
    // Wait for the "Loading high-resolution textures…" toast to disappear,
    // signaling the quality profile is fully loaded and the deferred normal
    // map upgrade has run.
    try {
        await page.waitForFunction(() => {
            const txt = document.body.textContent || "";
            return !/loading.*high-?resolution/i.test(txt);
        }, { timeout: 30000 });
    } catch {
        // Best-effort; proceed anyway.
    }
    await page.waitForTimeout(2500);

    // Scrub scene time. Try multiple APIs (whichever wires up first wins).
    await page.evaluate((targetMs) => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        if (!scene) return;
        scene.setTime?.(targetMs);
        scene.setSimulationTime?.(targetMs);
        scene.scrubToTime?.(targetMs);
        scene.timeline?.setTime?.(targetMs);
        scene.animationController?.setTime?.(targetMs);
        scene.setAnimTime?.(targetMs);
        const slider = document.querySelector('#mainTimeSlider, input[type="range"][name="time"], #timeline-slider');
        if (slider) {
            slider.value = String(targetMs);
            slider.dispatchEvent(new Event("input", { bubbles: true }));
            slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }, TARGET_MS);
    await page.waitForTimeout(2500);

    // Engage Craft to Moon view (the desktop "From=Craft, To=Moon" pair).
    // Path: click chip if minimized, then mobile-preset to lock the from/to pair.
    await page.evaluate(() => {
        const chipMoon = Array.from(document.querySelectorAll(".aux-camera-chip"))
            .find((b) => /Craft.*Moon/i.test(b.textContent || b.getAttribute("aria-label") || ""));
        chipMoon?.click();
        const mobileBtn = document.querySelector('[data-mobile-view-preset="moon"]');
        mobileBtn?.click();
    });
    await page.waitForTimeout(2500);

    // Optionally tighten panel FoV so crater detail is visible at viewable
    // resolution. Pass FOV_DEG=8 to zoom in. We do this by finding the
    // Craft->Moon panelState in the runtime aux-camera-views manager and
    // assigning camera.fov directly + disabling autoFov.
    const fovDeg = Number(process.env.FOV_DEG);
    if (Number.isFinite(fovDeg) && fovDeg > 0) {
        const debug = await page.evaluate((deg) => {
            // The aux-camera-views manager lives on the scene-handler, not the
            // animationScene. Search the document/window for an instance with
            // a `panels` array.
            const candidates = [];
            if (window.__moonMissionDesktopPanelManager?.panels) {
                candidates.push({ from: "desktopPanelManager", mgr: window.__moonMissionDesktopPanelManager });
            }
            // Try to find via scene-handler reference if exposed.
            for (const k of Object.keys(window)) {
                const v = window[k];
                if (v && typeof v === "object" && Array.isArray(v.panels) && v.panels.length) {
                    candidates.push({ from: k, mgr: v });
                }
            }
            // Also walk children of any Object3D with panels (scene-handler is an obj with auxiliaryCameraViews).
            const animationScenes = window.animationScenes || {};
            for (const k of Object.keys(animationScenes)) {
                const sc = animationScenes[k];
                for (const prop of ["auxiliaryCameraViews", "auxCameraViews", "missionAuxiliaryCameraViews"]) {
                    if (sc?.[prop]?.panels?.length) {
                        candidates.push({ from: `animationScenes[${k}].${prop}`, mgr: sc[prop] });
                    }
                }
            }
            const result = { found: candidates.map((c) => c.from), patched: false, panelIds: [] };
            for (const { mgr } of candidates) {
                result.panelIds = mgr.panels.map((p) => p.id || p.title);
                const moonPanel = mgr.panels.find((p) => {
                    const id = String(p.id || "");
                    return id === "moon" || id === "aux:moon" || /Craft.*Moon/i.test(p.title || "");
                });
                // The desktop-panel-manager wraps the actual aux panel; the
                // inner panelState lives at moonPanel.panelState (or .source).
                const inner = moonPanel?.panelState || moonPanel?.source || moonPanel?.delegate || moonPanel;
                if (inner?.camera) {
                    inner.autoFovEnabled = false;
                    inner.camera.fov = deg;
                    inner.camera.updateProjectionMatrix?.();
                    result.patched = true;
                    result.patchedPanelId = moonPanel?.id || inner?.id;
                    result.innerKeys = Object.keys(inner).slice(0, 30);
                    break;
                } else if (moonPanel) {
                    result.moonPanelKeys = Object.keys(moonPanel).slice(0, 30);
                }
            }
            return result;
        }, fovDeg);
        console.log("FoV override:", JSON.stringify(debug));
        await page.waitForTimeout(2500);
    }

    // Verify the time landed where we asked.
    const probe = await page.evaluate(() => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        const t = scene?.scope?.time
            ?? scene?.latestSceneState?.time
            ?? null;
        return {
            sceneTimeIso: t ? new Date(t).toISOString() : null,
        };
    });
    console.log("scene time:", probe.sceneTimeIso, "(target:", ISO + ")");

    // Full page (so user sees context including aux panels), and a tight crop
    // of the Craft -> Moon aux panel.
    await page.screenshot({ path: path.join(OUT, `${LABEL}-fullpage.png`), fullPage: false });
    console.log("wrote", `${LABEL}-fullpage.png`);
    // The Craft→Moon panel header shows "Craft → Moon"; locate by header text.
    const panelHandle = await page.evaluateHandle(() => {
        const panels = Array.from(document.querySelectorAll(".aux-camera-view"));
        return panels.find((p) => /Craft\s*[→→>\-]+\s*Moon/i.test(p.textContent || "")) || null;
    });
    const elem = panelHandle ? panelHandle.asElement() : null;
    if (elem) {
        await elem.screenshot({ path: path.join(OUT, `${LABEL}-panel.png`) });
        console.log("wrote", `${LABEL}-panel.png`);
    } else {
        console.log("(no Craft->Moon panel handle found by header text)");
    }
} finally {
    await browser.close();
}
