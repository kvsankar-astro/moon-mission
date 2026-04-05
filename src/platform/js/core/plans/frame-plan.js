function buildSceneStateOptions({
    sunLongitude,
    chebyshevData,
    chebyshevDataLoaded,
    npzData,
    npzDataLoaded,
    landingNpzData,
    landingNpzLoaded,
    landingChebyshevData,
    landingChebyshevLoaded,
    globalConfig,
    startLandingTime,
    endLandingTime,
    eventInfos,
    missionTimes,
    scene,
    frameMode,
    bodySources,
    ephemerisSource,
    includeNextState,
}) {
    return {
        sunLongitude,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes,
        planetsForLocations: scene.planetsForLocations,
        frameMode,
        bodySources,
        ephemerisSource,
        includeNextState,
    };
}

function buildRenderOptions({
    craftId,
    pixelsPerAU,
    primaryBody,
    planetsForLocations,
    updateCraftScale,
    startLandingTime,
    scene,
}) {
    return {
        craftId,
        pixelsPerAU,
        primaryBody,
        planetsForLocations,
        updateCraftScale,
        landingFreezeTime: startLandingTime ? (startLandingTime - 5000) : null,
        scene,
    };
}

function planFrameStep(input) {
    const {
        config,
        animTime,
        scene,
        computeSunLongitude,
        computeSceneState,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes,
        frameMode,
        bodySources,
        ephemerisSource,
        craftId,
        pixelsPerAU,
        updateCraftScale,
        currentDimension,
    } = input;

    if (!scene) {
        return {
            shouldRun: false,
            reason: "scene-missing",
        };
    }

    const sunLongitude = computeSunLongitude(animTime);
    const sceneStateOptions = buildSceneStateOptions({
        sunLongitude,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes,
        scene,
        frameMode,
        bodySources,
        ephemerisSource,
        includeNextState: currentDimension !== "2D",
    });
    const sceneState = computeSceneState(animTime, config, sceneStateOptions);
    const primaryBody = scene.primaryBody;
    const renderOptions = buildRenderOptions({
        craftId,
        pixelsPerAU,
        primaryBody,
        planetsForLocations: scene.planetsForLocations,
        updateCraftScale,
        startLandingTime,
        scene,
    });

    return {
        shouldRun: true,
        statePatchIntent: {
            sunLongitude: sceneState.sunLongitude,
        },
        renderIntent: {
            dimension: currentDimension,
            config,
            sceneState,
            renderOptions,
            shouldAdjustCameraProjection:
                currentDimension === "3D" && !!scene.initialized3D,
        },
        uiIntent: {
            config,
            animTime,
            sceneState,
            primaryBody,
            globalConfig,
        },
    };
}

export {
    buildRenderOptions,
    buildSceneStateOptions,
    planFrameStep,
};
