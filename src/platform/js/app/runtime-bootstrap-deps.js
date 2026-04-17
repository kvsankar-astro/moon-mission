import { createRuntimeInitDeps, createRuntimeUiControlsDeps } from "./runtime-deps.js";

function createRuntimeBootstrapAccessors({
    renderPort = {},
    statePort = {},
    clockPort = {},
} = {}) {
    const getConfig = statePort.getConfig;

    return {
        getPanX: typeof statePort.getPanX === "function"
            ? statePort.getPanX
            : () => statePort.getPanXState(getConfig()),
        getPanY: typeof statePort.getPanY === "function"
            ? statePort.getPanY
            : () => statePort.getPanYState(getConfig()),
        getZoomFactor: typeof statePort.getZoomFactor === "function"
            ? statePort.getZoomFactor
            : () => statePort.getZoomFactorState(getConfig()),
        getZoomTimeoutMs: typeof statePort.getZoomTimeoutMs === "function"
            ? statePort.getZoomTimeoutMs
            : () => clockPort.UC.ZOOM_TIMEOUT,
        getZoomScale: typeof statePort.getZoomScale === "function"
            ? statePort.getZoomScale
            : () => clockPort.UC.ZOOM_SCALE,
        setDimension: (value) => {
            renderPort.setDimension(value);
        },
    };
}

function createRuntimeAnimationDeps({
    renderPort = {},
    statePort = {},
    clockPort = {},
} = {}) {
    return {
        animationController: renderPort.animationController,
        getAnimTime: statePort.getAnimTime,
        getTimeTransLunarInjection: statePort.getTimeTransLunarInjection,
        getTimeLunarOrbitInsertion: statePort.getTimeLunarOrbitInsertion,
        setMissionStartCalled: statePort.setMissionStartCalled,
        clearLegacyTimeout: clockPort.clearLegacyTimeout,
    };
}

function createUpdateConfigFromMetadata({ statePort = {} } = {}) {
    return function updateConfigFromMetadata() {
        const cfg = statePort.getConfig();
        const scene = statePort.getAnimationScenes()[cfg];
        if (scene?.metadata && scene.metadata.step_size_seconds) {
            const metadataStepSeconds = scene.metadata.step_size_seconds;
            scene.stepDurationInMilliSeconds = metadataStepSeconds * 1000;
            statePort.setTimelineTotalSteps(
                (statePort.getLatestEndTime() - statePort.getStartTime()) /
                scene.stepDurationInMilliSeconds,
            );
        }
    };
}

function createOrbitProcessDeps(
    {
        uiPort = {},
        renderPort = {},
        dataPort = {},
        clockPort = {},
        statePort = {},
    } = {},
    {
        animationActions,
        accessors,
    },
) {
    return {
        d3: uiPort.d3,
        d3SelectAll: uiPort.d3SelectAll,
        hideElementById: uiPort.hideElementById,
        clearProgressLabel: uiPort.clearProgressLabel,
        updateConfigFromMetadata: createUpdateConfigFromMetadata({ statePort }),
        getCurrentDimension: statePort.getCurrentDimension,
        processOrbitVectorsData: dataPort.processOrbitVectorsData,
        sleep: clockPort.sleep,
        getSvgWidth: statePort.getSvgWidth,
        getSvgHeight: statePort.getSvgHeight,
        setSvgRect: statePort.setSvgRect,
        getOffsetX: statePort.getOffsetX,
        getOffsetY: statePort.getOffsetY,
        getPanX: accessors.getPanX,
        getPanY: accessors.getPanY,
        getZoomFactor: accessors.getZoomFactor,
        handleZoom: renderPort.handleZoom,
        zoomEnd: renderPort.zoomEnd,
        getMissionStartCalled: statePort.getMissionStartCalled,
        missionStart: animationActions.missionStart,
        getAnimationRunning: statePort.getAnimationRunning,
        updateAnimateButtonText: () => {
            uiPort.updateD3ElementText("#animate", "Play");
        },
        zoomChangeTransform: renderPort.zoomChangeTransform,
        getConfig: statePort.getConfig,
        orbitDataProcessed: dataPort.orbitDataProcessed,
    };
}

