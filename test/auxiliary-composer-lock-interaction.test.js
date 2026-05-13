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

    it("refits the selected body after switching locks from a crater-scale FoV", async () => {
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

            const setManualMinimumFov = async () => {
                await page.evaluate(() => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    const autoButton = panel.querySelector(".aux-camera-view__auto-toggle");
                    const slider = panel.querySelector(".aux-camera-view__fov-slider");
                    if (autoButton.classList.contains("is-active")) {
                        autoButton.click();
                    }
                    slider.value = slider.min;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                });
                await page.waitForFunction(
                    () => {
                        const panel = document.querySelector(".aux-camera-view--composer");
                        return panel?.querySelector(".aux-camera-view__fov-value")?.textContent?.trim() === "0.1°";
                    },
                    { timeout: 5000 },
                );
            };

            const revealComposerSkyControls = async () => {
                const viewport = page.locator(".aux-camera-view--composer .aux-camera-view__viewport");
                const box = await viewport.boundingBox();
                if (!box) {
                    throw new Error("Frame and Shoot viewport was not available");
                }
                await page.mouse.move(box.x + 24, box.y + 24);
                await page.waitForFunction(
                    () => {
                        const controls = document.querySelector(
                            ".aux-camera-view--composer .aux-camera-view__composer-sky-controls",
                        );
                        return controls && window.getComputedStyle(controls).pointerEvents !== "none";
                    },
                    undefined,
                    { timeout: 5000 },
                );
            };

            const clickLock = async (label) => {
                await revealComposerSkyControls();
                await page
                    .locator(".aux-camera-view--composer .aux-camera-view__composer-sky-controls .aux-camera-view__composer-button")
                    .filter({ hasText: new RegExp(`^${label}$`) })
                    .first()
                    .click();
            };

            const waitForRefit = async (label) => page.waitForFunction(
                (targetLabel) => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    const activeLock = [...panel.querySelectorAll(".aux-camera-view__composer-button.is-active")]
                        .find((button) => ["Free", "Earth", "Moon"].includes(button.textContent.trim()));
                    const autoButton = panel.querySelector(".aux-camera-view__auto-toggle");
                    const valueText = panel.querySelector(".aux-camera-view__fov-value")?.textContent?.trim() || "";
                    const numericFov = Number.parseFloat(valueText);
                    return activeLock?.textContent.trim() === targetLabel &&
                        autoButton?.classList.contains("is-active") &&
                        Number.isFinite(numericFov) &&
                        numericFov > 0.1;
                },
                label,
                { timeout: 10000 },
            );

            const waitForFreeLock = async () => page.waitForFunction(
                () => {
                    const panel = document.querySelector(".aux-camera-view--composer");
                    const activeLock = [...panel.querySelectorAll(".aux-camera-view__composer-button.is-active")]
                        .find((button) => ["Free", "Earth", "Moon"].includes(button.textContent.trim()));
                    const autoButton = panel.querySelector(".aux-camera-view__auto-toggle");
                    return activeLock?.textContent.trim() === "Free" &&
                        !autoButton?.classList.contains("is-active") &&
                        autoButton?.disabled === true;
                },
                undefined,
                { timeout: 10000 },
            );

            await setManualMinimumFov();
            await clickLock("Earth");
            await waitForRefit("Earth");

            await clickLock("Free");
            await waitForFreeLock();

            await setManualMinimumFov();
            await clickLock("Moon");
            await waitForRefit("Moon");
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("allows Moon-locked Frame and Shoot wheel zoom to widen beyond Auto FoV bounds", async () => {
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

            const viewportBox = await page
                .locator(".aux-camera-view--composer .aux-camera-view__viewport")
                .boundingBox();
            if (!viewportBox) {
                throw new Error("Frame and Shoot viewport was not available");
            }

            await page.mouse.move(
                viewportBox.x + viewportBox.width * 0.5,
                viewportBox.y + viewportBox.height * 0.5,
            );
            for (let i = 0; i < 8; i += 1) {
                await page.mouse.wheel(0, 2000);
            }

            const zoomState = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const activeLock = [...panel.querySelectorAll(".aux-camera-view__composer-button.is-active")]
                    .find((button) => ["Free", "Earth", "Moon"].includes(button.textContent.trim()));
                const autoButton = panel.querySelector(".aux-camera-view__auto-toggle");
                const valueText = panel.querySelector(".aux-camera-view__fov-value")?.textContent?.trim() || "";
                return {
                    activeLock: activeLock?.textContent.trim() || "",
                    autoActive: autoButton?.classList.contains("is-active") === true,
                    fov: Number.parseFloat(valueText),
                };
            });

            expect(zoomState.activeLock).toBe("Moon");
            expect(zoomState.autoActive).toBe(false);
            expect(zoomState.fov).toBeGreaterThan(70);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("keeps Mag and Craters controls in the expected Frame and Shoot rows", async () => {
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

            const state = await page.evaluate(() => {
                const panel = document.querySelector(".aux-camera-view--composer");
                const magRow = panel.querySelector(".aux-camera-view__composer-star-mag-row");
                const craterPill = panel.querySelector("[data-proof-id='lunar-craters-toggle']");
                const craterRow = craterPill?.closest(".aux-camera-view__composer-crater-row");
                const infoRow = craterPill?.closest(".aux-camera-view__composer-info-row");
                return {
                    magLabel: magRow?.querySelector(".aux-camera-view__composer-label")?.textContent?.trim() || "",
                    craterHasOwnRow: !!craterRow,
                    craterInOverlayRow: !!infoRow,
                    craterText: craterPill?.textContent?.trim() || "",
                };
            });

            expect(state.magLabel).toBe("Mag");
            expect(state.craterText).toBe("Craters");
            expect(state.craterHasOwnRow).toBe(true);
            expect(state.craterInOverlayRow).toBe(false);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);
});
