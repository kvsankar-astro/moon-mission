
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
import { degreesToRadians, distance3D, sphericalToCartesian, velocityToAngle } from "./utils/math-utils.js";
import {
    createUTCTimestamp,
    formatDateTimeIST,
    getDateComponentsUTC
} from "./utils/time-utils.js";
import { SceneHelpers } from "./rendering/scene-helpers.js";
import { SkyRenderer } from "./rendering/sky-renderer.js";
import { LightManager } from "./rendering/light-manager.js";
import { EarthRenderer } from "./rendering/earth-renderer.js";
import { MoonRenderer } from "./rendering/moon-renderer.js";
import { SpacecraftRenderer } from "./rendering/spacecraft-renderer.js";
import { CameraController, CAMERA_LOOK_MODE } from "./rendering/camera-controller.js";
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
import { createAnimationActions } from "./app/animation-actions.js";
import { createSettingsActions } from "./app/settings-actions.js";
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
import { createDimensionActions } from "./app/dimension-actions.js";
import { createSvgActions } from "./app/svg-actions.js";
import { createPlaneActions } from "./app/plane-actions.js";
import { createOrbitLoadActions } from "./app/orbit-load-actions.js";
import { createLandingLoadActions } from "./app/landing-load-actions.js";
import { createOrbitElementsActions } from "./app/orbit-elements-actions.js";
import { createOrbitVectorsActions } from "./app/orbit-vectors-actions.js";
import { createZoomActions } from "./app/zoom-actions.js";
import { createLabelActions } from "./app/label-actions.js";
import { createOrbitProcessActions } from "./app/orbit-process-actions.js";
import { createBodyLocationActions } from "./app/body-location-actions.js";
import { createCraftScaleActions } from "./app/craft-scale-actions.js";
import { computeSceneCameraParameters } from "./app/camera-parameters-core.js";
import { createSceneCameraActions } from "./app/scene-camera-actions.js";
import { createOrbitCurveActions } from "./app/orbit-curve-actions.js";
import { createBodyRotationActions } from "./app/body-rotation-actions.js";
import { createLocationActions } from "./app/location-actions.js";
import { createSpacecraftCurveActions } from "./app/spacecraft-curve-actions.js";
import { createPrimarySecondaryBodiesActions } from "./app/primary-secondary-bodies-actions.js";
import { loadSceneTextures } from "./app/texture-loader.js";
import { createSceneInitActions } from "./app/scene-init-actions.js";
import { createSceneDisposeActions } from "./app/scene-dispose-actions.js";
import { createDimensionsActions } from "./app/dimensions-actions.js";
import { applySceneTextures } from "./app/scene-texture-actions.js";
import { createScene3dInitActions } from "./app/scene-3d-init-actions.js";
import { createSceneCameraPositionActions } from "./app/scene-camera-position-actions.js";
import { createSceneCreationActions } from "./app/scene-creation-actions.js";
import { createOrbitVectorProcessingActions } from "./app/orbit-vector-processing-actions.js";
import { createLineOfSightActions } from "./app/line-of-sight-actions.js";
import { createAxesHelperActions } from "./app/axes-helper-actions.js";
import { createLightActions } from "./app/light-actions.js";
import { createSpacecraftActions } from "./app/spacecraft-actions.js";
import { createSceneCameraControllerActions } from "./app/scene-camera-controller-actions.js";
import { createSpacecraftModelActions } from "./app/spacecraft-model-actions.js";
import { createSkyActions } from "./app/sky-actions.js";
import { createEarthActions } from "./app/earth-actions.js";
import { createMoonActions } from "./app/moon-actions.js";
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
import { createStartEndTimesResolver } from "./app/start-end-times.js";
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
import { createCameraOverlayActions } from "./app/camera-overlay.js";
import { createSceneUiUpdateActions } from "./app/scene-ui-update-actions.js";
import { createSceneFrameUiActions } from "./app/scene-frame-ui-actions.js";
import { createScene2DFrameActions } from "./app/scene-2d-frame-actions.js";
import { createSceneFrameOrchestrationActions } from "./app/scene-frame-orchestration-actions.js";
import { createInitOrchestrationActions } from "./app/init-orchestration.js";
import { createSceneHandlerClass } from "./app/scene-handler-class.js";
import { createAnimationSceneClass } from "./app/animation-scene-class.js";
import { createInitConfigSceneSetupActions } from "./app/init-config-scene-setup.js";
import { createInitConfigOrchestrationActions } from "./app/init-config-orchestration.js";
import { createInitConfigUiActions } from "./app/init-config-ui-actions.js";
import { createInitConfigFlowActions } from "./app/init-config-flow-actions.js";
import { createRuntimeInitActions } from "./app/runtime-init.js";
import { createRuntimeUiControlsActions } from "./app/runtime-ui-controls.js";
import { createRuntimeInitDeps, createRuntimeUiControlsDeps } from "./app/runtime-deps.js";
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

