import { lunar_pole } from "../astro.js";
import {
    COLORS as COL,
    PHYSICS_CONSTANTS as PC,
} from "../core/constants.js";
import { generateCurveFromChebyshev } from "../chebyshev.js";
import {
    generateBodyCurve,
    getBodyEphemerisState,
} from "../data/ephemeris-provider.js";
import { SceneHelpers } from "../rendering/scene-helpers.js";
import { bindSettingsPanel } from "../ui/event-handlers.js";
import { createMissionSceneEntry } from "./mission-scene-entry.js";
import { initSceneHandlerDom } from "./scene-handler-init.js";
import { computeSceneCameraParameters } from "./camera-parameters-core.js";

function createMissionSceneRender({
    getSceneHandler,
    getAnimationScenes,
    getConfig,
}) {
    return function render() {
        const sceneHandler = getSceneHandler();
        if (!sceneHandler) return;
        const animationScene = getAnimationScenes()[getConfig()];
        if (!animationScene) return;
        sceneHandler.render(animationScene);
    };
}

function createMissionSceneEntryContext(ctx, { render }) {
    return {
        d3: ctx.d3,
        THREE: ctx.THREE,
        Astronomy: ctx.Astronomy,
        lunar_pole,
        COL,
        PC,
        DEFAULT_VIEW_STATE: ctx.DEFAULT_VIEW_STATE,
        SceneHelpers,
        bindSettingsPanel,
        initSceneHandlerDom,
        computeSceneCameraParameters,
        isTestMode: ctx.isTestMode,
        isCompareMode: ctx.isCompareMode,
        frameMode: ctx.frameMode,
        generateCurveFromChebyshev,
        chebyshevDataLoaded: ctx.chebyshevDataLoaded,
        chebyshevData: ctx.chebyshevData,
        npzData: ctx.npzData,
        npzDataLoaded: ctx.npzDataLoaded,
        landingNpzLoaded: ctx.landingNpzLoaded,
        landingNpzData: ctx.landingNpzData,
        getActiveEphemerisSource: ctx.getActiveEphemerisSource,
        resolveBodySource: ctx.resolveBodySource,
        getBodyEphemerisSources: ctx.getBodyEphemerisSources,
        generateBodyCurve,
        getAnimationScenes: ctx.getAnimationScenes,
        getStartTime: ctx.getStartTime,
        getLatestEndTime: ctx.getLatestEndTime,
        getLandingEnabled: ctx.getLandingEnabled,
        landingChebyshevLoaded: ctx.landingChebyshevLoaded,
        landingChebyshevData: ctx.landingChebyshevData,
        getStartLandingTime: ctx.getStartLandingTime,
        getEndLandingTime: ctx.getEndLandingTime,
        getPixelsPerAU: ctx.getPixelsPerAU,
        getGlobalConfig: ctx.getGlobalConfig,
        getConfig: ctx.getConfig,
        getCraftId: ctx.getCraftId,
        planetProperties: ctx.planetProperties,
        getOrbitPointsCount: ctx.getOrbitPointsCount,
        getLandingPointsCount: ctx.getLandingPointsCount,
        getViewOrbitDescent: ctx.getViewOrbitDescent,
        getViewOrbit: ctx.getViewOrbit,
        getOrbitStyle: ctx.getOrbitStyle,
        getTrailTrackBrightness3D: ctx.getTrailTrackBrightness3D,
        getTrailTailBrightness3D: ctx.getTrailTailBrightness3D,
        render,
        bridgeActions: ctx.bridgeActions,
        clearEventInfo: ctx.clearEventInfo,
        getMissionRuntimeWireup: ctx.getMissionRuntimeWireup,
        getSvgWidth: ctx.getSvgWidth,
        getSvgHeight: ctx.getSvgHeight,
        setOrbitPointsCount: ctx.setOrbitPointsCount,
        setLandingPointsCount: ctx.setLandingPointsCount,
        getCraftSize: ctx.getCraftSize,
        getDefaultCameraDistance: ctx.getDefaultCameraDistance,
        getSceneHandler: ctx.getSceneHandler,
        windowRef: ctx.windowRef,
        getMoonRadius: ctx.getMoonRadius,
        getViewPolarAxes: ctx.getViewPolarAxes,
        getViewPoles: ctx.getViewPoles,
        getAnimTime: ctx.getAnimTime,
        getEarthRadius: ctx.getEarthRadius,
        getViewCraters: ctx.getViewCraters,
        getViewPhotoMode: ctx.getViewPhotoMode,
        getViewEarthClouds: ctx.getViewEarthClouds,
        setViewEarthClouds: ctx.setViewEarthClouds,
        getRuntimeFlags: ctx.getRuntimeFlags,
        ensureSceneViewState: ctx.ensureSceneViewState,
        getBodyEphemerisState,
        getEphemerisSource: ctx.getEphemerisSource,
        getViewSky: ctx.getViewSky,
        getViewConstellationLines: ctx.getViewConstellationLines,
        getViewMoonSOI: ctx.getViewMoonSOI,
        getViewMoonHillSphere: ctx.getViewMoonHillSphere,
        getViewBodyHalos: ctx.getViewBodyHalos,
        getViewMoonOsculatingOrbit: ctx.getViewMoonOsculatingOrbit,
        getViewXYZAxes: ctx.getViewXYZAxes,
        getViewAuxiliaryPanels: ctx.getViewAuxiliaryPanels,
        getViewEclipticPlane: ctx.getViewEclipticPlane,
        getViewEquatorialPlane: ctx.getViewEquatorialPlane,
        getEventInfos: ctx.getEventInfos,
        getTimelineEventInfos: ctx.getTimelineEventInfos,
        getLastInputActivityMs: ctx.getLastInputActivityMs,
    };
}

function createMissionSceneComposition(
    ctx,
    { createMissionSceneEntryImpl = createMissionSceneEntry } = {},
) {
    const render = ctx.render || createMissionSceneRender({
        getSceneHandler: ctx.getSceneHandler,
        getAnimationScenes: ctx.getAnimationScenes,
        getConfig: ctx.getConfig,
    });

    return {
        render,
        ...createMissionSceneEntryImpl(
            createMissionSceneEntryContext(ctx, { render }),
        ),
    };
}

export {
    createMissionSceneComposition,
    createMissionSceneEntryContext,
    createMissionSceneRender,
};
