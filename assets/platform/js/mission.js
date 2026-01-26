
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
import { getStateFromChebyshev, generateCurveFromChebyshev } from "./chebyshev.js";
import { getMoonState, getEarthFromMoonState } from "./astronomy-bodies.js";
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
import { readOriginMode, readViewSettings } from "./ui/ui-state.js";
import { bindBurnButtons, bindSettingsPanel } from "./ui/event-handlers.js";
import { loadChebyshev, loadMissionConfig, resolveLandingChebyshevUrl, resolveOrbitUrls } from "./data/mission-data.js";
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
import { createModeSwitchActions } from "./app/mode-switch.js";
import { applyEventsUpdate, computeEventsUpdate } from "./app/config-events.js";
import {
    applyInitConfigAlreadyInitialized,
    shouldSkipInitConfig,
} from "./app/init-config.js";
import { initSceneHandlerDom } from "./app/scene-handler-init.js";
import { createStartEndTimesResolver } from "./app/start-end-times.js";
import { initRepeatButtons } from "./app/init-repeat-buttons.js";

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

// Chebyshev ephemeris data (replaces NPZ for spacecraft position)
var chebyshevDataLoaded = { "geo": false, "lunar": false };
var chebyshevData = {};  // { "geo": chebData, "lunar": chebData }
var landingChebyshevLoaded = false;
var landingChebyshevData = null;
var nOrbitPoints = 0;
var nLandingPoints = 0;
var progress = 0;
var bannerShown = false;
var stopZoom = false;
var sunLongitude = 0.0;

// animation control
var mouseDown = false;

// defaults for XY plane
var planeSelection = "DEFAULT"; // DEFAULT, XY, YZ, ZX, XY-, YZ-, ZX-
var plane = "XY"; // XY, YZ, ZX
var xVariable = "x";
var yVariable = "y";
var zVariable = "z";
var vxVariable = "vx";
var vyVariable = "vy";
var vzVariable = "vz";
var xFactor = 1;
var yFactor = 1;
var zFactor = 1;

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
var zoomFactor = 1;
var panx = 0;
var pany = 0;
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

// Event bus for decoupling UI ↔ mission orchestration
const eventBus = createEventBus();
var globalConfig = null; // Store loaded config from config.json
var joyRideFlag = false;
var landingFlag = false;

const orbitCurveActions = createOrbitCurveActions({
    THREE,
    generateCurveFromChebyshev,
    chebyshevDataLoaded,
    chebyshevData,
    getStepMs: (config) => animationScenes[config].stepDurationInMilliSeconds,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getLandingEnabled: () => !!(globalConfig && globalConfig.landing && globalConfig.landing.enabled),
    getLandingChebyshevLoaded: () => landingChebyshevLoaded,
    getLandingChebyshevData: () => landingChebyshevData,
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

// View variables

const ORIGIN_OVERRIDE_STORAGE_KEY = "cy3.originOverride";

function consumeOriginOverrideFromSession() {
    try {
        const override = sessionStorage.getItem(ORIGIN_OVERRIDE_STORAGE_KEY);
        if (override === "lunar") {
            setChecked("origin-moon", true);
            setChecked("origin-earth", false);
            setChecked("origin-relative", false);
        } else if (override === "geo") {
            setChecked("origin-earth", true);
            setChecked("origin-moon", false);
            setChecked("origin-relative", false);
        }
        sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
    } catch {
        // Ignore storage errors (private browsing, disabled storage, etc.)
    }
}

consumeOriginOverrideFromSession();

// Relative mode is Earth-centered; force Earth origin selection without changing defaults for normal runs.
if (isRelativeMode) {
    setChecked("origin-relative", true);
    setChecked("origin-earth", false);
    setChecked("origin-moon", false);
}

var config = readOriginMode();
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
function wait50() {
    return wait(50);
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
        landingFlag,
    });

    applyLandingUiPatch({
        setChecked,
        patch,
        setLandingFlag: (val) => {
            landingFlag = val;
        },
    });
}

const getStartAndEndTimes = createStartEndTimesResolver({
    getGlobalConfig: () => globalConfig,
    getConfig: () => config,
    createUTCTimestamp,
    oneMinuteMs: TC.ONE_MINUTE_MS,
});

class SceneHandler {

    constructor() {
        // console.log("SceneHandler ctor called");

        this.scene = null;
        this.renderer = null;
        this.canvasNode = null;
        this.initialized = false;
        this.lookAtWorldTarget = new THREE.Vector3();

        this.init();
    }

    init() {

        // console.log("SceneHandler init() called");

        if (this.initialized) {
            return;
        }

        const { renderer, canvasNode } = initSceneHandlerDom({
            d3,
            bindSettingsPanel,
            computeSVGDimensions: svgActions.computeSVGDimensions,
            getSvgWidth: () => svgWidth,
            getSvgHeight: () => svgHeight,
            isTestMode,
            onWindowResize,
            THREE,
        });
        this.renderer = renderer;
        this.canvasNode = canvasNode;

        this.initialized = true;
    }