function showWhatsNew() {
    // Keep the legacy function but route through the lightweight dialog shim.
    if (window.CY3Dialog?.open) {
        window.CY3Dialog.open("#dialog-whatsnew");
    } else {
        showElementById("dialog-whatsnew");
    }
}

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

const orbitCurveActions = createOrbitCurveActions({
    THREE,
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
    getStepMs: (config) => animationScenes[config].stepDurationInMilliSeconds,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getLandingEnabled: () => !!(globalConfig && globalConfig.landing && globalConfig.landing.enabled),
    getLandingChebyshevLoaded: (cfg = config) => !!landingChebyshevLoaded[cfg],
    getLandingChebyshevData: (cfg = config) => landingChebyshevData[cfg],
    getStartLandingTime: () => startLandingTime,
    getEndLandingTime: () => endLandingTime,
    PC,
    getPixelsPerAU: () => PIXELS_PER_AU,
});

const bodyRotationActions = createBodyRotationActions({
    lunar_pole,
    Astronomy,
    degreesToRadians,
    PC,
});

const locationActions = createLocationActions({
    THREE,
    sphericalToCartesian,
    degreesToRadians,
    COL,
    getEarthRadius: () => earthRadius,
    getMoonRadius: () => moonRadius,
    getGlobalConfig: () => globalConfig,
    getViewCraters: () => viewCraters,
});

const spacecraftCurveActions = createSpacecraftCurveActions({
    THREE,
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
    createLineMaterial: (color) => new THREE.LineBasicMaterial({ color, linewidth: 0.2 }),
});

const primarySecondaryBodiesActions = createPrimarySecondaryBodiesActions({
    getConfig: () => config,
    getGlobalConfig: () => globalConfig,
});

const sceneInitActions = createSceneInitActions({
    THREE,
    render,
    wait20,
    clearEventInfo,
});

const sceneDisposeActions = createSceneDisposeActions();

const dimensionsActions = createDimensionsActions({
    computeSVGDimensions: () => svgActions.computeSVGDimensions(),
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
});

const scene3dInitActions = createScene3dInitActions({
    THREE,
    loadSceneTextures,
    applySceneTextures,
});

const sceneCameraPositionActions = createSceneCameraPositionActions({
    cameraControlsCallback,
    distance3D,
});

const sceneCreationActions = createSceneCreationActions();

const orbitVectorProcessingActions = createOrbitVectorProcessingActions({
    orbitCurveActions,
    getConfig: () => config,
    setOrbitPointsCount: (count) => {
        nOrbitPoints = count;
    },
    setLandingPointsCount: (count) => {
        nLandingPoints = count;
    },
});

const lineOfSightActions = createLineOfSightActions();

const axesHelperActions = createAxesHelperActions({
    SceneHelpers,
    getPixelsPerAU: () => PIXELS_PER_AU,
    PC,
});

const lightActions = createLightActions({
    LightManager,
});

const spacecraftActions = createSpacecraftActions({
    SpacecraftRenderer,
    planetProperties,
    getCraftSize: () => craftSize,
});

const sceneCameraControllerActions = createSceneCameraControllerActions({
    CameraController,
    getDefaultCameraDistance: () => defaultCameraDistance,
    getRendererDomElement: () => theSceneHandler.renderer.domElement,
    cameraControlsCallback,
    render,
});

const spacecraftModelActions = createSpacecraftModelActions({
    SpacecraftRenderer,
    planetProperties,
    getCraftSize: () => craftSize,
    getGlobalConfig: () => globalConfig,
    getModelPathPrefix: () => window.missionConfig.modelPath,
});

const skyActions = createSkyActions({
    SkyRenderer,
    render,
});

const earthActions = createEarthActions({
    EarthRenderer,
    render,
});

