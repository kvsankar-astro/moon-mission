// Probe the live moon material in the mission scene to confirm what shader
// values the rendered panel is actually using. Reads:
//   - material.userData (post-photo-mode-override during render)
//   - material.normalScale, displacementScale (raw THREE.MeshStandardMaterial)
//   - material.normalMap.image dimensions (was the high-res normal map built?)
//   - material.normalMap === material.userData.fastNormalMap? (which normal map
//     instance is in use)
//   - generated-normal-map flag (did the deferred upgrade run)
// Optionally scrubs to a specific time first.
import { chromium } from "playwright";

const ISO = process.argv[2] || "2026-04-06T22:41:21Z";
const TARGET_MS = Date.parse(ISO);

const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--headless=new", "--disable-dev-shm-usage", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"],
});
try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    const baseUrl = process.env.MOON_TUNE_BASE_URL || "http://127.0.0.1:7275";
    await page.goto(`${baseUrl}/mission.html?mission=artemis2`, { waitUntil: "networkidle" });
    await page.waitForTimeout(8000);
    try {
        await page.waitForFunction(() => {
            const txt = document.body.textContent || "";
            return !/loading.*high-?resolution/i.test(txt);
        }, { timeout: 30000 });
    } catch {}
    await page.waitForTimeout(2500);

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

    // Click Craft -> Moon mobile preset to engage that view too.
    await page.evaluate(() => {
        const chip = Array.from(document.querySelectorAll(".aux-camera-chip"))
            .find((b) => /Craft.*Moon/i.test(b.textContent || ""));
        chip?.click();
        const btn = document.querySelector('[data-mobile-view-preset="moon"]');
        btn?.click();
    });
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(() => {
        const scene = (window.animationScenes || {})[Object.keys(window.animationScenes || {})[0]];
        if (!scene) return { ok: false, reason: "no scene" };
        const mat = scene.moonRenderer?.mesh?.material;
        if (!mat) return { ok: false, reason: "no material" };
        const u = mat.userData?.moonPhotometricShader?.uniforms || null;
        const nm = mat.normalMap;
        const dm = mat.displacementMap;
        const generated = scene.moonRenderer?.generatedNormalMap;
        return {
            ok: true,
            renderSettings: {
                normalScale: { x: mat.normalScale?.x, y: mat.normalScale?.y },
                displacementScale: mat.displacementScale,
                bumpScale: mat.bumpScale,
            },
            userData: {
                moonHighlightBoost: mat.userData?.moonHighlightBoost,
                moonTerminatorContrast: mat.userData?.moonTerminatorContrast,
                moonHighlightWeightExponent: mat.userData?.moonHighlightWeightExponent,
                moonShadowLift: mat.userData?.moonShadowLift,
                moonTerrainShadowStrength: mat.userData?.moonTerrainShadowStrength,
            },
            uniforms: u ? {
                uMoonHighlightBoost: u.uMoonHighlightBoost?.value,
                uMoonTerminatorContrast: u.uMoonTerminatorContrast?.value,
                uMoonHighlightWeightExponent: u.uMoonHighlightWeightExponent?.value,
                uMoonShadowLift: u.uMoonShadowLift?.value,
                uMoonTerrainShadowStrength: u.uMoonTerrainShadowStrength?.value,
            } : null,
            textures: {
                normalMap: nm ? {
                    isInstance: nm === generated ? "generated" : "external/null",
                    width: nm.image?.width,
                    height: nm.image?.height,
                    flipY: nm.flipY,
                    isDataTexture: nm.constructor?.name,
                } : null,
                displacementMap: dm ? { width: dm.image?.width, height: dm.image?.height, flipY: dm.flipY } : null,
                bumpMap: mat.bumpMap ? { kind: mat.bumpMap === dm ? "displacement-fallback" : "other", width: mat.bumpMap.image?.width } : null,
                generatedExists: !!generated,
            },
            programCacheKey: mat.customProgramCacheKey?.() || null,
            sceneTime: scene.scope?.time
                ? new Date(scene.scope.time).toISOString()
                : null,
        };
    });
    console.log(JSON.stringify(probe, null, 2));
} finally {
    await browser.close();
}
