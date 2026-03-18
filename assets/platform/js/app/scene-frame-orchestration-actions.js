function createSceneFrameOrchestrationActions(deps) {
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
    } = deps;

    function setLocation() {
        const config = getConfig();
        if (!isOrbitDataProcessed(config)) {
            return;
        }

        const animTime = getAnimTime();
        const scene = getAnimationScene(config);
        if (!scene) {
            return;
        }

        const sceneState = computeSceneState(animTime, config, {
            sunLongitude: computeSunLongitude(animTime),
            chebyshevData: getChebyshevData(),
            chebyshevDataLoaded: getChebyshevDataLoaded(),
            npzData: getNpzData(),
            npzDataLoaded: getNpzDataLoaded(),
            landingNpzData: getLandingNpzData(config),
            landingNpzLoaded: getLandingNpzLoaded(config),
            landingChebyshevData: getLandingChebyshevData(config),
            landingChebyshevLoaded: getLandingChebyshevLoaded(config),
            globalConfig: getGlobalConfig(),
            startLandingTime: getStartLandingTime(),
            endLandingTime: getEndLandingTime(),
            eventInfos: getEventInfos(),
            missionTimes: getMissionTimes(),
            planetsForLocations: scene.planetsForLocations,
            frameMode: getFrameMode(),
            bodySources: getBodySources(),
            ephemerisSource: getActiveEphemerisSource(config),
        });

        setSunLongitude(sceneState.sunLongitude);

        const primaryBody = scene.primaryBody;
        const startLandingTime = getStartLandingTime();
        const renderOptions = {
            craftId: getCraftId(),
            pixelsPerAU: getPixelsPerAU(),
            primaryBody,
            planetsForLocations: scene.planetsForLocations,
            updateCraftScale,
            landingFreezeTime: startLandingTime ? (startLandingTime - 5000) : null,
        };

        if (getCurrentDimension() === "3D") {
            if (animation3DControllers[config]) {
                animation3DControllers[config].render(sceneState, renderOptions);
            }
            if (scene.initialized3D) {
                adjustCameraProjectionMatrixAndSkyAngle();
            }
        } else {
            scene2DFrameActions.render2DFrame({ sceneState, renderOptions });
        }

        sceneFrameUiActions.updateFrameUi({
            animTime,
            sceneState,
            primaryBody,
            globalConfig: getGlobalConfig(),
        });

        render();
    }

    return {
        setLocation,
    };
}

export { createSceneFrameOrchestrationActions };