const moonActions = createMoonActions({
    MoonRenderer,
    getMoonRadius: () => moonRadius,
    getGlobalConfig: () => globalConfig,
    getViewPolarAxes: () => viewPolarAxes,
    getViewPoles: () => viewPoles,
    getAnimTime: () => animTime,
    render,
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

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function wait10() {
    return wait(10);
}
function wait20() {
    return wait(20);
}
async function sleep() { return new Promise(requestAnimationFrame); } // The Promise resolves after the next frame is painted

async function fetchMetadata(baseFileName) {
    // baseFileName can be like "geo-CY3" or "geo-CY3-cheb.json"
    // We need to derive the meta filename pattern: "geo-CY3-meta.json"
    const baseName = baseFileName.replace(/-cheb\.json$/, '').replace(/\.json$/, '');
    const metaFileName = `${baseName}-meta.json`;
    try {
        const response = await fetch(metaFileName);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn(`No metadata file found: ${metaFileName}, using defaults`);
    }
    return null; // Fallback to defaults
}

function updateMoonUIFromConfig() {
    const patch = computeMoonUiPatch({
        globalConfig,
        currentConfig: config,
    });

    applyMoonUiPatch({
        setChecked,
        patch,
        setConfig: (val) => {
            config = val;
        },
    });
}

function updateLandingUIFromConfig() {
    const patch = computeLandingUiPatch({
        globalConfig,
        landingFlag: runtimeFlags.landing,
    });

    applyLandingUiPatch({
        setChecked,
        patch,
        setLandingFlag: (val) => {
            runtimeFlags.landing = val;
        },
    });
}

const getStartAndEndTimes = createStartEndTimesResolver({
    getGlobalConfig: () => globalConfig,
    getConfig: () => config,
    createUTCTimestamp,
    oneMinuteMs: TC.ONE_MINUTE_MS,
});

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

function updateCraftScale() {
    craftScaleActions.updateCraftScale();
}

function cameraControlsCallback() {
    craftScaleActions.cameraControlsCallback();
}

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

const svgActions = createSvgActions({
    d3,
    getConfig: () => config,
    getCurrentDimension: () => currentDimension,
    setSvgContainer: (val) => {
        svgContainer = val;
    },
    setDataLoaded: (val) => {
        dataLoaded = val;
    },
    setSvgX: (val) => {
        svgX = val;
    },
    setSvgY: (val) => {
        svgY = val;
    },
    setSvgWidth: (val) => {
        svgWidth = val;
    },
    setSvgHeight: (val) => {
        svgHeight = val;
    },
    setOffsetX: (val) => {
        offsetx = val;
    },
    setOffsetY: (val) => {
        offsety = val;
    },
    getOffsetX: () => offsetx,
    getOffsetY: () => offsety,
    updateProgressLabel,
});

const { loadOrbitDataIfNeededAndProcess } = createOrbitLoadActions({
    d3,
    sleep,
    getConfig: () => config,
    animationScenes,
    orbitDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    npzData,
    npzDataLoaded,
    getDataLoaded: () => dataLoaded,
    setDataLoaded: (val) => {
        dataLoaded = val;
    },
    loadChebyshev,
    loadNpz,
    processOrbitData,
    ensureIndeterminateProgressBar,
    showElementById,
    hideElementById,
    updateProgressLabel,
    setEventInfoText: (text) => {
        d3.select("#eventinfo").text(text);
    },
    getEphemerisSource: () => ephemerisSource,
    getBodiesForConfig: (cfg = config) => animationScenes[cfg]?.planetsForLocations || [],
    onEphemerisLoaded: ({ config, source, url, bodies = [] }) => {
        ephemerisRecords[config] = ephemerisRecords[config] || {};
        ephemerisRecords[config][source] = { url, bodies };
        updateEphemerisPanel();
    },
    onEphemerisStatus: (cfg, source, status, message = "") => {
        ephemerisStatuses[cfg] = ephemerisStatuses[cfg] || {};
        ephemerisStatuses[cfg][source] = { status, message };
        updateEphemerisPanel();
    },
    getBodySource: (bodyId) => resolveBodySource({
        bodyId,
        bodySources: bodyEphemerisSources,
        defaultSpacecraftSource: ephemerisSource,
    }),
});

const { loadLandingDataAndProcess } = createLandingLoadActions({
    getGlobalConfig: () => globalConfig,
    getConfigsList: () => {
        const configuredLandingModes = (globalConfig?.phases || []).filter(
            (phase) => phase === "geo" || phase === "lunar",
        );
        return configuredLandingModes.length > 0
            ? configuredLandingModes
            : Object.keys(animationScenes);
    },
    getLandingDataLoaded: () => landingDataLoaded,
    setLandingDataLoaded: (val) => {
        landingDataLoaded = val;
    },
    setLandingNpzLoaded: (cfg, val) => {
        landingNpzLoaded[cfg] = val;
    },
    setLandingNpzData: (cfg, val) => {
        landingNpzData[cfg] = val;
    },
    setLandingChebyshevLoaded: (cfg, val) => {
        landingChebyshevLoaded[cfg] = val;
    },
    setLandingChebyshevData: (cfg, val) => {
        landingChebyshevData[cfg] = val;
    },
    resolveLandingNpzUrl,
    resolveLandingChebyshevUrl,
    loadNpz,
    loadChebyshev,
});

const { processOrbitElementsData } = createOrbitElementsActions({
    getSvgContainer: () => svgContainer,
    getConfig: () => config,
    animationScenes,
    planetProperties,
    PC,
    PIXELS_PER_AU,
    getZoomFactor: () => getZoomFactorState(config),
    setEpochJD: (val) => {
        epochJD = val;
    },
    setEpochDate: (val) => {
        epochDate = val;
    },
});

const {
    shouldDrawOrbit,
    planetStartTime,
    isLocationAvaialable,
    getBodyLocation,
} = createBodyLocationActions({
    THREE,
    getConfig: () => config,
    getGlobalConfig: () => globalConfig,
    getStartTime: () => startTime,
    getEndTimeSC: () => endTimeSC,
    getStartLandingTime: () => startLandingTime,
    getEndLandingTime: () => endLandingTime,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getLandingNpzLoaded: (cfg = config) => !!landingNpzLoaded[cfg],
    getLandingNpzData: (cfg = config) => landingNpzData[cfg],
    getLandingChebyshevLoaded: (cfg = config) => !!landingChebyshevLoaded[cfg],
    getLandingChebyshevData: (cfg = config) => landingChebyshevData[cfg],
    getStartAndEndTimes,
    TC,
    getFrameMode: () => frameMode,
    getEphemerisSource: (cfg = config) => getActiveEphemerisSource(cfg),
    resolveBodySource: (bodyId) =>
        resolveBodySource({
            bodyId,
            bodySources: bodyEphemerisSources,
            defaultSpacecraftSource: ephemerisSource,
        }),
    getBodyEphemerisRange,
    getBodyEphemerisState,
});

const craftScaleActions = createCraftScaleActions({
    THREE,
    animationScenes,
    getConfig: () => config,
    getJoyRideFlag: () => runtimeFlags.joyRide,
    getLandingFlag: () => runtimeFlags.landing,
    getDefaultCameraDistance: () => defaultCameraDistance,
    getAnimTime: () => animTime,
    isLocationAvaialable,
});

const { processOrbitVectorsData } = createOrbitVectorsActions({
    d3,
    sleep,
    getSvgContainer: () => svgContainer,
    getCurrentDimension: () => currentDimension,
    getConfig: () => config,
    animationScenes,
    planetProperties,
    shouldDrawOrbit,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getEphemerisSource: (cfg = config) => getActiveEphemerisSource(cfg),
    resolveBodySource: (bodyId) =>
        resolveBodySource({
            bodyId,
            bodySources: bodyEphemerisSources,
            defaultSpacecraftSource: ephemerisSource,
        }),
    generateBodyCurve,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getZoomFactor: () => getZoomFactorState(config),
    getPlaneVariables: () => {
        const vars = getPlaneVariablesState(config);
        return {
            xFactor: vars.xFactor,
            yFactor: vars.yFactor,
            xVariable: vars.xVariable,
            yVariable: vars.yVariable,
        };
    },
    planetStartTime,
    PC,
    UC,
    getPixelsPerAU: () => PIXELS_PER_AU,
    getEpochJD: () => epochJD,
    getEpochDate: () => epochDate,
    setEpochDisplay: ({ epochJD, epochDate }) => {
        d3.select("#epochjd").html(epochJD);
        d3.select("#epochdate").html(epochDate);
    },
});

const { setLabelLocation, showGreenwichLongitude, adjustLabelLocations } = createLabelActions({
    d3,
    Astronomy,
    getCurrentDimension: () => currentDimension,
    getConfig: () => config,
    animationScenes,
    planetProperties,
    showPlanet,
    isLocationAvaialable,
    getAnimTime: () => animTime,
    getBodyLocation,
    PC,
    UC,
    getPixelsPerAU: () => PIXELS_PER_AU,
    getZoomFactor: () => getZoomFactorState(config),
    getXFactor: () => getPlaneVariablesState(config).xFactor,
    getYFactor: () => getPlaneVariablesState(config).yFactor,
    getXVariable: () => getPlaneVariablesState(config).xVariable,
    getYVariable: () => getPlaneVariablesState(config).yVariable,
    getCraftData: () => craftData,
});

const { handleZoom, handleZoomNew, zoomEnd, zoomChangeTransform, zoomChange } = createZoomActions({
    d3,
    getSvgContainer: () => svgContainer,
    getCurrentDimension: () => currentDimension,
    animationScenes,
    getConfig: () => config,
    getZoomFactor: () => getZoomFactorState(config),
    setZoomFactor: (val) => {
        setZoomFactorState(val, config);
    },
    getPanX: () => getPanXState(config),
    setPanX: (val) => {
        setPanXState(val, config);
    },
    getPanY: () => getPanYState(config),
    setPanY: (val) => {
        setPanYState(val, config);
    },
    getOffsetX: () => offsetx,
    getOffsetY: () => offsety,
    adjustLabelLocations,
    showGreenwichLongitude,
});

const planeActions = createPlaneActions({
    getPlaneSelection: () => getPlaneSelectionState(config),
    setPlaneVariables: (planeConfig) => {
        setPlaneVariablesState(planeConfig, config);
    },
    getCurrentDimension: () => currentDimension,
    animationScenes,
    getConfig: () => config,
    initSVG: svgActions.initSVG,
    loadOrbitDataIfNeededAndProcess,
    handleDimensionSwitch,
    setLocation,
});

const initConfigSceneSetupActions = createInitConfigSceneSetupActions({
    PC,
    windowRef: window,
    animationScenes,
    animation3DControllers,
    animation2DControllers,
    AnimationScene,
    Animation3DController,
    Animation2DController,
    planetProperties,
    showPlanet,
    computeSVGDimensions: () => svgActions.computeSVGDimensions(),
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    setPixelsPerAU: (value) => {
        PIXELS_PER_AU = value;
    },
    setDefaultCameraDistance: (value) => {
        defaultCameraDistance = value;
    },
    setTrackWidth: (value) => {
        trackWidth = value;
    },
    setEarthRadius: (value) => {
        earthRadius = value;
    },
    setMoonRadius: (value) => {
        moonRadius = value;
    },
    getEarthRadius: () => earthRadius,
    getMoonRadius: () => moonRadius,
    setStartTime: (value) => {
        startTime = value;
    },
    setEndTime: (value) => {
        endTime = value;
    },
    setEndTimeSC: (value) => {
        endTimeSC = value;
    },
    setLatestEndTime: (value) => {
        latestEndTime = value;
    },
    setTimelineTotalSteps: (value) => {
        timelineTotalSteps = value;
    },
    setTicksPerAnimationStep: (value) => {
        ticksPerAnimationStep = value;
    },
    setEpochJD: (value) => {
        epochJD = value;
    },
    setEpochDate: (value) => {
        epochDate = value;
    },
    getStartAndEndTimes,
    animationController,
    resolveOrbitUrls,
    resolveOrbitNpzUrl,
    handleModeSwitchToGeo,
    handleModeSwitchToLunar,
    setRelativeOrbitUrls: ({ scene, orbitsJson, orbitsCheb }) => {
        scene.orbitsJson = orbitsJson;
        scene.orbitsCheb = orbitsCheb;
    },
});

const initConfigOrchestrationActions = createInitConfigOrchestrationActions({
    loadMissionConfig,
    getGlobalConfig: () => globalConfig,
    setGlobalConfig: (value) => {
        globalConfig = value;
    },
    setEventInfos: (value) => {
        eventInfos = value;
    },
    getEphemerisSource,
    setEphemerisSource: (value) => {
        ephemerisSource = value;
    },
    setBodyEphemerisSources: (value) => {
        bodyEphemerisSources = value;
    },
    setEphemerisStatusesForConfig: (cfg, status) => {
        ephemerisStatuses[cfg] = status;
    },
    bindInfoPanelControls,
    updateEphemerisPanel,
    applyMissionMetadata,
    getPlanetProperties: () => planetProperties,
    documentRef: document,
    updateMultipleElementsText,
    updateSpacecraftMnemonic,
    updateMoonUIFromConfig,
    updateLandingUIFromConfig,
    applyLandingTimesUpdate,
    computeLandingTimesUpdate,
    createUTCTimestamp,
    setStartLandingTime: (value) => {
        startLandingTime = value;
    },
    setEndLandingTime: (value) => {
        endLandingTime = value;
    },
    consoleRef: console,
    applyEventsUpdate,
    computeEventsUpdate,
    getConfig: () => config,
    getDataEndTimeMs: (spacecraftMnemonic) => getStartAndEndTimes(spacecraftMnemonic)[1],
    computeMissionEventTimes,
    setTimeTransLunarInjection: (value) => {
        timeTransLunarInjection = value;
    },
    setTimeLunarOrbitInsertion: (value) => {
        timeLunarOrbitInsertion = value;
    },
    getSceneHandler: () => theSceneHandler,
    setSceneHandler: (value) => {
        theSceneHandler = value;
    },
    SceneHandlerClass: SceneHandler,
});

const initConfigUiActions = createInitConfigUiActions({
    d3,
    getEventInfos: () => eventInfos,
    bindBurnButtons,
    getBurnButtonHandler: () => burnButtonHandler,
    SwiperClass: Swiper,
});

const { initConfig } = createInitConfigFlowActions({
    getConfig: () => config,
    getAnimationScene: (cfg) => animationScenes[cfg],
    AnimationScene,
    shouldSkipInitConfig,
    applyInitConfigAlreadyInitialized,
    handleModeSwitchToGeo,
    handleModeSwitchToLunar,
    setChecked,
    normalizePlaneSelection,
    setPlaneSelectionState,
    syncPlaneSelectionControls,
    initConfigOrchestrationActions,
    getGlobalConfig: () => globalConfig,
    initConfigSceneSetupActions,
    isRelativeMode,
    initConfigUiActions,
    setSceneState: (cfg, state) => {
        if (animationScenes[cfg]) {
            animationScenes[cfg].state = state;
        }
    },
    consoleRef: console,
});

const dimensionActions = createDimensionActions({
    d3,
    getConfig: () => config,
    animationScenes,
    getCurrentDimension: () => currentDimension,
    setCurrentDimension: (val) => {
        currentDimension = val;
    },
    getPreviousDimension: () => previousDimension,
    setPreviousDimension: (val) => {
        previousDimension = val;
    },
    setDimensionChanged: (val) => {
        dimensionChanged = val;
    },
    getDimensionChanged: () => dimensionChanged,
    setSvgContainer: (val) => {
        svgContainer = val;
    },
    initSVG: svgActions.initSVG,
    loadOrbitDataIfNeededAndProcess,
    handleDimensionSwitch,
    handlePlaneChange: planeActions.handlePlaneChange,
    setLocation,
    adjustLabelLocations,
    getStartLandingFlag: () => startLandingFlag,
    clearStartLandingFlag: () => {
        startLandingFlag = false;
    },
    toggleLanding: () => toggleLanding(),
    updateProgressLabel,
});

({
    toggleMode,
    setDimensionTop,
    setView,
} = createSettingsActions({
    getConfig: () => config,
    setConfig: (val) => { config = val; },
    animationScenes,
    AnimationScene,
    initAnimation,
    readOriginMode,
    readViewSettings,
    setFPSCounterVisibility,
    render,
    getGlobalConfig: () => globalConfig,
    setViewFlags: (view) => {
        viewOrbit = view.viewOrbit;
        viewOrbitDescent = view.viewOrbitDescent;
        viewCraters = view.viewCraters;
        viewXYZAxes = view.viewXYZAxes;
        viewPoles = view.viewPoles;
        viewPolarAxes = view.viewPolarAxes;
        viewSky = view.viewSky;
        viewMoonSOI = view.viewMoonSOI;
        viewEclipticPlane = view.viewEclipticPlane;
        viewEquatorialPlane = view.viewEquatorialPlane;
        viewFPS = view.viewFPS;
    },
    setDimension: dimensionActions.setDimension,
    onConfigChanged: (newConfig) => {
        syncPlaneStateForConfig(newConfig);
    },
}));

const sceneUiUpdateActions = createSceneUiUpdateActions({
    d3,
    formatMetric: FORMAT_METRIC,
    updateEventInfo,
    clearEventInfo,
});

const sceneFrameUiActions = createSceneFrameUiActions({
    getAnimDate: () => animDate,
    sceneUiUpdateActions,
});

const scene2DFrameActions = createScene2DFrameActions({
    animation2DControllers,
    animationScenes,
    getConfig: () => config,
    getPlaneVariables: () => getPlaneVariablesState(config),
    getZoomFactor: () => getZoomFactorState(config),
    getPanX: () => getPanXState(config),
    getPanY: () => getPanYState(config),
    setCraftData: (value) => {
        craftData = value;
    },
    setLabelLocation,
    zoomChangeTransform,
    showGreenwichLongitude,
});

const sceneFrameOrchestrationActions = createSceneFrameOrchestrationActions({
    getConfig: () => config,
    isOrbitDataProcessed: (cfg) => orbitDataProcessed[cfg],
    getAnimTime: () => animTime,
    computeSunLongitude,
    computeSceneState,
    getChebyshevData: () => chebyshevData,
    getChebyshevDataLoaded: () => chebyshevDataLoaded,
    getNpzData: () => npzData,
    getNpzDataLoaded: () => npzDataLoaded,
    getLandingNpzData: (cfg) => landingNpzData[cfg],
    getLandingNpzLoaded: (cfg) => landingNpzLoaded[cfg],
    getLandingChebyshevData: (cfg) => landingChebyshevData[cfg],
    getLandingChebyshevLoaded: (cfg) => landingChebyshevLoaded[cfg],
    getGlobalConfig: () => globalConfig,
    getStartLandingTime: () => startLandingTime,
    getEndLandingTime: () => endLandingTime,
    getEventInfos: () => eventInfos,
    getMissionTimes: () => ({ timeTransLunarInjection, timeLunarOrbitInsertion }),
    getAnimationScene: (cfg) => animationScenes[cfg],
    getFrameMode: () => frameMode,
    getBodySources: () => bodyEphemerisSources,
    getActiveEphemerisSource: (cfg) => getActiveEphemerisSource(cfg),
    setSunLongitude: (value) => {
        sunLongitude = value;
    },
    getCraftId: () => craftId,
    getPixelsPerAU: () => PIXELS_PER_AU,
    updateCraftScale,
    getCurrentDimension: () => currentDimension,
    animation3DControllers,
    adjustCameraProjectionMatrixAndSkyAngle,
    scene2DFrameActions,
    sceneFrameUiActions,
    render,
});

function onWindowResize() {
    render(); // TODO is this the right thing to do here?
}

function showPlanet(planet) {
    return true;
}

function setLocation() {
    sceneFrameOrchestrationActions.setLocation();
}

function adjustCameraProjectionMatrixAndSkyAngle() {
    adjustSceneCameraProjectionAndSky({
        scene: animationScenes[config],
        cameraControlsCallback,
    });
}

async function initAnimation(flags) {
    return initOrchestrationActions.initAnimation(flags);
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
        updateCameraOverlay,
    }));

    requestAnimationFrame(animateLoop);
 
}