    render(animationScene) {

        // console.log("SceneHandler.render() called");

        if (animationScene.initialized3D) {

            updateCraftScale();
            
            if (animationScene.lockOnEarth || (globalConfig && globalConfig.is_lunar && animationScene.lockOnMoon)) {
            
                var x = animationScene.secondaryBody3D.position.x;
                var y = animationScene.secondaryBody3D.position.y;
                var z = animationScene.secondaryBody3D.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
                // animationScene.camera.lookAt(animationScene.secondaryBody3D.position);

            } else if (animationScene.lockOnSC) {
                
                var x = animationScene.craft.position.x;
                var y = animationScene.craft.position.y;
                var z = animationScene.craft.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
                // animationScene.camera.lookAt(animationScene.craft.position);                
            } else {
                animationScene.motherContainer.position.set(0, 0, 0);
            }               

            // Iteration 17: from-to camera system hook (defaults to manual/manual => no-op).
            if (animationScene.cameraController?.updateFromTo) {
                animationScene.cameraController.updateFromTo({
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    spacecraft: animationScene.craft,
                });
            }

            if (joyRideFlag || landingFlag) {

                var craftEarthDistance = animationScene.craft.position.distanceTo(animationScene.earthContainer.position);
                var craftMoonDistance = (globalConfig && globalConfig.is_lunar && animationScene.moonContainer) 
                    ? animationScene.craft.position.distanceTo(animationScene.moonContainer.position) 
                    : Infinity;
                var earthAngleRads = Math.asin(earthRadius / craftEarthDistance);
                var moonAngleRads = Math.asin(moonRadius / craftMoonDistance);
                // console.log("earthAngleRads = " + earthAngleRads + ", moonAngleRads = " + moonAngleRads);

                // console.log("craftEarthDistance = " + craftEarthDistance + ", craftMoonDistance = " + craftMoonDistance + ", moonRadius = " + moonRadius);

                var closerBody;
                var closerAngleRads;
                var radius;
                var distance;
                if (craftEarthDistance < craftMoonDistance) {

                    closerBody = animationScene.earthContainer;
                    closerAngleRads = earthAngleRads;
                    distance = craftEarthDistance;
                    radius = earthRadius;
                    animationScene.craftCamera.up.set(0, 0, 1);
                    animationScene.droneCamera.up.set(0, 1, 0);

                } else {

                    closerBody = animationScene.moonContainer;
                    closerAngleRads = moonAngleRads;
                    distance = craftMoonDistance;
                    radius = moonRadius;
                    animationScene.craftCamera.up.set(1, 0, 0);
                    animationScene.droneCamera.up.set(1, 0, 0);
                }
                
                // var v1 = new THREE.Vector3();
                // var v2 = new THREE.Vector3();

                // v1.subVectors(closerBody.position, animationScene.craft.position).normalize();
                // v2.subVectors(animationScene.curve[timelineIndex+1], animationScene.craft.position).normalize();
                // v2.add(v1);
                // v2.add(animationScene.craft.position);
                // var theta = Math.acos(radius/distance);

                animationScene.craftCamera.lookAt(closerBody.position); 
                animationScene.droneCamera.lookAt(animationScene.craft.position); 

                var specialCamera = joyRideFlag ? animationScene.craftCamera : animationScene.droneCamera;

                this.renderer.autoClear = true;
                specialCamera.layers.set(0);
                this.renderer.render(animationScene.scene, specialCamera);    

                this.renderer.autoClear = false;
                specialCamera.layers.set(1);
                this.renderer.render(animationScene.scene, specialCamera);    


            } else {
                this.renderer.autoClear = true;
                animationScene.camera.layers.set(0);
                this.renderer.render(animationScene.scene, animationScene.camera);    

                this.renderer.autoClear = false;
                animationScene.camera.layers.set(1);
                this.renderer.render(animationScene.scene, animationScene.camera);    

            }
        }
    }
}

function updateCraftScale() {
    craftScaleActions.updateCraftScale();
}

function cameraControlsCallback() {
    craftScaleActions.cameraControlsCallback();
}

class AnimationScene {
    
    static SCENE_STATE_START = 0;
    static SCENE_STATE_INIT_CONFIG_DONE = 1;
    static SCENE_STATE_INIT_DONE = 2;
    static SCENE_STATE_ADD_CURVE_DONE = 3;

    constructor(name) {

        // console.log("AnimationScene ctor called for " + name);

        this.name = name;

        this.orbits = {};

        this.initialized3D = false;

        this.earth = null;
        this.earthContainer = null;
        this.earthAxis = null;
        this.earthGlow = null;

        this.moon = null;
        this.moonAxisRotationAngle = 0;

        this.primaryBody3D = null;
        this.secondaryBody3D = null;
        this.craft = null;
        this.camera = null;
        this.cameraControlsEnabled = true;
        this.cameraControls = null;
        this.scene = null;
        this.renderer = null;
        this.curve = [];
        this.landingCurve = [];
        this.curveVelocities = [];
        this.landingCurveVelocities = [];

        this.locations = [];

        // Scene helpers (axes, planes, SOI) - managed by SceneHelpers class
        this.sceneHelpers = null;

        // Sky renderer (starmap and constellations)
        this.skyRenderer = null;

        // Light manager
        this.lightManager = null;

        // Earth renderer
        this.earthRenderer = null;

        // Moon renderer
        this.moonRenderer = null;

        // Spacecraft renderer
        this.spacecraftRenderer = null;

        // Camera controller
        this.cameraController = null;

        this.stopCreationFlag = false;

        this.state = AnimationScene.SCENE_STATE_START;
    }


    stopCreation() {
        sceneCreationActions.stopCreation(this);
    }

    setCameraPosition(x, y, z) {
        sceneCameraPositionActions.setCameraPosition(this, x, y, z);
    }

    init3d(callback) {
        scene3dInitActions.init3d(this, callback);

        // var loader = new THREE.TextureLoader();

        // // console.log("Loading texture ...");

        // loader.load(
        //     'images/2_no_clouds_8k.jpg',

        //     function(texture) {

        //         // console.log("Loaded texture.");
        //         scene.earthTexture = texture;
        //         await scene.init3dRest();
        //         callback();

        //     });

        /* DON'T PUT ANY CODE HERE */
    }

    computeDimensions() {
        dimensionsActions.computeDimensions(this);
    }

    addSky() {
        skyActions.addSky(this, { earthRadius, viewSky });
    }

    disposeSky() {
        skyActions.disposeSky(this);
    }
    
    addEarth() {
        // Create Earth renderer
        this.earthRenderer = new EarthRenderer(earthRadius);
        this.earthRenderer.setTextures(this.earthTexture, this.earthSpecularTexture);
        this.earthRenderer.create(viewPolarAxes, viewPoles);

        // Backward-compatible property references
        this.earthContainer = this.earthRenderer.container;
        this.earth = this.earthRenderer.mesh;
        this.earthAxis = this.earthRenderer.axis;
        this.earthNorthPoleSphere = this.earthRenderer.northPoleSphere;
        this.earthSouthPoleSphere = this.earthRenderer.southPoleSphere;

        render();
    }

    disposeEarth() {
        if (this.earthRenderer) {
            this.earthRenderer.dispose();
            this.earthRenderer = null;
        }

        // Clear backward-compatible references
        this.earth = null;
        this.earthAxis = null;
        this.earthNorthPoleSphere = null;
        this.earthSouthPoleSphere = null;
        this.earthContainer = null;
        this.earthTexture = null;
        this.earthSpecularTexture = null;
    }

