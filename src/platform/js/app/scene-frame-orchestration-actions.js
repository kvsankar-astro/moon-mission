import { planFrameStep } from "../core/plans/frame-plan.js";

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
        frameRenderer,
        frameUiUpdater,
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

        const npzData = getNpzData();
        const npzDataLoaded = getNpzDataLoaded();
        const bodySources = getBodySources();
        const activeEphemerisSource = getActiveEphemerisSource(config);
        const globalConfig = getGlobalConfig();
        const computeSunLongitudeForFrame = (timeMs) =>
            computeSunLongitude(timeMs, {
                config,
                npzData,
                npzDataLoaded,
                bodySources,
                defaultSpacecraftSource: activeEphemerisSource,
                spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
            });

        const framePlan = planFrameStep({
            config,
            animTime,
            scene,
            computeSunLongitude: computeSunLongitudeForFrame,
            computeSceneState,
            chebyshevData: getChebyshevData(),
            chebyshevDataLoaded: getChebyshevDataLoaded(),
            npzData,
            npzDataLoaded,
            landingNpzData: getLandingNpzData(config),
            landingNpzLoaded: getLandingNpzLoaded(config),
            landingChebyshevData: getLandingChebyshevData(config),
            landingChebyshevLoaded: getLandingChebyshevLoaded(config),
            globalConfig,
            startLandingTime: getStartLandingTime(),
            endLandingTime: getEndLandingTime(),
            eventInfos: getEventInfos(),
            missionTimes: getMissionTimes(),
            frameMode: getFrameMode(),
            bodySources,
            ephemerisSource: activeEphemerisSource,
            craftId: getCraftId(),
            pixelsPerAU: getPixelsPerAU(),
            updateCraftScale,
            currentDimension: getCurrentDimension(),
        });

        if (!framePlan.shouldRun) {
            return;
        }

        setSunLongitude(framePlan.statePatchIntent.sunLongitude);
        frameRenderer.applyRenderIntent(framePlan.renderIntent);
        frameUiUpdater.applyUiIntent(framePlan.uiIntent);

        render();
    }

    return {
        setLocation,
    };
}

export { createSceneFrameOrchestrationActions };