export function main() {
    const onloadEndTime = startMissionApp({
        eventBus,
        handlers: {
            reset,
            toggleMode: toggleModeGuarded,
            toggleRelativeMode,
            changeCameraFromTo,
            toggleLockSC,
            toggleLockMoon,
            toggleLockEarth,
            togglePlane,
            setView,
            setDimensionTop,
            cy3Animate,
            toggleJoyRide,
            toggleLanding,
            toggleInfo,
            initAnimation,
        },
    });

    initCameraOverlay();

    // console.log("onload() took " + onloadEndTime + " ms");
}

const { init } = createRuntimeInitActions(createRuntimeInitDeps({
    getConfig: () => config,
    getScene: (cfg) => animationScenes[cfg],
    getSceneStateInitDone: () => AnimationScene.SCENE_STATE_INIT_DONE,
    setSceneState: (cfg, state) => {
        if (animationScenes[cfg]) {
            animationScenes[cfg].state = state;
        }
    },
    resetViewTransformState,
    initRepeatButtons,
    d3SelectAll,
    setChecked,
    bindRepeatButtons,
    d3Select: d3.select,
    getHandlersById: () => ({
        zoomin: f1,
        zoomout: f2,
        panleft: f3,
        panright: f4,
        panup: f5,
        pandown: f6,
        forward: f7,
        fastforward: f8,
        backward: f9,
        fastbackward: f10,
        slower: f11,
        resetspeed: f12,
        faster: f13,
        realtime: f14,
    }),
    getTimeoutHandleZoom: () => timeoutHandleZoom,
    setTimeoutHandleZoom: (value) => {
        timeoutHandleZoom = value;
    },
    setMousedownTimeout: (value) => {
        mousedownTimeout = value;
    },
    setMouseDown: (value) => {
        mouseDown = value;
    },
    getZoomTimeoutMs: () => UC.ZOOM_TIMEOUT,
    clearTimeoutFn: clearTimeout,
    zoomEnd,
    sleep,
    setAnimDate: (value) => {
        animDate = value;
    },
    getCurrentDimension: () => currentDimension,
    initSVG: () => svgActions.initSVG(),
    loadOrbitDataIfNeededAndProcess,
    loadLandingDataAndProcess,
}));

