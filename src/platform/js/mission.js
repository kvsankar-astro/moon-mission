
// Copyright (c) 2013-2024 Sankaranarayanan Viswanathan. All rights reserved.

import {
    CELESTIAL_BODIES as CB,
    FORMAT_CONSTANTS as FC,
    TIME_CONSTANTS as TC,
    UI_CONSTANTS as UC
} from "./core/constants.js";
import {
    clearEventInfo,
    d3SelectAll,
    updateEventInfo,
    updateD3ElementText,
    updateFPSCounter,
} from "./core/dom.js";
import { startMissionApp } from "./app/mission-app.js";
import { showElementById } from "./ui/dom-helpers.js";
import {
    resolveBodySource,
} from "./data/ephemeris-provider.js";
import {
    DEFAULT_VIEW_STATE,
} from "./app/plane-view-state.js";
import { createEphemerisInfoPanelActions } from "./app/ephemeris-info-panel.js";
import { createMissionLegacyState } from "./app/mission-legacy-state.js";
import {
    createMissionRuntimeRoot,
    publishMissionRuntimeGlobals,
} from "./app/mission-runtime-root.js";
import {
    createMissionSceneComposition,
    createMissionSceneRender,
} from "./app/mission-scene-composition.js";
import {
    createMissionLocalStateCells,
    createMissionStateCells,
} from "./app/mission-state-access.js";
import { createMissionViewEntry } from "./app/mission-view-entry.js";
import {
    computeAnimationStepState,
    updateFpsCounterState,
    updateFrameDeltaState,
    updateThreeDLoopCamera,
} from "./app/animation-loop.js";
import { adjustSceneCameraProjectionAndSky } from "./app/scene-camera-upkeep-actions.js";
import { createRuntimeInteractionState } from "./core/state/runtime-interaction-state.js";
import { createRuntimeLoopState } from "./core/state/runtime-loop-state.js";
import { createRuntimeSessionState } from "./core/state/runtime-session-state.js";
import { createRuntimeViewState } from "./core/state/runtime-view-state.js";
import { createMissionPlaybackRuntime } from "./app/mission-entry-composition.js";

import Swiper from 'swiper';
import * as THREE from 'three';

// Expose THREE for runtime modules that are initialized outside DI wiring.
if (typeof window !== "undefined" && !window.THREE) {
    window.THREE = THREE;
}

// Check if running in test mode (for consistent visual regression testing)
const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
const urlMode = new URLSearchParams(window.location.search).get('mode');
const isRelativeMode = urlMode === "relative";
const frameMode = isRelativeMode ? "relative" : "inertial";

let {
    craftSize,
    planetProperties,
    FORMAT_METRIC,
    craftId,
    config: initialConfig,
    missionStartCalled: initialMissionStartCalled,
    orbitDataLoaded,
    orbitDataProcessed,
    landingDataLoaded,
    ephemerisSource,
    chebyshevDataLoaded,
    chebyshevData,
    npzDataLoaded,
    npzData,
    landingNpzLoaded,
    landingNpzData,
    landingChebyshevLoaded,
    landingChebyshevData,
    nOrbitPoints,
    nLandingPoints,
    sunLongitude,
    mouseDown: initialMouseDown,
    planeSelection,
    plane,
    xVariable,
    yVariable,
    zVariable,
    vxVariable,
    vyVariable,
    vzVariable,
    xFactor,
    yFactor,
    zFactor,
    craftData,
    PIXELS_PER_AU,
    svgX,
    svgY,
    svgWidth,
    svgHeight,
    offsetx,
    offsety,
    trackWidth,
    earthRadius,
    moonRadius,
    svgContainer,
    svgRect,
    zoomFactor,
    panx,
    pany,
    defaultCameraDistance,
    epochJD,
    epochDate,
    startTime,
    endTime,
    endTimeSC,
    latestEndTime,
    startLandingTime,
    endLandingTime,
    timelineTotalSteps,
    animDate,
    animTime,
    animationRunning,
    startLandingFlag: initialStartLandingFlag,
    timeoutHandle: initialLegacyTimeoutHandle,
    timeoutHandleZoom: initialTimeoutHandleZoom,
    dataLoaded,
    ticksPerAnimationStep,
    mousedownTimeout: initialMouseDownTimeout,
    fpsUpdateInterval,
    timeTransLunarInjection,
    timeLunarOrbitInsertion,
    eventInfos,
    currentDimension: initialCurrentDimension,
    previousDimension: initialPreviousDimension,
    dimensionChanged: initialDimensionChanged,
    theSceneHandler,
    animationScenes,
    animation3DControllers,
    animation2DControllers,
} = createMissionLegacyState({
    CB,
    FC,
    TC,
    UC,
    DEFAULT_VIEW_STATE,
    d3,
});

