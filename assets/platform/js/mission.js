
// Copyright (c) 2013-2024 Sankaranarayanan Viswanathan. All rights reserved.

import { lunar_pole } from "./astro.js";
import {
    CELESTIAL_BODIES as CB,
    COLORS as COL,
    FORMAT_CONSTANTS as FC,
    PHYSICS_CONSTANTS as PC,
    TIME_CONSTANTS as TC,
    UI_CONSTANTS as UC
} from "./core/constants.js";
import {
    clearEventInfo,
    clearProgressLabel,
    d3SelectAll,
    setFPSCounterVisibility,
    updateD3ElementText,
    updateEventInfo,
    updateFPSCounter,
    updateMultipleElementsText,
    updateProgressLabel,
    updateSpacecraftMnemonic
} from "./core/dom.js";
import { generateCurveFromChebyshev } from "./chebyshev.js";
import {
    createUTCTimestamp,
} from "./utils/time-utils.js";
import { SceneHelpers } from "./rendering/scene-helpers.js";
import { AnimationController } from "./animation/animation-controller.js";
import {
    computeSceneState,
} from "./scene-state.js";
import { Animation3DController, Animation2DController } from "./controllers/index.js";
import { computeSunLongitude } from "./services/ephemeris.js";
import { applyCameraFromTo, readCameraLookMode, readCameraPositionMode, readOriginMode, readViewSettings } from "./ui/ui-state.js";
import { bindBurnButtons, bindSettingsPanel } from "./ui/event-handlers.js";
import {
    loadChebyshev,
    loadMissionConfig,
    loadNpz,
    resolveLandingChebyshevUrl,
    resolveLandingNpzUrl,
    resolveOrbitNpzUrl,
    resolveOrbitUrls,
} from "./data/mission-data.js";
import { createEventBus } from "./core/event-bus.js";
import { startMissionApp } from "./app/mission-app.js";
import { createCameraActions } from "./app/camera-actions.js";
import { createModeActions } from "./app/mode-actions.js";
import { createLockActions } from "./app/lock-actions.js";
import { setChecked } from "./ui/ui-state.js";
import {
    ensureIndeterminateProgressBar,
    hideElementById,
    readCheckedRadioValue,
    showElementById,
    toggleVisibilityById,
} from "./ui/dom-helpers.js";
import { computeSceneCameraParameters } from "./app/camera-parameters-core.js";
import { createBurnActions } from "./app/burn-actions.js";
import { createRepeatMouseDownHandlers } from "./app/repeat-mousedown.js";
import { createNavigationActions } from "./app/navigation-actions.js";
import { bindRepeatButtons } from "./app/repeat-button-bindings.js";
import {
    applyLandingUiPatch,
    applyMoonUiPatch,
    computeLandingUiPatch,
    computeMoonUiPatch,
} from "./app/config-ui.js";
import { applyMissionMetadata } from "./app/mission-metadata.js";
import {
    applyLandingTimesUpdate,
    computeLandingTimesUpdate,
    computeMissionEventTimes,
} from "./app/config-times.js";
import {
    generateBodyCurve,
    getBodyEphemerisRange,
    getBodyEphemerisState,
    resolveBodySource,
} from "./data/ephemeris-provider.js";
import { applyEventsUpdate, computeEventsUpdate } from "./app/config-events.js";
import {
    applyInitConfigAlreadyInitialized,
    shouldSkipInitConfig,
} from "./app/init-config.js";
import { initSceneHandlerDom } from "./app/scene-handler-init.js";
import { initRepeatButtons } from "./app/init-repeat-buttons.js";
import {
    DEFAULT_VIEW_STATE,
    getPlaneVariablesForSelection,
    normalizePlaneSelection,
    syncPlaneSelectionControls,
} from "./app/plane-view-state.js";
import { createEphemerisInfoPanelActions } from "./app/ephemeris-info-panel.js";
import { createMissionLegacyState } from "./app/mission-legacy-state.js";
import { createMissionRuntimeEntry } from "./app/mission-runtime-entry.js";
import { createMissionSceneEntry } from "./app/mission-scene-entry.js";
import { createMissionViewComposition } from "./app/mission-view-composition.js";
import {
    computeAnimationStepState,
    updateFpsCounterState,
    updateFrameDeltaState,
    updateThreeDLoopCamera,
} from "./app/animation-loop.js";
import { executeAnimationFrame } from "./app/scene-frame-loop-actions.js";
import { adjustSceneCameraProjectionAndSky } from "./app/scene-camera-upkeep-actions.js";

