import { describe, expect, it, vi } from "vitest";
import {
    createInitOrchestrationDeps,
    createOrbitProcessDeps,
    createRuntimeBootstrapAccessors,
    createRuntimeInitHandlersById,
    createRuntimeUiControlsDepsFromPorts,
    createUpdateConfigFromMetadata,
} from "../src/platform/js/app/runtime-bootstrap-deps.js";

describe("runtime bootstrap dependency builders", () => {
    it("resolves transform accessors from explicit state slices", () => {
        const setDimension = vi.fn();

        const accessors = createRuntimeBootstrapAccessors({
            renderPort: { setDimension },
            statePort: {
                app: {
                    getConfig: vi.fn(() => "geo"),
                },
                viewTransform: {
                    getPanX: vi.fn(() => 1),
                    getPanY: vi.fn(() => 2),
                    getZoomFactor: vi.fn(() => 3),
                    getZoomTimeoutMs: vi.fn(() => 4),
                    getZoomScale: vi.fn(() => 5),
                },
            },
            clockPort: { UC: { ZOOM_TIMEOUT: 9, ZOOM_SCALE: 10 } },
        });

        expect(accessors.getPanX()).toBe(1);
        expect(accessors.getPanY()).toBe(2);
        expect(accessors.getZoomFactor()).toBe(3);
        expect(accessors.getZoomTimeoutMs()).toBe(4);
        expect(accessors.getZoomScale()).toBe(5);
        accessors.setDimension("3D");
        expect(setDimension).toHaveBeenCalledWith("3D");
    });

    it("falls back to config-scoped transform state when direct transform getters are absent", () => {
        const setDimension = vi.fn();
        const fallback = createRuntimeBootstrapAccessors({
            renderPort: { setDimension },
            statePort: {
                app: {
                    getConfig: vi.fn(() => "geo"),
                },
                viewTransform: {
                    getPanXState: vi.fn(() => 11),
                    getPanYState: vi.fn(() => 12),
                    getZoomFactorState: vi.fn(() => 13),
                },
            },
            clockPort: { UC: { ZOOM_TIMEOUT: 14, ZOOM_SCALE: 15 } },
        });

        expect(fallback.getPanX()).toBe(11);
        expect(fallback.getPanY()).toBe(12);
        expect(fallback.getZoomFactor()).toBe(13);
        expect(fallback.getZoomTimeoutMs()).toBe(14);
        expect(fallback.getZoomScale()).toBe(15);
        fallback.setDimension("3D");
        expect(setDimension).toHaveBeenCalledWith("3D");
    });

    it("updates timeline metadata from the active scene when step size is available", () => {
        const scene = {
            metadata: {
                step_size_seconds: 2,
            },
        };
        const setTimelineTotalSteps = vi.fn();

        createUpdateConfigFromMetadata({
            statePort: {
                app: {
                    getConfig: vi.fn(() => "geo"),
                    getAnimationScenes: vi.fn(() => ({ geo: scene })),
                    setTimelineTotalSteps,
                    getLatestEndTime: vi.fn(() => 10000),
                    getStartTime: vi.fn(() => 2000),
                },
            },
        })();

        expect(scene.stepDurationInMilliSeconds).toBe(2000);
        expect(setTimelineTotalSteps).toHaveBeenCalledWith(4);
    });

    it("threads runtime UI control deps through state and browser ports", () => {
        const setPanXState = vi.fn();
        const setPanYState = vi.fn();
        const setZoomFactorState = vi.fn();
        const setPlaneSelectionState = vi.fn();

        const deps = createRuntimeUiControlsDepsFromPorts(
            {
                uiPort: {
                    setChecked: vi.fn(),
                    readCameraPositionMode: vi.fn(),
                    readCameraLookMode: vi.fn(),
                    applyCameraFromTo: vi.fn(),
                    readPlaneSelection: vi.fn(),
                    setPlaneSelectionState,
                    toggleStatsVisibility: vi.fn(),
                    windowRef: { windowOnly: true },
                },
                renderPort: {
                    createNavigationActions: vi.fn(),
                    createRepeatMouseDownHandlers: vi.fn(),
                    createLockActions: vi.fn(),
                    createCameraActions: vi.fn(),
                    createModeActions: vi.fn(),
                    createBurnActions: vi.fn(),
                    zoomChange: vi.fn(),
                    zoomEnd: vi.fn(),
                    render: vi.fn(),
                    handlePlaneChange: vi.fn(),
                    updateCraftScale: vi.fn(),
                    setView: vi.fn(),
                    THREE: { threeOnly: true },
                    loadSceneTextures: vi.fn(),
                    applyAndRefreshSceneTextures: vi.fn(),
                },
                statePort: {
                    app: {
                        getConfig: vi.fn(() => "geo"),
                        getAnimationScenes: vi.fn(() => ({ geo: {} })),
                        getGlobalConfig: vi.fn(),
                    },
                    data: {
                        getEventInfos: vi.fn(),
                        getTimelineEventInfos: vi.fn(() => [{ key: "timeline-burn-a" }]),
                    },
                    session: {
                        getLandingFlag: vi.fn(),
                        setLandingFlag: vi.fn(),
                        getJoyRideFlag: vi.fn(),
                        setJoyRideFlag: vi.fn(),
                        setAnimTime: vi.fn(),
                    },
                    sceneView: {
                        getViewSky: vi.fn(),
                        getViewConstellationLines: vi.fn(),
                    },
                    interaction: {
                        getMouseDownTimeout: vi.fn(),
                        setMouseDownTimeout: vi.fn(),
                        setTimeoutHandleZoom: vi.fn(),
                    },
                    viewTransform: {
                        getPanXState: vi.fn(() => 21),
                        setPanXState,
                        getPanYState: vi.fn(() => 22),
                        setPanYState,
                        getZoomFactorState: vi.fn(() => 23),
                        setZoomFactorState,
                    },
                },
            },
            {
                animationActions: {
                    forward: vi.fn(),
                    fastForward: vi.fn(),
                    backward: vi.fn(),
                    fastBackward: vi.fn(),
                    slower: vi.fn(),
                    resetspeed: vi.fn(),
                    faster: vi.fn(),
                    realtime: vi.fn(),
                    missionSetTime: vi.fn(),
                },
                accessors: {
                    getZoomTimeoutMs: vi.fn(() => 200),
                    getZoomScale: vi.fn(() => 1.5),
                },
                createMoonRenderProfileActions: vi.fn(),
            },
        );

        expect(deps.getPanX()).toBe(21);
        expect(deps.getPanY()).toBe(22);
        expect(deps.getZoomFactor()).toBe(23);
        deps.setPanX(31);
        deps.setPanY(32);
        deps.setZoomFactor(33);
        deps.setPlaneSelection("YZ");
        expect(setPanXState).toHaveBeenCalledWith(31, "geo");
        expect(setPanYState).toHaveBeenCalledWith(32, "geo");
        expect(setZoomFactorState).toHaveBeenCalledWith(33, "geo");
        expect(setPlaneSelectionState).toHaveBeenCalledWith("YZ", "geo");
        expect(deps.getZoomTimeoutMs()).toBe(200);
        expect(deps.getZoomScale()).toBe(1.5);
        expect(deps.globalObject).toEqual({ windowOnly: true });
        expect(deps.THREE).toEqual({ threeOnly: true });
        expect(deps.getTimelineEventInfos()).toEqual([{ key: "timeline-burn-a" }]);
    });

    it("maps runtime init handler ids to the repeat-button action surface", () => {
        const uiControlsActions = {
            f1: vi.fn(),
            f2: vi.fn(),
            f3: vi.fn(),
            f4: vi.fn(),
            f5: vi.fn(),
            f6: vi.fn(),
            f7: vi.fn(),
            f8: vi.fn(),
            f9: vi.fn(),
            f10: vi.fn(),
            f11: vi.fn(),
            f12: vi.fn(),
            f13: vi.fn(),
            f14: vi.fn(),
        };

        expect(createRuntimeInitHandlersById(uiControlsActions)).toEqual({
            zoomin: uiControlsActions.f1,
            zoomout: uiControlsActions.f2,
            panleft: uiControlsActions.f3,
            panright: uiControlsActions.f4,
            panup: uiControlsActions.f5,
            pandown: uiControlsActions.f6,
            forward: uiControlsActions.f7,
            fastforward: uiControlsActions.f8,
            backward: uiControlsActions.f9,
            fastbackward: uiControlsActions.f10,
            slower: uiControlsActions.f11,
            resetspeed: uiControlsActions.f12,
            faster: uiControlsActions.f13,
            realtime: uiControlsActions.f14,
        });
    });

    it("builds init orchestration deps from ports and composed actions", () => {
        const setDimension = vi.fn();
        const setView = vi.fn();
        const changeCameraFromTo = vi.fn();
        const animationScenes = { geo: { id: "scene" } };

        const deps = createInitOrchestrationDeps(
            {
                uiPort: {
                    d3: {},
                    d3SelectAll: vi.fn(),
                },
                renderPort: {
                    initConfig: vi.fn(),
                    setLocation: vi.fn(),
                    updateCraftScale: vi.fn(),
                    render: vi.fn(),
                    animateLoop: vi.fn(),
                    setView,
                },
                dataPort: {
                    orbitDataProcessed: { geo: 1, lunar: 0 },
                },
                clockPort: {
                    requestAnimationFrame: vi.fn(),
                },
                statePort: {
                    app: {
                        getConfig: vi.fn(() => "geo"),
                        getStartTime: vi.fn(() => 1000),
                        getLatestEndTime: vi.fn(() => 2000),
                        getAnimationScenes: vi.fn(() => animationScenes),
                    },
                    session: {
                        setAnimTime: vi.fn(),
                    },
                },
            },
            {
                animationActions: {
                    missionStart: vi.fn(),
                    missionSetTime: vi.fn(),
                    realtime: vi.fn(),
                    playAnimation: vi.fn(),
                },
                uiControlsActions: {
                    changeCameraFromTo,
                },
                runtimeInitActions: {
                    init: vi.fn(),
                },
                accessors: {
                    setDimension,
                },
            },
        );

        expect(deps.isOrbitDataProcessed("geo")).toBe(true);
        expect(deps.isOrbitDataProcessed("lunar")).toBe(false);
        expect(deps.getSetView()).toBe(setView);
        expect(deps.getChangeCameraFromTo()).toBe(changeCameraFromTo);
        expect(deps.animationScenes).toBe(animationScenes);
        deps.setDimension("2D");
        expect(setDimension).toHaveBeenCalledWith("2D");
    });

    it("builds orbit-process deps with the composed accessors and animation hooks", () => {
        const getPanX = vi.fn(() => 10);
        const getPanY = vi.fn(() => 11);
        const getZoomFactor = vi.fn(() => 12);

        const deps = createOrbitProcessDeps(
            {
                uiPort: {
                    d3: {},
                    d3SelectAll: vi.fn(),
                    hideElementById: vi.fn(),
                    clearProgressLabel: vi.fn(),
                    updateD3ElementText: vi.fn(),
                },
                renderPort: {
                    handleZoom: vi.fn(),
                    zoomEnd: vi.fn(),
                    zoomChangeTransform: vi.fn(),
                },
                dataPort: {
                    processOrbitVectorsData: vi.fn(),
                    orbitDataProcessed: {},
                },
                clockPort: {
                    sleep: vi.fn(),
                },
                statePort: {
                    app: {
                        getCurrentDimension: vi.fn(() => "2D"),
                        getSvgWidth: vi.fn(() => 800),
                        getSvgHeight: vi.fn(() => 600),
                        setSvgRect: vi.fn(),
                        getOffsetX: vi.fn(() => 0),
                        getOffsetY: vi.fn(() => 0),
                        getConfig: vi.fn(() => "geo"),
                        getAnimationScenes: vi.fn(() => ({ geo: {} })),
                        setTimelineTotalSteps: vi.fn(),
                        getLatestEndTime: vi.fn(() => 1000),
                        getStartTime: vi.fn(() => 0),
                    },
                    session: {
                        getAnimationRunning: vi.fn(() => false),
                    },
                    interaction: {
                        getMissionStartCalled: vi.fn(() => false),
                    },
                },
            },
            {
                animationActions: {
                    missionStart: vi.fn(),
                },
                accessors: {
                    getPanX,
                    getPanY,
                    getZoomFactor,
                },
            },
        );

        expect(deps.getPanX()).toBe(10);
        expect(deps.getPanY()).toBe(11);
        expect(deps.getZoomFactor()).toBe(12);
        expect(deps.missionStart).toEqual(expect.any(Function));
        expect(deps.updateAnimateButtonText).toEqual(expect.any(Function));
        deps.updateAnimateButtonText();
        expect(deps.updateConfigFromMetadata).toEqual(expect.any(Function));
    });
});
