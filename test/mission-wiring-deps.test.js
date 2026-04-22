import { describe, expect, it, vi } from "vitest";
import {
    createDataflowWiringDeps,
    createInitConfigFlowDeps,
    createInitConfigWiringDeps,
    createMissionWiringContext,
    createSceneFrameWiringDeps,
    createViewSettingsWiringDeps,
} from "../src/platform/js/app/mission-wiring-deps.js";

describe("createMissionWiringContext", () => {
    it("merges explicit ports and flattens structured state slices into one wiring context", () => {
        const ctx = createMissionWiringContext({
            uiPort: { fromUi: true, shared: "ui" },
            renderPort: { fromRender: true },
            dataPort: { fromData: true },
            clockPort: { fromClock: true },
            statePort: {
                app: { fromState: true, shared: "state" },
                session: { fromSession: true },
                viewTransform: { fromTransform: true },
            },
        });

        expect(ctx).toMatchObject({
            fromUi: true,
            fromRender: true,
            fromData: true,
            fromClock: true,
            fromState: true,
            fromSession: true,
            fromTransform: true,
            shared: "state",
        });
    });
});

describe("mission wiring dependency builders", () => {
    it("prefers the effective orbit-style accessor when building dataflow deps", () => {
        const getEffectiveOrbitStyle = vi.fn();
        const getOrbitStyle = vi.fn();
        const getStartAndEndTimes = vi.fn();
        const loadProgress = { start: vi.fn() };

        const deps = createDataflowWiringDeps(
            {
                d3: {},
                getEffectiveOrbitStyle,
                getOrbitStyle,
            },
            { getStartAndEndTimes, loadProgress },
        );

        expect(deps.getOrbitStyle).toBe(getEffectiveOrbitStyle);
        expect(deps.getStartAndEndTimes).toBe(getStartAndEndTimes);
        expect(deps.loadProgress).toBe(loadProgress);
    });

    it("threads compare-mode state into dataflow deps", () => {
        const deps = createDataflowWiringDeps(
            {
                d3: {},
                isCompareMode: true,
            },
            { getStartAndEndTimes: vi.fn(), loadProgress: null },
        );

        expect(deps.getIsCompareMode()).toBe(true);
    });

    it("derives init-config helpers from the shared context", () => {
        const getStartAndEndTimes = vi.fn(() => [1000, 2000]);
        const loadProgress = { start: vi.fn() };
        const computeSVGDimensions = vi.fn();
        const getEphemerisSourceFromData = vi.fn();
        const setViewFlags = vi.fn();
        const applyViewSettings = vi.fn();

        const deps = createInitConfigWiringDeps(
            {
                computeSVGDimensions,
                getEphemerisSourceFromData,
                setViewFlags,
                applyViewSettings,
            },
            { getStartAndEndTimes, loadProgress },
        );

        expect(deps.computeSVGDimensions).toBe(computeSVGDimensions);
        expect(deps.getEphemerisSource).toBe(getEphemerisSourceFromData);
        expect(deps.setViewFlags).toBe(setViewFlags);
        expect(deps.applyViewSettings).toBe(applyViewSettings);
        expect(deps.getDataEndTimeMs("CY3")).toBe(2000);
        expect(getStartAndEndTimes).toHaveBeenCalledWith("CY3");
        expect(deps.loadProgress).toBe(loadProgress);
    });

    it("connects init-config flow dependencies to the wiring bundle", () => {
        const animationScene = { id: "geo-scene" };
        const initConfigWiring = {
            initConfigOrchestrationActions: { run: vi.fn() },
            initConfigSceneSetupActions: { setup: vi.fn() },
            initConfigUiActions: { sync: vi.fn() },
        };

        const deps = createInitConfigFlowDeps(
            {
                getConfig: vi.fn(),
                animationScenes: { geo: animationScene },
                AnimationScene: class AnimationScene {},
                shouldSkipInitConfig: vi.fn(),
                applyInitConfigAlreadyInitialized: vi.fn(),
                handleModeSwitchToGeo: vi.fn(),
                handleModeSwitchToLunar: vi.fn(),
                setChecked: vi.fn(),
                normalizePlaneSelection: vi.fn(),
                setPlaneSelectionState: vi.fn(),
                syncPlaneSelectionControls: vi.fn(),
                getGlobalConfig: vi.fn(),
                isRelativeMode: vi.fn(),
                setSceneState: vi.fn(),
                consoleRef: { log: vi.fn() },
            },
            { initConfigWiring },
        );

        expect(deps.getAnimationScene("geo")).toBe(animationScene);
        expect(deps.initConfigOrchestrationActions).toBe(
            initConfigWiring.initConfigOrchestrationActions,
        );
        expect(deps.initConfigSceneSetupActions).toBe(
            initConfigWiring.initConfigSceneSetupActions,
        );
        expect(deps.initConfigUiActions).toBe(initConfigWiring.initConfigUiActions);
    });

    it("injects dataflow helpers into the view-settings wiring deps", () => {
        const initSVG = vi.fn();
        const loadOrbitDataIfNeededAndProcess = vi.fn();
        const handlePlaneChange = vi.fn();
        const adjustLabelLocations = vi.fn();
        const loadProgress = { start: vi.fn() };

        const deps = createViewSettingsWiringDeps(
            {
                d3: {},
                getConfig: vi.fn(),
                animationScenes: {},
                setConfig: vi.fn(),
                AnimationScene: class AnimationScene {},
                initAnimation: vi.fn(),
                readOriginMode: vi.fn(),
                readViewSettings: vi.fn(),
                setFPSCounterVisibility: vi.fn(),
                render: vi.fn(),
                getGlobalConfig: vi.fn(),
                getAnimationRunning: vi.fn(),
                setViewFlags: vi.fn(),
                onConfigChanged: vi.fn(),
            },
            {
                dataflow: {
                    svgActions: { initSVG },
                    loadOrbitDataIfNeededAndProcess,
                    planeActions: { handlePlaneChange },
                    adjustLabelLocations,
                },
                loadProgress,
            },
        );

        expect(deps.initSVG).toBe(initSVG);
        expect(deps.loadOrbitDataIfNeededAndProcess).toBe(
            loadOrbitDataIfNeededAndProcess,
        );
        expect(deps.handlePlaneChange).toBe(handlePlaneChange);
        expect(deps.adjustLabelLocations).toBe(adjustLabelLocations);
        expect(deps.loadProgress).toBe(loadProgress);
    });

    it("injects dataflow helpers into the scene-frame wiring deps", () => {
        const setLabelLocation = vi.fn();
        const zoomChangeTransform = vi.fn();
        const showGreenwichLongitude = vi.fn();

        const deps = createSceneFrameWiringDeps(
            {
                getPlaneVariablesStateForConfig: vi.fn(),
                getZoomFactorStateForConfig: vi.fn(),
                getPanXStateForConfig: vi.fn(),
                getPanYStateForConfig: vi.fn(),
                getActiveEphemerisSourceForConfig: vi.fn(),
                animationScenes: { geo: { id: "geo-scene" } },
                render: vi.fn(),
            },
            {
                dataflow: {
                    setLabelLocation,
                    zoomChangeTransform,
                    showGreenwichLongitude,
                },
            },
        );

        expect(deps.getPlaneVariables).toBeDefined();
        expect(deps.getZoomFactor).toBeDefined();
        expect(deps.getPanX).toBeDefined();
        expect(deps.getPanY).toBeDefined();
        expect(deps.getActiveEphemerisSource).toBeDefined();
        expect(deps.setLabelLocation).toBe(setLabelLocation);
        expect(deps.zoomChangeTransform).toBe(zoomChangeTransform);
        expect(deps.showGreenwichLongitude).toBe(showGreenwichLongitude);
        expect(deps.getAnimationScene("geo")).toEqual({ id: "geo-scene" });
    });
});
