import { describe, expect, it, vi } from "vitest";

import {
    createMissionSceneComposition,
    createMissionSceneEntryContext,
    createMissionSceneRender,
} from "../src/platform/js/app/mission-scene-composition.js";

function createSceneCompositionContext() {
    const animationScenes = {
        geo: { id: "geo-scene" },
    };
    const sceneHandler = {
        render: vi.fn(),
    };

    return {
        d3: {},
        THREE: {},
        Astronomy: {},
        DEFAULT_VIEW_STATE: { defaultOnly: true },
        isTestMode: true,
        frameMode: "inertial",
        chebyshevDataLoaded: { geo: true },
        chebyshevData: { geo: [] },
        npzData: { geo: [] },
        npzDataLoaded: { geo: true },
        landingNpzLoaded: { geo: false },
        landingNpzData: { geo: [] },
        getActiveEphemerisSource: vi.fn(() => "chebyshev"),
        resolveBodySource: vi.fn(),
        getBodyEphemerisSources: vi.fn(() => ({ SC: "npz" })),
        getAnimationScenes: vi.fn(() => animationScenes),
        getStartTime: vi.fn(() => 10),
        getLatestEndTime: vi.fn(() => 20),
        getLandingEnabled: vi.fn(() => false),
        landingChebyshevLoaded: { geo: false },
        landingChebyshevData: { geo: [] },
        getStartLandingTime: vi.fn(() => 30),
        getEndLandingTime: vi.fn(() => 40),
        getPixelsPerAU: vi.fn(() => 100),
        getGlobalConfig: vi.fn(() => ({ mission: "cy3" })),
        getConfig: vi.fn(() => "geo"),
        getCraftId: vi.fn(() => "SC"),
        planetProperties: {},
        getOrbitPointsCount: vi.fn(() => 50),
        getLandingPointsCount: vi.fn(() => 0),
        getViewOrbitDescent: vi.fn(() => false),
        getViewOrbit: vi.fn(() => true),
        getOrbitStyle: vi.fn(() => "trail"),
        getTrailTrackBrightness3D: vi.fn(() => 0.7),
        getTrailTailBrightness3D: vi.fn(() => 0.5),
        bridgeActions: { wait10: vi.fn() },
        clearEventInfo: vi.fn(),
        getMissionRuntimeWireup: vi.fn(() => ({
            svgActions: {
                computeSVGDimensions: vi.fn(),
            },
        })),
        getSvgWidth: vi.fn(() => 800),
        getSvgHeight: vi.fn(() => 600),
        setOrbitPointsCount: vi.fn(),
        setLandingPointsCount: vi.fn(),
        getCraftSize: vi.fn(() => 2),
        getDefaultCameraDistance: vi.fn(() => 500),
        getSceneHandler: vi.fn(() => sceneHandler),
        windowRef: {},
        getMoonRadius: vi.fn(() => 1737),
        getViewPolarAxes: vi.fn(() => false),
        getViewPoles: vi.fn(() => false),
        getAnimTime: vi.fn(() => 1234),
        getEarthRadius: vi.fn(() => 6371),
        getViewCraters: vi.fn(() => false),
        getRuntimeFlags: vi.fn(() => ({ joyRide: false, landing: false })),
        ensureSceneViewState: vi.fn(),
        getEphemerisSource: vi.fn(() => "chebyshev"),
        getViewSky: vi.fn(() => true),
        getViewConstellationLines: vi.fn(() => false),
        getViewMoonSOI: vi.fn(() => false),
        getViewMoonHillSphere: vi.fn(() => false),
        getViewBodyHalos: vi.fn(() => true),
        getViewMoonOsculatingOrbit: vi.fn(() => false),
        getViewXYZAxes: vi.fn(() => false),
        getViewAuxiliaryPanels: vi.fn(() => true),
        getViewEclipticPlane: vi.fn(() => false),
        getViewEquatorialPlane: vi.fn(() => false),
        getEventInfos: vi.fn(() => []),
        getTimelineEventInfos: vi.fn(() => [{ key: "timeline-burn-a" }]),
        _animationScenes: animationScenes,
        _sceneHandler: sceneHandler,
    };
}

describe("mission scene composition", () => {
    it("builds a render bridge that only renders the current animation scene when available", () => {
        const sceneHandler = { render: vi.fn() };
        const render = createMissionSceneRender({
            getSceneHandler: vi.fn(() => sceneHandler),
            getAnimationScenes: vi.fn(() => ({ geo: { id: "geo-scene" } })),
            getConfig: vi.fn(() => "geo"),
        });
        const missingSceneRender = createMissionSceneRender({
            getSceneHandler: vi.fn(() => null),
            getAnimationScenes: vi.fn(() => ({})),
            getConfig: vi.fn(() => "geo"),
        });

        render();
        missingSceneRender();

        expect(sceneHandler.render).toHaveBeenCalledWith({ id: "geo-scene" });
        expect(sceneHandler.render).toHaveBeenCalledTimes(1);
    });

    it("builds the scene-entry context with static helpers and forwarded accessors", () => {
        const ctx = createSceneCompositionContext();
        const render = vi.fn();

        const sceneEntryContext = createMissionSceneEntryContext(ctx, { render });

        expect(sceneEntryContext.render).toBe(render);
        expect(sceneEntryContext.getAnimationScenes).toBe(ctx.getAnimationScenes);
        expect(sceneEntryContext.getConfig).toBe(ctx.getConfig);
        expect(sceneEntryContext.resolveBodySource).toBe(ctx.resolveBodySource);
        expect(sceneEntryContext.bridgeActions).toBe(ctx.bridgeActions);
        expect(sceneEntryContext.clearEventInfo).toBe(ctx.clearEventInfo);
        expect(sceneEntryContext.getTimelineEventInfos).toBe(ctx.getTimelineEventInfos);
        expect(sceneEntryContext.generateBodyCurve).toEqual(expect.any(Function));
        expect(sceneEntryContext.getBodyEphemerisState).toEqual(expect.any(Function));
        expect(sceneEntryContext.bindSettingsPanel).toEqual(expect.any(Function));
        expect(sceneEntryContext.COL).toBeDefined();
        expect(sceneEntryContext.PC).toBeDefined();
        expect(sceneEntryContext.lunar_pole).toBeDefined();
    });

    it("creates the scene entry around the render bridge and returns the entry exports", () => {
        const ctx = createSceneCompositionContext();
        let capturedContext = null;

        const result = createMissionSceneComposition(ctx, {
            createMissionSceneEntryImpl: vi.fn((sceneEntryContext) => {
                capturedContext = sceneEntryContext;
                return {
                    SceneHandler: class SceneHandler {},
                    AnimationScene: class AnimationScene {},
                };
            }),
        });

        expect(result.SceneHandler).toEqual(expect.any(Function));
        expect(result.AnimationScene).toEqual(expect.any(Function));
        expect(result.render).toEqual(expect.any(Function));
        expect(capturedContext.render).toBe(result.render);

        result.render();

        expect(ctx._sceneHandler.render).toHaveBeenCalledWith(ctx._animationScenes.geo);
    });
});