function createRuntimeUiControlsDepsFromPorts(
    {
        uiPort = {},
        renderPort = {},
        statePort = {},
    } = {},
    {
        animationActions,
        accessors,
        createMoonRenderProfileActions,
    },
) {
    return createRuntimeUiControlsDeps({
        createNavigationActions: renderPort.createNavigationActions,
        createRepeatMouseDownHandlers: renderPort.createRepeatMouseDownHandlers,
        createLockActions: renderPort.createLockActions,
        createCameraActions: renderPort.createCameraActions,
        createModeActions: renderPort.createModeActions,
        createMoonRenderProfileActions,
        createBurnActions: renderPort.createBurnActions,
        getConfig: statePort.getConfig,
        getPanXState: statePort.getPanXState,
        setPanXState: statePort.setPanXState,
        getPanYState: statePort.getPanYState,
        setPanYState: statePort.setPanYState,
        getZoomFactorState: statePort.getZoomFactorState,
        setZoomFactorState: statePort.setZoomFactorState,
        zoomChange: renderPort.zoomChange,
        zoomEnd: renderPort.zoomEnd,
        render: renderPort.render,
        getZoomTimeoutMs: accessors.getZoomTimeoutMs,
        getZoomScale: accessors.getZoomScale,
        toggleStatsVisibility: uiPort.toggleStatsVisibility,
        forward: animationActions.forward,
        fastForward: animationActions.fastForward,
        backward: animationActions.backward,
        fastBackward: animationActions.fastBackward,
        slower: animationActions.slower,
        resetspeed: animationActions.resetspeed,
        faster: animationActions.faster,
        realtime: animationActions.realtime,
        getMouseDownTimeout: statePort.getMouseDownTimeout,
        setMouseDownTimeout: statePort.setMouseDownTimeout,
        setTimeoutHandleZoom: statePort.setTimeoutHandleZoom,
        animationScenes: statePort.getAnimationScenes(),
        setChecked: uiPort.setChecked,
        readCameraPositionMode: uiPort.readCameraPositionMode,
        readCameraLookMode: uiPort.readCameraLookMode,
        applyCameraFromTo: uiPort.applyCameraFromTo,
        readPlaneSelection: uiPort.readPlaneSelection,
        setPlaneSelectionState: uiPort.setPlaneSelectionState,
        handlePlaneChange: renderPort.handlePlaneChange,
        getViewSky: statePort.getViewSky,
        getViewConstellationLines: statePort.getViewConstellationLines,
        getGlobalConfig: statePort.getGlobalConfig,
        updateCraftScale: renderPort.updateCraftScale,
        getLandingFlag: statePort.getLandingFlag,
        setLandingFlag: statePort.setLandingFlag,
        getJoyRideFlag: statePort.getJoyRideFlag,
        setJoyRideFlag: statePort.setJoyRideFlag,
        setView: renderPort.setView,
        getEventInfos: statePort.getEventInfos,
        setAnimTime: statePort.setAnimTime,
        missionSetTime: animationActions.missionSetTime,
        THREE: renderPort.THREE,
        loadSceneTextures: renderPort.loadSceneTextures,
        applyAndRefreshSceneTextures: renderPort.applyAndRefreshSceneTextures,
        globalObject: uiPort.windowRef,
    });
}

function createRuntimeInitHandlersById(uiControlsActions) {
    return {
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
    };
}

function createRuntimeInitDepsFromPorts(
    {
        uiPort = {},
        renderPort = {},
        dataPort = {},
        clockPort = {},
        statePort = {},
    } = {},
    {
        uiControlsActions,
        accessors,
    },
) {
    return createRuntimeInitDeps({
        getConfig: statePort.getConfig,
        getScene: (cfg) => statePort.getAnimationScenes()[cfg],
        getSceneStateInitDone: statePort.getSceneStateInitDone,
        setSceneState: statePort.setSceneState,
        resetViewTransformState: uiPort.resetViewTransformState,
        initRepeatButtons: uiPort.initRepeatButtons,
        d3SelectAll: uiPort.d3SelectAll,
        setChecked: uiPort.setChecked,
        bindRepeatButtons: uiPort.bindRepeatButtons,
        d3Select: uiPort.d3.select,
        getHandlersById: () => createRuntimeInitHandlersById(uiControlsActions),
        getTimeoutHandleZoom: statePort.getTimeoutHandleZoom,
        setTimeoutHandleZoom: statePort.setTimeoutHandleZoom,
        setMousedownTimeout: statePort.setMouseDownTimeout,
        setMouseDown: statePort.setMouseDown,
        getZoomTimeoutMs: accessors.getZoomTimeoutMs,
        clearTimeoutFn: clockPort.clearTimeoutFn,
        zoomEnd: renderPort.zoomEnd,
        sleep: clockPort.sleep,
        setAnimDate: statePort.setAnimDate,
        getCurrentDimension: statePort.getCurrentDimension,
        initSVG: dataPort.initSVG,
        loadOrbitDataIfNeededAndProcess: dataPort.loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess: dataPort.loadLandingDataAndProcess,
    });
}

function createInitOrchestrationDeps(
    {
        uiPort = {},
        renderPort = {},
        dataPort = {},
        clockPort = {},
        statePort = {},
    } = {},
    {
        animationActions,
        uiControlsActions,
        runtimeInitActions,
        accessors,
    },
) {
    return {
        initConfig: renderPort.initConfig,
        init: runtimeInitActions.init,
        getConfig: statePort.getConfig,
        isOrbitDataProcessed: (cfg) => !!dataPort.orbitDataProcessed[cfg],
        missionStart: animationActions.missionStart,
        missionSetTime: animationActions.missionSetTime,
        setRealtimeSpeed: animationActions.realtime,
        playAnimation: animationActions.playAnimation,
        setAnimTime: statePort.setAnimTime,
        setLocation: renderPort.setLocation,
        setDimension: accessors.setDimension,
        getSetView: () => renderPort.setView,
        getChangeCameraFromTo: () => uiControlsActions.changeCameraFromTo,
        updateCraftScale: renderPort.updateCraftScale,
        d3: uiPort.d3,
        d3SelectAll: uiPort.d3SelectAll,
        render: renderPort.render,
        requestAnimationFrame: clockPort.requestAnimationFrame,
        animateLoop: renderPort.animateLoop,
        getStartTime: statePort.getStartTime,
        getLatestEndTime: statePort.getLatestEndTime,
        animationScenes: statePort.getAnimationScenes(),
    };
}

export {
    createInitOrchestrationDeps,
    createOrbitProcessDeps,
    createRuntimeAnimationDeps,
    createRuntimeBootstrapAccessors,
    createRuntimeInitDepsFromPorts,
    createRuntimeInitHandlersById,
    createRuntimeUiControlsDepsFromPorts,
    createUpdateConfigFromMetadata,
};
