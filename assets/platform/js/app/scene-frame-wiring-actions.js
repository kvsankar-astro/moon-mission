import { createSceneUiUpdateActions } from "./scene-ui-update-actions.js";
import { createSceneFrameUiActions } from "./scene-frame-ui-actions.js";
import { createScene2DFrameActions } from "./scene-2d-frame-actions.js";
import { createSceneFrameOrchestrationActions } from "./scene-frame-orchestration-actions.js";

function createSceneFrameWiringActions(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
        getAnimDate,
        animation2DControllers,
        animationScenes,
        getConfig,
        getPlaneVariables,
        getZoomFactor,
        getPanX,
        getPanY,
        setCraftData,
        setLabelLocation,
        zoomChangeTransform,
        showGreenwichLongitude,
        isOrbitDataProcessed,
        getAnimTime,
        computeSunLongitude,
        computeSceneState,
        getChebyshevData,
        getChebyshevDataLoaded,
        getNpzData,
        getNpzDataLoaded,
        getLandingNpzData,
        getLandingNpzLoaded,
        getLandingChebyshevData,
        getLandingChebyshevLoaded,
        getGlobalConfig,
        getStartLandingTime,
        getEndLandingTime,
        getEventInfos,
        getMissionTimes,
        getAnimationScene,
        getFrameMode,
        getBodySources,
        getActiveEphemerisSource,
        setSunLongitude,
        getCraftId,
        getPixelsPerAU,
        updateCraftScale,
        getCurrentDimension,
        animation3DControllers,
        adjustCameraProjectionMatrixAndSkyAngle,
        render,
    } = deps;

    const sceneUiUpdateActions = createSceneUiUpdateActions({
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
    });

    const sceneFrameUiActions = createSceneFrameUiActions({
        getAnimDate,
        sceneUiUpdateActions,
    });

    const scene2DFrameActions = createScene2DFrameActions({
        animation2DControllers,
        animationScenes,
        getConfig,
        getPlaneVariables,
        getZoomFactor,
        getPanX,
        getPanY,
        setCraftData,
        setLabelLocation,
        zoomChangeTransform,
        showGreenwichLongitude,
    });

    const sceneFrameOrchestrationActions = createSceneFrameOrchestrationActions({
        getConfig,
        isOrbitDataProcessed,
        getAnimTime,
        computeSunLongitude,
        computeSceneState,
        getChebyshevData,
        getChebyshevDataLoaded,
        getNpzData,
        getNpzDataLoaded,
        getLandingNpzData,
        getLandingNpzLoaded,
        getLandingChebyshevData,
        getLandingChebyshevLoaded,
        getGlobalConfig,
        getStartLandingTime,
        getEndLandingTime,
        getEventInfos,
        getMissionTimes,
        getAnimationScene,
        getFrameMode,
        getBodySources,
        getActiveEphemerisSource,
        setSunLongitude,
        getCraftId,
        getPixelsPerAU,
        updateCraftScale,
        getCurrentDimension,
        animation3DControllers,
        adjustCameraProjectionMatrixAndSkyAngle,
        scene2DFrameActions,
        sceneFrameUiActions,
        render,
    });

    return {
        sceneUiUpdateActions,
        sceneFrameUiActions,
        scene2DFrameActions,
        sceneFrameOrchestrationActions,
    };
}

export { createSceneFrameWiringActions };
