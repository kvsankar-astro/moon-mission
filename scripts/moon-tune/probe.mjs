// Diagnostic probe: open tuner, wait, screenshot the whole page + canvas, dump scene state.
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const OUT = path.resolve("tmp/moon-tune/shots");
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
    headless: false,  // headless=new via channel:chrome below
    channel: "chrome",
    args: [
        "--headless=new",
        "--disable-dev-shm-usage",
        "--ignore-gpu-blocklist",
        "--enable-gpu",
        "--enable-webgl",
    ],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 880 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => console.log("page", m.type(), m.text()));
page.on("response", async (r) => {
    if (r.status() >= 400) console.log("HTTP", r.status(), r.url());
});
page.on("requestfailed", (req) => console.log("FAILED", req.failure()?.errorText, req.url()));

await page.goto("http://127.0.0.1:7275/moon-render-tuner.html", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);

// Count animation frames over 1s — if zero, render loop never started.
const frameCount = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const start = performance.now();
    function tick() {
        n++;
        if (performance.now() - start > 1000) resolve(n);
        else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}));
console.log("rAF/sec:", frameCount);

// Probe again after extra wait for textures.
await page.waitForTimeout(4000);

// Find what URL gave the 404.
const reqs = await page.evaluate(() => {
    const list = performance.getEntriesByType("resource").map((e) => ({
        url: e.name,
        responseStatus: e.responseStatus,
        encoded: e.encodedBodySize,
        decoded: e.decodedBodySize,
        duration: Math.round(e.duration),
    }));
    return list;
});
console.log("resources:", reqs.filter((r) => r.responseStatus >= 400 || r.url.match(/(moon|three)/i)).slice(0, 30));

const sceneState = await page.evaluate(() => {
    // Scrape things we can reach. If init failed, controls-root has Error.
    const errorBlock = document.querySelector("#tuner-controls-root .tuner-group-title");
    return {
        controlsRootText: document.getElementById("tuner-controls-root")?.textContent?.slice(0, 400),
        firstGroupTitle: errorBlock?.textContent,
    };
});
console.log("sceneState:", sceneState);


const failed = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    return entries.filter((e) => e.transferSize === 0 && e.responseStatus >= 400).map((e) => ({ url: e.name, status: e.responseStatus }));
});
console.log("perf failed:", failed);

// Read raw GL framebuffer at center after a render frame, plus inspect program logs.
const glState = await page.evaluate(() => {
    const c = document.getElementById("tuner-canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { err: "no gl" };
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            const w = c.width, h = c.height;
            const px = new Uint8Array(4);
            gl.readPixels(Math.floor(w/2), Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            // Sample programs / shaders Three.js uses.
            const programs = [];
            // Hack: enumerate via WebGL state we can introspect. Three.js doesn't expose
            // program list, but we can introspect currentProgram.
            const cur = gl.getParameter(gl.CURRENT_PROGRAM);
            if (cur) {
                programs.push({
                    linked: gl.getProgramParameter(cur, gl.LINK_STATUS),
                    log: gl.getProgramInfoLog(cur),
                });
            }
            const lastErr = gl.getError();
            resolve({ centerPx: Array.from(px), programs, lastErr, w, h });
        });
    });
});
console.log("glState:", JSON.stringify(glState));

// Use canvas.toDataURL by forcing a render right before. To do that, dispatch
// a dummy resize that re-renders, then immediately call toDataURL. Note: the
// existing Three.js renderer in tuner uses preserveDrawingBuffer=false (default)
// so we hook into its render loop and capture inside a rAF.
const dataUrl = await page.evaluate(async () => {
    const c = document.getElementById("tuner-canvas");
    return new Promise((resolve) => {
        // Two rAFs to guarantee a render has been issued and the buffer is current.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resolve(c.toDataURL("image/png"));
            });
        });
    });
});
const buf = Buffer.from(dataUrl.split(",")[1], "base64");
await fs.writeFile(path.join(OUT, "probe-canvas-toDataURL.png"), buf);
console.log("canvas toDataURL bytes:", buf.length);

await page.screenshot({ path: path.join(OUT, "probe-fullpage.png"), fullPage: false });
console.log("fullpage shot saved");
await browser.close();