function updateConfigFromMetadata() {
    // Update step duration from metadata if available
    if (animationScenes[config].metadata && animationScenes[config].metadata.step_size_seconds) {
        const metadataStepSeconds = animationScenes[config].metadata.step_size_seconds;
        animationScenes[config].stepDurationInMilliSeconds = metadataStepSeconds * 1000; // Convert seconds to milliseconds
        // Step duration updated from metadata
        
        // Recalculate timeline total steps
        timelineTotalSteps = (latestEndTime - startTime) / animationScenes[config].stepDurationInMilliSeconds;
    }
}

let orbitProcessActions = null;

async function processOrbitData() {
    return orbitProcessActions.processOrbitData();
}

const {
    cy3Animate,
    fastBackward,
    backward,
    stopAnimation,
    forward,
    fastForward,
    missionStart,
    missionSetTime,
    missionNow,
    missionTLI,
    missionLunar,
    missionEnd,
    faster,
    resetspeed,
    slower,
    realtime,
} = createAnimationActions({
    animationController,
    getAnimTime: () => animTime,
    getTimeTransLunarInjection: () => timeTransLunarInjection,
    getTimeLunarOrbitInsertion: () => timeLunarOrbitInsertion,
    setMissionStartCalled: (val) => { missionStartCalled = val; },
    clearLegacyTimeout: () => { clearTimeout(timeoutHandle); },
});

