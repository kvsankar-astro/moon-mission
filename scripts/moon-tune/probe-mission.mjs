// Probe live moon material in mission.html to confirm the defaults are applied.
import { chromium } from "playwright";

const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--headless=new", "--disable-dev-shm-usage", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"],
});
try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    await page.goto("http://127.0.0.1:7275/mission.html?mission=artemis2", { waitUntil: "networkidle" });
    await page.waitForTimeout(8000);

    const probe = await page.evaluate(() => {
        // Try to find the moon material across known global handles.
        const result = { found: false };
        const scenes = window.animationScenes || {};
        const sceneKeys = Object.keys(scenes);
        const scene = sceneKeys.length ? scenes[sceneKeys[0]] : null;
        result.sceneKeys = sceneKeys;
        if (scene?.moonRenderer?.mesh?.material) {
            const m = scene.moonRenderer.mesh.material;
            const u = m.userData?.moonPhotometricShader?.uniforms || null;
            result.found = true;
            result.userData = {
                moonTerrainShadowStrength: m.userData.moonTerrainShadowStrength,
                moonTerrainShadowTexelStride: m.userData.moonTerrainShadowTexelStride,
                moonTerrainShadowSlopeBias: m.userData.moonTerrainShadowSlopeBias,
                moonTerminatorContrast: m.userData.moonTerminatorContrast,
                moonHighlightBoost: m.userData.moonHighlightBoost,
                normalScale: { x: m.normalScale?.x, y: m.normalScale?.y },
                displacementScale: m.displacementScale,
                hasDisplacementMap: !!m.displacementMap,
                hasNormalMap: !!m.normalMap,
            };
            if (u) {
                result.uniforms = {
                    uMoonTerrainShadowStrength: u.uMoonTerrainShadowStrength?.value,
                    uMoonTerrainShadowTexelStride: u.uMoonTerrainShadowTexelStride?.value,
                    uMoonTerrainShadowSlopeBias: u.uMoonTerrainShadowSlopeBias?.value,
                    uMoonTerminatorContrast: u.uMoonTerminatorContrast?.value,
                    uMoonHeightTexelSize: u.uMoonHeightTexelSize?.value
                        ? { x: u.uMoonHeightTexelSize.value.x, y: u.uMoonHeightTexelSize.value.y }
                        : null,
                };
            }
            // Light direction info.
            const dirLights = [];
            scene.scene?.traverse?.((obj) => {
                if (obj.isDirectionalLight) {
                    dirLights.push({
                        name: obj.name || "",
                        intensity: obj.intensity,
                        color: obj.color?.getHexString?.(),
                        pos: obj.position ? { x: obj.position.x, y: obj.position.y, z: obj.position.z } : null,
                    });
                }
            });
            result.dirLights = dirLights;
        } else {
            result.windowKeys = Object.keys(window).filter((k) => /scene|moon|render/i.test(k)).slice(0, 30);
        }
        return result;
    });
    console.log(JSON.stringify(probe, null, 2));
} finally {
    await browser.close();
}
