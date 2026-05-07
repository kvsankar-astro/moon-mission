import { afterEach, describe, expect, it, vi } from "vitest";

import {
    AuxiliaryCameraViewsManager,
    AUXILIARY_VIEW_CAMERA_PRESETS,
    composerRollDialKnobOffset,
    normalizeComposerRollRad,
    resolveLunarFlybyWindowMs,
    rollRadFromDialPointer,
    selectComposerSkyLabelCandidates,
} from "../src/platform/js/app/auxiliary-camera-views.js";
import { LIGHT_SETTINGS as LT } from "../src/platform/js/core/constants.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AUXILIARY_VIEW_CAMERA_PRESETS", () => {
    it("exposes the three desktop auxiliary view semantics for mobile reuse", () => {
        expect(AUXILIARY_VIEW_CAMERA_PRESETS).toEqual([
            {
                id: "earth",
                label: "Craft \u2192 Earth",
                positionMode: "spacecraft",
                lookMode: "earth",
            },
            {
                id: "moon",
                label: "Craft \u2192 Moon",
                positionMode: "spacecraft",
                lookMode: "moon",
            },
            {
                id: "earth-to-moon",
                label: "Earth \u2192 Moon",
                positionMode: "earth",
                lookMode: "moon",
            },
        ]);
    });
});

describe("resolveLunarFlybyWindowMs", () => {
    it("returns SOI entry/exit bounds when present in mission events", () => {
        const paddingMs = 5 * 60 * 1000;
        const startMs = Date.UTC(2026, 3, 6, 4, 43, 12);
        const endMs = Date.UTC(2026, 3, 7, 17, 27, 12);
        const window = resolveLunarFlybyWindowMs([
            {
                key: "lunarSoiEntry",
                label: "Lunar SOI In",
                startTime: new Date(startMs),
            },
            {
                key: "closestApproach",
                label: "Lunar Flyby",
                startTime: new Date(Date.UTC(2026, 3, 6, 23, 6, 12)),
            },
            {
                key: "lunarSoiExit",
                label: "Lunar SOI Out",
                startTime: new Date(endMs),
            },
        ]);

        expect(window.startMs).toBe(startMs - paddingMs);
        expect(window.endMs).toBe(endMs + paddingMs);
    });

    it("returns NaN bounds when SOI entry/exit events are missing", () => {
        const window = resolveLunarFlybyWindowMs([
            {
                key: "closestApproach",
                label: "Lunar Flyby",
                startTime: new Date(Date.UTC(2026, 3, 6, 23, 6, 12)),
            },
        ]);

        expect(Number.isNaN(window.startMs)).toBe(true);
        expect(Number.isNaN(window.endMs)).toBe(true);
    });
});

