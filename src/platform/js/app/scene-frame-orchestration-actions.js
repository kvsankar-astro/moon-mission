import { planSceneFrame } from "./scene-frame-plan.js";
import { createTransientActiveEventTracker } from "./transient-active-event-tracker.js";

function applySceneFrameEffects({
    framePlan,
    setSunLongitude,
    frameRenderer,
    frameUiUpdater,
    render,
}) {
    setSunLongitude(framePlan.statePatchIntent.sunLongitude);
    frameRenderer.applyRenderIntent(framePlan.renderIntent);
    frameUiUpdater.applyUiIntent(framePlan.uiIntent);
    render();
}

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
        planSceneFrame: planSceneFrameImpl = planSceneFrame,
        createTransientEventTracker = createTransientActiveEventTracker,
    } = deps;
    const transientActiveEventTracker = createTransientEventTracker({
        eventDisplayWindowMs: 2000,
        eventDisplayMinStableUiMs: 2000,
    });

    function setLocation() {
        const config = getConfig();
        if (!isOrbitDataProcessed(config)) {
            return;
        }

        const animTime = getAnimTime();
        const scene = getAnimationScene(config);
        const globalConfig = getGlobalConfig();
        const eventInfos = getEventInfos();
        const framePlan = planSceneFrameImpl({
            config,
            animTime,
            scene,
            computeSunLongitude,
            computeSceneState,
            chebyshevData: getChebyshevData(),
            chebyshevDataLoaded: getChebyshevDataLoaded(),
            npzData: getNpzData(),
            npzDataLoaded: getNpzDataLoaded(),
            landingNpzData: getLandingNpzData(config),
            landingNpzLoaded: getLandingNpzLoaded(config),
            landingChebyshevData: getLandingChebyshevData(config),
            landingChebyshevLoaded: getLandingChebyshevLoaded(config),
            globalConfig,
            startLandingTime: getStartLandingTime(),
            endLandingTime: getEndLandingTime(),
            eventInfos,
            missionTimes: getMissionTimes(),
            frameMode: getFrameMode(),
            bodySources: getBodySources(),
            activeEphemerisSource: getActiveEphemerisSource(config),
            craftId: getCraftId(),
            pixelsPerAU: getPixelsPerAU(),
            updateCraftScale,
            currentDimension: getCurrentDimension(),
        });

        if (!framePlan.shouldRun) {
            return;
        }

        const framePlanWithTransientEvent = transientActiveEventTracker.applyToFramePlan({
            config,
            animTime,
            eventInfos,
            framePlan,
        });

        applySceneFrameEffects({
            framePlan: framePlanWithTransientEvent.framePlan,
            setSunLongitude,
            frameRenderer,
            frameUiUpdater,
            render,
        });
    }

    return {
        setLocation,
    };
}

export { createSceneFrameOrchestrationActions };