    addMoon() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            console.debug('Skipping moon creation - not a lunar mission');
            return;
        }

        // Create Moon renderer
        this.moonRenderer = new MoonRenderer(moonRadius);
        this.moonRenderer.setTextures(this.moonMap, this.moonDisplacementMap);
        this.moonRenderer.create(viewPolarAxes, viewPoles);

        // Backward-compatible property references
        this.moonContainer = this.moonRenderer.container;
        this.moon = this.moonRenderer.mesh;
        this.moonAxis = this.moonRenderer.axis;
        this.moonAxisVector = this.moonRenderer.axisVector;
        this.moonNorthPoleSphere = this.moonRenderer.northPoleSphere;
        this.moonSouthPoleSphere = this.moonRenderer.southPoleSphere;

        // Add Moon SOI (managed by SceneHelpers)
        this.addMoonSOI();

        // Set initial rotation
        this.rotateMoon(animTime);

        render();
    }

    disposeMoon() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }

        // Dispose Moon SOI first (managed by SceneHelpers)
        this.disposeMoonSOI();

        if (this.moonRenderer) {
            this.moonRenderer.dispose();
            this.moonRenderer = null;
        }

        // Clear backward-compatible references
        this.moon = null;
        this.moonAxis = null;
        this.moonAxisVector = null;
        this.moonNorthPoleSphere = null;
        this.moonSouthPoleSphere = null;
        this.moonContainer = null;
        this.moonMap = null;
        this.moonDisplacementMap = null;
    }
    
    addMoonSOI() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }

        // Create SceneHelpers instance if not already created
        if (!this.sceneHelpers) {
            this.sceneHelpers = new SceneHelpers(this.motherContainer);
        }

        this.sceneHelpers.createMoonSOI(this.moon, moonRadius, viewMoonSOI);

        // Backward-compatible property reference for setView()
        this.moonSOISphere = this.sceneHelpers.moonSOISphere;
    }

    disposeMoonSOI() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        if (this.sceneHelpers) {
            this.sceneHelpers.disposeMoonSOI();
        }
        this.moonSOISphere = null;
    }

    addEarthLocations() {
        locationActions.addEarthLocations({ scene: this });
    }

    disposeEarthLocations() {
        locationActions.disposeEarthLocations({ scene: this });
    }
    
    addMoonLocations() {
        locationActions.addMoonLocations({ scene: this });
    }

    disposeMoonLocations() {
        locationActions.disposeMoonLocations({ scene: this });
    }

    setPrimaryAndSecondaryBodies() {
        primarySecondaryBodiesActions.setPrimaryAndSecondaryBodies(this);
    }

    addSpacecraftCurve() {
        spacecraftCurveActions.addSpacecraftCurve(this);
    }

    disposeSpacecraftCurve() {
        spacecraftCurveActions.disposeSpacecraftCurve(this);
    }



    addSpacecraft() {
        spacecraftActions.addSpacecraft(this);
    }

    disposeSpacecraft() {
        spacecraftActions.disposeSpacecraft(this);
    }

    

    
    addLineOfSight() {
        lineOfSightActions.addLineOfSight(this);
    }

    disposeLineOfSight() {
        lineOfSightActions.disposeLineOfSight(this);
    }

    addAxesHelper() {
        axesHelperActions.addAxesHelper(this, {
            earthRadius,
            viewXYZAxes,
            viewEclipticPlane,
            viewEquatorialPlane,
        });
    }

    disposeAxesHelper() {
        axesHelperActions.disposeAxesHelper(this);
    }
    
    addLight() {
        lightActions.addLight(this);
    }

    disposeLight() {
        lightActions.disposeLight(this);
    }

    addCamera() {
        sceneCameraControllerActions.addCamera(this);
    }

    disposeCamera() {
        sceneCameraControllerActions.disposeCamera(this);
    }

    async addSpacecraftModel() {
        await spacecraftModelActions.addSpacecraftModel(this);
    }

    disposeSpacecraftModel() {
        spacecraftModelActions.disposeSpacecraftModel(this);
    }
    
    init3dRest() {
        sceneInitActions.init3dRest(this);
    }

    setCameraParameters(isInitialization = false) {
        // console.log("setCameraParameters() called: isInitialization = " + isInitialization);

        let controllerDistance = null;
        if (this.cameraControlsEnabled && this.cameraController) {
            controllerDistance = this.cameraController.getDistanceFromOrigin();
        }

        const params = computeSceneCameraParameters({
            isMoonCamera: this.cameraController?.lookMode === CAMERA_LOOK_MODE.MOON,
            planeSelection,
            missionConfig: config,
            isInitialization,
            controllerDistance,
            defaultCameraDistance,
        });

        if (this.cameraController) {
            this.cameraController.setFov(params.fov);
            if (params.up) {
                this.cameraController.setUp(params.up.x, params.up.y, params.up.z);
            }
        }

        if (params.position) {
            this.setCameraPosition(params.position.x, params.position.y, params.position.z);
        }

        this.craftVisible = params.craftVisible;

        adjustCameraProjectionMatrixAndSkyAngle();
    }

    processOrbitVectorsData3D() {
        orbitVectorProcessingActions.processOrbitVectorsData3D(this);
    }

    processLandingVectors() {
        orbitVectorProcessingActions.processLandingVectors(this);
    }

    cameraDisntance(position) {
        return sceneCameraPositionActions.cameraDisntance(position);
    }   

	rotateMoon(timeMs = animTime) {
	    if (!globalConfig || !globalConfig.is_lunar) return;
	    if (!this.moonContainer) return;

	    if (frameMode === "relative" && config === "geo") {
	        const moonState = getMoonState(timeMs);
	        const r = new THREE.Vector3(moonState.x, moonState.y, moonState.z);
	        const v = new THREE.Vector3(moonState.vx, moonState.vy, moonState.vz);

	        if (r.lengthSq() === 0) return;

	        const xHat = r.clone().normalize();
	        const zHat = new THREE.Vector3().crossVectors(r, v);
	        if (zHat.lengthSq() === 0) return;
	        zHat.normalize();
	        const yHat = new THREE.Vector3().crossVectors(zHat, xHat);
	        if (yHat.lengthSq() === 0) return;
	        yHat.normalize();

	        // Relative frame basis:
	        // - local (relative) axes expressed in inertial coords are {xHat, yHat, zHat}.
	        // - makeBasis() yields M = [xHat yHat zHat] mapping relative->inertial.
	        // - We want B = M^T mapping inertial->relative (world coords in relative mode).
	        const relativeToInertial = new THREE.Matrix4().makeBasis(xHat, yHat, zHat);
	        const inertialToRelative = relativeToInertial.clone().transpose();
	        const qFrame = new THREE.Quaternion().setFromRotationMatrix(inertialToRelative);

	        // Moon orientation in inertial frame (IAU pole model, matching existing rotateMoon()).
	        const date = new Date(timeMs);
	        const lp = lunar_pole(date);
	        const alpha = lp["alpha"];
	        const delta = lp["delta"];
	        const W = lp["W"];

	        const qInertial = new THREE.Quaternion();
	        const qx1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1 * PC.EARTH_AXIS_INCLINATION_RADS);
	        const qz2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 + alpha);
	        const qx3 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - delta);
	        const qz4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), W);
	        qInertial.multiply(qx1).multiply(qz2).multiply(qx3).multiply(qz4);

	        // Convert inertial orientation into the relative-frame world coordinates.
	        this.moonContainer.quaternion.copy(qFrame).multiply(qInertial);
	        return;
	    }

	    bodyRotationActions.rotateMoon({
	        timeMs,
	        globalConfig,
	        moonContainer: this.moonContainer,
	    });
	}

    rotateEarth(timeMs = animTime) {
        bodyRotationActions.rotateEarth({
            timeMs,
            earthContainer: this.earthContainer,
        });
    } 

    dispose() {
        sceneDisposeActions.dispose(this);
    }
}

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
    getDataLoaded: () => dataLoaded,
    setDataLoaded: (val) => {
        dataLoaded = val;
    },
    loadChebyshev,
    processOrbitData,
    ensureIndeterminateProgressBar,
    showElementById,
    hideElementById,
    updateProgressLabel,
    setEventInfoText: (text) => {
        d3.select("#eventinfo").text(text);
    },
});

