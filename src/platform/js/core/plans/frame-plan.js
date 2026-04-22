import { createComparisonDisplayState } from "../domain/comparison-display.js";
import { resolveCompareDisplayProfile } from "../domain/runtime-mode.js";

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
    craftId,
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
        craftId,
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
    globalConfig,
    compareMode = false,
    comparisonNormalizationScale = 1,
}) {
    return {
        craftId,
        pixelsPerAU,
        primaryBody,
        planetsForLocations,
        updateCraftScale,
        landingFreezeTime: startLandingTime ? (startLandingTime - 5000) : null,
        scene,
        compareMode,
        comparisonNormalizationScale,
        compareDisplayProfile: compareMode ? resolveCompareDisplayProfile(globalConfig) : null,
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
        compareMode = false,
        createCompareDisplayState = createComparisonDisplayState,
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
        craftId,
    });
    const rawSceneState = computeSceneState(animTime, config, sceneStateOptions);
    const renderSceneState = compareMode
        ? createCompareDisplayState(rawSceneState, {
            config,
            globalConfig,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            defaultSpacecraftSource: ephemerisSource,
        })
        : rawSceneState;
    const primaryBody = scene.primaryBody;
    const renderOptions = buildRenderOptions({
        craftId,
        pixelsPerAU,
        primaryBody,
        planetsForLocations: scene.planetsForLocations,
        updateCraftScale,
        startLandingTime,
        scene,
        globalConfig,
        compareMode,
        comparisonNormalizationScale:
            renderSceneState?.comparisonNormalizationScale ?? 1,
    });

    return {
        shouldRun: true,
        statePatchIntent: {
            sunLongitude: rawSceneState.sunLongitude,
        },
        renderIntent: {
            dimension: currentDimension,
            config,
            sceneState: renderSceneState,
            renderOptions,
            shouldAdjustCameraProjection:
                currentDimension === "3D" && !!scene.initialized3D,
        },
        uiIntent: {
            config,
            animTime,
            sceneState: rawSceneState,
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
