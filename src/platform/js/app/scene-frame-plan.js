import { planFrameStep } from "../core/plans/frame-plan.js";

function resolveSceneFrameCraftId({ scene, fallbackCraftId }) {
    return scene?.activeCraftId || scene?.primaryCraftId || fallbackCraftId;
}

function createFrameSunLongitudeCalculator({
    computeSunLongitude,
    config,
    chebyshevData,
    chebyshevDataLoaded,
    npzData,
    npzDataLoaded,
    bodySources,
    ephemerisSource,
    globalConfig,
}) {
    return (timeMs) =>
        computeSunLongitude(timeMs, {
            config,
            chebyshevData,
            chebyshevDataLoaded,
            npzData,
            npzDataLoaded,
            bodySources,
            defaultSpacecraftSource: ephemerisSource,
            spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
        });
}

function planSceneFrame(input) {
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
        activeEphemerisSource,
        craftId,
        pixelsPerAU,
        updateCraftScale,
        currentDimension,
    } = input;

    const activeSceneCraftId = resolveSceneFrameCraftId({
        scene,
        fallbackCraftId: craftId,
    });
    const computeSunLongitudeForFrame = createFrameSunLongitudeCalculator({
        computeSunLongitude,
        config,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        bodySources,
        ephemerisSource: activeEphemerisSource,
        globalConfig,
    });

    return planFrameStep({
        config,
        animTime,
        scene,
        computeSunLongitude: computeSunLongitudeForFrame,
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
        ephemerisSource: activeEphemerisSource,
        craftId: activeSceneCraftId,
        pixelsPerAU,
        updateCraftScale,
        currentDimension,
    });
}

export {
    createFrameSunLongitudeCalculator,
    planSceneFrame,
    resolveSceneFrameCraftId,
};
