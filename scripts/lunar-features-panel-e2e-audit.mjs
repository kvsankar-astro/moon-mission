import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const BASE_URL = process.env.LUNAR_FEATURES_AUDIT_URL || "http://127.0.0.1:7274/mission.html?mission=artemis2";
const OUTPUT_ROOT = path.resolve(
    process.cwd(),
    "test-artifacts",
    "lunar-features-panel-e2e-audit",
    new Date().toISOString().replace(/[:.]/g, "-"),
);

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100) || "step";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCountText(raw) {
    const match = String(raw || "").match(/([0-9][0-9,]*)/);
    if (!match) return null;
    return Number(match[1].replace(/,/g, ""));
}

function computeDiffStats(beforePath, afterPath, diffPath) {
    const before = PNG.sync.read(fs.readFileSync(beforePath));
    const after = PNG.sync.read(fs.readFileSync(afterPath));
    if (before.width !== after.width || before.height !== after.height) {
        throw new Error("Before/after screenshot dimensions differ.");
    }
    const diff = new PNG({ width: before.width, height: before.height });
    const diffPixels = pixelmatch(
        before.data,
        after.data,
        diff.data,
        before.width,
        before.height,
        { threshold: 0.1 },
    );
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    const total = before.width * before.height;
    return {
        diffPixels,
        totalPixels: total,
        diffRatio: total > 0 ? diffPixels / total : 0,
    };
}

async function openPanel(page) {
    await page.locator("#toggle-pill-lunar-craters").click({ force: true });
    await page.waitForSelector("#lunar-crater-controls-panel:not([hidden])", { timeout: 15000 });
}

async function closePanel(page) {
    const panelVisible = await page.locator("#lunar-crater-controls-panel").isVisible().catch(() => false);
    if (!panelVisible) return;
    await page.locator("#lunar-crater-close").click({ force: true });
    await page.waitForFunction(() => {
        const panel = document.getElementById("lunar-crater-controls-panel");
        return !!panel && panel.hidden === true;
    }, { timeout: 15000 });
}

async function setMoonFraming(page) {
    await page.locator("#follow-pill-moon").click({ force: true });
    await sleep(900);

    const viewport = page.viewportSize() || { width: 1600, height: 1000 };
    const centerX = Math.round(viewport.width * 0.54);
    const centerY = Math.round(viewport.height * 0.54);

    for (let i = 0; i < 20; i += 1) {
        await page.mouse.move(centerX, centerY);
        await page.mouse.wheel(0, -1200);
        await sleep(40);
    }
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 140, centerY + 34, { steps: 18 });
    await page.mouse.up();
    await sleep(900);
}

