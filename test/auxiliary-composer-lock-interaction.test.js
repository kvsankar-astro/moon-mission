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

    it("keeps Frame and Shoot controls in the expected rows", async () => {
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
                const controlLabels = [...panel.querySelectorAll(".aux-camera-view__composer-controls .aux-camera-view__composer-label")]
                    .map((label) => label.textContent?.trim())
                    .filter(Boolean);
                const opticsLabels = [...panel.querySelectorAll(".aux-camera-view__composer-optics-body .aux-camera-view__composer-label")]
                    .map((label) => label.textContent?.trim())
                    .filter(Boolean);
                const sectionLabels = [...panel.querySelectorAll(".aux-camera-view__composer-section-label")]
                    .map((label) => label.textContent?.trim())
                    .filter(Boolean);
                return {
                    magLabel: magRow?.querySelector(".aux-camera-view__composer-label")?.textContent?.trim() || "",
                    craterHasOwnRow: !!craterRow,
                    craterInOverlayRow: !!infoRow,
                    craterText: craterPill?.textContent?.trim() || "",
                    controlLabels,
                    opticsLabels,
                    sectionLabels,
                    hasExposureSlider: !!panel.querySelector("[data-proof-id='exposure-ev-slider']"),
                    hasAutoExposureToggle: !!panel.querySelector("[data-proof-id='auto-exposure-toggle']"),
                    hasResetButton: !!panel.querySelector("[data-proof-id='composer-reset-button']"),
                };
            });

            expect(state.magLabel).toBe("Mag");
            expect(state.craterText).toBe("Lunar Features");
            expect(state.craterHasOwnRow).toBe(true);
            expect(state.craterInOverlayRow).toBe(false);
            expect(state.sectionLabels).toEqual(expect.arrayContaining(["Creative", "Photo"]));
            expect(state.controlLabels).toEqual(expect.arrayContaining([
                "Earth Fill",
                "Moon Fill",
                "Earthshine Gain",
                "Moonshine Gain",
            ]));
            expect(state.opticsLabels).toEqual(expect.arrayContaining(["Exposure"]));
            expect(state.hasExposureSlider).toBe(true);
            expect(state.hasAutoExposureToggle).toBe(true);
            expect(state.hasResetButton).toBe(true);
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);

    it("resets Frame and Shoot control values to defaults", async () => {
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
                const setInput = (proofId, value, eventType = "input") => {
                    const input = panel.querySelector(`[data-proof-id='${proofId}']`);
                    input.value = String(value);
                    input.dispatchEvent(new Event(eventType, { bubbles: true }));
                };
                setInput("earth-ambient-slider", 1.25);
                setInput("exposure-ev-slider", 8);
                setInput("star-mag-slider", 0);
                const autoExposure = panel.querySelector("[data-proof-id='auto-exposure-toggle']");
                autoExposure.checked = false;
                autoExposure.dispatchEvent(new Event("change", { bubbles: true }));
                const resetButton = panel.querySelector("[data-proof-id='composer-reset-button']");
                resetButton.click();
                const earthFillSlider = panel.querySelector("[data-proof-id='earth-ambient-slider']");
                const earthFillValue = earthFillSlider.closest(".aux-camera-view__composer-optics-row")
                    ?.querySelector("output")?.textContent?.trim();
                const exposureSlider = panel.querySelector("[data-proof-id='exposure-ev-slider']");
                const exposureValue = exposureSlider.closest(".aux-camera-view__composer-optics-row")
                    ?.querySelector("output")?.textContent?.trim();
                const starMagSlider = panel.querySelector("[data-proof-id='star-mag-slider']");
                const starMagValue = starMagSlider.closest(".aux-camera-view__composer-optics-row")
                    ?.querySelector("output")?.textContent?.trim();
                return {
                    earthFill: earthFillSlider.value,
                    earthFillValue,
                    exposure: exposureSlider.value,
                    exposureValue,
                    autoExposure: autoExposure.checked,
                    starMag: starMagSlider.value,
                    starMagValue,
                };
            });

            expect(state.earthFill).toBe("0");
            expect(state.earthFillValue).toBe("0.00");
            expect(state.exposure).toBe("0");
            expect(state.exposureValue).toBe("+0.0 EV");
            expect(state.autoExposure).toBe(true);
            expect(state.starMag).toBe("6");
            expect(state.starMagValue).toBe("6.0");
        } finally {
            await page.close();
        }
    }, TEST_TIMEOUT_MS);
});
