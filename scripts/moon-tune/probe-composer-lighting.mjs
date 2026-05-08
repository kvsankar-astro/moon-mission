// Probe live moon lighting vs Hertzsprung-region orientation in the Frame and
// Shoot composer. Reads scene state to show: scene time, moon-centered sun
// direction (world frame), moon orientation quaternion, and where the IAU
// Hertzsprung point (lat -2, lon -128) projects on the moon's surface in world
// coords.
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
    await page.waitForTimeout(7000);

    // Open Frame and Shoot panel by clicking the Flyby pill if present.
    await page.click("#focus-pill-flyby").catch(() => {});
    await page.waitForTimeout(2500);

    // If a time argument is provided, scrub the scene there before probing.
    const targetMs = Number(process.env.PROBE_TIME_MS);
    if (Number.isFinite(targetMs)) {
        await page.evaluate((t) => {
            const scene = (window.animationScenes || {})[Object.keys(window.animationScenes || {})[0]];
            // Common knobs the runtime exposes for time scrubbing.
            if (scene?.setSimulationTime) scene.setSimulationTime(t);
            else if (scene?.timeline?.setTime) scene.timeline.setTime(t);
            else if (scene?.scrubToTime) scene.scrubToTime(t);
            else if (scene?.setTime) scene.setTime(t);
        }, targetMs);
        await page.waitForTimeout(2000);
    }

    const out = await page.evaluate(() => {
        const scenes = window.animationScenes || {};
        const scene = scenes[Object.keys(scenes)[0]] || null;
        if (!scene) return { ok: false, reason: "no scene" };

        const dotV = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
        const norm = (v) => {
            const len = Math.hypot(v.x, v.y, v.z) || 1;
            return { x: v.x / len, y: v.y / len, z: v.z / len };
        };

        // Moon-centered sun direction (world frame).
        const moonSunDirWorld = scene.stateSunDirections?.moonCentered
            || scene.latestSceneState?.sunDirections?.moonCentered
            || null;

        // Moon container quaternion (world rotation that takes selenographic
        // coords to world coords).
        const moonContainer = scene.moonRenderer?.container;
        const q = moonContainer?.quaternion ? {
            x: moonContainer.quaternion.x,
            y: moonContainer.quaternion.y,
            z: moonContainer.quaternion.z,
            w: moonContainer.quaternion.w,
        } : null;

        // Apply quaternion to selenographic point: returns world-space direction.
        const applyQuat = (p, q) => {
            const ix = q.w * p.x + q.y * p.z - q.z * p.y;
            const iy = q.w * p.y + q.z * p.x - q.x * p.z;
            const iz = q.w * p.z + q.x * p.y - q.y * p.x;
            const iw = -q.x * p.x - q.y * p.y - q.z * p.z;
            return {
                x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
                y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
                z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
            };
        };

        // Hertzsprung at selenographic (lat=-2, lon=-128). Convert to a unit
        // vector in selenographic frame: x toward 0/0 (sub-Earth), z toward
        // north pole. Note: SphereGeometry's UV layout puts longitude 0 at
        // a specific meridian; the moon container rotation applies the IAU
        // pole/W angles, so this point in *moon-fixed* frame should be rotated
        // by that quaternion to land in world frame.
        const toRad = (d) => d * Math.PI / 180;
        const lat = toRad(-2);
        const lon = toRad(-128);
        // Geometry note: the moon is built as a SphereGeometry (z-up after
        // rotateX(PI/2) in createMoon), so selenographic +x is the prime
        // meridian intersection on the equator and +z is the lunar north pole.
        const hertzMoonFixed = {
            x: Math.cos(lat) * Math.cos(lon),
            y: Math.cos(lat) * Math.sin(lon),
            z: Math.sin(lat),
        };
        const hertzWorld = q ? applyQuat(hertzMoonFixed, q) : null;

        // NdotL for Hertzsprung = dot(world hertzNormal, sunDirWorld).
        let hertzNdotL = null;
        if (hertzWorld && moonSunDirWorld) {
            const sun = norm(moonSunDirWorld);
            const n = norm(hertzWorld);
            hertzNdotL = dotV(n, sun);
        }

        // Resolve time across plausible places it might be stashed.
        const tCandidates = [
            scene.scope?.time,
            scene.currentTime,
            scene.simulationTime,
            scene.latestSceneState?.time,
            scene.latestSceneState?.timeMs,
            scene.lastTimeMs,
            window.scene?.time,
        ].filter((t) => Number.isFinite(t));
        const tMs = tCandidates[0] || null;

        return {
            ok: true,
            sceneTimeIso: tMs ? new Date(tMs).toISOString() : null,
            sceneTimeMs: tMs,
            sceneStateKeys: Object.keys(scene.latestSceneState || {}).slice(0, 30),
            moonSunDirWorld: moonSunDirWorld ? norm(moonSunDirWorld) : null,
            moonQuat: q,
            hertzMoonFixed,
            hertzWorld: hertzWorld ? norm(hertzWorld) : null,
            hertzNdotL,
            hertzInterpretation: hertzNdotL == null
                ? "could not compute"
                : (hertzNdotL > 0.3 ? "fully lit" : (hertzNdotL > 0 ? "partially lit" : "in shadow")),
        };
    });

    console.log(JSON.stringify(out, null, 2));
} finally {
    await browser.close();
}
