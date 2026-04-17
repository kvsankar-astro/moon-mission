import { describe, expect, it, vi } from "vitest";
import {
    createFrameRendererDeps,
    createFrameUiUpdaterDeps,
    createScene2DFrameDeps,
    createSceneFrameOrchestrationDeps,
    createSceneFrameUiDeps,
    createSceneUiUpdateDeps,
} from "../src/platform/js/app/scene-frame-wiring-deps.js";

describe("scene frame wiring dependency builders", () => {
    it("builds scene UI update deps from formatting and event handlers", () => {
        const d3 = {};
        const formatMetric = vi.fn();
        const updateEventInfo = vi.fn();
        const clearEventInfo = vi.fn();

        expect(
            createSceneUiUpdateDeps({
                d3,
                formatMetric,
                updateEventInfo,
                clearEventInfo,
                ignored: true,
            }),
        ).toEqual({
            d3,
            formatMetric,
            updateEventInfo,
            clearEventInfo,
        });
    });

    it("threads scene UI actions through the frame UI adapter deps", () => {
        const getAnimDate = vi.fn();
        const sceneUiUpdateActions = { update: vi.fn() };

        expect(
            createSceneFrameUiDeps({ getAnimDate }, sceneUiUpdateActions),
        ).toEqual({
            getAnimDate,
            sceneUiUpdateActions,
        });

        expect(createFrameUiUpdaterDeps(sceneUiUpdateActions)).toEqual({
            sceneFrameUiActions: sceneUiUpdateActions,
        });
    });

    it("builds the 2D frame and renderer deps from the scene wiring context", () => {
        const scene2DFrameActions = { render2DFrame: vi.fn() };
        const animation3DControllers = {};
        const adjustCameraProjectionMatrixAndSkyAngle = vi.fn();

        expect(
            createScene2DFrameDeps({
                animation2DControllers: {},
                animationScenes: {},
                getConfig: vi.fn(),
                getPlaneVariables: vi.fn(),
                getZoomFactor: vi.fn(),
                getPanX: vi.fn(),
                getPanY: vi.fn(),
                setCraftData: vi.fn(),
                setLabelLocation: vi.fn(),
                zoomChangeTransform: vi.fn(),
                showGreenwichLongitude: vi.fn(),
            }),
        ).toMatchObject({
            getConfig: expect.any(Function),
            getPlaneVariables: expect.any(Function),
            showGreenwichLongitude: expect.any(Function),
        });

        expect(
            createFrameRendererDeps(
                {
                    animation3DControllers,
                    adjustCameraProjectionMatrixAndSkyAngle,
                },
                scene2DFrameActions,
            ),
        ).toEqual({
            animation3DControllers,
            adjustCameraProjectionMatrixAndSkyAngle,
            scene2DFrameActions,
        });
    });

    it("injects renderer and UI updater shells into frame orchestration deps", () => {
        const frameRenderer = { renderFrame: vi.fn() };
        const frameUiUpdater = { updateFrameUi: vi.fn() };
        const render = vi.fn();

        const deps = createSceneFrameOrchestrationDeps(
            {
                getConfig: vi.fn(),
                isOrbitDataProcessed: vi.fn(),
                getAnimTime: vi.fn(),
                computeSunLongitude: vi.fn(),
                computeSceneState: vi.fn(),
                getChebyshevData: vi.fn(),
                getChebyshevDataLoaded: vi.fn(),
                getNpzData: vi.fn(),
                getNpzDataLoaded: vi.fn(),
                getLandingNpzData: vi.fn(),
                getLandingNpzLoaded: vi.fn(),
                getLandingChebyshevData: vi.fn(),
                getLandingChebyshevLoaded: vi.fn(),
                getGlobalConfig: vi.fn(),
                getStartLandingTime: vi.fn(),
                getEndLandingTime: vi.fn(),
                getEventInfos: vi.fn(),
                getMissionTimes: vi.fn(),
                getAnimationScene: vi.fn(),
                getFrameMode: vi.fn(),
                getBodySources: vi.fn(),
                getActiveEphemerisSource: vi.fn(),
                setSunLongitude: vi.fn(),
                getCraftId: vi.fn(),
                getPixelsPerAU: vi.fn(),
                updateCraftScale: vi.fn(),
                getCurrentDimension: vi.fn(),
                render,
            },
            { frameRenderer, frameUiUpdater },
        );

        expect(deps.frameRenderer).toBe(frameRenderer);
        expect(deps.frameUiUpdater).toBe(frameUiUpdater);
        expect(deps.render).toBe(render);
        expect(deps.computeSceneState).toEqual(expect.any(Function));
        expect(deps.getAnimationScene).toEqual(expect.any(Function));
    });
});