const { loadLandingDataAndProcess } = createLandingLoadActions({
    getGlobalConfig: () => globalConfig,
    getLandingDataLoaded: () => landingDataLoaded,
    setLandingDataLoaded: (val) => {
        landingDataLoaded = val;
    },
    setLandingChebyshevLoaded: (val) => {
        landingChebyshevLoaded = val;
    },
    setLandingChebyshevData: (val) => {
        landingChebyshevData = val;
    },
    resolveLandingChebyshevUrl,
    loadChebyshev,
});

const { processOrbitElementsData } = createOrbitElementsActions({
    getSvgContainer: () => svgContainer,
    getConfig: () => config,
    animationScenes,
    planetProperties,
    PC,
    PIXELS_PER_AU,
    getZoomFactor: () => zoomFactor,
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
    getLandingChebyshevLoaded: () => landingChebyshevLoaded,
    getLandingChebyshevData: () => landingChebyshevData,
    getStateFromChebyshev,
    getMoonState,
    getEarthFromMoonState,
    getStartAndEndTimes,
    TC,
});

const craftScaleActions = createCraftScaleActions({
    THREE,
    animationScenes,
    getConfig: () => config,
    getJoyRideFlag: () => joyRideFlag,
    getLandingFlag: () => landingFlag,
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
    generateCurveFromChebyshev,
    getStartTime: () => startTime,
    getLatestEndTime: () => latestEndTime,
    getZoomFactor: () => zoomFactor,
    getPlaneVariables: () => ({
        xFactor,
        yFactor,
        xVariable,
        yVariable,
    }),
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
    getZoomFactor: () => zoomFactor,
    getXFactor: () => xFactor,
    getYFactor: () => yFactor,
    getXVariable: () => xVariable,
    getYVariable: () => yVariable,
    getCraftData: () => craftData,
});

const { handleZoom, handleZoomNew, zoomEnd, zoomChangeTransform, zoomChange } = createZoomActions({
    d3,
    getSvgContainer: () => svgContainer,
    getCurrentDimension: () => currentDimension,
    animationScenes,
    getConfig: () => config,
    getZoomFactor: () => zoomFactor,
    setZoomFactor: (val) => {
        zoomFactor = val;
    },
    getPanX: () => panx,
    setPanX: (val) => {
        panx = val;
    },
    getPanY: () => pany,
    setPanY: (val) => {
        pany = val;
    },
    getOffsetX: () => offsetx,
    getOffsetY: () => offsety,
    adjustLabelLocations,
    showGreenwichLongitude,
});