export { animationScenes };

const runtimeViewState = createRuntimeViewState({
    initialConfig,
    initialCurrentDimension,
    initialPreviousDimension,
    initialDimensionChanged,
});

function getActiveEphemerisSource(cfg = runtimeViewState.getConfig()) {
    return ephemerisSource;
}
const ephemerisRecords = {}; // config -> { npz?: { url, bodies }, chebyshev?: { url } }
const ephemerisStatuses = {}; // config -> { npz?: { status, message }, chebyshev?: { status, message } }
let bodyEphemerisSources = {}; // optional per-body overrides from config

const {
    bindInfoPanelControls,
    updateEphemerisPanel,
} = createEphemerisInfoPanelActions({
    getGlobalConfig: () => globalConfig,
    getEphemerisSource: () => ephemerisSource,
    getEphemerisRecords: () => ephemerisRecords,
    getEphemerisStatuses: () => ephemerisStatuses,
    getBodyEphemerisSources: () => bodyEphemerisSources,
    resolveBodySource,
});

let missionRuntimeWireup = null;

function getSceneForConfig(cfg = runtimeViewState.getConfig()) {
    return animationScenes[cfg];
}

let toggleMode;
let setDimensionTop;
let setView;
const runtimeSessionState = createRuntimeSessionState({
    initialAnimTime: animTime,
    initialAnimationRunning: animationRunning,
    initialJoyRide: false,
    initialLanding: false,
});
const runtimeFlags = runtimeSessionState.getRuntimeFlags();
const runtimeLoopState = createRuntimeLoopState({
    initialDeltaFrameTime: TC.ONE_MINUTE_MS,
});
const runtimeInteractionState = createRuntimeInteractionState({
    initialMissionStartCalled,
    initialStartLandingFlag,
    initialMouseDown,
    initialMouseDownTimeout,
    initialTimeoutHandleZoom,
    initialLegacyTimeoutHandle,
});

function getEffectiveOrbitStyle() {
    const selectedStyle = runtimeViewState.getOrbitStyle();
    if (selectedStyle !== "trail") {
        return "classic";
    }
    return runtimeSessionState.getAnimationRunning() ? "trail" : "classic";
}

const render = createMissionSceneRender({
    getSceneHandler: () => theSceneHandler,
    getAnimationScenes: () => animationScenes,
    getConfig: () => runtimeViewState.getConfig(),
});

const {
    bridgeActions,
    sceneViewStateActions,
    modeSwitchActions,
    initialMissionViewState,
} = createMissionViewEntry({
    d3,
    d3SelectAll,
    windowRef: window,
    showElementById,
    getGlobalConfig: () => globalConfig,
    getConfig: () => runtimeViewState.getConfig(),
    setConfig: (val) => {
        runtimeViewState.setConfig(val);
    },
    getLandingFlag: () => runtimeSessionState.getLandingFlag(),
    setLandingFlag: (val) => {
        runtimeSessionState.setLandingFlag(val);
    },
    getCraftScaleActions: () => missionRuntimeWireup?.craftScaleActions,
    getSceneFrameOrchestrationActions: () => missionRuntimeWireup?.sceneFrameOrchestrationActions,
    render,
    adjustSceneCameraProjectionAndSky,
    getAnimationScenes: () => animationScenes,
    computeSVGDimensions: () => missionRuntimeWireup?.svgActions?.computeSVGDimensions?.(),
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    getSceneHandler: () => theSceneHandler,
    getSceneForConfig,
    getLegacyPlaneSelection: () => planeSelection,
    setLegacyPlaneSelection: (value) => {
        planeSelection = value;
    },
    getLegacyPlaneVariables: () => ({
        plane: plane,
        xFactor: xFactor,
        yFactor: yFactor,
        zFactor: zFactor,
        xVariable: xVariable,
        yVariable: yVariable,
        zVariable: zVariable,
        vxVariable: vxVariable,
        vyVariable: vyVariable,
        vzVariable: vzVariable,
    }),
    setLegacyPlaneVariables: (planeConfig) => {
        plane = planeConfig.plane;
        xFactor = planeConfig.xFactor;
        yFactor = planeConfig.yFactor;
        zFactor = planeConfig.zFactor;
        xVariable = planeConfig.xVariable;
        yVariable = planeConfig.yVariable;
        zVariable = planeConfig.zVariable;
        vxVariable = planeConfig.vxVariable;
        vyVariable = planeConfig.vyVariable;
        vzVariable = planeConfig.vzVariable;
    },
    getLegacyZoomFactor: () => zoomFactor,
    setLegacyZoomFactor: (value) => {
        zoomFactor = value;
    },
    getLegacyPanX: () => panx,
    setLegacyPanX: (value) => {
        panx = value;
    },
    getLegacyPanY: () => pany,
    setLegacyPanY: (value) => {
        pany = value;
    },
    isRelativeMode,
    getToggleMode: () => toggleMode,
    getCurrentAnimTime: () => runtimeSessionState.getAnimTime(),
    planeSelection,
});

