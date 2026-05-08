import { afterEach, describe, expect, it, vi } from "vitest";

import {
    AuxiliaryCameraViewsManager,
    AUXILIARY_VIEW_CAMERA_PRESETS,
    computeComposerDragSensitivityScale,
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

describe("Frame and Shoot drag sensitivity math", () => {
    it("keeps default FoV drag at the existing sensitivity", () => {
        expect(computeComposerDragSensitivityScale(50)).toBeCloseTo(1, 8);
    });

    it("reduces drag sensitivity at narrow FoV values", () => {
        const scaleAtOneDegree = computeComposerDragSensitivityScale(1);
        const expectedScale = Math.tan((1 * Math.PI / 180) * 0.5) /
            Math.tan((50 * Math.PI / 180) * 0.5);

        expect(scaleAtOneDegree).toBeCloseTo(expectedScale, 8);
        expect(scaleAtOneDegree).toBeLessThan(0.02);
    });

    it("continues tapering drag sensitivity for crater-scale FoV values", () => {
        const scaleAtTenthDegree = computeComposerDragSensitivityScale(0.1);
        const expectedScale = Math.tan((0.1 * Math.PI / 180) * 0.5) /
            Math.tan((50 * Math.PI / 180) * 0.5);

        expect(scaleAtTenthDegree).toBeCloseTo(expectedScale, 8);
        expect(scaleAtTenthDegree).toBeLessThan(0.002);
    });

    it("does not increase drag sensitivity beyond the legacy wide-FoV feel", () => {
        expect(computeComposerDragSensitivityScale(120)).toBe(1);
        expect(computeComposerDragSensitivityScale(Number.NaN)).toBe(1);
    });
});

describe("Frame and Shoot FoV bounds", () => {
    it("allows manual crater-scale FoV down to a tenth of a degree", () => {
        const updates = [];
        const position = { x: 12, y: 34, z: 56 };
        const manager = Object.create(AuxiliaryCameraViewsManager.prototype);
        const panelState = {
            camera: {
                fov: 50,
                position,
                updateProjectionMatrix: vi.fn(() => updates.push("projection")),
            },
            fovControl: {
                setFovDegrees: vi.fn(),
            },
            overlayDirty: false,
        };

        manager.setPanelFov(panelState, 0.1);

        expect(panelState.camera.fov).toBe(0.1);
        expect(panelState.camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
        expect(panelState.overlayDirty).toBe(true);
        expect(panelState.fovControl.setFovDegrees).toHaveBeenCalledWith(0.1, 0.1);
        expect(panelState.camera.position).toBe(position);
        expect(panelState.camera.position).toEqual({ x: 12, y: 34, z: 56 });
        expect(updates).toEqual(["projection"]);
    });

    it("clamps Frame and Shoot FoV below a tenth of a degree", () => {
        const manager = Object.create(AuxiliaryCameraViewsManager.prototype);
        const panelState = {
            camera: {
                fov: 50,
                updateProjectionMatrix: vi.fn(),
            },
            fovControl: {
                setFovDegrees: vi.fn(),
            },
            overlayDirty: false,
        };

        manager.setPanelFov(panelState, 0.01);

        expect(panelState.camera.fov).toBe(0.1);
        expect(panelState.fovControl.setFovDegrees).toHaveBeenCalledWith(0.1, 0.1);
    });
});

describe("Frame and Shoot lock target FoV behavior", () => {
    function createLockTargetHarness({ lockTarget = "moon", autoFovEnabled = false } = {}) {
        const panelState = {
            mode: "composer",
            composerInteractionEnabled: true,
            composerLockTarget: lockTarget,
            autoFovEnabled,
        };
        const manager = Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            activateComposerWindow: vi.fn(),
            queuePersistPanelState: vi.fn(),
            requestRender: vi.fn(),
        });
        const syncComposerLockUi = vi.fn();
        const syncAutoToggleUi = vi.fn();
        return {
            manager,
            panelState,
            syncComposerLockUi,
            syncAutoToggleUi,
        };
    }

    it("re-enables auto FoV when switching between Earth and Moon locks", () => {
        const {
            manager,
            panelState,
            syncComposerLockUi,
            syncAutoToggleUi,
        } = createLockTargetHarness({
            lockTarget: "moon",
            autoFovEnabled: false,
        });

        manager.setComposerLockTarget(panelState, "earth", {
            syncComposerLockUi,
            syncAutoToggleUi,
        });

        expect(panelState.composerLockTarget).toBe("earth");
        expect(panelState.autoFovEnabled).toBe(true);
        expect(syncAutoToggleUi).toHaveBeenCalledTimes(1);
        expect(syncComposerLockUi).toHaveBeenCalledTimes(1);
        expect(manager.requestRender).toHaveBeenCalledTimes(1);
    });

    it("does not discard a manual crater-scale FoV when re-clicking the same body lock", () => {
        const {
            manager,
            panelState,
            syncAutoToggleUi,
        } = createLockTargetHarness({
            lockTarget: "moon",
            autoFovEnabled: false,
        });

        manager.setComposerLockTarget(panelState, "moon", {
            syncAutoToggleUi,
        });

        expect(panelState.composerLockTarget).toBe("moon");
        expect(panelState.autoFovEnabled).toBe(false);
        expect(syncAutoToggleUi).not.toHaveBeenCalled();
    });
});