describe("Frame and Shoot roll dial math", () => {
    it("normalizes roll angles into one positive turn", () => {
        expect(normalizeComposerRollRad(0)).toBe(0);
        expect(normalizeComposerRollRad(Math.PI * 2)).toBe(0);
        expect(normalizeComposerRollRad(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5);
    });

    it("maps dial pointer positions with 0 degrees at the top and clockwise positive", () => {
        const center = { centerX: 100, centerY: 100 };

        expect(rollRadFromDialPointer({ ...center, pointerX: 100, pointerY: 80 })).toBeCloseTo(0);
        expect(rollRadFromDialPointer({ ...center, pointerX: 120, pointerY: 100 })).toBeCloseTo(Math.PI / 2);
        expect(rollRadFromDialPointer({ ...center, pointerX: 100, pointerY: 120 })).toBeCloseTo(Math.PI);
        expect(rollRadFromDialPointer({ ...center, pointerX: 80, pointerY: 100 })).toBeCloseTo(Math.PI * 1.5);
    });

    it("places the roll knob on the same polar convention", () => {
        expect(composerRollDialKnobOffset(0, 18)).toEqual({ x: 0, y: -18 });
        expect(composerRollDialKnobOffset(Math.PI / 2, 18).x).toBeCloseTo(18);
        expect(composerRollDialKnobOffset(Math.PI / 2, 18).y).toBeCloseTo(0);
    });
});

describe("selectComposerSkyLabelCandidates", () => {
    it("selects the brightest 20 percent of projected in-view stars", () => {
        const candidates = [
            { text: "dim", magnitude: 5, point: { x: 10, y: 10 } },
            { text: "brightest", magnitude: -1, point: { x: 20, y: 20 } },
            { text: "mid", magnitude: 2, point: { x: 30, y: 30 } },
            { text: "bright", magnitude: 0, point: { x: 40, y: 40 } },
            { text: "faint", magnitude: 4, point: { x: 50, y: 50 } },
            { text: "middle", magnitude: 3, point: { x: 60, y: 60 } },
            { text: "fainter", magnitude: 4.5, point: { x: 70, y: 70 } },
            { text: "middim", magnitude: 3.5, point: { x: 80, y: 80 } },
            { text: "barely", magnitude: 5.5, point: { x: 90, y: 90 } },
            { text: "very dim", magnitude: 6, point: { x: 100, y: 100 } },
        ];

        expect(selectComposerSkyLabelCandidates(candidates).map((candidate) => candidate.text)).toEqual([
            "brightest",
            "bright",
        ]);
    });

    it("ignores non-projectable candidates and respects the label cap", () => {
        const candidates = [
            { text: "bad point", magnitude: -2, point: { x: Number.NaN, y: 10 } },
            { text: "", magnitude: -1, point: { x: 10, y: 10 } },
            { text: "A", magnitude: 0, point: { x: 10, y: 10 } },
            { text: "B", magnitude: 1, point: { x: 10, y: 10 } },
            { text: "C", magnitude: 2, point: { x: 10, y: 10 } },
        ];

        expect(
            selectComposerSkyLabelCandidates(candidates, {
                visibleFraction: 1,
                maxCount: 2,
            }).map((candidate) => candidate.text),
        ).toEqual(["A", "B"]);
    });
});

describe("Frame and Shoot body ambient controls", () => {
    function createManagerForAmbientTests() {
        return Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            THREE: {
                MathUtils: {
                    clamp(value, min, max) {
                        return Math.min(Math.max(value, min), max);
                    },
                },
            },
        });
    }

    function createBodyWithMaterial(material) {
        return {
            traverse(callback) {
                callback({
                    isMesh: true,
                    material,
                });
            },
        };
    }

    it("applies Earth ambient to the Earth nightside shader uniform", () => {
        const manager = createManagerForAmbientTests();
        const material = {
            map: {},
            userData: {
                earthNightsideLift: 0,
            },
        };
        const uniform = { value: 0 };
        material.userData.refreshEarthShaderUniforms = () => {
            uniform.value = material.userData.earthNightsideLift;
        };

        const restore = manager.applyComposerBodyAmbientLighting({
            panelState: {
                composerEarthAmbient: 1.25,
                composerMoonAmbient: 0,
                composerEarthshineGain: 2.4,
            },
            earth: createBodyWithMaterial(material),
        });

        expect(material.userData.earthNightsideLift).toBeCloseTo(1.25, 6);
        expect(uniform.value).toBeCloseTo(1.25, 6);

        restore();

        expect(material.userData.earthNightsideLift).toBe(0);
        expect(uniform.value).toBe(0);
    });

    it("applies Frame and Shoot Earth ambient as shared panel-render lighting", () => {
        const manager = createManagerForAmbientTests();
        manager.panels = [
            {
                mode: "composer",
                composerEarthAmbient: 1.75,
                composerMoonAmbient: 0,
                composerMoonshineGain: 0,
            },
        ];
        const material = {
            map: {},
            userData: {
                earthNightsideLift: 0,
            },
        };
        const uniform = { value: 0 };
        material.userData.refreshEarthShaderUniforms = () => {
            uniform.value = material.userData.earthNightsideLift;
        };

        const restore = manager.applySharedComposerBodyAmbientLighting({
            earth: createBodyWithMaterial(material),
        });

        expect(material.userData.earthNightsideLift).toBeCloseTo(1.75, 6);
        expect(uniform.value).toBeCloseTo(1.75, 6);

        restore();

        expect(material.userData.earthNightsideLift).toBe(0);
        expect(uniform.value).toBe(0);
    });

    it("applies Moonshine gain to the Earth night-side shader as shared panel lighting", () => {
        const manager = createManagerForAmbientTests();
        manager.panels = [
            {
                mode: "composer",
                composerEarthAmbient: 0,
                composerMoonAmbient: 0,
                composerMoonshineGain: 2,
            },
        ];
        const material = {
            map: {},
            userData: {
                earthNightsideLift: 0,
                earthMoonshineLift: 0,
            },
        };
        const uniforms = {
            ambient: 0,
            moonshine: 0,
        };
        material.userData.refreshEarthShaderUniforms = () => {
            uniforms.ambient = material.userData.earthNightsideLift;
            uniforms.moonshine = material.userData.earthMoonshineLift;
        };

        const restore = manager.applySharedComposerBodyAmbientLighting({
            earth: createBodyWithMaterial(material),
        });

        expect(material.userData.earthNightsideLift).toBe(0);
        const expectedMoonshineLift = 2 * 0.65 * LT.MOONSHINE_TO_EARTHSHINE_INTENSITY_RATIO;
        expect(material.userData.earthMoonshineLift).toBeCloseTo(expectedMoonshineLift, 6);
        expect(uniforms.ambient).toBe(0);
        expect(uniforms.moonshine).toBeCloseTo(expectedMoonshineLift, 6);

        restore();

        expect(material.userData.earthNightsideLift).toBe(0);
        expect(material.userData.earthMoonshineLift).toBe(0);
        expect(uniforms.ambient).toBe(0);
        expect(uniforms.moonshine).toBe(0);
    });

    it("keeps Moon artificial ambient at zero when the Moon Ambient slider is zero", () => {
        const manager = createManagerForAmbientTests();
        const material = {
            map: {},
            userData: {
                moonShadowLift: 0.42,
            },
        };
        const uniform = { value: 0.42 };
        material.userData.refreshMoonShaderUniforms = () => {
            uniform.value = material.userData.moonShadowLift;
        };

        const restore = manager.applyComposerBodyAmbientLighting({
            panelState: {
                composerEarthAmbient: 0,
                composerMoonAmbient: 0,
                composerEarthshineGain: 2.4,
            },
            moon: createBodyWithMaterial(material),
        });

        expect(material.userData.moonShadowLift).toBe(0);
        expect(uniform.value).toBe(0);

        restore();

        expect(material.userData.moonShadowLift).toBeCloseTo(0.42, 6);
        expect(uniform.value).toBeCloseTo(0.42, 6);
    });
});