const { toggleRelativeMode, toggleModeGuarded } = initialMissionViewState;
runtimeViewState.setConfig(initialMissionViewState.config);
runtimeViewState.setViewFlags({
    viewAuxiliaryPanels: initialMissionViewState.viewAuxiliaryPanels,
    viewOrbit: initialMissionViewState.viewOrbit,
    viewOrbitDescent: initialMissionViewState.viewOrbitDescent,
    viewCraters: initialMissionViewState.viewCraters,
    viewXYZAxes: initialMissionViewState.viewXYZAxes,
    viewPoles: initialMissionViewState.viewPoles,
    viewPolarAxes: initialMissionViewState.viewPolarAxes,
    viewSky: initialMissionViewState.viewSky,
    viewConstellationLines: initialMissionViewState.viewConstellationLines,
    viewMoonSOI: initialMissionViewState.viewMoonSOI,
    viewMoonHillSphere: initialMissionViewState.viewMoonHillSphere,
    viewBodyHalos: initialMissionViewState.viewBodyHalos,
    viewMoonOsculatingOrbit: initialMissionViewState.viewMoonOsculatingOrbit,
    viewEclipticPlane: initialMissionViewState.viewEclipticPlane,
    viewEquatorialPlane: initialMissionViewState.viewEquatorialPlane,
    viewFPS: initialMissionViewState.viewFPS,
    orbitStyle: runtimeViewState.getOrbitStyle(),
    trailTrackBrightness2D: runtimeViewState.getTrailTrackBrightness2D(),
    trailTrackBrightness3D: runtimeViewState.getTrailTrackBrightness3D(),
    trailTailBrightness2D: runtimeViewState.getTrailTailBrightness2D(),
    trailTailBrightness3D: runtimeViewState.getTrailTailBrightness3D(),
});

const {
    eventBus,
    animationController,
    syncTimelineDock,
    syncActiveCraftControl,
} = createMissionPlaybackRuntime({
    windowRef: window,
    documentRef: document,
    CustomEventClass: typeof CustomEvent === "function" ? CustomEvent : null,
    runtimeSessionState,
    bridgeActions,
    updateD3ElementText,
    getSetView: () => setView,
    getAnimationScenes: () => animationScenes,
    getConfig: () => runtimeViewState.getConfig(),
    getGlobalConfig: () => globalConfig,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getAnimTime: () => runtimeSessionState.getAnimTime(),
    getEventInfos: () => eventInfos,
    defaultStepMs: TC.ONE_MINUTE_MS,
    maxTimelineStepMs: TC.ONE_SECOND_MS,
    updateEventInfo,
    clearEventInfo,
});

var globalConfig = null; // Store loaded config from config.json

