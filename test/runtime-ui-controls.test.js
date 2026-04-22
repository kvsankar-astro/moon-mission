import { describe, expect, it, vi } from "vitest";

import {
    createRuntimeNavigationControlGroup,
    createRuntimeUiControlGroups,
} from "../src/platform/js/app/runtime-ui-control-groups.js";
import { createRuntimeUiControlsActions } from "../src/platform/js/app/runtime-ui-controls.js";

function createBaseDeps(overrides = {}) {
    return {
        createNavigationActions: vi.fn(() => ({
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            panLeft: vi.fn(),
            panRight: vi.fn(),
            panUp: vi.fn(),
            panDown: vi.fn(),
            reset: vi.fn(),
            navOnly: true,
        })),
        createRepeatMouseDownHandlers: vi.fn(() => ({
            f1: vi.fn(),
            repeatOnly: true,
        })),
        createLockActions: vi.fn(() => ({
            toggleLockSC: vi.fn(),
            lockOnly: true,
        })),
        createCameraActions: vi.fn(() => ({
            changeCameraFromTo: vi.fn(),
            cameraOnly: true,
        })),
        createModeActions: vi.fn(() => ({
            toggleLanding: vi.fn(),
            modeOnly: true,
        })),
        createMoonRenderProfileActions: vi.fn(() => ({
            setMoonRenderProfile: vi.fn(),
            profileOnly: true,
        })),
        createBurnActions: vi.fn(() => ({
            burnButtonHandler: vi.fn(),
            burnOnly: true,
        })),
        getPanX: vi.fn(() => 1),
        setPanX: vi.fn(),
        getPanY: vi.fn(() => 2),
        setPanY: vi.fn(),
        getZoomFactor: vi.fn(() => 3),
        setZoomFactor: vi.fn(),
        zoomChange: vi.fn(),
        zoomEnd: vi.fn(),
        render: vi.fn(),
        getZoomTimeoutMs: vi.fn(() => 10),
        getZoomScale: vi.fn(() => 1.5),
        toggleStatsVisibility: vi.fn(),
        forward: vi.fn(),
        fastForward: vi.fn(),
        backward: vi.fn(),
        fastBackward: vi.fn(),
        slower: vi.fn(),
        resetspeed: vi.fn(),
        faster: vi.fn(),
        realtime: vi.fn(),
        getMouseDownTimeout: vi.fn(() => 25),
        setMouseDownTimeout: vi.fn(),
        setTimeoutHandleZoom: vi.fn(),
        animationScenes: { geo: {} },
        getConfig: vi.fn(() => "geo"),
        setChecked: vi.fn(),
        readCameraPositionMode: vi.fn(() => "manual"),
        readCameraLookMode: vi.fn(() => "earth"),
        applyCameraFromTo: vi.fn(),
        readPlaneSelection: vi.fn(() => "XY"),
        setPlaneSelection: vi.fn(),
        handlePlaneChange: vi.fn(),
        getViewSky: vi.fn(() => true),
        getViewConstellationLines: vi.fn(() => false),
        getGlobalConfig: vi.fn(() => ({ mission: "cy3" })),
        updateCraftScale: vi.fn(),
        getLandingFlag: vi.fn(() => false),
        setLandingFlag: vi.fn(),
        getJoyRideFlag: vi.fn(() => false),
        setJoyRideFlag: vi.fn(),
        setView: vi.fn(),
        getEventInfos: vi.fn(() => [{ key: "burn-a" }]),
        setAnimTime: vi.fn(),
        missionSetTime: vi.fn(),
        THREE: { threeOnly: true },
        loadSceneTextures: vi.fn(),
        applyAndRefreshSceneTextures: vi.fn(),
        globalObject: { windowOnly: true },
        ...overrides,
    };
}

