
// Copyright (c) 2013-2024 Sankaranarayanan Viswanathan. All rights reserved.

import { lunar_pole } from "./astro.js";
import {
    CELESTIAL_BODIES as CB,
    COLORS as COL,
    FORMAT_CONSTANTS as FC,
    LIGHT_SETTINGS as LT,
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
    formatDateTimeIST,
    getDateComponentsUTC
} from "./utils/time-utils.js";
import { SceneHelpers } from "./rendering/scene-helpers.js";
import { AnimationController } from "./animation/animation-controller.js";
import {
    computeSceneState,
    // toScreenCoordinates, // used by controllers
    // projectToPlane        // used by controllers
} from "./scene-state.js";
import { Animation3DController, Animation2DController } from "./controllers/index.js";
import { computeSunLongitude } from "./services/ephemeris.js";
import { applyCameraFromTo, readCameraLookMode, readCameraPositionMode, readOriginMode, readViewSettings } from "./ui/ui-state.js";
import { bindBurnButtons, bindSettingsPanel } from "./ui/event-handlers.js";
import {
    getEphemerisSource,
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
import { createSceneCameraActions } from "./app/scene-camera-actions.js";
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
import { createModeSwitchActions } from "./app/mode-switch.js";
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
import { createSceneViewStateActions } from "./app/scene-view-state.js";
import { createRelativeModeActions } from "./app/relative-mode.js";
import { createEphemerisInfoPanelActions } from "./app/ephemeris-info-panel.js";
import { createSceneHandlerClass } from "./app/scene-handler-class.js";
import { createAnimationSceneClass } from "./app/animation-scene-class.js";
import { createMissionBridgeActions } from "./app/mission-bridge-actions.js";
import {
    createMissionRuntimeBootstrapActions,
    createMissionWiringActions,
} from "./app/mission-context-builders.js";
import { createMissionStateAccess } from "./app/mission-state-access.js";
import { createMissionSceneActionBundle } from "./app/mission-scene-action-bundle.js";
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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TrackballControls } from '../../../third-party/TrackballControls.js';

// Check if running in test mode (for consistent visual regression testing)
const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
const urlMode = new URLSearchParams(window.location.search).get('mode');
const isRelativeMode = urlMode === "relative";
const frameMode = isRelativeMode ? "relative" : "inertial";

// orbit and location related data

// constants

var SC     = "SC"; // Default spacecraft mnemonic - will be overridden by config

var craftSize = 5; // in pixels