const planeActions = createPlaneActions({
    getPlaneSelection: () => planeSelection,
    setPlaneVariables: (planeConfig) => {
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
    getCurrentDimension: () => currentDimension,
    animationScenes,
    getConfig: () => config,
    initSVG: svgActions.initSVG,
    loadOrbitDataIfNeededAndProcess,
    handleDimensionSwitch,
    setLocation,
});


async function initConfig() {

    // console.log("initConfig() called");

    const existingScene = animationScenes[config];
    if (shouldSkipInitConfig({ animationScene: existingScene, AnimationScene })) {
        // console.log("initConfig() returning as already initialized");
        applyInitConfigAlreadyInitialized({
            config,
            handleModeSwitchToGeo,
            handleModeSwitchToLunar,
            setChecked,
            animationScene: existingScene,
        });
        return;
    }

    if (globalConfig === null) {
        globalConfig = await loadMissionConfig();
        eventInfos = globalConfig?.eventInfos || [];

         if (globalConfig) {
             // Note: SC and craftId remain as "SC" for internal use
             // globalConfig.spacecraft_mnemonic is used only for file path construction
             applyMissionMetadata({
                 globalConfig,
                 planetProperties,
                 document,
                 updateMultipleElementsText,
                 updateSpacecraftMnemonic,
             });
             updateMoonUIFromConfig();
             updateLandingUIFromConfig();
         }
     }

    const configData = globalConfig;
    
    // Update landing times from config if available
    applyLandingTimesUpdate({
        update: computeLandingTimesUpdate({ globalConfig, createUTCTimestamp }),
        setStartLandingTime: (val) => {
            startLandingTime = val;
        },
        setEndLandingTime: (val) => {
            endLandingTime = val;
        },
        console,
    });
    
    // Update landing UI visibility from config
    updateLandingUIFromConfig();

    applyEventsUpdate({
        update: computeEventsUpdate({
            globalConfig,
            config,
            nowDate: new Date(),
            getDataEndTimeMs: (spacecraftMnemonic) =>
                getStartAndEndTimes(spacecraftMnemonic)[1],
        }),
        setEventInfos: (val) => {
            eventInfos = val;
        },
        console,
    });

    // Get TLI and LOI times from config (only for lunar missions)
    const missionEventTimes = computeMissionEventTimes({ globalConfig });
    if (typeof missionEventTimes.timeTransLunarInjection === "number") {
        timeTransLunarInjection = missionEventTimes.timeTransLunarInjection;
    }
    if (typeof missionEventTimes.timeLunarOrbitInsertion === "number") {
        timeLunarOrbitInsertion = missionEventTimes.timeLunarOrbitInsertion;
    }

    if (!theSceneHandler) {
        theSceneHandler = new SceneHandler();
    }    

    if (config == "geo") {

        if (!animationScenes[config]) {
            // console.log("Creating new AnimationScene for " + config);
            animationScenes[config] = new AnimationScene(config);
            // Create controllers for this config
            animation3DControllers[config] = new Animation3DController(config, animationScenes[config]);
            animation2DControllers[config] = new Animation2DController(config, {
                planetProperties: planetProperties,
                showPlanet: showPlanet
            });
        }

        svgActions.computeSVGDimensions();
    
        PIXELS_PER_AU = Math.min(svgWidth, svgHeight) / (1.2 * (2 * PC.EARTH_MOON_DISTANCE_MEAN_AU)); 
        // The smaller dimension of the screen should fit 120% of the whole Moon orbit around Earth

        defaultCameraDistance = 2 * PC.EARTH_MOON_DISTANCE_MEAN_AU * PIXELS_PER_AU;

        trackWidth = 0.6;

        earthRadius = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;
        moonRadius = (PC.MOON_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;
        
        animationScenes[config].primaryBody = "EARTH";
        animationScenes[config].primaryBodyRadius = earthRadius;

        animationScenes[config].secondaryBody = "MOON";
        animationScenes[config].secondaryBodyRadius = moonRadius;

        // Use config data if available, otherwise use defaults
        const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
        if (configData && configData[config]) {
            const cfg = configData[config];
            animationScenes[config].planetsForOrbits = cfg.planets;
            animationScenes[config].planetsForLocations = cfg.planets;
            animationScenes[config].stepDurationInMilliSeconds = cfg.step_size_in_seconds * 1000; // Convert to milliseconds

            const orbitUrls = resolveOrbitUrls(configData, config);
            if (orbitUrls) {
                animationScenes[config].orbitsJson = orbitUrls.orbitsJson;
                animationScenes[config].orbitsCheb = orbitUrls.orbitsCheb;
            }
        }

        // URL-only: mode=relative loads a precomputed rotating-frame orbit file.
        // Keep config as "geo" (Earth origin) to avoid changing existing UI flows.
        if (isRelativeMode) {
            const dataPath = window?.missionConfig?.dataPath;
            const relativeBase = `relative-${spacecraftMnemonic}`;
            if (typeof dataPath === "string" && dataPath.length > 0) {
                animationScenes[config].orbitsJson = `${dataPath}${relativeBase}.json`;
                animationScenes[config].orbitsCheb = `${dataPath}${relativeBase}-cheb.json`;
            }
        }
        animationScenes[config].orbitsJsonFileSizeInBytes = 34793 * 1024; // TODO
        animationScenes[config].stepsPerHop = 4;

        startTime                  = getStartAndEndTimes("EARTH")[0];
        endTime                    = getStartAndEndTimes("EARTH")[1];
        endTimeSC                 = getStartAndEndTimes(spacecraftMnemonic)[1];

        latestEndTime = endTime;
        timelineTotalSteps = (latestEndTime - startTime) / animationScenes[config].stepDurationInMilliSeconds;
        ticksPerAnimationStep = 1;

        // Configure animation controller with mission timing
        animationController.configure({
            startTime: startTime,
            endTime: endTime,
            stepDurationMs: animationScenes[config].stepDurationInMilliSeconds,
            stepsPerHop: animationScenes[config].stepsPerHop
        });

        epochJD = "N/A";
        epochDate = "N/A";

        // timelineIndex = 0; // Don't reset in case we are switching between modes

        handleModeSwitchToGeo();

    } else if (config == "lunar") {

        if (!animationScenes[config]) {
            // console.log("Creating new AnimationScene for " + config);
            animationScenes[config] = new AnimationScene(config);
            // Create controllers for this config
            animation3DControllers[config] = new Animation3DController(config, animationScenes[config]);
            animation2DControllers[config] = new Animation2DController(config, {
                planetProperties: planetProperties,
                showPlanet: showPlanet
            });
        }

        svgActions.computeSVGDimensions();
    
        PIXELS_PER_AU = Math.min(svgWidth, svgHeight) / (1.2 * (2 * PC.EARTH_MOON_DISTANCE_MEAN_AU)); 
        // The smaller dimension of the screen should fit 120% of the whole Moon orbit around Earth
        
        defaultCameraDistance = 2 * PC.EARTH_MOON_DISTANCE_MEAN_AU * PIXELS_PER_AU;

        trackWidth = 0.6;

        earthRadius = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;
        moonRadius = (PC.MOON_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU * 0.997;        

        animationScenes[config].primaryBody = "MOON";
        animationScenes[config].primaryBodyRadius = moonRadius;

        animationScenes[config].secondaryBody = "EARTH";
        animationScenes[config].secondaryBodyRadius = earthRadius;

        // Use config data if available, otherwise use defaults
        const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
        if (configData && configData[config]) {
            const cfg = configData[config];
            animationScenes[config].planetsForOrbits = cfg.planets;
            animationScenes[config].planetsForLocations = cfg.planets;
            animationScenes[config].stepDurationInMilliSeconds = cfg.step_size_in_seconds * 1000; // Convert to milliseconds

            const orbitUrls = resolveOrbitUrls(configData, config);
            if (orbitUrls) {
                animationScenes[config].orbitsJson = orbitUrls.orbitsJson;
                animationScenes[config].orbitsCheb = orbitUrls.orbitsCheb;
            }
        }

        animationScenes[config].orbitsJsonFileSizeInBytes = 34800 * 1024; // TODO
        animationScenes[config].stepsPerHop = 4;

        startTime                  = getStartAndEndTimes("EARTH")[0];
        endTime                    = getStartAndEndTimes("EARTH")[1];
        endTimeSC                 = getStartAndEndTimes(spacecraftMnemonic)[1];

        latestEndTime = endTime;
        timelineTotalSteps = (latestEndTime - startTime) / animationScenes[config].stepDurationInMilliSeconds;
        ticksPerAnimationStep = 1;

        // Configure animation controller with mission timing
        animationController.configure({
            startTime: startTime,
            endTime: endTime,
            stepDurationMs: animationScenes[config].stepDurationInMilliSeconds,
            stepsPerHop: animationScenes[config].stepsPerHop
        });

        epochJD = "N/A";
        epochDate = "N/A";

        // timelineIndex = 0; // Don't reset in case we are switching between modes

        handleModeSwitchToLunar();

    } 

    // Add event buttons

    d3.select("#burnbuttons").html("");
    for (let i = 0; i < eventInfos.length; ++i) {

        // console.log("Adding button " + eventInfos[i]["label"]);

        d3.select("#burnbuttons")
            .append("div")
                .attr("class", "swiper-slide")
                .append("button")
                    .attr("id", "burn" + (i+1))
                    .attr("type", "button")
                    .attr("class", "button burnbutton")
                    .attr("title", eventInfos[i]["label"])
                    .html(eventInfos[i]["label"]);

    }

    bindBurnButtons(eventInfos.length, burnButtonHandler);

    var swiper1 = new Swiper('.swiper1', {
        direction: 'horizontal',
        loop: true,
        slidesPerView: 'auto',
      });

    var swiper2 = new Swiper('.swiper2', {
        direction: 'horizontal',
        loop: true,
        slidesPerView: 'auto',
      });


    animationScenes[config].state = AnimationScene.SCENE_STATE_INIT_CONFIG_DONE;
    console.debug("initConfig(" + config + ") returning - state at SCENE_STATE_ADD_CURVE_DONE");
}

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

const { toggleMode, setDimensionTop, setView } = createSettingsActions({
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
});

function navigateWithRelativeMode(enabled) {
    const url = new URL(window.location.href);
    if (enabled) {
        url.searchParams.set("mode", "relative");
    } else {
        url.searchParams.delete("mode");
    }
    window.location.href = url.toString();
}

function toggleRelativeMode() {
    if (isRelativeMode) return;
    try {
        sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
    } catch {
        // Ignore storage errors
    }
    navigateWithRelativeMode(true);
}

function toggleModeGuarded() {
    if (!isRelativeMode) {
        toggleMode();
        return;
    }

    // Relative mode is URL-driven (mode=relative). Exiting requires a reload to reset frame/orbit sources.
    const nextOrigin = readOriginMode();
    try {
        if (nextOrigin === "lunar") {
            sessionStorage.setItem(ORIGIN_OVERRIDE_STORAGE_KEY, "lunar");
        } else {
            sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
        }
    } catch {
        // Ignore storage errors
    }

    navigateWithRelativeMode(false);
}

function onWindowResize() {
    render(); // TODO is this the right thing to do here?
}

function showPlanet(planet) {
    return true;
}

function setLocation() {

    if (!orbitDataProcessed[config]) {
        return;
    }

    // =========================================================================
    // 1. FUNCTIONAL CORE: Compute scene state
    // =========================================================================
    const sunLongitudeForFrame = computeSunLongitude(animTime);
    const sceneState = computeSceneState(animTime, config, {
        sunLongitude: sunLongitudeForFrame,
        chebyshevData,
        chebyshevDataLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes: { timeTransLunarInjection, timeLunarOrbitInsertion },
        planetsForLocations: animationScenes[config].planetsForLocations,
        frameMode,
    });

    // Store sun longitude for global access (used by other parts of code)
    sunLongitude = sceneState.sunLongitude;

    // =========================================================================
    // 2. Update date display
    // =========================================================================
    var animTimeDate = new Date(animTime);
    animDate.html(animTimeDate);

    // =========================================================================
    // 3. Render with appropriate controller
    // =========================================================================
    const renderOptions = {
        craftId,
        pixelsPerAU: PIXELS_PER_AU,
        primaryBody: animationScenes[config].primaryBody,
        planetsForLocations: animationScenes[config].planetsForLocations,
        updateCraftScale
    };

    if (currentDimension === "3D") {
        // 3D rendering via controller
        if (animation3DControllers[config]) {
            animation3DControllers[config].render(sceneState, renderOptions);
        }
        if (animationScenes[config] && animationScenes[config].initialized3D) {
            adjustCameraProjectionMatrixAndSkyAngle();
        }
    } else {
        // 2D rendering via controller
        if (animation2DControllers[config]) {
            animation2DControllers[config].setPlaneConfig({
                xVariable, yVariable, zVariable,
                xFactor, yFactor, zFactor
            });
            animation2DControllers[config].setZoomPan(zoomFactor, panx, pany);
            animation2DControllers[config].render(sceneState, renderOptions);

            // Keep legacy craftData in sync (used by zoom/label helpers like adjustLabelLocations())
            if (typeof animation2DControllers[config].getCraftData === "function") {
                const latestCraftData = animation2DControllers[config].getCraftData();
                if (latestCraftData && Number.isFinite(latestCraftData.x) && Number.isFinite(latestCraftData.y)) {
                    craftData = latestCraftData;
                }
            }
        }

        // 2D-specific: labels, zoom transform, Greenwich longitude
        for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {
            var planetKey = animationScenes[config].planetsForLocations[i];
            setLabelLocation(planetKey, sceneState.bodies[planetKey]);
        }
        zoomChangeTransform(0);
        showGreenwichLongitude();
    }

    // =========================================================================
    // 4. Update shared UI: telemetry display
    // =========================================================================
    if (sceneState.telemetry) {
        const tel = sceneState.telemetry;
        const primaryBody = animationScenes[config].primaryBody;

        d3.select("#distance-SC-" + primaryBody).text(FORMAT_METRIC(tel.distancePrimary));
        d3.select("#altitude-SC-" + primaryBody).text(FORMAT_METRIC(tel.altitudePrimary));
        d3.select("#velocity-SC-" + primaryBody).text(FORMAT_METRIC(tel.velocityPrimary));

        if (tel.distanceMoon !== undefined && tel.distanceMoon !== null) {
            d3.select("#distance-SC-MOON").text(FORMAT_METRIC(tel.distanceMoon));
            d3.select("#altitude-SC-MOON").text(FORMAT_METRIC(tel.altitudeMoon));
            d3.select("#velocity-SC-MOON").text(FORMAT_METRIC(tel.velocityMoon));
        }

        if (tel.distanceEarth !== undefined && tel.distanceEarth !== null) {
            d3.select("#distance-SC-EARTH").text(FORMAT_METRIC(tel.distanceEarth));
            d3.select("#altitude-SC-EARTH").text(FORMAT_METRIC(tel.altitudeEarth));
            d3.select("#velocity-SC-EARTH").text(FORMAT_METRIC(tel.velocityEarth));
        }
    }

    // =========================================================================
    // 5. Update shared UI: phase indicator
    // =========================================================================
    if (globalConfig && globalConfig.is_lunar) {
        d3.select("#phase-1").html("Earth Bound Phase");
        d3.select("#phase-2").html("Lunar Bound Phase");
        d3.select("#phase-3").html("Lunar Orbit Phase");

        if (sceneState.phase === "earth-bound") {
            d3.select("#phase-1").html("<b><u>Earth Bound Phase</u></b>");
        } else if (sceneState.phase === "lunar-bound") {
            d3.select("#phase-2").html("<b><u>Lunar Bound Phase</u></b>");
        } else if (sceneState.phase === "lunar-orbit") {
            d3.select("#phase-3").html("<b><u>Lunar Orbit Phase</u></b>");
        }
    }

    // =========================================================================
    // 6. Update shared UI: event/burn indicator
    // =========================================================================
    if (sceneState.activeEvent) {
        d3.select("#burng").style("visibility", "visible");
        updateEventInfo(sceneState.activeEvent.infoText);
    } else {
        d3.select("#burng").style("visibility", "hidden");
        clearEventInfo();
    }

    render();
}

function adjustCameraProjectionMatrixAndSkyAngle() {
    if (animationScenes[config].cameraControlsEnabled) {
        // console.debug("Updating skyContainer position and camera controls for 3D scene");
        animationScenes[config].camera.updateProjectionMatrix();
        animationScenes[config].skyContainer.position.setFromMatrixPosition(animationScenes[config].camera.matrixWorld);
        animationScenes[config].cameraControls.update();
        cameraControlsCallback();
    }
}

async function initAnimation(flags) {
    
    try {
        await initConfig();
        await init(function() {});
    
        await (async function waitUntilOrbitDataProcessed() {
            if (!orbitDataProcessed[config]) {
                // console.log("Waiting for orbit data to be processed for " + config);
                setTimeout(waitUntilOrbitDataProcessed, 50);
            } else {
                // console.log("Orbit data already processed for " + config);
                if (flags.reset) { missionStart(); } else { setLocation(); };
                // realtime();
                dimensionActions.setDimension(true);
                setView();
                updateCraftScale();
                // startLandingFlag = true;
                // cy3Animate();
            }
        })();    
    } catch (error) {
        d3.select("#eventinfo").text("Failed to load the aninmation. Please restart the browser and try again.");
        console.error("Error: exception in initAnimation(): " + error);
        d3SelectAll("button").attr("disabled", true);
        return;
    }

    render();
    requestAnimationFrame(animateLoop);
}

function animateLoop() {
       
    curFrameTime = performance.now();

    // Update FPS counter
    fpsFrameCount++;
    if (fpsLastTime === 0) {
        fpsLastTime = curFrameTime;
    }
    if (curFrameTime - fpsLastTime >= fpsUpdateInterval) {
        const fps = Math.round(fpsFrameCount * 1000 / (curFrameTime - fpsLastTime));
        updateFPSCounter(fps);
        fpsFrameCount = 0;
        fpsLastTime = curFrameTime;
    }

    // Update frame timing for delta calculations
    if (prevFrameTime != null) {
        deltaFrameTime = curFrameTime - prevFrameTime;
    }
    prevFrameTime = curFrameTime;

    ++animateLoopCount;
    if (animateLoopCount % ticksPerAnimationStep < 0.1) {

        animateLoopCount = 0;

        // Use animation controller to advance time
        // The controller's onTimeChange callback handles setLocation()
        animationController.tick(curFrameTime);
    }

    if (animationScenes[config] && animationScenes[config].initialized3D && animationScenes[config].cameraControlsEnabled) {
        animationScenes[config].skyContainer.position.setFromMatrixPosition(animationScenes[config].camera.matrixWorld);
        animationScenes[config].cameraControls.update();
        cameraControlsCallback();
    }

    requestAnimationFrame(animateLoop);
 
}

export function main() {
    const onloadEndTime = startMissionApp({
        eventBus,
        handlers: {
            reset,
            toggleMode: toggleModeGuarded,
            toggleRelativeMode,
            toggleCamera,
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

    // console.log("onload() took " + onloadEndTime + " ms");
}

// TODO - find a better way to handle the following


async function init(callback) {
    if (animationScenes[config] && animationScenes[config].state >= AnimationScene.SCENE_STATE_INIT_DONE) {
        // console.log("init() returning as already initialized");
        return;
    }

    const fnStartTime = performance.now();
    // console.log("init() called");

    zoomFactor = 1;
    panx = 0;
    pany = 0;
    
    initRepeatButtons({
        d3SelectAll,
        setChecked,
        animationScene: animationScenes[config],
        bindRepeatButtons,
        d3Select: d3.select,
        handlersById: {
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
        },
        resetMouseRepeatState: ({ mouseOut } = {}) => {
            if (mouseOut) {
                mouseDown = false;
                if (timeoutHandleZoom == null) return;
            } else {
                mousedownTimeout = UC.ZOOM_TIMEOUT;
                mouseDown = false;
            }

            clearTimeout(timeoutHandleZoom);
            timeoutHandleZoom = null;
            zoomEnd();
        },
    });

    await sleep();

    // $("#settings-panel").dialog({
    //     dialogClass: "dialog desktoponly",
    //     modal: false,
    //     position: {
    //         my: "right top",
    //         at: "right top",
    //         of: "#blurb",
    //         collision: "fit flip"},
    //     title: "Settings",
    //     closeOnEscape: false
    // }).dialogExtend({
    //     closable: false,
    //     "dblclick" : "collapse",
    //     minimizable: false,
    //     minimizeLocation: 'right',
    //     collapsable: true,
    // })/* .dialogExtend("collapse") */;
    // $("#settings-panel")
    //     .closest('.ui-dialog')
    //     .addClass("transparent-panel")
    //     .css({'background': 'transparent', 'background-image': 'none', 'border': '0'});

    // $("#animation-control-panel").dialog({
    //     dialogClass: "dialog",
    //     modal: false,
    //     position: {
    //         my: "left top",
    //         at: "left bottom",
    //         of: "#settings-panel",
    //         collision: "fit flip"},
    //     width: "100%",
    //     maxWidth: "100%",
    //     /* height: '300', */
    //     resizable: false,
    //     // title: "Controls",
    //     closeOnEscape: false
    // }).dialogExtend({
    //     titlebar: 'none',
    //     closable: false,
    //     "dblclick" : "collapse",
    //     minimizable: false,
    //     minimizeLocation: 'right',
    //     collapsable: true,
    // });
    // $("#animation-control-panel")
    //     .closest('.ui-dialog')
    //     .addClass("transparent-panel")
    //     .css({'background': 'transparent', 'background-image': 'none', 'border': '0'});

    let isMobile = window.matchMedia("only screen and (max-width: 600px)").matches;

    // Let's not show the zoom panel at all. TODO Find a better solution later.
    // if (!isMobile) {
    //     $("#zoom-panel").dialog({
    //         dialogClass: "dialog dimension-2D desktoponly",
    //         modal: false,
    //         position: {
    //             my: "left top",
    //             at: "left bottom",
    //             of: "#animation-control-panel",
    //             collision: "fit flip"},
    //         title: "Pan/Zoom",
    //         closeOnEscape: false
    //     }).dialogExtend({
    //         closable: false,
    //         "dblclick" : "collapse",
    //         minimizable: true,
    //         minimizeLocation: 'right',
    //         collapsable: true,
    //     });
    //     $("#zoom-panel")
    //         .closest('.ui-dialog')
    //         .addClass("transparent-panel")
    //         .addClass("desktoponly")
    //         .css({'background': 'transparent', 'background-image': 'none', 'border': '0', 'margin-top': '20px'});    
    // }

    // $("#stats").dialog({
    //     dialogClass: "dialog notitledialog",
    //     modal: false,
    //     position: {
    //         my: "left bottom",
    //         at: "left bottom-50",
    //         of: window,
    //         collision: "fit flip"},
    //         title: "Information",
    //         minimizable: true,
    //         collapsable: true,
    //         closeOnEscape: false
    //     }).dialogExtend({
    //         closable: false,
    //         "dblclick" : "collapse",
    //         minimizable: true,
    //         minimizeLocation: 'right',
    //         collapsable: true,
    // });
    // $("#stats")
    //     .closest('.ui-dialog')
    //     .addClass("transparent-panel")
    //     .css({'background': 'transparent', 'background-image': 'none', 'border': '0'});

    animDate = d3.select("#date");

    await sleep();
    if (currentDimension == "2D") {
        svgActions.initSVG();
    }

    await sleep();
    loadOrbitDataIfNeededAndProcess(callback);
    loadLandingDataAndProcess();

    const fnDuration = performance.now() - fnStartTime;
    animationScenes[config].state = AnimationScene.SCENE_STATE_INIT_DONE;
    // console.log("init() returning: took " + fnDuration + " ms");
}

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
    getPanX: () => panx,
    getPanY: () => pany,
    getZoomFactor: () => zoomFactor,
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
} = createNavigationActions({
    getPanX: () => panx,
    setPanX: (val) => { panx = val; },
    getPanY: () => pany,
    setPanY: (val) => { pany = val; },
    getZoomFactor: () => zoomFactor,
    setZoomFactor: (val) => { zoomFactor = val; },
    zoomChange,
    zoomEnd,
    render,
    getZoomTimeoutMs: () => UC.ZOOM_TIMEOUT,
    getZoomScale: () => UC.ZOOM_SCALE,
    toggleInfo: () => { toggleVisibilityById("stats"); },
});

const { f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14 } = createRepeatMouseDownHandlers({
    zoomIn,
    zoomOut,
    panLeft,
    panRight,
    panUp,
    panDown,
    forward,
    fastForward,
    backward,
    fastBackward,
    slower,
    resetspeed,
    faster,
    realtime,
    getDelayMs: () => mousedownTimeout,
    setDelayMs: (val) => { mousedownTimeout = val; },
    setTimeoutHandle: (handle) => { timeoutHandleZoom = handle; },
});

const { toggleLockSC, toggleLockMoon, toggleLockEarth } = createLockActions({
    animationScenes,
    getConfig: () => config,
    reset,
    setChecked,
});

const sceneCameraActions = createSceneCameraActions({
    animationScenes,
    getConfig: () => config,
    renderScene: (scene) => {
        if (!theSceneHandler) return;
        theSceneHandler.render(scene);
    },
});

const { toggleCamera, togglePlane, toggleCameraPos, toggleCameraLook } = createCameraActions({
    animationScenes,
    getConfig: () => config,
    readCameraMode: () => readCheckedRadioValue("camera", "default"),
    readPlaneSelection: () => readCheckedRadioValue("plane", "DEFAULT"),
    setPlaneSelection: (val) => { planeSelection = val; },
    handlePlaneChange: planeActions.handlePlaneChange,
    readLookMode: () => readCheckedRadioValue("look", "AUTO"),
    render,
    getViewSky: () => viewSky,
    applyCameraPosToggle: sceneCameraActions.toggleCameraPos,
    applyCameraLookToggle: sceneCameraActions.toggleCameraLook,
});

const { toggleJoyRide, toggleLanding } = createModeActions({
    animationScenes,
    getConfig: () => config,
    getGlobalConfig: () => globalConfig,
    render,
    updateCraftScale,
    getLandingFlag: () => landingFlag,
    setLandingFlag: (val) => { landingFlag = val; },
    getJoyRideFlag: () => joyRideFlag,
    setJoyRideFlag: (val) => { joyRideFlag = val; },
    setView,
});

const { burnButtonHandler } = createBurnActions({
    getEventInfos: () => eventInfos,
    setAnimTime: (val) => { animTime = val; },
    missionSetTime,
});

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