describe("Frame and Shoot local event time formatting", () => {
    it("shows available event precision down to seconds", () => {
        const manager = Object.create(AuxiliaryCameraViewsManager.prototype);

        const formatted = manager.formatLocalDateTime(Date.UTC(2026, 3, 1, 12, 34, 56));

        expect(formatted).toMatch(/\d{2}:\d{2}:56/);
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

describe("Frame and Shoot constellation line rendering", () => {
    function createManagerForExposureTests() {
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

    it("temporarily enables the sky constellation layer only when the composer checkbox is on", () => {
        const manager = createManagerForExposureTests();
        const panelState = {
            mode: "composer",
            renderer: { toneMappingExposure: 1 },
            composerSunProfile: "camera",
            composerSunStrength: 1,
            composerSunHaloGain: 1,
            composerSunStarburstGain: 1,
            composerSunFlareGain: 1,
            composerEarthshineGain: 1,
            composerStarMagnitudeLimit: 6,
            composerConstellationLinesEnabled: true,
        };
        const skyRenderer = {
            container: { visible: false },
            skyMesh: { material: { opacity: 0.18 } },
            constellationMesh: {
                visible: false,
                material: { opacity: 0.06 },
            },
        };

        const restore = manager.applyComposerExposureProfile({}, panelState, null, { skyRenderer });

        expect(skyRenderer.container.visible).toBe(true);
        expect(skyRenderer.constellationMesh.visible).toBe(true);
        expect(skyRenderer.constellationMesh.material.opacity).toBeCloseTo(0.06);

        restore();

        expect(skyRenderer.container.visible).toBe(false);
        expect(skyRenderer.constellationMesh.visible).toBe(false);
        expect(skyRenderer.constellationMesh.material.opacity).toBeCloseTo(0.06);
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

describe("Frame and Shoot timeline phase tracking", () => {
    const phases = [
        {
            id: "launch",
            label: "Launch & Earth Orbit",
            startMs: 0,
            endMs: 100,
            events: [{ key: "launch" }, { key: "solarArrays" }],
        },
        {
            id: "lunar",
            label: "Lunar Flyby",
            startMs: 100,
            endMs: 200,
            events: [{ key: "lunarSoiEntry" }, { key: "closestApproach" }],
        },
    ];

    function createTimelineHarness() {
        const manager = Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            THREE: {
                MathUtils: {
                    clamp(value, min, max) {
                        return Math.min(Math.max(value, min), max);
                    },
                },
            },
            composerTimelinePhases: phases,
            composerSelectedPhaseIndex: -1,
            composerActivePhaseIndex: -1,
            composerFlybyEvents: [],
            readMainTimelineState: vi.fn(),
            syncComposerTransportUi: vi.fn(),
            syncComposerPhaseSelect: vi.fn(),
            setComposerInteractionEnabled: vi.fn(),
            setComposerTimelineLocalText: vi.fn(),
            syncComposerFlybyEventPills: vi.fn(),
        });
        const panelState = {
            composerTimelineSlider: { value: "" },
            composerTimelineLabel: { textContent: "" },
            composerTimelineDragging: false,
        };
        return { manager, panelState };
    }

    it("does not permanently pin the first rendered phase before the composer seek lands", () => {
        const { manager, panelState } = createTimelineHarness();
        manager.readMainTimelineState.mockReturnValue({
            min: 0,
            max: 200,
            value: 50,
            stepMs: 1,
        });

        manager.syncComposerTimelineUi(panelState);

        expect(manager.composerActivePhaseIndex).toBe(0);
        expect(manager.composerSelectedPhaseIndex).toBe(-1);

        manager.readMainTimelineState.mockReturnValue({
            min: 0,
            max: 200,
            value: 150,
            stepMs: 1,
        });
        manager.syncComposerTimelineUi(panelState);

        expect(manager.composerActivePhaseIndex).toBe(1);
        expect(manager.composerSelectedPhaseIndex).toBe(-1);
        expect(manager.composerFlybyEvents.map((eventInfo) => eventInfo.key)).toEqual([
            "lunarSoiEntry",
            "closestApproach",
        ]);
    });

    it("clears an explicit phase selection after the timeline moves outside it", () => {
        const { manager, panelState } = createTimelineHarness();
        manager.composerSelectedPhaseIndex = 0;
        manager.readMainTimelineState.mockReturnValue({
            min: 0,
            max: 200,
            value: 150,
            stepMs: 1,
        });

        manager.syncComposerTimelineUi(panelState);

        expect(manager.composerSelectedPhaseIndex).toBe(-1);
        expect(manager.composerActivePhaseIndex).toBe(1);
    });
});

describe("Frame and Shoot event pill highlighting", () => {
    class FakeElement {
        constructor(tagName = "div") {
            this.tagName = tagName;
            this.children = [];
            this.className = "";
            this.textContent = "";
            this.attributes = {};
            this.listeners = new Map();
            this.classList = {
                add: (...names) => {
                    const values = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const name of names) values.add(name);
                    this.className = Array.from(values).join(" ");
                },
                remove: (...names) => {
                    const values = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const name of names) values.delete(name);
                    this.className = Array.from(values).join(" ");
                },
                contains: (name) => this.className.split(/\s+/).filter(Boolean).includes(name),
                toggle: (name, enabled) => {
                    if (enabled) {
                        this.classList.add(name);
                        return true;
                    }
                    this.classList.remove(name);
                    return false;
                },
            };
        }

        appendChild(child) {
            this.children.push(child);
            return child;
        }

        replaceChildren(...children) {
            this.children = children;
        }

        setAttribute(name, value) {
            this.attributes[name] = String(value);
        }

        addEventListener(type, handler) {
            const handlers = this.listeners.get(type) || [];
            handlers.push(handler);
            this.listeners.set(type, handlers);
        }
    }

    function createHarness() {
        vi.stubGlobal("document", {
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        });

        const manager = Object.assign(Object.create(AuxiliaryCameraViewsManager.prototype), {
            composerActivePhaseIndex: -1,
            composerSelectedPhaseIndex: -1,
            composerFlybyEvents: [
                { key: "e1", title: "Event 1", timeMs: 1000 },
                { key: "e2", title: "Event 2", timeMs: 2000 },
            ],
            formatLocalDateTime: (timeMs) => String(timeMs),
            seekMainTimelineTime: vi.fn(),
            syncComposerTimelineUi: vi.fn(),
            requestRender: vi.fn(),
        });
        const panelState = {
            composerFlybyEventsWrap: new FakeElement(),
            composerFlybyEventsSignature: "",
            composerFlybyEventNodes: [],
            composerFlybySelectedEventTimeMs: Number.NaN,
        };
        return { manager, panelState };
    }

    it("shows dashed boundaries for the two surrounding events between event times", () => {
        const { manager, panelState } = createHarness();

        manager.syncComposerFlybyEventPills(panelState, 1500);

        expect(panelState.composerFlybyEventNodes[0].element.classList.contains("is-boundary")).toBe(true);
        expect(panelState.composerFlybyEventNodes[1].element.classList.contains("is-boundary")).toBe(true);
        expect(panelState.composerFlybyEventNodes[0].element.classList.contains("is-active")).toBe(false);
        expect(panelState.composerFlybyEventNodes[1].element.classList.contains("is-active")).toBe(false);
    });

    it("uses the solid active pill only on an exact event time", () => {
        const { manager, panelState } = createHarness();

        manager.syncComposerFlybyEventPills(panelState, 1000);

        expect(panelState.composerFlybyEventNodes[0].element.classList.contains("is-active")).toBe(true);
        expect(panelState.composerFlybyEventNodes[0].element.classList.contains("is-boundary")).toBe(false);
        expect(panelState.composerFlybyEventNodes[1].element.classList.contains("is-active")).toBe(false);
        expect(panelState.composerFlybyEventNodes[1].element.classList.contains("is-boundary")).toBe(false);
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