const {
    SceneHandler,
    AnimationScene,
} = createMissionSceneComposition({
    d3,
    THREE,
    Astronomy,
    DEFAULT_VIEW_STATE,
    isTestMode,
    frameMode,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    landingNpzLoaded,
    landingNpzData,
    getActiveEphemerisSource,
    resolveBodySource,
    getBodyEphemerisSources: () => bodyEphemerisSources,
    getAnimationScenes: () => animationScenes,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getLandingEnabled: () => !!(globalConfig && globalConfig.landing && globalConfig.landing.enabled),
    landingChebyshevLoaded,
    landingChebyshevData,
    getStartLandingTime: () => startLandingTime,
    getEndLandingTime: () => endLandingTime,
    getPixelsPerAU: () => PIXELS_PER_AU,
    getGlobalConfig: () => globalConfig,
    getConfig: () => runtimeViewState.getConfig(),
    getCraftId: () => craftId,
    planetProperties,
    getOrbitPointsCount: () => nOrbitPoints,
    getLandingPointsCount: () => nLandingPoints,
    getViewOrbitDescent: () => runtimeViewState.getViewOrbitDescent(),
    getViewOrbit: () => runtimeViewState.getViewOrbit(),
    getOrbitStyle: () => getEffectiveOrbitStyle(),
    getTrailTrackBrightness3D: () => runtimeViewState.getTrailTrackBrightness3D(),
    getTrailTailBrightness3D: () => runtimeViewState.getTrailTailBrightness3D(),
    bridgeActions,
    clearEventInfo,
    getMissionRuntimeWireup: () => missionRuntimeWireup,
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    setOrbitPointsCount: (count) => {
        nOrbitPoints = count;
    },
    setLandingPointsCount: (count) => {
        nLandingPoints = count;
    },
    getCraftSize: () => craftSize,
    getDefaultCameraDistance: () => defaultCameraDistance,
    getSceneHandler: () => theSceneHandler,
    windowRef: window,
    getMoonRadius: () => moonRadius,
    getViewPolarAxes: () => runtimeViewState.getViewPolarAxes(),
    getViewPoles: () => runtimeViewState.getViewPoles(),
    getAnimTime: () => runtimeSessionState.getAnimTime(),
    getEarthRadius: () => earthRadius,
    getViewCraters: () => runtimeViewState.getViewCraters(),
    getRuntimeFlags: () => runtimeSessionState.getRuntimeFlags(),
    ensureSceneViewState: sceneViewStateActions.ensureSceneViewState,
    getEphemerisSource: () => ephemerisSource,
    getViewSky: () => runtimeViewState.getViewSky(),
    getViewConstellationLines: () => runtimeViewState.getViewConstellationLines(),
    getViewMoonSOI: () => runtimeViewState.getViewMoonSOI(),
    getViewMoonHillSphere: () => runtimeViewState.getViewMoonHillSphere(),
    getViewBodyHalos: () => runtimeViewState.getViewBodyHalos(),
    getViewMoonOsculatingOrbit: () => runtimeViewState.getViewMoonOsculatingOrbit(),
    getViewXYZAxes: () => runtimeViewState.getViewXYZAxes(),
    getViewAuxiliaryPanels: () => runtimeViewState.getViewAuxiliaryPanels(),
    getViewEclipticPlane: () => runtimeViewState.getViewEclipticPlane(),
    getViewEquatorialPlane: () => runtimeViewState.getViewEquatorialPlane(),
    getEventInfos: () => eventInfos,
    render,
});

