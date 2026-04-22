import { planFrameStep } from "../core/plans/frame-plan.js";
import { createNormalizedComparisonDisplayState } from "./comparison-normalization.js";
import { resolveCompareDisplayProfile } from "../core/domain/runtime-mode.js";

function resolveSceneFrameCraftId({ scene, fallbackCraftId }) {
    return scene?.activeCraftId || scene?.primaryCraftId || fallbackCraftId;
}

function resolveFixedCompareSunLongitude(globalConfig) {
    const fixedSunDirection = resolveCompareDisplayProfile(globalConfig)?.fixedSunDirection;
    const x = Number(fixedSunDirection?.x);
    const y = Number(fixedSunDirection?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return 0;
    }
    return Math.atan2(y, x);
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
    compareMode = false,
}) {
    if (compareMode) {
        const fixedSunLongitude = resolveFixedCompareSunLongitude(globalConfig);
        return () => fixedSunLongitude;
    }

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
        compareMode,
        craftId,
        pixelsPerAU,
        updateCraftScale,
        currentDimension,
        createCompareDisplayState = createNormalizedComparisonDisplayState,
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
        compareMode,
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
        compareMode,
        createCompareDisplayState,
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
