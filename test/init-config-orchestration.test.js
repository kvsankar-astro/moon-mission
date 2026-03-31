import { describe, expect, it, vi } from "vitest";

import { createInitConfigOrchestrationActions } from "../src/platform/js/app/init-config-orchestration.js";

function buildDeps(overrides = {}) {
    let globalConfig = null;
    return {
        loadMissionConfig: vi.fn(async () => ({
            ui: {
                viewDefaults: {
                    viewXYZAxes: false,
                    viewPoles: false,
                },
            },
        })),
        getGlobalConfig: vi.fn(() => globalConfig),
        setGlobalConfig: vi.fn((value) => {
            globalConfig = value;
        }),
        setViewFlags: vi.fn(),
        applyViewSettings: vi.fn(),
        setEventInfos: vi.fn(),
        getEphemerisSource: vi.fn(() => "chebyshev"),
        setEphemerisSource: vi.fn(),
        setBodyEphemerisSources: vi.fn(),
        setEphemerisStatusesForConfig: vi.fn(),
        bindInfoPanelControls: vi.fn(),
        updateEphemerisPanel: vi.fn(),
        applyMissionMetadata: vi.fn(),
        getPlanetProperties: vi.fn(() => ({})),
        documentRef: {},
        updateMultipleElementsText: vi.fn(),
        updateSpacecraftMnemonic: vi.fn(),
        updateMoonUIFromConfig: vi.fn(),
        updateLandingUIFromConfig: vi.fn(),
        applyLandingTimesUpdate: vi.fn(),
        computeLandingTimesUpdate: vi.fn(() => ({})),
        createUTCTimestamp: vi.fn(),
        setStartLandingTime: vi.fn(),
        setEndLandingTime: vi.fn(),
        consoleRef: { debug: vi.fn() },
        applyEventsUpdate: vi.fn(),
        computeEventsUpdate: vi.fn(() => ({ shouldUpdate: false })),
        getConfig: vi.fn(() => "geo"),
        getDataEndTimeMs: vi.fn(() => 0),
        computeMissionEventTimes: vi.fn(() => ({})),
        setTimeTransLunarInjection: vi.fn(),
        setTimeLunarOrbitInsertion: vi.fn(),
        getSceneHandler: vi.fn(() => null),
        setSceneHandler: vi.fn(),
        SceneHandlerClass: class {},
        loadProgress: null,
        ...overrides,
    };
}

describe("createInitConfigOrchestrationActions", () => {
    it("applies mission-config view defaults when config loads", async () => {
        const deps = buildDeps();
        const actions = createInitConfigOrchestrationActions(deps);

        await actions.ensureGlobalConfigLoaded();

        expect(deps.setViewFlags).toHaveBeenCalledWith({
            viewXYZAxes: false,
            viewPoles: false,
        });
        expect(deps.applyViewSettings).toHaveBeenCalledWith({
            viewXYZAxes: false,
            viewPoles: false,
        });
    });

    it("does not apply view defaults when config omits them", async () => {
        const deps = buildDeps({
            loadMissionConfig: vi.fn(async () => ({ ui: {} })),
        });
        const actions = createInitConfigOrchestrationActions(deps);

        await actions.ensureGlobalConfigLoaded();

        expect(deps.setViewFlags).not.toHaveBeenCalled();
        expect(deps.applyViewSettings).not.toHaveBeenCalled();
    });

    it("forces moon visual aids off in test mode", async () => {
        const deps = buildDeps({
            isTestMode: true,
            loadMissionConfig: vi.fn(async () => ({
                ui: {
                    viewDefaults: {
                        viewMoonHighlightRing: true,
                        viewMoonOsculatingOrbit: true,
                    },
                },
            })),
        });
        const actions = createInitConfigOrchestrationActions(deps);

        await actions.ensureGlobalConfigLoaded();

        expect(deps.setViewFlags).toHaveBeenCalledWith({
            viewMoonHighlightRing: false,
            viewMoonOsculatingOrbit: false,
        });
        expect(deps.applyViewSettings).toHaveBeenCalledWith({
            viewMoonHighlightRing: false,
            viewMoonOsculatingOrbit: false,
        });
    });
});
