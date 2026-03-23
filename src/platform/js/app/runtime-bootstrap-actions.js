import { createAnimationActions } from "./animation-actions.js";
import { createRuntimeInitActions } from "./runtime-init.js";
import { createRuntimeUiControlsActions } from "./runtime-ui-controls.js";
import { createRuntimeInitDeps, createRuntimeUiControlsDeps } from "./runtime-deps.js";
import { createOrbitProcessActions } from "./orbit-process-actions.js";
import { createInitOrchestrationActions } from "./init-orchestration.js";
import { createCameraOverlayActions } from "./camera-overlay.js";

function createRuntimeBootstrapActions(ports) {
    const {
        uiPort = {},
        renderPort = {},
        dataPort = {},
        clockPort = {},
        statePort = {},
    } = ports || {};
    const deps = {
        ...uiPort,
        ...renderPort,
        ...dataPort,
        ...clockPort,
        ...statePort,
    };

    const {
        d3,
        d3SelectAll,
        hideElementById,
        clearProgressLabel,
        updateD3ElementText,
        createNavigationActions,
        createRepeatMouseDownHandlers,
        createLockActions,
        createCameraActions,
        createModeActions,
        createBurnActions,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        readPlaneSelection,
        setPlaneSelectionState,
        setChecked,
        toggleStatsVisibility,
        requestAnimationFrame,
        clearTimeoutFn,
        bindRepeatButtons,
        initRepeatButtons,
        resetViewTransformState,
        zoomEnd,
        zoomChange,
        zoomChangeTransform,
        handleZoom,
        render,
        sleep,
        updateCraftScale,
        setView,
        setDimension,
        setLocation,
        initConfig,
        animateLoop,
        initSVG,
        loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess,
        processOrbitVectorsData,
        handlePlaneChange,
        getConfig,
        getAnimationScenes,
        getCurrentDimension,
        getPanXState,
        setPanXState,
        getPanYState,
        setPanYState,
        getZoomFactorState,
        setZoomFactorState,
        getPanX,
        getPanY,
        getZoomFactor,
        getZoomTimeoutMs,
        getZoomScale,
        getMouseDownTimeout,
        setMouseDownTimeout,
        getTimeoutHandleZoom,
        setTimeoutHandleZoom,
        setMouseDown,
        setAnimDate,
        getViewSky,
        getGlobalConfig,
        getLandingFlag,
        setLandingFlag,
        getJoyRideFlag,
        setJoyRideFlag,
        getEventInfos,
        getAnimTime,
        setAnimTime,
        getTimeTransLunarInjection,
        getTimeLunarOrbitInsertion,
        setMissionStartCalled,
        clearLegacyTimeout,
        getMissionStartCalled,
        getAnimationRunning,
        getSvgWidth,
        getSvgHeight,
        setSvgRect,
        getOffsetX,
        getOffsetY,
        getStartTime,
        getLatestEndTime,
        setTimelineTotalSteps,
        orbitDataProcessed,
        getSceneStateInitDone,
        setSceneState,
        getPixelsPerAU,
        getKmPerAu,
        isTestMode,
        THREE,
        UC,
        PC,
    } = deps;

    const resolvePanX = typeof getPanX === "function"
        ? getPanX
        : () => getPanXState(getConfig());
    const resolvePanY = typeof getPanY === "function"
        ? getPanY
        : () => getPanYState(getConfig());
    const resolveZoomFactor = typeof getZoomFactor === "function"
        ? getZoomFactor
        : () => getZoomFactorState(getConfig());
    const resolveZoomTimeoutMs = typeof getZoomTimeoutMs === "function"
        ? getZoomTimeoutMs
        : () => UC.ZOOM_TIMEOUT;
    const resolveZoomScale = typeof getZoomScale === "function"
        ? getZoomScale
        : () => UC.ZOOM_SCALE;
    const resolveKmPerAu = typeof getKmPerAu === "function"
        ? getKmPerAu
        : () => PC.KM_PER_AU;

    function updateConfigFromMetadata() {
        const cfg = getConfig();
        const scene = getAnimationScenes()[cfg];
        if (scene?.metadata && scene.metadata.step_size_seconds) {
            const metadataStepSeconds = scene.metadata.step_size_seconds;
            scene.stepDurationInMilliSeconds = metadataStepSeconds * 1000;
            setTimelineTotalSteps((getLatestEndTime() - getStartTime()) / scene.stepDurationInMilliSeconds);
        }
    }

    const animationActions = createAnimationActions({
        animationController: deps.animationController,
        getAnimTime,
        getTimeTransLunarInjection,
        getTimeLunarOrbitInsertion,
        setMissionStartCalled,
        clearLegacyTimeout,
    });

    const orbitProcessActions = createOrbitProcessActions({
        d3,
        d3SelectAll,
        hideElementById,
        clearProgressLabel,
        updateConfigFromMetadata,
        getCurrentDimension,
        processOrbitVectorsData,
        sleep,
        getSvgWidth,
        getSvgHeight,
        setSvgRect,
        getOffsetX,
        getOffsetY,
        getPanX: resolvePanX,
        getPanY: resolvePanY,
        getZoomFactor: resolveZoomFactor,
        handleZoom,
        zoomEnd,
        getMissionStartCalled,
        missionStart: animationActions.missionStart,
        getAnimationRunning,
        updateAnimateButtonText: () => {
            updateD3ElementText("#animate", "Play");
        },
        zoomChangeTransform,
        getConfig,
        orbitDataProcessed,
    });

    const uiControlsActions = createRuntimeUiControlsActions(createRuntimeUiControlsDeps({
        createNavigationActions,
        createRepeatMouseDownHandlers,
        createLockActions,
        createCameraActions,
        createModeActions,
        createBurnActions,
        getConfig,
        getPanXState,
        setPanXState,
        getPanYState,
        setPanYState,
        getZoomFactorState,
        setZoomFactorState,
        zoomChange,
        zoomEnd,
        render,
        getZoomTimeoutMs: resolveZoomTimeoutMs,
        getZoomScale: resolveZoomScale,
        toggleStatsVisibility,
        forward: animationActions.forward,
        fastForward: animationActions.fastForward,
        backward: animationActions.backward,
        fastBackward: animationActions.fastBackward,
        slower: animationActions.slower,
        resetspeed: animationActions.resetspeed,
        faster: animationActions.faster,
        realtime: animationActions.realtime,
        getMouseDownTimeout,
        setMouseDownTimeout,
        setTimeoutHandleZoom,
        animationScenes: getAnimationScenes(),
        setChecked,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        readPlaneSelection,
        setPlaneSelectionState,
        handlePlaneChange,
        getViewSky,
        getGlobalConfig,
        updateCraftScale,
        getLandingFlag,
        setLandingFlag,
        getJoyRideFlag,
        setJoyRideFlag,
        setView,
        getEventInfos,
        setAnimTime,
        missionSetTime: animationActions.missionSetTime,
    }));

    const runtimeInitActions = createRuntimeInitActions(createRuntimeInitDeps({
        getConfig,
        getScene: (cfg) => getAnimationScenes()[cfg],
        getSceneStateInitDone,
        setSceneState,
        resetViewTransformState,
        initRepeatButtons,
        d3SelectAll,
        setChecked,
        bindRepeatButtons,
        d3Select: d3.select,
        getHandlersById: () => ({
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
        }),
        getTimeoutHandleZoom,
        setTimeoutHandleZoom,
        setMousedownTimeout: setMouseDownTimeout,
        setMouseDown,
        getZoomTimeoutMs: resolveZoomTimeoutMs,
        clearTimeoutFn,
        zoomEnd,
        sleep,
        setAnimDate,
        getCurrentDimension,
        initSVG,
        loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess,
    }));

    const initOrchestrationActions = createInitOrchestrationActions({
        initConfig,
        init: runtimeInitActions.init,
        getConfig,
        isOrbitDataProcessed: (cfg) => !!orbitDataProcessed[cfg],
        missionStart: animationActions.missionStart,
        missionSetTime: animationActions.missionSetTime,
        setAnimTime,
        setLocation,
        setDimension: (value) => {
            setDimension(value);
        },
        getSetView: () => setView,
        getChangeCameraFromTo: () => uiControlsActions.changeCameraFromTo,
        updateCraftScale,
        d3,
        d3SelectAll,
        render,
        requestAnimationFrame,
        animateLoop,
    });

    const cameraOverlayActions = createCameraOverlayActions({
        THREE,
        isTestMode,
        getAnimationScenes,
        getConfig,
        readCameraPositionMode,
        readCameraLookMode,
        getPixelsPerAU,
        getKmPerAu: resolveKmPerAu,
        recenterMountedCamera: uiControlsActions.recenterMountedCamera,
    });

    return {
        init: runtimeInitActions.init,
        processOrbitData: () => orbitProcessActions.processOrbitData(),
        initOrchestrationActions,
        initCameraOverlay: cameraOverlayActions.initCameraOverlay,
        updateCameraOverlay: cameraOverlayActions.updateCameraOverlay,
        ...animationActions,
        ...uiControlsActions,
    };
}

export { createRuntimeBootstrapActions };