const missionStateCells = createMissionStateCells({
    localStateCells: createMissionLocalStateCells({
        mutableStateAccessors: {
            globalConfig: [() => globalConfig, (value) => { globalConfig = value; }],
            svgContainer: [() => svgContainer, (value) => { svgContainer = value; }],
            dataLoaded: [() => dataLoaded, (value) => { dataLoaded = value; }],
            svgX: [() => svgX, (value) => { svgX = value; }],
            svgY: [() => svgY, (value) => { svgY = value; }],
            svgWidth: [() => svgWidth, (value) => { svgWidth = value; }],
            svgHeight: [() => svgHeight, (value) => { svgHeight = value; }],
            offsetx: [() => offsetx, (value) => { offsetx = value; }],
            offsety: [() => offsety, (value) => { offsety = value; }],
            landingDataLoaded: [() => landingDataLoaded, (value) => { landingDataLoaded = value; }],
            epochJD: [() => epochJD, (value) => { epochJD = value; }],
            epochDate: [() => epochDate, (value) => { epochDate = value; }],
            startTime: [() => startTime, (value) => { startTime = value; }],
            endTime: [() => endTime, (value) => { endTime = value; }],
            endTimeSC: [() => endTimeSC, (value) => { endTimeSC = value; }],
            latestEndTime: [() => latestEndTime, (value) => { latestEndTime = value; }],
            timelineTotalSteps: [() => timelineTotalSteps, (value) => { timelineTotalSteps = value; }],
            ticksPerAnimationStep: [() => ticksPerAnimationStep, (value) => { ticksPerAnimationStep = value; }],
            PIXELS_PER_AU: [() => PIXELS_PER_AU, (value) => { PIXELS_PER_AU = value; }],
            defaultCameraDistance: [() => defaultCameraDistance, (value) => { defaultCameraDistance = value; }],
            trackWidth: [() => trackWidth, (value) => { trackWidth = value; }],
            earthRadius: [() => earthRadius, (value) => { earthRadius = value; }],
            moonRadius: [() => moonRadius, (value) => { moonRadius = value; }],
            startLandingTime: [() => startLandingTime, (value) => { startLandingTime = value; }],
            endLandingTime: [() => endLandingTime, (value) => { endLandingTime = value; }],
            craftData: [() => craftData, (value) => { craftData = value; }],
            eventInfos: [() => eventInfos, (value) => { eventInfos = value; }],
            ephemerisSource: [() => ephemerisSource, (value) => { ephemerisSource = value; }],
            bodyEphemerisSources: [() => bodyEphemerisSources, (value) => { bodyEphemerisSources = value; }],
            timeTransLunarInjection: [() => timeTransLunarInjection, (value) => { timeTransLunarInjection = value; }],
            timeLunarOrbitInsertion: [() => timeLunarOrbitInsertion, (value) => { timeLunarOrbitInsertion = value; }],
            theSceneHandler: [() => theSceneHandler, (value) => { theSceneHandler = value; }],
            animDate: [() => animDate, (value) => { animDate = value; }],
            svgRect: [() => svgRect, (value) => { svgRect = value; }],
            sunLongitude: [() => sunLongitude, (value) => { sunLongitude = value; }],
        },
        readonlyStateAccessors: {
            frameMode: () => frameMode,
            craftId: () => craftId,
        },
    }),
    runtimeViewState,
    runtimeSessionState,
    runtimeInteractionState,
    getEffectiveOrbitStyle,
});

const {
    initAnimation,
    processOrbitData,
    animateLoop,
    main,
    missionRuntimeWireup: nextMissionRuntimeWireup,
    toggleMode: runtimeToggleMode,
    setDimensionTop: runtimeSetDimensionTop,
    setView: runtimeSetView,
} = createMissionRuntimeRoot({
    handlersEntryContext: {
        performanceRef: performance,
        requestAnimationFrameRef: requestAnimationFrame,
        startMissionApp,
        eventBus,
        toggleModeGuarded,
        toggleRelativeMode,
        getStartupAnimTimeOverride: () => initialMissionViewState.startupAnimTimeOverride,
        readLoopState: () => runtimeLoopState.getLoopState(),
        writeLoopState: (nextLoopState) => {
            runtimeLoopState.setLoopState(nextLoopState);
        },
        getFpsUpdateInterval: () => fpsUpdateInterval,
        getTicksPerAnimationStep: () => ticksPerAnimationStep,
        updateFPSCounter,
        updateFpsCounterState,
        updateFrameDeltaState,
        computeAnimationStepState,
        getAnimationController: () => animationController,
        getScene: () => animationScenes[runtimeViewState.getConfig()],
        getCameraControlsCallback: () => bridgeActions.cameraControlsCallback,
        updateThreeDLoopCamera,
    },
    wireupEntryContext: {
        d3,
        d3SelectAll,
        THREE,
        Astronomy,
        windowRef: window,
        documentRef: document,
        consoleRef: console,
        SwiperClass: Swiper,
        formatMetric: FORMAT_METRIC,
        missionStateCells,
        runtimeFlags,
        animationScenes,
        orbitDataLoaded,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        planetProperties,
        ephemerisRecords,
        ephemerisStatuses,
        resolveBodySource,
        getActiveEphemerisSource,
        sceneViewStateActions,
        AnimationScene,
        SceneHandlerClass: SceneHandler,
        bridgeActions,
        modeSwitchActions,
        animation3DControllers,
        animation2DControllers,
        animationController,
        bindInfoPanelControls,
        updateEphemerisPanel,
        pixelsPerAU: PIXELS_PER_AU,
        render,
        isRelativeMode,
        isTestMode,
    },
    syncTimelineDock,
    syncActiveCraftControl,
});
missionRuntimeWireup = nextMissionRuntimeWireup;
toggleMode = runtimeToggleMode;
setDimensionTop = runtimeSetDimensionTop;
setView = runtimeSetView;
export { main };

publishMissionRuntimeGlobals({
    windowRef: window,
    animationScenes,
    AnimationScene,
    main,
});

// end of file


