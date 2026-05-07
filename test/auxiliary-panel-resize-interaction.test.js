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
            expect(after.height).toBeGreaterThan(before.height + 50);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);
});
