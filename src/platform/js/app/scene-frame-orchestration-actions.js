import { planFrameStep } from "../core/plans/frame-plan.js";
import { createTransientActiveEventTracker } from "./transient-active-event-tracker.js";

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
    const transientActiveEventTracker = createTransientActiveEventTracker({
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
        if (!scene) {
            return;
        }

        const npzData = getNpzData();
        const npzDataLoaded = getNpzDataLoaded();
        const chebyshevData = getChebyshevData();
        const chebyshevDataLoaded = getChebyshevDataLoaded();
        const bodySources = getBodySources();
        const activeEphemerisSource = getActiveEphemerisSource(config);
        const globalConfig = getGlobalConfig();
        const computeSunLongitudeForFrame = (timeMs) =>
            computeSunLongitude(timeMs, {
                config,
                chebyshevData,
                chebyshevDataLoaded,
                npzData,
                npzDataLoaded,
                bodySources,
                defaultSpacecraftSource: activeEphemerisSource,
                spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
            });

        const activeSceneCraftId =
            scene?.activeCraftId ||
            scene?.primaryCraftId ||
            getCraftId();

        const eventInfos = getEventInfos();
        const framePlan = planFrameStep({
            config,
            animTime,
            scene,
            computeSunLongitude: computeSunLongitudeForFrame,
            computeSceneState,
            chebyshevData,
            chebyshevDataLoaded,
            npzData,
            npzDataLoaded,
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
            bodySources,
            ephemerisSource: activeEphemerisSource,
            craftId: activeSceneCraftId,
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

        setSunLongitude(framePlanWithTransientEvent.framePlan.statePatchIntent.sunLongitude);
        frameRenderer.applyRenderIntent(framePlanWithTransientEvent.framePlan.renderIntent);
        frameUiUpdater.applyUiIntent(framePlanWithTransientEvent.framePlan.uiIntent);

        render();
    }

    return {
        setLocation,
    };
}

export { createSceneFrameOrchestrationActions };