orbitProcessActions = createOrbitProcessActions({
    d3,
    d3SelectAll,
    hideElementById,
    clearProgressLabel,
    updateConfigFromMetadata,
    getCurrentDimension: () => currentDimension,
    processOrbitVectorsData,
    sleep,
    getSvgWidth: () => svgWidth,
    getSvgHeight: () => svgHeight,
    setSvgRect: (val) => {
        svgRect = val;
    },
    getOffsetX: () => offsetx,
    getOffsetY: () => offsety,
    getPanX: () => getPanXState(config),
    getPanY: () => getPanYState(config),
    getZoomFactor: () => getZoomFactorState(config),
    handleZoom,
    zoomEnd,
    getMissionStartCalled: () => missionStartCalled,
    missionStart,
    getAnimationRunning: () => animationRunning,
    updateAnimateButtonText: () => {
        updateD3ElementText("#animate", "Play");
    },
    zoomChangeTransform,
    getConfig: () => config,
    orbitDataProcessed,
});

const {
    reset,
    toggleInfo,
    zoomIn,
    zoomOut,
    panLeft,
    panRight,
    panUp,
    panDown,
    f1,
    f2,
    f3,
    f4,
    f5,
    f6,
    f7,
    f8,
    f9,
    f10,
    f11,
    f12,
    f13,
    f14,
    toggleLockSC,
    toggleLockMoon,
    toggleLockEarth,
    changeCameraFromTo,
    togglePlane,
    recenterMountedCamera,
    toggleJoyRide,
    toggleLanding,
    burnButtonHandler,
} = createRuntimeUiControlsActions(createRuntimeUiControlsDeps({
    createNavigationActions,
    createRepeatMouseDownHandlers,
    createLockActions,
    createCameraActions,
    createModeActions,
    createBurnActions,
    getConfig: () => config,
    getPanXState,
    setPanXState,
    getPanYState,
    setPanYState,
    getZoomFactorState,
    setZoomFactorState,
    zoomChange,
    zoomEnd,
    render,
    getZoomTimeoutMs: () => UC.ZOOM_TIMEOUT,
    getZoomScale: () => UC.ZOOM_SCALE,
    toggleStatsVisibility: () => {
        toggleVisibilityById("stats");
    },
    forward,
    fastForward,
    backward,
    fastBackward,
    slower,
    resetspeed,
    faster,
    realtime,
    getMouseDownTimeout: () => mousedownTimeout,
    setMouseDownTimeout: (val) => {
        mousedownTimeout = val;
    },
    setTimeoutHandleZoom: (handle) => {
        timeoutHandleZoom = handle;
    },
    animationScenes,
    setChecked,
    readCameraPositionMode,
    readCameraLookMode,
    applyCameraFromTo,
    readPlaneSelection: () => readCheckedRadioValue("plane", "DEFAULT"),
    setPlaneSelectionState,
    handlePlaneChange: planeActions.handlePlaneChange,
    getViewSky: () => viewSky,
    getGlobalConfig: () => globalConfig,
    updateCraftScale,
    getLandingFlag: () => runtimeFlags.landing,
    setLandingFlag: (val) => {
        runtimeFlags.landing = val;
    },
    getJoyRideFlag: () => runtimeFlags.joyRide,
    setJoyRideFlag: (val) => {
        runtimeFlags.joyRide = val;
    },
    setView,
    getEventInfos: () => eventInfos,
    setAnimTime: (val) => {
        animTime = val;
    },
    missionSetTime,
}));

const initOrchestrationActions = createInitOrchestrationActions({
    initConfig,
    init,
    getConfig: () => config,
    isOrbitDataProcessed: (cfg) => !!orbitDataProcessed[cfg],
    missionStart,
    setLocation,
    setDimension: (value) => {
        dimensionActions.setDimension(value);
    },
    getSetView: () => setView,
    getChangeCameraFromTo: () => changeCameraFromTo,
    updateCraftScale,
    d3,
    d3SelectAll,
    render,
    requestAnimationFrame,
    animateLoop,
});

const { initCameraOverlay, updateCameraOverlay } = createCameraOverlayActions({
    THREE,
    isTestMode,
    getAnimationScenes: () => animationScenes,
    getConfig: () => config,
    readCameraPositionMode,
    readCameraLookMode,
    getPixelsPerAU: () => PIXELS_PER_AU,
    getKmPerAu: () => PC.KM_PER_AU,
    recenterMountedCamera,
});

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
