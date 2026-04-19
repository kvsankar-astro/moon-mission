import { describe, expect, it, vi } from "vitest";

import {
    createMissionRuntimeHandlersEntryContext,
    createMissionRuntimeWireupEntryContext,
} from "../src/platform/js/app/mission-runtime-root-context.js";

describe("mission runtime root context", () => {
    it("builds a handlers entry context with dynamic runtime getters and loop proxies", () => {
        let activeConfig = "geo";
        const animationScenes = {
            geo: { id: "geo-scene" },
            lunar: { id: "lunar-scene" },
        };
        const runtimeLoopState = {
            getLoopState: vi.fn(() => ({ stepMs: 1000 })),
            setLoopState: vi.fn(),
        };
        const runtimeViewState = {
            getConfig: () => activeConfig,
        };
        const bridgeActions = {
            cameraControlsCallback: vi.fn(),
        };
        const animationController = { id: "controller" };
        const context = createMissionRuntimeHandlersEntryContext({
            performanceRef: { now: () => 1 },
            requestAnimationFrameRef: vi.fn(),
            startMissionApp: vi.fn(),
            eventBus: { emit: vi.fn() },
            toggleModeGuarded: vi.fn(),
            toggleRelativeMode: vi.fn(),
            getStartupAnimTimeOverride: () => 123,
            runtimeLoopState,
            getFpsUpdateInterval: () => 250,
            getTicksPerAnimationStep: () => 10,
            updateFPSCounter: vi.fn(),
            updateFpsCounterState: vi.fn(),
            updateFrameDeltaState: vi.fn(),
            computeAnimationStepState: vi.fn(),
            animationController,
            animationScenes,
            runtimeViewState,
            bridgeActions,
            updateThreeDLoopCamera: vi.fn(),
        });

        expect(context.readLoopState()).toEqual({ stepMs: 1000 });
        context.writeLoopState({ stepMs: 2000 });
        expect(runtimeLoopState.setLoopState).toHaveBeenCalledWith({ stepMs: 2000 });
        expect(context.getAnimationController()).toBe(animationController);
        expect(context.getScene()).toBe(animationScenes.geo);
        expect(context.getCameraControlsCallback()).toBe(bridgeActions.cameraControlsCallback);

        activeConfig = "lunar";
        expect(context.getScene()).toBe(animationScenes.lunar);
    });

    it("builds a wireup entry context without changing the dependency surface", () => {
        let bodySources = { EARTH: "npz" };
        const context = createMissionRuntimeWireupEntryContext({
            d3: { select: vi.fn() },
            d3SelectAll: vi.fn(),
            THREE: { Scene: class Scene {} },
            Astronomy: { version: "test" },
            windowRef: { innerWidth: 600 },
            documentRef: { getElementById: vi.fn() },
            consoleRef: console,
            SwiperClass: class Swiper {},
            formatMetric: "metric",
            missionStateCells: { config: { get: vi.fn() } },
            runtimeFlags: { joyRideEnabled: false },
            animationScenes: { geo: {} },
            orbitDataLoaded: true,
            orbitDataProcessed: false,
            chebyshevData: { geo: [] },
            chebyshevDataLoaded: true,
            npzData: { geo: [] },
            npzDataLoaded: false,
            landingNpzData: {},
            landingNpzLoaded: false,
            landingChebyshevData: {},
            landingChebyshevLoaded: true,
            planetProperties: { EARTH: {} },
            ephemerisRecords: {},
            ephemerisStatuses: {},
            resolveBodySource: vi.fn(),
            getActiveEphemerisSource: vi.fn(() => "chebyshev"),
            getBodyEphemerisSources: () => bodySources,
            sceneViewStateActions: { syncPlaneStateForConfig: vi.fn() },
            AnimationScene: class AnimationScene {},
            SceneHandlerClass: class SceneHandler {},
            bridgeActions: { toggleMode: vi.fn() },
            modeSwitchActions: { setDimensionTop: vi.fn() },
            animation3DControllers: {},
            animation2DControllers: {},
            animationController: { play: vi.fn() },
            bindInfoPanelControls: vi.fn(),
            updateEphemerisPanel: vi.fn(),
            pixelsPerAU: 42,
            render: vi.fn(),
            isRelativeMode: false,
            isTestMode: true,
        });

        expect(context.pixelsPerAU).toBe(42);
        expect(context.isTestMode).toBe(true);
        expect(context.getActiveEphemerisSource()).toBe("chebyshev");
        expect(context.getBodyEphemerisSources()).toEqual({ EARTH: "npz" });

        bodySources = { MOON: "chebyshev" };
        expect(context.getBodyEphemerisSources()).toEqual({ MOON: "chebyshev" });
    });
});
