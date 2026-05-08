function createSceneUiUpdateDeps(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
        getStartTime,
        getLatestEndTime,
        getAnimationRunning,
        getIsCompareMode,
        setTimelineMediaMarkers,
    } = deps;

    return {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
        getStartTime,
        getLatestEndTime,
        getAnimationRunning,
        getIsCompareMode,
        setTimelineMediaMarkers,
    };
}

function createSceneFrameUiDeps(deps, sceneUiUpdateActions) {
    const { getAnimDate } = deps;

    return {
        getAnimDate,
        sceneUiUpdateActions,
    };
}

function createScene2DFrameDeps(deps) {
    const {
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
    } = deps;

    return {
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
    };
}

function createFrameRendererDeps(deps, scene2DFrameActions) {
    const {
        animation3DControllers,
        adjustCameraProjectionMatrixAndSkyAngle,
    } = deps;

    return {
        animation3DControllers,
        adjustCameraProjectionMatrixAndSkyAngle,
        scene2DFrameActions,
    };
}

function createFrameUiUpdaterDeps(sceneFrameUiActions) {
    return {
        sceneFrameUiActions,
    };
}

function createSceneFrameOrchestrationDeps(deps, {
    frameRenderer,
    frameUiUpdater,
}) {
    const {
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
        getIsCompareMode,
        setSunLongitude,
        getCraftId,
        getPixelsPerAU,
        updateCraftScale,
        getCurrentDimension,
        render,
    } = deps;

    return {
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
        getIsCompareMode,
        setSunLongitude,
        getCraftId,
        getPixelsPerAU,
        updateCraftScale,
        getCurrentDimension,
        frameRenderer,
        frameUiUpdater,
        render,
    };
}

export {
    createFrameRendererDeps,
    createFrameUiUpdaterDeps,
    createScene2DFrameDeps,
    createSceneFrameOrchestrationDeps,
    createSceneFrameUiDeps,
    createSceneUiUpdateDeps,
};