import Swiper from 'swiper';
import * as THREE from 'three';

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
    config,
    missionStartCalled,
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
    mouseDown,
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
    animateLoopCount,
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
    prevFrameTime,
    deltaFrameTime,
    animationRunning,
    startLandingFlag,
    timeoutHandle,
    timeoutHandleZoom,
    dataLoaded,
    ticksPerAnimationStep,
    mousedownTimeout,
    fpsFrameCount,
    fpsLastTime,
    fpsUpdateInterval,
    timeTransLunarInjection,
    timeLunarOrbitInsertion,
    eventInfos,
    currentDimension,
    previousDimension,
    dimensionChanged,
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

function getActiveEphemerisSource(cfg = config) {
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

function getSceneForConfig(cfg = config) {
    return animationScenes[cfg];
}

let toggleMode;
let setDimensionTop;
let setView;

const {
    bridgeActions,
    sceneViewStateActions,
    modeSwitchActions,
    initialMissionViewState,
} = createMissionViewComposition({
    d3,
    d3SelectAll,
    windowRef: window,
    showElementById,
    computeMoonUiPatch,
    applyMoonUiPatch,
    computeLandingUiPatch,
    applyLandingUiPatch,
    setChecked,
    getGlobalConfig: () => globalConfig,
    getConfig: () => config,
    setConfig: (val) => {
        config = val;
    },
    getLandingFlag: () => runtimeFlags.landing,
    setLandingFlag: (val) => {
        runtimeFlags.landing = val;
    },
    getCraftScaleActions: () => missionRuntimeWireup?.craftScaleActions,
    getSceneFrameOrchestrationActions: () => missionRuntimeWireup?.sceneFrameOrchestrationActions,
    render,
    adjustSceneCameraProjectionAndSky,
    getAnimationScenes: () => animationScenes,
    defaultViewState: DEFAULT_VIEW_STATE,
    getSceneForConfig,
    normalizePlaneSelection,
    getPlaneVariablesForSelection,
    syncPlaneSelectionControls,
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
    readOriginMode,
    readViewSettings,
    getToggleMode: () => toggleMode,
    planeSelection,
});

const eventBus = createEventBus();

// Animation Controller instance
// Callbacks sync global state and update UI for backward compatibility
var animationController = new AnimationController({
    onTimeChange: (time) => {
        animTime = time;  // Sync global animTime for backward compatibility
        bridgeActions.setLocation();    // Update scene positions
        eventBus.emit("animation:timeChanged", { time });
    },
    onPlayStateChange: (isPlaying) => {
        animationRunning = isPlaying;  // Sync global state
        updateD3ElementText("#animate", isPlaying ? "Pause" : "Play");
        eventBus.emit(isPlaying ? "animation:play" : "animation:pause", { isPlaying });
    },
    onSpeedChange: (multiplier, isRealtime) => {
        eventBus.emit("animation:speedChanged", { multiplier, isRealtime });
    }
});

var globalConfig = null; // Store loaded config from config.json
const runtimeFlags = {
    joyRide: false,
    landing: false,
};

const { SceneHandler, AnimationScene } = createMissionSceneEntry({
    d3,
    THREE,
    Astronomy,
    lunar_pole,
    COL,
    PC,
    DEFAULT_VIEW_STATE,
    SceneHelpers,
    bindSettingsPanel,
    initSceneHandlerDom,
    computeSceneCameraParameters,
    isTestMode,
    frameMode,
    generateCurveFromChebyshev,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    landingNpzLoaded,
    landingNpzData,
    getActiveEphemerisSource,
    resolveBodySource,
    getBodyEphemerisSources: () => bodyEphemerisSources,
    generateBodyCurve,
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
    getConfig: () => config,
    getCraftId: () => craftId,
    planetProperties,
    getOrbitPointsCount: () => nOrbitPoints,
    getLandingPointsCount: () => nLandingPoints,
    getViewOrbitDescent: () => viewOrbitDescent,
    getViewOrbit: () => viewOrbit,
    render,
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
    getViewPolarAxes: () => viewPolarAxes,
    getViewPoles: () => viewPoles,
    getAnimTime: () => animTime,
    getEarthRadius: () => earthRadius,
    getViewCraters: () => viewCraters,
    getRuntimeFlags: () => runtimeFlags,
    ensureSceneViewState: sceneViewStateActions.ensureSceneViewState,
    getBodyEphemerisState,
    getEphemerisSource: () => ephemerisSource,
    getViewSky: () => viewSky,
    getViewMoonSOI: () => viewMoonSOI,
    getViewXYZAxes: () => viewXYZAxes,
    getViewEclipticPlane: () => viewEclipticPlane,
    getViewEquatorialPlane: () => viewEquatorialPlane,
});

const { toggleRelativeMode, toggleModeGuarded } = initialMissionViewState;
config = initialMissionViewState.config;
var viewOrbit = initialMissionViewState.viewOrbit;
var viewOrbitDescent = initialMissionViewState.viewOrbitDescent;
var viewCraters = initialMissionViewState.viewCraters;
var viewXYZAxes = initialMissionViewState.viewXYZAxes;
var viewPoles = initialMissionViewState.viewPoles;
var viewPolarAxes = initialMissionViewState.viewPolarAxes;
var viewSky = initialMissionViewState.viewSky;
var viewMoonSOI = initialMissionViewState.viewMoonSOI;
var viewEclipticPlane = initialMissionViewState.viewEclipticPlane;
var viewEquatorialPlane = initialMissionViewState.viewEquatorialPlane;
var viewFPS = initialMissionViewState.viewFPS;

function render() {
    var animationScene = animationScenes[config];
    theSceneHandler.render(animationScene);
}

const bindStateCell = (get, set) => ({ get, set });
const bindReadonlyStateCell = (get) => ({ get, set: () => {} });

const missionStateCells = {
    globalConfig: bindStateCell(() => globalConfig, (value) => { globalConfig = value; }),
    config: bindStateCell(() => config, (value) => { config = value; }),
    currentDimension: bindStateCell(() => currentDimension, (value) => { currentDimension = value; }),
    previousDimension: bindStateCell(() => previousDimension, (value) => { previousDimension = value; }),
    dimensionChanged: bindStateCell(() => dimensionChanged, (value) => { dimensionChanged = value; }),
    svgContainer: bindStateCell(() => svgContainer, (value) => { svgContainer = value; }),
    dataLoaded: bindStateCell(() => dataLoaded, (value) => { dataLoaded = value; }),
    svgX: bindStateCell(() => svgX, (value) => { svgX = value; }),
    svgY: bindStateCell(() => svgY, (value) => { svgY = value; }),
    svgWidth: bindStateCell(() => svgWidth, (value) => { svgWidth = value; }),
    svgHeight: bindStateCell(() => svgHeight, (value) => { svgHeight = value; }),
    offsetx: bindStateCell(() => offsetx, (value) => { offsetx = value; }),
    offsety: bindStateCell(() => offsety, (value) => { offsety = value; }),
    landingDataLoaded: bindStateCell(() => landingDataLoaded, (value) => { landingDataLoaded = value; }),
    epochJD: bindStateCell(() => epochJD, (value) => { epochJD = value; }),
    epochDate: bindStateCell(() => epochDate, (value) => { epochDate = value; }),
    startTime: bindStateCell(() => startTime, (value) => { startTime = value; }),
    endTime: bindStateCell(() => endTime, (value) => { endTime = value; }),
    endTimeSC: bindStateCell(() => endTimeSC, (value) => { endTimeSC = value; }),
    latestEndTime: bindStateCell(() => latestEndTime, (value) => { latestEndTime = value; }),
    timelineTotalSteps: bindStateCell(() => timelineTotalSteps, (value) => { timelineTotalSteps = value; }),
    ticksPerAnimationStep: bindStateCell(() => ticksPerAnimationStep, (value) => { ticksPerAnimationStep = value; }),
    PIXELS_PER_AU: bindStateCell(() => PIXELS_PER_AU, (value) => { PIXELS_PER_AU = value; }),
    defaultCameraDistance: bindStateCell(() => defaultCameraDistance, (value) => { defaultCameraDistance = value; }),
    trackWidth: bindStateCell(() => trackWidth, (value) => { trackWidth = value; }),
    earthRadius: bindStateCell(() => earthRadius, (value) => { earthRadius = value; }),
    moonRadius: bindStateCell(() => moonRadius, (value) => { moonRadius = value; }),
    startLandingTime: bindStateCell(() => startLandingTime, (value) => { startLandingTime = value; }),
    endLandingTime: bindStateCell(() => endLandingTime, (value) => { endLandingTime = value; }),
    frameMode: bindReadonlyStateCell(() => frameMode),
    animTime: bindStateCell(() => animTime, (value) => { animTime = value; }),
    craftData: bindStateCell(() => craftData, (value) => { craftData = value; }),
    eventInfos: bindStateCell(() => eventInfos, (value) => { eventInfos = value; }),
    ephemerisSource: bindStateCell(() => ephemerisSource, (value) => { ephemerisSource = value; }),
    bodyEphemerisSources: bindStateCell(() => bodyEphemerisSources, (value) => { bodyEphemerisSources = value; }),
    timeTransLunarInjection: bindStateCell(() => timeTransLunarInjection, (value) => { timeTransLunarInjection = value; }),
    timeLunarOrbitInsertion: bindStateCell(() => timeLunarOrbitInsertion, (value) => { timeLunarOrbitInsertion = value; }),
    theSceneHandler: bindStateCell(() => theSceneHandler, (value) => { theSceneHandler = value; }),
    startLandingFlag: bindStateCell(() => startLandingFlag, (value) => { startLandingFlag = value; }),
    viewOrbit: bindStateCell(() => viewOrbit, (value) => { viewOrbit = value; }),
    viewOrbitDescent: bindStateCell(() => viewOrbitDescent, (value) => { viewOrbitDescent = value; }),
    viewCraters: bindStateCell(() => viewCraters, (value) => { viewCraters = value; }),
    viewXYZAxes: bindStateCell(() => viewXYZAxes, (value) => { viewXYZAxes = value; }),
    viewPoles: bindStateCell(() => viewPoles, (value) => { viewPoles = value; }),
    viewPolarAxes: bindStateCell(() => viewPolarAxes, (value) => { viewPolarAxes = value; }),
    viewSky: bindStateCell(() => viewSky, (value) => { viewSky = value; }),
    viewMoonSOI: bindStateCell(() => viewMoonSOI, (value) => { viewMoonSOI = value; }),
    viewEclipticPlane: bindStateCell(() => viewEclipticPlane, (value) => { viewEclipticPlane = value; }),
    viewEquatorialPlane: bindStateCell(() => viewEquatorialPlane, (value) => { viewEquatorialPlane = value; }),
    viewFPS: bindStateCell(() => viewFPS, (value) => { viewFPS = value; }),
    animDate: bindStateCell(() => animDate, (value) => { animDate = value; }),
    mousedownTimeout: bindStateCell(() => mousedownTimeout, (value) => { mousedownTimeout = value; }),
    timeoutHandleZoom: bindStateCell(() => timeoutHandleZoom, (value) => { timeoutHandleZoom = value; }),
    mouseDown: bindStateCell(() => mouseDown, (value) => { mouseDown = value; }),
    missionStartCalled: bindStateCell(() => missionStartCalled, (value) => { missionStartCalled = value; }),
    timeoutHandle: bindReadonlyStateCell(() => timeoutHandle),
    animationRunning: bindReadonlyStateCell(() => animationRunning),
    svgRect: bindStateCell(() => svgRect, (value) => { svgRect = value; }),
    sunLongitude: bindStateCell(() => sunLongitude, (value) => { sunLongitude = value; }),
    craftId: bindReadonlyStateCell(() => craftId),
};

({ missionRuntimeWireup } = createMissionRuntimeEntry({
    d3,
    missionStateCells,
    runtimeFlags,
    animationScenes,
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
    ephemerisStatuses,
    resolveBodySource,
    getActiveEphemerisSource,
    sceneViewStateActions,
    AnimationScene,
    bridgeActions,
    modeSwitchActions,
    staticWireupDeps: {
        d3,
        d3SelectAll,
        THREE,
        Astronomy,
        windowRef: window,
        documentRef: document,
        consoleRef: console,
        SwiperClass: Swiper,
        PC,
        TC,
        UC,
        formatMetric: FORMAT_METRIC,
        updateEventInfo,
        clearEventInfo,
        updateProgressLabel,
        ensureIndeterminateProgressBar,
        showElementById,
        hideElementById,
        loadChebyshev,
        loadNpz,
        processOrbitData,
        resolveLandingNpzUrl,
        resolveLandingChebyshevUrl,
        createUTCTimestamp,
        animationScenes,
        animation3DControllers,
        animation2DControllers,
        orbitDataLoaded,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        ephemerisRecords,
        ephemerisStatuses,
        planetProperties,
        animationController,
        AnimationScene,
        Animation3DController,
        Animation2DController,
        SceneHandlerClass: SceneHandler,
        resolveOrbitUrls,
        resolveOrbitNpzUrl,
        loadMissionConfig,
        bindInfoPanelControls,
        updateEphemerisPanel,
        applyMissionMetadata,
        updateMultipleElementsText,
        updateSpacecraftMnemonic,
        applyLandingTimesUpdate,
        computeLandingTimesUpdate,
        applyEventsUpdate,
        computeEventsUpdate,
        computeMissionEventTimes,
        bindBurnButtons,
        shouldSkipInitConfig,
        applyInitConfigAlreadyInitialized,
        normalizePlaneSelection,
        syncPlaneSelectionControls,
        setChecked,
        readOriginMode,
        readViewSettings,
        setFPSCounterVisibility,
        computeSunLongitude,
        computeSceneState,
        getBodyEphemerisRange,
        getBodyEphemerisState,
        generateBodyCurve,
        PIXELS_PER_AU,
        render,
        clearProgressLabel,
        updateD3ElementText,
        createNavigationActions,
        createRepeatMouseDownHandlers,
        createLockActions,
        createCameraActions,
        createModeActions,
        createBurnActions,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        requestAnimationFrame,
        clearTimeoutFn: clearTimeout,
        bindRepeatButtons,
        initRepeatButtons,
    },
    readPlaneSelection: () => readCheckedRadioValue("plane", "DEFAULT"),
    toggleStatsVisibility: () => {
        toggleVisibilityById("stats");
    },
    animateLoop,
    initAnimation,
    isRelativeMode,
    isTestMode,
}));

toggleMode = missionRuntimeWireup.toggleMode;
setDimensionTop = missionRuntimeWireup.setDimensionTop;
setView = missionRuntimeWireup.setView;

async function initAnimation(flags) {
    return missionRuntimeWireup.runtimeBootstrapActions.initOrchestrationActions.initAnimation(flags);
}

function animateLoop() {
    ({
        fpsFrameCount,
        fpsLastTime,
        prevFrameTime,
        deltaFrameTime,
        animateLoopCount,
    } = executeAnimationFrame({
        performanceRef: performance,
        fpsFrameCount,
        fpsLastTime,
        fpsUpdateInterval,
        updateFPSCounter,
        prevFrameTime,
        deltaFrameTime,
        animateLoopCount,
        ticksPerAnimationStep,
        updateFpsCounterState,
        updateFrameDeltaState,
        computeAnimationStepState,
        animationController,
        getScene: () => animationScenes[config],
        cameraControlsCallback: bridgeActions.cameraControlsCallback,
        updateThreeDLoopCamera,
        updateCameraOverlay: () => missionRuntimeWireup.runtimeBootstrapActions.updateCameraOverlay(),
    }));

    requestAnimationFrame(animateLoop);
 
}

export function main() {
    startMissionApp({
        eventBus,
        handlers: {
            reset: () => missionRuntimeWireup.runtimeBootstrapActions.reset(),
            toggleMode: toggleModeGuarded,
            toggleRelativeMode,
            changeCameraFromTo: () => missionRuntimeWireup.runtimeBootstrapActions.changeCameraFromTo(),
            toggleLockSC: () => missionRuntimeWireup.runtimeBootstrapActions.toggleLockSC(),
            toggleLockMoon: () => missionRuntimeWireup.runtimeBootstrapActions.toggleLockMoon(),
            toggleLockEarth: () => missionRuntimeWireup.runtimeBootstrapActions.toggleLockEarth(),
            togglePlane: () => missionRuntimeWireup.runtimeBootstrapActions.togglePlane(),
            setView,
            setDimensionTop,
            cy3Animate: () => missionRuntimeWireup.runtimeBootstrapActions.cy3Animate(),
            toggleJoyRide: () => missionRuntimeWireup.runtimeBootstrapActions.toggleJoyRide(),
            toggleLanding: () => missionRuntimeWireup.runtimeBootstrapActions.toggleLanding(),
            toggleInfo: () => missionRuntimeWireup.runtimeBootstrapActions.toggleInfo(),
            initAnimation,
        },
    });

    missionRuntimeWireup.runtimeBootstrapActions.initCameraOverlay();
}

async function processOrbitData() {
    return missionRuntimeWireup.runtimeBootstrapActions.processOrbitData();
}

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