async function setTypeChecked(page, featureType, checked) {
    await page.evaluate(({ featureType, checked: nextValue }) => {
        const selector =
            `#lunar-crater-controls-panel .lunar-crater-controls-panel__type-row[data-feature-type="${CSS.escape(featureType)}"]`;
        const row = document.querySelector(selector);
        if (!row) return;
        const input = row.querySelector(".lunar-crater-controls-panel__type-toggle");
        if (!input) return;
        input.checked = nextValue === true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { featureType, checked });
}

async function setTypeMin(page, featureType, value) {
    await page.evaluate(({ featureType, value: nextValue }) => {
        const selector =
            `#lunar-crater-controls-panel .lunar-crater-controls-panel__type-row[data-feature-type="${CSS.escape(featureType)}"]`;
        const row = document.querySelector(selector);
        if (!row) return;
        const input = row.querySelectorAll(".lunar-crater-controls-panel__type-number")[0];
        if (!input) return;
        input.value = String(nextValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { featureType, value });
}

async function setTypeMax(page, featureType, value) {
    await page.evaluate(({ featureType, value: nextValue }) => {
        const selector =
            `#lunar-crater-controls-panel .lunar-crater-controls-panel__type-row[data-feature-type="${CSS.escape(featureType)}"]`;
        const row = document.querySelector(selector);
        if (!row) return;
        const input = row.querySelectorAll(".lunar-crater-controls-panel__type-number")[1];
        if (!input) return;
        input.value = String(nextValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { featureType, value });
}

async function configureBaseline(page) {
    await openPanel(page);
    await page.locator('#lunar-crater-controls-panel [data-preset-id="all"]').click({ force: true });
    await page.locator("#lunar-crater-visible-toggle").click({ force: true });
    await page.evaluate(() => {
        const min = document.getElementById("lunar-crater-min-diameter");
        const max = document.getElementById("lunar-crater-max-diameter");
        if (min) {
            min.value = "0";
            min.dispatchEvent(new Event("input", { bubbles: true }));
            min.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (max) {
            max.value = "600";
            max.dispatchEvent(new Event("input", { bubbles: true }));
            max.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });
    await sleep(350);
    await closePanel(page);
    await sleep(350);
}

async function readPanelState(page) {
    return page.evaluate(() => {
        const countText = document.getElementById("lunar-crater-count-value")?.textContent?.trim() || "";
        const countMatch = countText.match(/([0-9][0-9,]*)/);
        const filteredCount = countMatch ? Number(countMatch[1].replace(/,/g, "")) : null;
        const scenes = window.animationScenes || {};
        const sceneKeys = Object.keys(scenes);
        const scene = scenes.lunar || scenes.geo || (sceneKeys.length ? scenes[sceneKeys[0]] : null);
        const typeFilters = scene?.lunarFeatureTypeFilters && typeof scene.lunarFeatureTypeFilters === "object"
            ? scene.lunarFeatureTypeFilters
            : {};
        const sortedTypeFilterSignature = JSON.stringify(
            Object.keys(typeFilters)
                .sort()
                .map((key) => [key, typeFilters[key]]),
        );
        return {
            countText,
            filteredCount,
            globalMinDiameterKm: Number(document.getElementById("lunar-crater-min-diameter")?.value),
            globalMaxDiameterKm: Number(document.getElementById("lunar-crater-max-diameter")?.value),
            viewLunarCraters: document.getElementById("view-lunar-craters")?.checked === true,
            displayMode: document.getElementById("lunar-crater-display-mode")?.value || "",
            sceneFilteredCount: scene?.lunarCraterFilteredCount ?? null,
            sceneRenderedCount: scene?.lunarCraterRenderedCount ?? null,
            sceneDisplayMode: scene?.lunarCraterDisplayMode ?? null,
            sceneGroupChildren: scene?.lunarCraterGroup?.children?.length ?? null,
            sceneGroupVisible: scene?.lunarCraterGroup?.visible === true,
            typeFilterSignature: sortedTypeFilterSignature,
        };
    });
}

async function captureMoon(page, filePath) {
    await page.screenshot({ path: filePath, fullPage: false });
}

async function main() {
    ensureDir(OUTPUT_ROOT);
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-dev-shm-usage",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
        ],
    });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();

    const results = [];
    let stepIndex = 0;

    const runStep = async ({
        name,
        prepare = null,
        action,
        expectVisualChange = false,
        minDiffRatio = 0.00025,
        expectCountDelta = null,
        validate = null,
    }) => {
        stepIndex += 1;
        const id = `${String(stepIndex).padStart(3, "0")}-${slugify(name)}`;
        const beforePath = path.join(OUTPUT_ROOT, `${id}-moon-before.png`);
        const afterPath = path.join(OUTPUT_ROOT, `${id}-moon-after.png`);
        const diffPath = path.join(OUTPUT_ROOT, `${id}-moon-diff.png`);

        await configureBaseline(page);
        if (typeof prepare === "function") {
            await prepare();
        }
        await closePanel(page);
        await sleep(250);

        await captureMoon(page, beforePath);

        await openPanel(page);
        const beforeState = await readPanelState(page);
        const beforeCount = parseCountText(beforeState.countText);
        await action();
        await sleep(600);
        const afterStateWhileOpen = await readPanelState(page);
        const afterCount = parseCountText(afterStateWhileOpen.countText);
        await closePanel(page);
        await sleep(350);

        await captureMoon(page, afterPath);
        const diffStats = computeDiffStats(beforePath, afterPath, diffPath);
        const visualChanged = diffStats.diffRatio >= minDiffRatio;
        const countDelta = Number.isFinite(beforeCount) && Number.isFinite(afterCount)
            ? afterCount - beforeCount
            : null;
        const countExpectationMet = expectCountDelta === null
            ? true
            : expectCountDelta === "decrease"
                ? (Number.isFinite(countDelta) && countDelta < 0)
                : expectCountDelta === "increase"
                    ? (Number.isFinite(countDelta) && countDelta > 0)
                    : expectCountDelta === "change"
                        ? (Number.isFinite(countDelta) && countDelta !== 0)
                        : true;
        const visualExpectationMet = expectVisualChange ? visualChanged : true;
        const stateChanged =
            beforeState.viewLunarCraters !== afterStateWhileOpen.viewLunarCraters ||
            beforeState.displayMode !== afterStateWhileOpen.displayMode ||
            beforeState.filteredCount !== afterStateWhileOpen.filteredCount ||
            beforeState.globalMinDiameterKm !== afterStateWhileOpen.globalMinDiameterKm ||
            beforeState.globalMaxDiameterKm !== afterStateWhileOpen.globalMaxDiameterKm ||
            beforeState.sceneFilteredCount !== afterStateWhileOpen.sceneFilteredCount ||
            beforeState.sceneRenderedCount !== afterStateWhileOpen.sceneRenderedCount ||
            beforeState.sceneDisplayMode !== afterStateWhileOpen.sceneDisplayMode ||
            beforeState.sceneGroupChildren !== afterStateWhileOpen.sceneGroupChildren ||
            beforeState.sceneGroupVisible !== afterStateWhileOpen.sceneGroupVisible ||
            beforeState.typeFilterSignature !== afterStateWhileOpen.typeFilterSignature;
        const customValidation = typeof validate === "function"
            ? validate({ beforeState, afterState: afterStateWhileOpen, countDelta, visualChanged })
            : { ok: true, reason: "" };
        const pass = visualExpectationMet && (countExpectationMet || stateChanged) && customValidation.ok;

        results.push({
            step: stepIndex,
            name,
            before: beforePath,
            after: afterPath,
            diff: diffPath,
            beforeState,
            afterState: afterStateWhileOpen,
            beforeCount,
            afterCount,
            countDelta,
            expectCountDelta,
            expectVisualChange,
            diffPixels: diffStats.diffPixels,
            totalPixels: diffStats.totalPixels,
            diffRatio: diffStats.diffRatio,
            status: pass ? "passed" : "failed",
            stateChanged,
            failureReason: pass
                ? ""
                : (customValidation.reason ||
                    `visualChanged=${visualChanged} (need ${expectVisualChange}), countDelta=${countDelta} (expect ${expectCountDelta}), stateChanged=${stateChanged}`),
        });
    };

    try {
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120000 });
        await page.waitForSelector("#toggle-pill-lunar-craters", { timeout: 60000 });
        await sleep(1600);
        await setMoonFraming(page);

        await runStep({
            name: "Mode Off",
            action: async () => { await page.locator("#lunar-crater-off-toggle").click({ force: true }); },
            expectVisualChange: true,
            validate: ({ afterState }) => ({
                ok: afterState.viewLunarCraters === false,
                reason: "Mode Off did not disable lunar feature visibility.",
            }),
        });
        await runStep({
            name: "Mode Show Always",
            prepare: async () => {
                await openPanel(page);
                await page.locator("#lunar-crater-off-toggle").click({ force: true });
                await closePanel(page);
            },
            action: async () => { await page.locator("#lunar-crater-visible-toggle").click({ force: true }); },
            expectVisualChange: true,
            validate: ({ afterState }) => ({
                ok: afterState.viewLunarCraters === true && afterState.displayMode === "always",
                reason: "Mode Show Always did not set expected visibility/mode.",
            }),
        });
        await runStep({
            name: "Mode Show On Hover",
            action: async () => { await page.locator("#lunar-crater-hover-toggle").click({ force: true }); },
            validate: ({ afterState }) => ({
                ok: afterState.viewLunarCraters === true && afterState.displayMode === "hover",
                reason: "Mode Show On Hover did not set expected visibility/mode.",
            }),
        });

        await runStep({
            name: "Preset Interesting",
            action: async () => {
                await page.locator('#lunar-crater-controls-panel [data-preset-id="interesting"]').click({ force: true });
            },
            expectCountDelta: "decrease",
        });
        await runStep({
            name: "Preset No Craters",
            action: async () => {
                await page.locator('#lunar-crater-controls-panel [data-preset-id="non_crater"]').click({ force: true });
            },
            expectCountDelta: "decrease",
        });
        await runStep({
            name: "Preset Craters Only",
            prepare: async () => {
                await openPanel(page);
                await page.locator('#lunar-crater-controls-panel [data-preset-id="non_crater"]').click({ force: true });
                await sleep(250);
                await closePanel(page);
            },
            action: async () => {
                await page.locator('#lunar-crater-controls-panel [data-preset-id="craters_only"]').click({ force: true });
            },
            expectCountDelta: "increase",
        });
        await runStep({
            name: "Preset All",
            prepare: async () => {
                await openPanel(page);
                await page.locator('#lunar-crater-controls-panel [data-preset-id="craters_only"]').click({ force: true });
                await sleep(250);
                await closePanel(page);
            },
            action: async () => {
                await page.locator('#lunar-crater-controls-panel [data-preset-id="all"]').click({ force: true });
            },
            expectCountDelta: "increase",
        });

        await runStep({
            name: "Global Min Slider 200",
            action: async () => {
                await page.evaluate(() => {
                    const min = document.getElementById("lunar-crater-min-diameter");
                    if (!min) return;
                    min.value = "200";
                    min.dispatchEvent(new Event("input", { bubbles: true }));
                    min.dispatchEvent(new Event("change", { bubbles: true }));
                });
            },
            expectCountDelta: "decrease",
        });
        await runStep({
            name: "Global Min Step Down",
            prepare: async () => {
                await openPanel(page);
                await page.evaluate(() => {
                    const min = document.getElementById("lunar-crater-min-diameter");
                    if (!min) return;
                    min.value = "200";
                    min.dispatchEvent(new Event("input", { bubbles: true }));
                    min.dispatchEvent(new Event("change", { bubbles: true }));
                });
                await sleep(250);
                await closePanel(page);
            },
            action: async () => {
                await page.evaluate(() => {
                    document.getElementById("lunar-crater-min-diameter-step-down")?.click();
                });
            },
            expectCountDelta: "increase",
        });
        await runStep({
            name: "Global Min Step Up",
            action: async () => {
                await page.evaluate(() => {
                    document.getElementById("lunar-crater-min-diameter-step-up")?.click();
                });
            },
            expectCountDelta: "decrease",
        });
        await runStep({
            name: "Global Max Slider 120",
            action: async () => {
                await page.evaluate(() => {
                    const max = document.getElementById("lunar-crater-max-diameter");
                    if (!max) return;
                    max.value = "120";
                    max.dispatchEvent(new Event("input", { bubbles: true }));
                    max.dispatchEvent(new Event("change", { bubbles: true }));
                });
            },
            expectCountDelta: "decrease",
        });
        await runStep({
            name: "Global Max Step Up",
            prepare: async () => {
                await openPanel(page);
                await page.evaluate(() => {
                    const max = document.getElementById("lunar-crater-max-diameter");
                    if (!max) return;
                    max.value = "120";
                    max.dispatchEvent(new Event("input", { bubbles: true }));
                    max.dispatchEvent(new Event("change", { bubbles: true }));
                });
                await sleep(250);
                await closePanel(page);
            },
            action: async () => {
                await page.evaluate(() => {
                    document.getElementById("lunar-crater-max-diameter-step-up")?.click();
                });
            },
            expectCountDelta: "increase",
        });
        await runStep({
            name: "Global Max Step Down",
            action: async () => {
                await page.evaluate(() => {
                    document.getElementById("lunar-crater-max-diameter-step-down")?.click();
                });
            },
            expectCountDelta: "decrease",
        });

        await openPanel(page);
        const featureTypes = await page.$$eval(
            "#lunar-crater-controls-panel .lunar-crater-controls-panel__type-row",
            (rows) =>
                rows
                    .map((row) => row.getAttribute("data-feature-type"))
                    .filter((value) => typeof value === "string" && value.length > 0),
        );
        await closePanel(page);

        for (const featureType of featureTypes) {
            await runStep({
                name: `Type Toggle ${featureType}`,
                action: async () => {
                    await setTypeChecked(page, featureType, false);
                },
                expectCountDelta: "decrease",
            });

            await runStep({
                name: `Type Min ${featureType}`,
                action: async () => {
                    await setTypeMin(page, featureType, 10000);
                },
                expectCountDelta: "decrease",
            });

            await runStep({
                name: `Type Max ${featureType}`,
                action: async () => {
                    await setTypeMax(page, featureType, 1);
                },
                expectCountDelta: "decrease",
            });
        }

        await runStep({
            name: "Group Mare Only Show Always",
            action: async () => {
                await page.locator('#lunar-crater-controls-panel [data-preset-id="all"]').click({ force: true });
                await sleep(250);
                await page.evaluate(() => {
                    const rows = Array.from(
                        document.querySelectorAll("#lunar-crater-controls-panel .lunar-crater-controls-panel__type-row"),
                    );
                    for (const row of rows) {
                        const type = row.getAttribute("data-feature-type");
                        const checkbox = row.querySelector(".lunar-crater-controls-panel__type-toggle");
                        if (!checkbox) continue;
                        checkbox.checked = type === "Mare, maria";
                        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
                await page.locator("#lunar-crater-visible-toggle").click({ force: true });
            },
            expectCountDelta: "decrease",
        });

        await runStep({
            name: "Close Button",
            action: async () => {
                await page.locator("#lunar-crater-close").click({ force: true });
                await page.waitForFunction(() => {
                    const panel = document.getElementById("lunar-crater-controls-panel");
                    return !!panel && panel.hidden === true;
                });
                await openPanel(page);
            },
            expectVisualChange: false,
            expectCountDelta: null,
        });

        const failed = results.filter((entry) => entry.status !== "passed");
        const report = {
            baseUrl: BASE_URL,
            outputRoot: OUTPUT_ROOT,
            total: results.length,
            passed: results.length - failed.length,
            failed: failed.length,
            failures: failed.map(({ step, name, failureReason }) => ({ step, name, failureReason })),
            tests: results,
        };
        const reportPath = path.join(OUTPUT_ROOT, "report.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

        console.log(`Lunar feature panel audit complete: ${reportPath}`);
        if (failed.length > 0) {
            console.log(`Failures: ${failed.length}`);
            process.exitCode = 2;
        } else {
            console.log("All tests passed.");
        }
    } finally {
        await context.close();
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
