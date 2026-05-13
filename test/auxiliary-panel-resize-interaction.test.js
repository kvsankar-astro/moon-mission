import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEffectiveTestBaseUrl } from "./local-test-config.js";

const TEST_TIMEOUT_MS = process.env.CI === "true" ? 120000 : 90000;

let browser;

describe("Auxiliary panel resize interactions", () => {
    beforeAll(async () => {
        browser = await chromium.launch({
            headless: process.env.HEADLESS !== "false",
            args: [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--disable-gpu-sandbox",
                "--use-angle=gl",
                "--enable-unsafe-swiftshader",
            ],
        });
    });

    afterAll(async () => {
        await browser?.close();
    });

    it("resizes the Frame and Shoot panel through the real bottom-right corner while textures are deferred", async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const baseUrl = getEffectiveTestBaseUrl(process.cwd());

        try {
            await page.addInitScript(() => localStorage.clear());
            await page.route(/\.(jpg|jpeg|png|webp)(\?|$)/i, async (route) => {
                const url = route.request().url();
                if (url.includes("/images/") || url.includes("/assets/")) {
                    await new Promise((resolve) => setTimeout(resolve, 6000));
                }
                await route.continue();
            });

            await page.goto(`${baseUrl}/artemis2/`, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            await page.waitForFunction(
                () => document.getElementById("mission-loading-overlay")?.dataset?.blocking === "false",
                { timeout: 30000 },
            );

            await page.evaluate(() => document.getElementById("flyby-pill")?.click());
            await page.waitForFunction(
                () => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    return panel && !panel.hidden;
                },
                { timeout: 10000 },
            );

            await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                panel.style.left = "96px";
                panel.style.top = "96px";
                panel.style.right = "auto";
                panel.style.bottom = "auto";
                panel.style.width = "600px";
                panel.style.height = "360px";
            });
            await page.waitForTimeout(100);

            const before = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const scene = window.animationScenes?.geo || window.animationScenes?.lunar || null;
                const rect = panel.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                    x: rect.right - 10,
                    y: rect.bottom - 10,
                    textureState: scene?.textureLoadState || "",
                    topClass: String(document.elementFromPoint(rect.right - 10, rect.bottom - 10)?.className || ""),
                };
            });

            expect(before.topClass).toContain("aux-camera-view__resize-grip");
            expect(before.textureState).toBe("deferred");

            await page.mouse.move(before.x, before.y);
            await page.mouse.down();
            await page.mouse.move(before.x + 120, before.y + 80, { steps: 5 });
            await page.mouse.up();
            await page.waitForTimeout(200);

            const after = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const rect = panel.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                };
            });

            expect(after.width).toBeGreaterThan(before.width + 80);
            expect(after.height).toBeGreaterThan(before.height + 40);

            const beforeTopLeft = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const rect = panel.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    x: rect.left + 10,
                    y: rect.top + 10,
                    topClass: String(document.elementFromPoint(rect.left + 10, rect.top + 10)?.className || ""),
                };
            });

            expect(beforeTopLeft.topClass).toContain("aux-camera-view__resize-grip");

            await page.mouse.move(beforeTopLeft.x, beforeTopLeft.y);
            await page.mouse.down();
            await page.mouse.move(beforeTopLeft.x - 90, beforeTopLeft.y - 60, { steps: 5 });
            await page.mouse.up();
            await page.waitForTimeout(200);

            const afterTopLeft = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const rect = panel.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                };
            });

            expect(afterTopLeft.left).toBeLessThan(beforeTopLeft.left - 50);
            expect(afterTopLeft.top).toBeLessThan(beforeTopLeft.top - 30);
            expect(afterTopLeft.width).toBeGreaterThan(beforeTopLeft.width + 50);
            expect(afterTopLeft.height).toBeGreaterThan(beforeTopLeft.height + 30);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("lets a maximized Frame and Shoot panel be resized from a corner", async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const baseUrl = getEffectiveTestBaseUrl(process.cwd());

        try {
            await page.addInitScript(() => localStorage.clear());
            await page.goto(`${baseUrl}/artemis2/`, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            await page.waitForFunction(
                () => document.getElementById("mission-loading-overlay")?.dataset?.blocking === "false",
                { timeout: 30000 },
            );

            await page.evaluate(() => document.getElementById("flyby-pill")?.click());
            await page.waitForFunction(
                () => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    return panel && !panel.hidden;
                },
                { timeout: 10000 },
            );

            await page.evaluate(() => {
                document.querySelector(".aux-camera-view--composer .aux-camera-view__expand-button")?.click();
            });
            await page.waitForFunction(
                () => document.querySelector(".aux-camera-view--composer")?.classList.contains("is-maximized"),
                { timeout: 5000 },
            );

            const before = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const rect = panel.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                    x: rect.right - 10,
                    y: rect.bottom - 10,
                    maximized: panel.classList.contains("is-maximized"),
                    topClass: String(document.elementFromPoint(rect.right - 10, rect.bottom - 10)?.className || ""),
                };
            });

            expect(before.maximized).toBe(true);
            expect(before.topClass).toContain("aux-camera-view__resize-grip");

            await page.mouse.move(before.x, before.y);
            await page.mouse.down();
            await page.mouse.move(before.x - 140, before.y - 90, { steps: 6 });
            await page.mouse.up();
            await page.waitForTimeout(200);

            const after = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const rect = panel.getBoundingClientRect();
                const expandButton = panel.querySelector(".aux-camera-view__expand-button");
                return {
                    width: rect.width,
                    height: rect.height,
                    maximized: panel.classList.contains("is-maximized"),
                    expandPressed: expandButton?.getAttribute("aria-pressed"),
                };
            });

            expect(after.maximized).toBe(false);
            expect(after.expandPressed).toBe("false");
            expect(after.width).toBeLessThan(before.width - 80);
            expect(after.height).toBeLessThan(before.height - 50);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("defaults Mission Media and Frame and Shoot with matching frames and an open scene gap", async () => {
        const page = await browser.newPage({ viewport: { width: 1920, height: 800 } });
        const baseUrl = getEffectiveTestBaseUrl(process.cwd());

        try {
            await page.addInitScript(() => localStorage.clear());
            await page.goto(`${baseUrl}/artemis2/`, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            await page.waitForFunction(
                () => document.getElementById("mission-loading-overlay")?.dataset?.blocking === "false",
                { timeout: 30000 },
            );

            await page.evaluate(() => document.getElementById("flyby-pill")?.click());
            await page.waitForFunction(
                () => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    return panel && !panel.hidden;
                },
                { timeout: 10000 },
            );
            const composerBeforeMedia = await page.evaluate(() => {
                const composer = document.querySelector(".aux-camera-view--composer");
                const rect = composer.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                };
            });

            await page.waitForFunction(
                () => document.getElementById("media-browser-panel-wrapper")?.hidden === false,
                { timeout: 10000 },
            );
            await page.evaluate(() => document.getElementById("panel-pill-media")?.click());
            await page.waitForFunction(
                () => {
                    const media = document.getElementById("media-browser-panel");
                    const composer = document.querySelector(".aux-camera-view--composer");
                    if (!media || !composer || media.classList.contains("media-browser-panel--hidden") || composer.hidden) {
                        return false;
                    }
                    const mediaRect = media.getBoundingClientRect();
                    const composerRect = composer.getBoundingClientRect();
                    return Math.abs(mediaRect.top - composerRect.top) <= 2 &&
                        Math.abs(mediaRect.bottom - composerRect.bottom) <= 2;
                },
                { timeout: 10000 },
            );

            const layout = await page.evaluate(() => {
                const media = document.getElementById("media-browser-panel");
                const composer = document.querySelector(".aux-camera-view--composer");
                const auxPanels = Array.from(document.querySelectorAll(".aux-camera-view:not(.aux-camera-view--composer)"))
                    .filter((panel) => !panel.hidden)
                    .map((panel) => {
                        const rect = panel.getBoundingClientRect();
                        return {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                        };
                    })
                    .sort((a, b) => a.top - b.top);
                const mediaRect = media.getBoundingClientRect();
                const composerRect = composer.getBoundingClientRect();
                return {
                    media: {
                        left: mediaRect.left,
                        top: mediaRect.top,
                        bottom: mediaRect.bottom,
                        width: mediaRect.width,
                        height: mediaRect.height,
                    },
                    composer: {
                        left: composerRect.left,
                        top: composerRect.top,
                        bottom: composerRect.bottom,
                        width: composerRect.width,
                        height: composerRect.height,
                    },
                    auxPanels,
                };
            });

            expect(Math.abs(layout.media.top - layout.composer.top)).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.media.bottom - layout.composer.bottom)).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.media.width - layout.composer.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.composer.width - composerBeforeMedia.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.composer.height - composerBeforeMedia.height)).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.media.height - (800 * 0.6))).toBeLessThanOrEqual(2);
            expect(Math.abs(layout.composer.height - (800 * 0.6))).toBeLessThanOrEqual(2);
            expect(layout.media.left).toBeLessThan(layout.composer.left);
            expect(layout.auxPanels).toHaveLength(3);
            expect(Math.max(...layout.auxPanels.map((panel) => Math.abs(panel.left - layout.auxPanels[0].left))))
                .toBeLessThanOrEqual(2);
            const mediaComposerGap = layout.composer.left - (layout.media.left + layout.media.width);
            expect(mediaComposerGap).toBeGreaterThanOrEqual(80);
            expect(layout.auxPanels[0].left).toBeGreaterThan(layout.composer.left + layout.composer.width);
            expect(Math.abs((layout.auxPanels[0].left + layout.auxPanels[0].width) - 1912)).toBeLessThanOrEqual(2);

            await page.evaluate(() => {
                const panel = document.getElementById("media-browser-panel");
                panel.style.left = "80px";
            });

            const beforeResize = await page.evaluate(() => {
                const panel = document.getElementById("media-browser-panel");
                const rect = panel.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    x: rect.left + 10,
                    y: rect.top + 10,
                    topClass: String(document.elementFromPoint(rect.left + 10, rect.top + 10)?.className || ""),
                };
            });

            expect(beforeResize.topClass).toContain("media-browser-panel__resize-grip");

            await page.mouse.move(beforeResize.x, beforeResize.y);
            await page.mouse.down();
            await page.mouse.move(beforeResize.x - 70, beforeResize.y - 50, { steps: 5 });
            await page.mouse.up();
            await page.waitForTimeout(200);

            const afterResize = await page.evaluate(() => {
                const panel = document.getElementById("media-browser-panel");
                const rect = panel.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                };
            });

            expect(afterResize.left).toBeLessThan(beforeResize.left - 40);
            expect(afterResize.top).toBeLessThan(beforeResize.top - 25);
            expect(afterResize.width).toBeGreaterThan(beforeResize.width + 40);
            expect(afterResize.height).toBeGreaterThan(beforeResize.height + 25);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("keeps the selected media view stable when resizing the thumbnail tray", async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const baseUrl = getEffectiveTestBaseUrl(process.cwd());

        try {
            await page.addInitScript(() => localStorage.clear());
            await page.goto(`${baseUrl}/artemis2/`, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            await page.waitForFunction(
                () => document.getElementById("mission-loading-overlay")?.dataset?.blocking === "false",
                { timeout: 30000 },
            );

            await page.evaluate(() => document.getElementById("panel-pill-media")?.click());
            await page.waitForFunction(
                () => {
                    const panel = document.getElementById("media-browser-panel");
                    const image = document.getElementById("media-browser-image");
                    return panel
                        && !panel.classList.contains("media-browser-panel--hidden")
                        && image
                        && !image.hidden
                        && image.getAttribute("src");
                },
                { timeout: 10000 },
            );

            await page.click("#media-browser-image-zoom-in");
            await page.click("#media-browser-image-zoom-in");

            const stagePoint = await page.evaluate(() => {
                const rect = document.getElementById("media-browser-stage").getBoundingClientRect();
                return {
                    x: rect.left + (rect.width / 2),
                    y: rect.top + (rect.height / 2),
                };
            });

            await page.mouse.move(stagePoint.x, stagePoint.y);
            await page.mouse.down();
            await page.mouse.move(stagePoint.x, stagePoint.y + 300, { steps: 8 });
            await page.mouse.up();

            const resizerPoint = await page.evaluate(() => {
                const rect = document.getElementById("media-browser-thumbnail-resizer").getBoundingClientRect();
                return {
                    x: rect.left + (rect.width / 2),
                    y: rect.top + (rect.height / 2),
                };
            });

            await page.mouse.move(resizerPoint.x, resizerPoint.y);
            await page.mouse.down();
            await page.mouse.move(resizerPoint.x, resizerPoint.y - 140, { steps: 8 });
            await page.mouse.up();
            await page.waitForTimeout(200);

            const afterResize = await page.evaluate(() => {
                const panel = document.getElementById("media-browser-panel");
                const stage = document.getElementById("media-browser-stage");
                const image = document.getElementById("media-browser-image");
                const thumbnailList = document.getElementById("media-browser-thumbnail-list");
                const activeThumbnail = thumbnailList?.querySelector(".media-browser-panel__thumbnail-card.is-active");
                const stageRect = stage.getBoundingClientRect();
                const listRect = thumbnailList.getBoundingClientRect();
                const activeRect = activeThumbnail.getBoundingClientRect();
                const transformText = image.style.transform || "";
                const transformMatch = transformText.match(/translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)\s*scale\(([-0-9.]+)\)/);
                const panY = Number(transformMatch?.[2]);
                const zoom = Number(transformMatch?.[3]);
                return {
                    activeThumbnailInsideList: activeRect.left >= listRect.left - 1
                        && activeRect.right <= listRect.right + 1,
                    maxPanY: (stageRect.height * (zoom - 1)) / 2,
                    panY,
                    stageHeight: stageRect.height,
                    thumbnailStripHeight: Number.parseFloat(
                        getComputedStyle(panel).getPropertyValue("--media-browser-thumbnail-strip-height"),
                    ),
                    zoom,
                };
            });

            expect(afterResize.thumbnailStripHeight).toBeGreaterThan(148);
            expect(afterResize.stageHeight).toBeGreaterThanOrEqual(150);
            expect(afterResize.zoom).toBeGreaterThan(1);
            expect(Math.abs(afterResize.panY)).toBeLessThanOrEqual(afterResize.maxPanY + 1);
            expect(afterResize.activeThumbnailInsideList).toBe(true);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);
});
