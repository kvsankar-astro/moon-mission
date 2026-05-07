import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEffectiveTestBaseUrl } from "./local-test-config.js";

const TEST_TIMEOUT_MS = process.env.CI === "true" ? 120000 : 90000;

let browser;

describe("Auxiliary Frame and Shoot lock interactions", () => {
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

    it("keeps Moon lock active and shows guidance when the locked Frame and Shoot viewport is dragged", async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const baseUrl = getEffectiveTestBaseUrl(process.cwd());

        try {
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
                const viewport = panel.querySelector(".aux-camera-view__viewport");
                const activeLock = [...panel.querySelectorAll(".aux-camera-view__composer-button.is-active")]
                    .find((button) => ["Free", "Earth", "Moon"].includes(button.textContent.trim()));
                const rect = viewport.getBoundingClientRect();
                return {
                    activeLock: activeLock?.textContent.trim() || "",
                    x: rect.left + rect.width * 0.5,
                    y: rect.top + rect.height * 0.5,
                };
            });

            expect(before.activeLock).toBe("Moon");

            await page.mouse.move(before.x, before.y);
            await page.mouse.down();
            await page.mouse.move(before.x + 160, before.y + 80, { steps: 5 });
            await page.mouse.up();

            const after = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const activeLock = [...panel.querySelectorAll(".aux-camera-view__composer-button.is-active")]
                    .find((button) => ["Free", "Earth", "Moon"].includes(button.textContent.trim()));
                const hint = panel.querySelector(".aux-camera-view__composer-hint");
                return {
                    activeLock: activeLock?.textContent.trim() || "",
                    hintVisible: hint?.dataset.visible === "true" && hint.hidden === false,
                    hintText: hint?.textContent.trim() || "",
                };
            });

            expect(after.activeLock).toBe("Moon");
            expect(after.hintVisible).toBe(true);
            expect(after.hintText).toContain("Switch to Free");
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);
});