var planetProperties = {
    "SC":      { "id": SC,        "name": "SC",              "color": "#ffa000",     "orbitcolor": "#66CCFF",    "stroke-width": 1.0, "r": 3.2, "labelOffsetX": -30, "labelOffsetY": -10 },
    
    
    "SUN":      { "id": CB.SUN,     "name": "Sun",           "color": "yellow",    "orbitcolor": "yellow",  "stroke-width": 1.0, "r": 5,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "MERCURY":  { "id": CB.MERCURY, "name": "Mercury",       "color": "green",     "orbitcolor": "green",   "stroke-width": 1.0, "r": 5,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "VENUS":    { "id": CB.VENUS,   "name": "Venus",         "color": "grey",      "orbitcolor": "grey",    "stroke-width": 1.0, "r": 5,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "EARTH":    { "id": CB.EARTH,   "name": "Earth",         "color": "blue",      "orbitcolor": "blue",    "stroke-width": 1.0, "r": 5,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "MARS":     { "id": CB.MARS,    "name": "Mars",          "color": "red",       "orbitcolor": "red",     "stroke-width": 0.3, "r": 5,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "MOON":     { "id": CB.MOON,    "name": "Moon",          "color": "lightgrey", "orbitcolor": "grey",    "stroke-width": 1.0, "r": 3,   "labelOffsetX": +10, "labelOffsetY": +10 },
    "CSS":      { "id": CB.CSS,     "name": "Siding Spring", "color": "cyan",      "orbitcolor": "cyan",    "stroke-width": 1.0, "r": 3,   "labelOffsetX": +10, "labelOffsetY": +10 },
};

// D3 formatters (derived from constants)
var FORMAT_PERCENT = d3.format(FC.PERCENT);
var FORMAT_METRIC = d3.format(FC.METRIC);

//
// General state variables
//

var craftId = "SC"; // Default spacecraft mnemonic - will be overridden by config
var config = "geo";
var missionStartCalled = false;
var orbitDataLoaded = { "geo": false, "lunar": false };
var orbitDataProcessed = { "geo": false, "lunar": false };
var orbitData = {};
var landingDataLoaded = false;
var landingDataProcessed = false;
var landingData = {};
var landingMetadata = {};
var ephemerisSource = "chebyshev"; // "chebyshev" (default) or "npz"
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

// Chebyshev ephemeris data (replaces NPZ for spacecraft position)
var chebyshevDataLoaded = { "geo": false, "lunar": false };
var chebyshevData = {};  // { "geo": chebData, "lunar": chebData }
var npzDataLoaded = { geo: false, lunar: false };
var npzData = {}; // { geo: {SC, MOON, EARTH}, lunar: {...} }
var landingNpzLoaded = { geo: false, lunar: false };
var landingNpzData = {};
var landingChebyshevLoaded = { geo: false, lunar: false };
var landingChebyshevData = {};
var nOrbitPoints = 0;
var nLandingPoints = 0;
var progress = 0;
var bannerShown = false;
var stopZoom = false;
var sunLongitude = 0.0;

// animation control
var mouseDown = false;

var planeSelection = DEFAULT_VIEW_STATE.planeSelection;
var plane = DEFAULT_VIEW_STATE.plane;
var xVariable = DEFAULT_VIEW_STATE.xVariable;
var yVariable = DEFAULT_VIEW_STATE.yVariable;
var zVariable = DEFAULT_VIEW_STATE.zVariable;
var vxVariable = DEFAULT_VIEW_STATE.vxVariable;
var vyVariable = DEFAULT_VIEW_STATE.vyVariable;
var vzVariable = DEFAULT_VIEW_STATE.vzVariable;
var xFactor = DEFAULT_VIEW_STATE.xFactor;
var yFactor = DEFAULT_VIEW_STATE.yFactor;
var zFactor = DEFAULT_VIEW_STATE.zFactor;

//
// Orbit data related variables
//

var craftData = {};

//
// Space related variables (as in Space Time)
//

var PIXELS_PER_AU;
var svgX = 0;
var svgY = 0;
var svgWidth = 0;
var svgHeight = 0;
var offsetx = 0;
var offsety = 0;
var trackWidth;
var earthRadius;
var skyRadius;
var moonRadius;
var svgContainer;
var svgRect;
var viewBoxWidth;
var viewBoxHeight;
var zoomFactor = DEFAULT_VIEW_STATE.zoomFactor;
var panx = DEFAULT_VIEW_STATE.panx;
var pany = DEFAULT_VIEW_STATE.pany;
var defaultCameraDistance = 0;

//
// Time related variables
//

var animateLoopCount = 0;
var epochJD;
var epochDate;

var startTime;
var endTime;
var endTimeSC;
var latestEndTime; 
var startLandingTime;
var endLandingTime;

var timelineTotalSteps;
var stepsPerHop;
var orbitsJsonFileSizeInBytes;
var animDate;
var animTime;
// var timelineIndex = 0;
// var timelineIndexStep = 1;
var animTimeStepMinutes = 1;
var realtimespeed = false;
var prevFrameTime = null;
var curFrameTime = null;
var deltaFrameTime = TC.ONE_MINUTE_MS;
var animationRunning = false;
var stopAnimationFlag = false;
var startLandingFlag = false;
var timeoutHandle;
var timeoutHandleZoom;
var dataLoaded = false;
var ticksPerAnimationStep;
var mousedownTimeout = UC.ZOOM_TIMEOUT;

// FPS calculation variables
var fpsFrameCount = 0;
var fpsLastTime = 0;
var fpsUpdateInterval = 1000; // Update FPS every 1000ms (1 second)

const {
    showWhatsNew,
    wait,
    wait10,
    wait20,
    sleep,
    fetchMetadata,
    updateMoonUIFromConfig,
    updateLandingUIFromConfig,
    updateCraftScale,
    cameraControlsCallback,
    onWindowResize,
    showPlanet,
    setLocation,
    adjustCameraProjectionMatrixAndSkyAngle,
} = createMissionBridgeActions({
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
    getCraftScaleActions: () => craftScaleActions,
    getSceneFrameOrchestrationActions: () => sceneFrameOrchestrationActions,
    render,
    adjustSceneCameraProjectionAndSky,
    getAnimationScenes: () => animationScenes,
});

// Animation Controller instance
// Callbacks sync global state and update UI for backward compatibility
var animationController = new AnimationController({
    onTimeChange: (time) => {
        animTime = time;  // Sync global animTime for backward compatibility
        setLocation();    // Update scene positions
        eventBus.emit("animation:timeChanged", { time });
    },
    onPlayStateChange: (isPlaying) => {
        animationRunning = isPlaying;  // Sync global state
        stopAnimationFlag = !isPlaying;
        updateD3ElementText("#animate", isPlaying ? "Pause" : "Play");
        eventBus.emit(isPlaying ? "animation:play" : "animation:pause", { isPlaying });
    },
    onSpeedChange: (multiplier, isRealtime) => {
        animTimeStepMinutes = multiplier;  // Sync global state
        realtimespeed = isRealtime;
        eventBus.emit("animation:speedChanged", { multiplier, isRealtime });
    }
});

// Spacecraft specific times and information
var timeTransLunarInjection;
var timeLunarOrbitInsertion;


var eventInfos = [];

// 3D rendering related variables

var currentDimension = "3D"; 
var previousDimension = null;
var dimensionChanged = false;
var theSceneHandler = null;
export var animationScenes = {};
var animation3DControllers = {};  // Per-config 3D controllers
var animation2DControllers = {};  // Per-config 2D controllers

function getSceneForConfig(cfg = config) {
    return animationScenes[cfg];
}

const {
    syncPlaneStateForConfig,
    ensureSceneViewState,
    getActiveSceneViewState,
    getPlaneSelectionState,
    setPlaneSelectionState,
    setPlaneVariablesState,
    getPlaneVariablesState,
    getZoomFactorState,
    setZoomFactorState,
    getPanXState,
    setPanXState,
    getPanYState,
    setPanYState,
    resetViewTransformState,
} = createSceneViewStateActions({
    defaultViewState: DEFAULT_VIEW_STATE,
    getConfig: () => config,
    getSceneForConfig,
    normalizePlaneSelection,
    getPlaneVariablesForSelection,
    syncPlaneSelectionControls,
    setChecked,
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
});

// Event bus for decoupling UI ↔ mission orchestration
const eventBus = createEventBus();
var globalConfig = null; // Store loaded config from config.json
const runtimeFlags = {
    joyRide: false,
    landing: false,
};

const {
    orbitCurveActions,
    bodyRotationActions,
    locationActions,
    spacecraftCurveActions,
    primarySecondaryBodiesActions,
    sceneInitActions,
    sceneDisposeActions,
    dimensionsActions,
    scene3dInitActions,
    sceneCameraPositionActions,
    sceneCreationActions,
    orbitVectorProcessingActions,
    lineOfSightActions,
    axesHelperActions,
    lightActions,
    spacecraftActions,
    sceneCameraControllerActions,
    spacecraftModelActions,
    skyActions,
    earthActions,
    moonActions,
} = createMissionSceneActionBundle({
    THREE,
    Astronomy,
    lunar_pole,
    COL,
    PC,
    generateCurveFromChebyshev,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getLandingNpzLoaded: (cfg = config) => !!landingNpzLoaded[cfg],
    getLandingNpzData: (cfg = config) => landingNpzData[cfg],
    getEphemerisSource: (cfg = config) => getActiveEphemerisSource(cfg),
    resolveBodySource: (bodyId) =>
        resolveBodySource({
            bodyId,
            bodySources: bodyEphemerisSources,
            defaultSpacecraftSource: ephemerisSource,
        }),
    generateBodyCurve,
    getStepMs: (cfg) => animationScenes[cfg].stepDurationInMilliSeconds,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getLandingEnabled: () => !!(globalConfig && globalConfig.landing && globalConfig.landing.enabled),
    getLandingChebyshevLoaded: (cfg = config) => !!landingChebyshevLoaded[cfg],
    getLandingChebyshevData: (cfg = config) => landingChebyshevData[cfg],
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
    wait10,
    wait20,
    clearEventInfo,
    computeSVGDimensions: () => svgActions.computeSVGDimensions(),
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    cameraControlsCallback,
    setOrbitPointsCount: (count) => {
        nOrbitPoints = count;
    },
    setLandingPointsCount: (count) => {
        nLandingPoints = count;
    },
    getCraftSize: () => craftSize,
    getDefaultCameraDistance: () => defaultCameraDistance,
    getRendererDomElement: () => theSceneHandler.renderer.domElement,
    getModelPathPrefix: () => window.missionConfig.modelPath,
    getMoonRadius: () => moonRadius,
    getViewPolarAxes: () => viewPolarAxes,
    getViewPoles: () => viewPoles,
    getAnimTime: () => animTime,
    getEarthRadius: () => earthRadius,
    getViewCraters: () => viewCraters,
    SceneHelpers,
});

// View variables

let toggleMode;
let setDimensionTop;
let setView;

const {
    consumeOriginOverrideFromSession,
    applyRelativeModeOriginSelection,
    toggleRelativeMode,
    toggleModeGuarded,
} = createRelativeModeActions({
    isRelativeMode,
    setChecked,
    readOriginMode,
    getToggleMode: () => toggleMode,
});

consumeOriginOverrideFromSession();

// Relative mode is Earth-centered; force Earth origin selection without changing defaults for normal runs.
applyRelativeModeOriginSelection();

var config = readOriginMode();
syncPlaneSelectionControls(planeSelection, setChecked);
var configGeo = (config === "geo");
var configLunar = (config === "lunar");

const initialViewSettings = readViewSettings();
var viewOrbit = initialViewSettings.viewOrbit;
var viewOrbitDescent = initialViewSettings.viewOrbitDescent;
var viewCraters = initialViewSettings.viewCraters;
var viewXYZAxes = initialViewSettings.viewXYZAxes;
var viewPoles = initialViewSettings.viewPoles;
var viewPolarAxes = initialViewSettings.viewPolarAxes;
var viewSky = initialViewSettings.viewSky;
var viewMoonSOI = initialViewSettings.viewMoonSOI;
var viewEclipticPlane = initialViewSettings.viewEclipticPlane;
var viewEquatorialPlane = initialViewSettings.viewEquatorialPlane;
var viewFPS = initialViewSettings.viewFPS;

const SceneHandler = createSceneHandlerClass({
    THREE,
    d3,
    bindSettingsPanel,
    initSceneHandlerDom,
    computeSVGDimensions: () => svgActions.computeSVGDimensions(),
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    isTestMode,
    onWindowResize,
    updateCraftScale,
    getRuntimeState: () => ({
        globalConfig,
        joyRideFlag: runtimeFlags.joyRide,
        landingFlag: runtimeFlags.landing,
        earthRadius,
        moonRadius,
    }),
});

const AnimationScene = createAnimationSceneClass({
    THREE,
    PC,
    DEFAULT_VIEW_STATE,
    SceneHelpers,
    lunar_pole,
    sceneCreationActions,
    sceneCameraPositionActions,
    scene3dInitActions,
    dimensionsActions,
    skyActions,
    earthActions,
    moonActions,
    locationActions,
    primarySecondaryBodiesActions,
    spacecraftCurveActions,
    spacecraftActions,
    lineOfSightActions,
    axesHelperActions,
    lightActions,
    sceneCameraControllerActions,
    spacecraftModelActions,
    sceneInitActions,
    orbitVectorProcessingActions,
    bodyRotationActions,
    sceneDisposeActions,
    ensureSceneViewState,
    computeSceneCameraParameters,
    adjustCameraProjectionMatrixAndSkyAngle,
    getDefaultCameraDistance: () => defaultCameraDistance,
    getBodyEphemerisState,
    resolveBodySource,
    getRuntimeState: () => ({
        globalConfig,
        frameMode,
        config,
        npzData,
        npzDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        bodyEphemerisSources,
        ephemerisSource,
        animTime,
        earthRadius,
        moonRadius,
        viewSky,
        viewPolarAxes,
        viewPoles,
        viewMoonSOI,
        viewXYZAxes,
        viewEclipticPlane,
        viewEquatorialPlane,
    }),
});

function render() {
    // console.log("render() global function called");
    var animationScene = animationScenes[config];
    theSceneHandler.render(animationScene);
}

function handleGeoInit() {

}

const {
    switchToGeo: handleModeSwitchToGeo,
    switchToLunar: handleModeSwitchToLunar,
    switchMode: handleModeSwitch,
    switchDimension: handleDimensionSwitch,
} = createModeSwitchActions({
    d3,
    d3SelectAll,
});

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

const missionStateAccess = createMissionStateAccess({
    d3,
    state: missionStateCells,
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
    getPlaneVariablesState,
    getZoomFactorState,
    getPanXState,
    getPanYState,
    getPlaneSelectionState,
    setPlaneVariablesState,
    getRuntimeBootstrapActions: () => runtimeBootstrapActions,
    getAnimationSceneInitDone: () => AnimationScene.SCENE_STATE_INIT_DONE,
    syncPlaneStateForConfig,
});

const {
    svgActions,
    loadOrbitDataIfNeededAndProcess,
    loadLandingDataAndProcess,
    processOrbitElementsData,
    shouldDrawOrbit,
    planetStartTime,
    isLocationAvaialable,
    getBodyLocation,
    craftScaleActions,
    processOrbitVectorsData,
    setLabelLocation,
    showGreenwichLongitude,
    adjustLabelLocations,
    handleZoom,
    handleZoomNew,
    zoomEnd,
    zoomChangeTransform,
    zoomChange,
    planeActions,
    initConfigSceneSetupActions,
    initConfigOrchestrationActions,
    initConfigUiActions,
    initConfig,
    dimensionActions,
    toggleMode: wiredToggleMode,
    setDimensionTop: wiredSetDimensionTop,
    setView: wiredSetView,
    sceneUiUpdateActions,
    sceneFrameUiActions,
    scene2DFrameActions,
    sceneFrameOrchestrationActions,
    getStartAndEndTimes,
} = createMissionWiringActions({
    d3,
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
    sleep,
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
    updateMoonUIFromConfig,
    updateLandingUIFromConfig,
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
    setPlaneSelectionState,
    readOriginMode,
    readViewSettings,
    setFPSCounterVisibility,
    computeSunLongitude,
    computeSceneState,
    getBodyEphemerisRange,
    getBodyEphemerisState,
    generateBodyCurve,
    PIXELS_PER_AU,
    setZoomFactorState,
    setPanXState,
    setPanYState,
    showPlanet,
    handleDimensionSwitch,
    setLocation,
    handleModeSwitchToGeo,
    handleModeSwitchToLunar,
    isRelativeMode,
    initAnimation,
    updateCraftScale,
    adjustCameraProjectionMatrixAndSkyAngle,
    render,
    stateAccess: missionStateAccess,
});

toggleMode = wiredToggleMode;
setDimensionTop = wiredSetDimensionTop;
setView = wiredSetView;

async function initAnimation(flags) {
    return runtimeBootstrapActions.initOrchestrationActions.initAnimation(flags);
}

function animateLoop() {
    ({
        curFrameTime,
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
        cameraControlsCallback,
        updateThreeDLoopCamera,
        updateCameraOverlay: () => runtimeBootstrapActions.updateCameraOverlay(),
    }));

    requestAnimationFrame(animateLoop);
 
}

export function main() {
    const onloadEndTime = startMissionApp({
        eventBus,
        handlers: {
            reset: () => runtimeBootstrapActions.reset(),
            toggleMode: toggleModeGuarded,
            toggleRelativeMode,
            changeCameraFromTo: () => runtimeBootstrapActions.changeCameraFromTo(),
            toggleLockSC: () => runtimeBootstrapActions.toggleLockSC(),
            toggleLockMoon: () => runtimeBootstrapActions.toggleLockMoon(),
            toggleLockEarth: () => runtimeBootstrapActions.toggleLockEarth(),
            togglePlane: () => runtimeBootstrapActions.togglePlane(),
            setView,
            setDimensionTop,
            cy3Animate: () => runtimeBootstrapActions.cy3Animate(),
            toggleJoyRide: () => runtimeBootstrapActions.toggleJoyRide(),
            toggleLanding: () => runtimeBootstrapActions.toggleLanding(),
            toggleInfo: () => runtimeBootstrapActions.toggleInfo(),
            initAnimation,
        },
    });

    runtimeBootstrapActions.initCameraOverlay();

    // console.log("onload() took " + onloadEndTime + " ms");
}

let runtimeBootstrapActions = null;

async function processOrbitData() {
    return runtimeBootstrapActions.processOrbitData();
}

runtimeBootstrapActions = createMissionRuntimeBootstrapActions({
    d3,
    d3SelectAll,
    hideElementById,
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
    readPlaneSelection: () => readCheckedRadioValue("plane", "DEFAULT"),
    setPlaneSelectionState,
    setChecked,
    toggleStatsVisibility: () => {
        toggleVisibilityById("stats");
    },
    requestAnimationFrame,
    clearTimeoutFn: clearTimeout,
    bindRepeatButtons,
    initRepeatButtons,
    resetViewTransformState,
    zoomEnd,
    zoomChange,
    zoomChangeTransform,
    handleZoom,
    render,
    sleep,
    updateCraftScale,
    setView,
    setDimension: (value) => {
        dimensionActions.setDimension(value);
    },
    setLocation,
    initConfig,
    animateLoop,
    initSVG: () => svgActions.initSVG(),
    loadOrbitDataIfNeededAndProcess,
    loadLandingDataAndProcess,
    processOrbitVectorsData,
    getPanXState,
    setPanXState,
    getPanYState,
    setPanYState,
    getZoomFactorState,
    setZoomFactorState,
    orbitDataProcessed,
    handlePlaneChange: planeActions.handlePlaneChange,
    animationController,
    isTestMode,
    THREE,
    UC,
    PC,
    stateAccess: missionStateAccess,
});

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