describe("runtime ui controls composition", () => {
    it("builds the navigation and repeat-button group from shared navigation actions", () => {
        const deps = createBaseDeps();

        const { navigationActions, repeatHandlers } = createRuntimeNavigationControlGroup(deps);

        expect(deps.createNavigationActions).toHaveBeenCalledWith({
            getPanX: deps.getPanX,
            setPanX: deps.setPanX,
            getPanY: deps.getPanY,
            setPanY: deps.setPanY,
            getZoomFactor: deps.getZoomFactor,
            setZoomFactor: deps.setZoomFactor,
            zoomChange: deps.zoomChange,
            zoomEnd: deps.zoomEnd,
            render: deps.render,
            getZoomTimeoutMs: deps.getZoomTimeoutMs,
            getZoomScale: deps.getZoomScale,
            toggleInfo: deps.toggleStatsVisibility,
        });
        expect(deps.createRepeatMouseDownHandlers).toHaveBeenCalledWith({
            zoomIn: navigationActions.zoomIn,
            zoomOut: navigationActions.zoomOut,
            panLeft: navigationActions.panLeft,
            panRight: navigationActions.panRight,
            panUp: navigationActions.panUp,
            panDown: navigationActions.panDown,
            forward: deps.forward,
            fastForward: deps.fastForward,
            backward: deps.backward,
            fastBackward: deps.fastBackward,
            slower: deps.slower,
            resetspeed: deps.resetspeed,
            faster: deps.faster,
            realtime: deps.realtime,
            getDelayMs: deps.getMouseDownTimeout,
            setDelayMs: deps.setMouseDownTimeout,
            setTimeoutHandle: deps.setTimeoutHandleZoom,
        });
        expect(repeatHandlers.repeatOnly).toBe(true);
    });

    it("builds grouped actions for locks, camera, mode, profiles, and burns", () => {
        const deps = createBaseDeps();

        const groups = createRuntimeUiControlGroups(deps);

        expect(deps.createLockActions).toHaveBeenCalledWith({
            animationScenes: deps.animationScenes,
            getConfig: deps.getConfig,
            reset: groups.navigationActions.reset,
            setChecked: deps.setChecked,
        });
        expect(deps.createCameraActions).toHaveBeenCalledWith({
            animationScenes: deps.animationScenes,
            getConfig: deps.getConfig,
            readCameraPositionMode: deps.readCameraPositionMode,
            readCameraLookMode: deps.readCameraLookMode,
            applyCameraFromTo: deps.applyCameraFromTo,
            readPlaneSelection: deps.readPlaneSelection,
            setPlaneSelection: deps.setPlaneSelection,
            handlePlaneChange: deps.handlePlaneChange,
            render: deps.render,
            getViewSky: deps.getViewSky,
            getViewConstellationLines: deps.getViewConstellationLines,
        });
        expect(deps.createModeActions).toHaveBeenCalledWith({
            animationScenes: deps.animationScenes,
            getConfig: deps.getConfig,
            getGlobalConfig: deps.getGlobalConfig,
            render: deps.render,
            updateCraftScale: deps.updateCraftScale,
            getLandingFlag: deps.getLandingFlag,
            setLandingFlag: deps.setLandingFlag,
            getJoyRideFlag: deps.getJoyRideFlag,
            setJoyRideFlag: deps.setJoyRideFlag,
            setView: deps.setView,
        });
        expect(deps.createMoonRenderProfileActions).toHaveBeenCalledWith({
            THREE: deps.THREE,
            animationScenes: deps.animationScenes,
            loadSceneTextures: deps.loadSceneTextures,
            applyAndRefreshSceneTextures: deps.applyAndRefreshSceneTextures,
            render: deps.render,
            globalObject: deps.globalObject,
        });
        expect(deps.createBurnActions).toHaveBeenCalledWith({
            getEventInfos: deps.getEventInfos,
            setAnimTime: deps.setAnimTime,
            missionSetTime: deps.missionSetTime,
        });
        expect(groups.lockActions.lockOnly).toBe(true);
        expect(groups.cameraActions.cameraOnly).toBe(true);
        expect(groups.modeActions.modeOnly).toBe(true);
        expect(groups.moonRenderProfileActions.profileOnly).toBe(true);
        expect(groups.burnActions.burnOnly).toBe(true);
    });

    it("prefers compare-aware timeline events for burn button navigation when available", () => {
        const deps = createBaseDeps({
            getTimelineEventInfos: vi.fn(() => [{ key: "timeline-burn-a" }]),
        });

        createRuntimeUiControlGroups(deps);

        expect(deps.createBurnActions).toHaveBeenCalledWith({
            getEventInfos: deps.getTimelineEventInfos,
            setAnimTime: deps.setAnimTime,
            missionSetTime: deps.missionSetTime,
        });
    });

    it("merges all grouped actions into the runtime control surface", () => {
        const deps = createBaseDeps();

        const actions = createRuntimeUiControlsActions(deps);

        expect(actions.navOnly).toBe(true);
        expect(actions.repeatOnly).toBe(true);
        expect(actions.lockOnly).toBe(true);
        expect(actions.cameraOnly).toBe(true);
        expect(actions.modeOnly).toBe(true);
        expect(actions.profileOnly).toBe(true);
        expect(actions.burnButtonHandler).toEqual(expect.any(Function));
        expect(actions.burnOnly).toBeUndefined();
    });
});