describe("Frame and Shoot reflected-light gain controls", () => {
    function createManagerForLightTests() {
        return Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            THREE: {
                MathUtils: {
                    clamp(value, min, max) {
                        return Math.min(Math.max(value, min), max);
                    },
                },
            },
        });
    }

    it("scales Moonshine reflected light during composer renders and restores it", () => {
        const manager = createManagerForLightTests();
        const scene = {
            lightMoonshine: {
                intensity: 0.0005,
            },
        };

        const restore = manager.applyComposerMoonshineGain({
            composerMoonshineGain: 2.4,
        }, scene);

        expect(scene.lightMoonshine.intensity).toBeCloseTo(0.0012, 8);

        restore();

        expect(scene.lightMoonshine.intensity).toBeCloseTo(0.0005, 8);
    });

    it("falls back to the reference Moonshine intensity when the phase light is dark", () => {
        const manager = createManagerForLightTests();
        const scene = {
            lightMoonshine: {
                intensity: 0,
            },
        };

        const restore = manager.applyComposerMoonshineGain({
            composerMoonshineGain: 1,
        }, scene);

        expect(scene.lightMoonshine.intensity).toBeGreaterThan(0);

        restore();

        expect(scene.lightMoonshine.intensity).toBe(0);
    });
});

describe("Auxiliary visible panel refresh scheduling", () => {
    it("refreshes all visible panels after shared composer controls change", () => {
        let rafCallback = null;
        vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
            rafCallback = callback;
            return 17;
        }));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());

        const visibleEarthPanel = { panel: { hidden: false }, viewport: {} };
        const hiddenMoonPanel = { panel: { hidden: true }, viewport: {} };
        const visibleComposerPanel = { panel: { hidden: false }, viewport: {} };
        const manager = Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            panels: [visibleEarthPanel, hiddenMoonPanel, visibleComposerPanel],
            visiblePanelsRefreshRaf: null,
            requestRender: vi.fn(),
            syncPanelSize: vi.fn(),
        });

        manager.scheduleVisiblePanelsRefresh();

        expect(manager.requestRender).not.toHaveBeenCalled();

        rafCallback();

        expect(manager.syncPanelSize).toHaveBeenCalledWith(visibleEarthPanel);
        expect(manager.syncPanelSize).toHaveBeenCalledWith(visibleComposerPanel);
        expect(manager.syncPanelSize).not.toHaveBeenCalledWith(hiddenMoonPanel);
        expect(manager.requestRender).toHaveBeenCalledTimes(1);
    });
});
