
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

// View variables

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

let wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let wait10 = () => wait(10);
let wait20 = () => wait(20);
let wait50 = () => wait(50);
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
        this.stopCreationFlag = true;
    }

    setCameraPosition(x, y, z) {
        // console.log(`Setting camera position to (${x}, ${y}, ${z}).`);

        if (this.cameraController) {
            this.cameraController.setPosition(x, y, z);
        }

        // Update sky position to follow camera
        if (this.skyContainer && this.camera) {
            this.skyContainer.position.setFromMatrixPosition(this.camera.matrixWorld);
        }

        // Update controls
        if (this.cameraController) {
            this.cameraController.update();
            cameraControlsCallback();
        }
    }

    init3d(callback) {
        if (this.initialized3D) {
            return;
        }

        var scene = this;

        const getTextures = ()=> new Promise((resolve, reject)=>{
          const loader = new THREE.TextureLoader();
          THREE.DefaultLoadingManager.onLoad = ()=>resolve(textures);
          const textures = [
            
            "images/earth/2_no_clouds_8k.jpg",
            "images/earth/earthspec1k.jpg",
            "images/moon/Solarsystemscope_texture_8k_moon.jpg",
            "images/moon/ldem_16_gsfc.png",
            "images/sky/starmap_4k.jpg",
            "images/sky/constellation_figures.jpg",

          ].map(filename=>loader.load(filename));
        });

        getTextures().then(async result=>{

            // console.log("Loaded textures: ", result);

            var mapIndex = 0;

            scene.earthTexture = result[mapIndex++];
            scene.earthTexture.minFilter = THREE.LinearFilter;

            scene.earthSpecularTexture = result[mapIndex++];
            scene.earthSpecularTexture.minFilter = THREE.LinearFilter;

            scene.moonMap = result[mapIndex++];
            scene.moonMap.minFilter = THREE.LinearFilter;

            scene.moonDisplacementMap = result[mapIndex++];
            scene.moonDisplacementMap.minFilter = THREE.LinearFilter;

            scene.skyTexture = result[mapIndex++];
            scene.skyTexture.minFilter = THREE.LinearFilter;
            // scene.skyTexture.flipY = false;

            scene.skyConstellationTexture = result[mapIndex++];
            scene.skyConstellationTexture.minFilter = THREE.LinearFilter;
            // scene.skyConstellationTexture.flipY = false;
            
            scene.init3dRest(); // We can't call callback until we are done
            callback();

        }, (error) => {
            console.error("Error: couldn't load textures: " + erorr);
        });

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
        svgActions.computeSVGDimensions();
        this.width = svgWidth;
        this.height = svgHeight;
    }

    async addCurve() {

        var scene = this;

        // [0  .. 420) => [320 .. 420), [220 .. 320), [120 .. 220), [20 .. 120), [0, 20)

        scene.startingIndex = scene.leftOrbitPoints;
        // console.log("addCurve(): startingIndex = " + scene.startingIndex, ", nPoints = " + scene.leftOrbitPoints);

        do {
            var nPoints = Math.min(scene.leftOrbitPoints, scene.pointsPerSlice);
            if (nPoints <= 0) {
                break;
            } else {
                scene.startingIndex -= nPoints;
                scene.leftOrbitPoints -= nPoints;
            }

            var arr = scene.curve.slice(scene.startingIndex, scene.startingIndex + nPoints + 1); // +1 because we want the last point
            var curves = new THREE.CatmullRomCurve3(arr);
        
            var orbitGeometry = new THREE.BufferGeometry();
            const vertexVectors = curves.getSpacedPoints(nPoints * 40);
            const vertices = [];
            vertexVectors.forEach(function(elem) { vertices.push(elem.x, elem.y, elem.z); }); 
            orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            var orbitLine = new THREE.Line(orbitGeometry, scene.orbitMaterial);
            orbitLine.visible = viewOrbit;
            scene.orbitLines.push(orbitLine);
            scene.motherContainer.add(orbitLine);
            render();
            await wait10();
            if (this.stopCreationFlag) {
                // console.log("Stopping creation of " + scene.name + " scene");
                break;
            }
        } while (true);

        // console.log("addCurve() done for " + scene.name);
        this.state = AnimationScene.SCENE_STATE_ADD_CURVE_DONE;
        // timeoutHandler();
    }

    addSky() {
        // Create sky renderer
        this.skyRenderer = new SkyRenderer(this.motherContainer, earthRadius);
        this.skyRenderer.setTextures(this.skyTexture, this.skyConstellationTexture);
        this.skyRenderer.create(viewSky);

        // Backward-compatible property references
        this.skyContainer = this.skyRenderer.container;
        this.sky = this.skyRenderer.skyMesh;
        this.skyConstellation = this.skyRenderer.constellationMesh;

        render();
    }

    disposeSky() {
        if (this.skyRenderer) {
            this.skyRenderer.dispose();
            this.skyRenderer = null;
        }

        // Clear backward-compatible references
        this.sky = null;
        this.skyConstellation = null;
        this.skyContainer = null;
        this.skyTexture = null;
        this.skyConstellationTexture = null;
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
        this.dwingeloo = this.plotEarthLocation(degreesToRadians(6.39616944444), degreesToRadians(52.8120194444), "#FF0000");
        this.chennai = this.plotEarthLocation(degreesToRadians(80.2707), degreesToRadians(13.0827), "#FF0000");

        this.locations.map(x => x.visible = viewCraters);
    }

    disposeEarthLocations() {
        if (this.locations) {
            this.locations.forEach(location => {
                if (location.geometry) {
                    location.geometry.dispose();
                }
                if (location.material) {
                    location.material.dispose();
                }
                this.earthContainer.remove(location);
            });
            this.locations = [];
        }

        // Specifically dispose of Dwingeloo and Chennai locations
        if (this.dwingeloo) {
            this.earthContainer.remove(this.dwingeloo);
            this.dwingeloo = null;
        }
        if (this.chennai) {
            this.earthContainer.remove(this.chennai);
            this.chennai = null;
        }
    }
    
    addMoonLocations() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        // Moon selenographic origin (Prime Meridian = 0 degrees, Equator = 0 degrees) for reference
        // this.plotMoonLocation(degreesToRadians(0), degreesToRadians(0), "#FF00FF"); // TODO 2021 - for testing - (0deg longitude == Prime Meridian, 0deg latitude)

        // Some Moon locations for calibrsation
        //
        // Some of the values are from Wikipedia and some are from NASA:
        //
        // https://astrogeology.usgs.gov/search/map/Moon/Research/Craters/GoranSalamuniccar_MoonCraters
        //
        // this.plotMoonLocation(degreesToRadians(- 9.3),      degreesToRadians(+51.6), "#FF0000");      // Plato crater
        // this.plotMoonLocation(degreesToRadians(- 1.1),      degreesToRadians(+40.6), "#FF0000");      // Mons Piton
        // this.plotMoonLocation(degreesToRadians(+ 5.211),    degreesToRadians(+ 3.212), "#FF0000");    // Mosting A crater
        // this.plotMoonLocation(degreesToRadians(+22.1),      degreesToRadians(-70.1), "#FF0000");      // Manzinus C - https://en.wikipedia.org/wiki/Manzinus_(crater) 
        // this.plotMoonLocation(degreesToRadians(+21.753904), degreesToRadians(-69.996092), "#FF0000"); // Manzinus C - https://en.wikipedia.org/wiki/Manzinus_(crater) 
        // this.plotMoonLocation(degreesToRadians(+24.3),      degreesToRadians(-71.3), "#FF0000");      // Simpelius N - https://en.wikipedia.org/wiki/Simpelius_(crater) 
        // this.plotMoonLocation(degreesToRadians(24.103513),  degreesToRadians(-71.365233), "#FF0000"); // Simpelius N - https://en.wikipedia.org/wiki/Simpelius_(crater) 

        // Plot landing sites from config
        if (globalConfig && globalConfig.landingSites) {
            globalConfig.landingSites.forEach(site => {
                this.plotMoonLocation(
                    degreesToRadians(site.longitude), 
                    degreesToRadians(site.latitude), 
                    site.color
                );
            });
        }

        this.locations.map(x => x.visible = viewCraters);
    }

    disposeMoonLocations() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        if (this.locations) {
            this.locations.forEach(location => {
                if (location.geometry) {
                    location.geometry.dispose();
                }
                if (location.material) {
                    location.material.dispose();
                }
                this.moonContainer.remove(location);
            });
            this.locations = [];
        }
    }

    setPrimaryAndSecondaryBodies() {
        // set primary and secondary bodies
                
        if (config == "geo") {

            this.primaryBody3D = this.earthContainer;
            this.secondaryBody3D = this.moonContainer;

            this.earthContainer.add(this.earthAxis);
            this.earthContainer.add(this.earthNorthPoleSphere);
            this.earthContainer.add(this.earthSouthPoleSphere);

            // Only add moon components if this is a lunar mission
            if (globalConfig && globalConfig.is_lunar && this.moonContainer) {
                this.moonContainer.add(this.moonAxis);
                this.moonContainer.add(this.moonNorthPoleSphere);
                this.moonContainer.add(this.moonSouthPoleSphere);
            }
                
        
        } else if (config == "lunar") {
        
            this.primaryBody3D = this.moonContainer;
            this.secondaryBody3D = this.earthContainer;

            // Only add moon components if this is a lunar mission
            if (globalConfig && globalConfig.is_lunar && this.moonContainer) {
                this.moonContainer.add(this.moonAxis);
                this.moonContainer.add(this.moonNorthPoleSphere);
                this.moonContainer.add(this.moonSouthPoleSphere);
            }

            this.earthContainer.add(this.earthAxis);
            this.earthContainer.add(this.earthNorthPoleSphere);
            this.earthContainer.add(this.earthSouthPoleSphere);
        
        }

        this.motherContainer.add(this.primaryBody3D);
        if (this.secondaryBody3D) {
            this.motherContainer.add(this.secondaryBody3D);
        }    
    }

    addSpacecraftCurve() {
        // add spacecraft orbiter orbit
        this.orbitLines = [];
        this.pointsPerSlice = 100;
        this.startingIndex = 0;
        this.leftOrbitPoints = nOrbitPoints;

        var craftOrbitColor = planetProperties[craftId]["orbitcolor"];
        this.orbitMaterial = new THREE.LineBasicMaterial({color: craftOrbitColor, linewidth: 0.2});

        this.addCurve(); // TODO should we prefix await here?


        if (config == "lunar" && globalConfig && globalConfig.landing && globalConfig.landing.enabled && this.landingCurve.length > 0) {
            // console.log("Adding landing curve ...");
            var landingCurves = new THREE.CatmullRomCurve3(this.landingCurve);
            var landingOrbitGeometry = new THREE.BufferGeometry();
            const vertexVectors = landingCurves.getSpacedPoints(nLandingPoints * 40);
            const vertices = [];
            vertexVectors.forEach(function(elem) { vertices.push(elem.x, elem.y, elem.z); }); 
            landingOrbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            var landingOrbitColor = "#FFFFE0"; // Light yellow for landing orbit
            var landingOrbitMaterial = new THREE.LineBasicMaterial({color: landingOrbitColor, linewidth: 0.2});
            this.landingOrbitLine = new THREE.Line(landingOrbitGeometry, landingOrbitMaterial);
            this.landingOrbitLine.visible = viewOrbitDescent;
            this.motherContainer.add(this.landingOrbitLine);
            render();
            // console.log("Added landing curve.");
        }

    }

    disposeSpacecraftCurve() {
        // Dispose of orbit lines
        if (this.orbitLines) {
            this.orbitLines.forEach(line => {
                if (line.geometry) {
                    line.geometry.dispose();
                }
                if (line.material) {
                    line.material.dispose();
                }
                this.motherContainer.remove(line);
            });
            this.orbitLines = [];
        }

        // Dispose of orbit material
        if (this.orbitMaterial) {
            this.orbitMaterial.dispose();
            this.orbitMaterial = null;
        }

        // Dispose of landing orbit line
        if (this.landingOrbitLine) {
            if (this.landingOrbitLine.geometry) {
                this.landingOrbitLine.geometry.dispose();
            }
            if (this.landingOrbitLine.material) {
                this.landingOrbitLine.material.dispose();
            }
            this.motherContainer.remove(this.landingOrbitLine);
            this.landingOrbitLine = null;
        }

        // Clear curve data
        this.chandrayaanCurve = [];
        this.landingCurve = [];

        // Reset orbit-related variables
        this.pointsPerSlice = 0;
        this.startingIndex = 0;
        this.leftOrbitPoints = 0;
    }



    addSpacecraft() {
        const craftColor = planetProperties["SC"]["color"];

        // Create spacecraft renderer
        this.spacecraftRenderer = new SpacecraftRenderer(this.motherContainer, craftSize, craftColor);
        this.spacecraftRenderer.createSimple();

        // Backward-compatible property references
        this.craft = this.spacecraftRenderer.craft;
        this.craftInner = this.spacecraftRenderer.craftInner;
        this.craftEdges = this.spacecraftRenderer.craftEdges;
        this.craftAxesHelper = this.spacecraftRenderer.axesHelper;
        this.craftVisible = this.spacecraftRenderer.visible;
        this.drone = this.spacecraftRenderer.drone;
    }

    disposeSpacecraft() {
        if (this.spacecraftRenderer) {
            this.spacecraftRenderer.dispose();
            this.spacecraftRenderer = null;
        }

        // Clear backward-compatible references
        this.craft = null;
        this.craftInner = null;
        this.craftEdges = null;
        this.craftAxesHelper = null;
        this.craftVisible = false;
        this.drone = null;
    }

    

    
    addLineOfSight() {
        // this.losLineGeometry = new THREE.BufferGeometry();
        // this.losLine = new THREE.Line(this.losLineGeometry, losLineMaterial);        
        // this.losLine.frustumCulled = false;
        // this.motherContainer.add(this.losLine);        
        // this.losLine.visible = false; // TODO add a control flag for this
    }

    disposeLineOfSight() {
        if (this.losLine) {
            if (this.losLine.geometry) {
                this.losLine.geometry.dispose();
            }
            if (this.losLine.material) {
                this.losLine.material.dispose();
            }
            this.motherContainer.remove(this.losLine);
            this.losLine = null;
        }

        if (this.losLineGeometry) {
            this.losLineGeometry.dispose();
            this.losLineGeometry = null;
        }
    }

    addAxesHelper() {
        // Create SceneHelpers instance if not already created
        if (!this.sceneHelpers) {
            this.sceneHelpers = new SceneHelpers(this.motherContainer);
        }

        const axesSize = 2 * PIXELS_PER_AU * PC.EARTH_MOON_DISTANCE_MEAN_AU;
        const gridRadius = earthRadius * 64;
        const eclipticPlaneSize = earthRadius * 128;
        const equatorialPlaneSize = earthRadius * 144;

        this.sceneHelpers.createAxesHelper(axesSize, viewXYZAxes);
        this.sceneHelpers.createEclipticPlane(gridRadius, eclipticPlaneSize, viewEclipticPlane);
        this.sceneHelpers.createEquatorialPlane(gridRadius, equatorialPlaneSize, viewEquatorialPlane);

        // Backward-compatible property references for setView()
        this.axesHelper = this.sceneHelpers.axesHelper;
        this.eclipticPolarGridHelper = this.sceneHelpers.eclipticPolarGridHelper;
        this.eclipticPlaneHelper = this.sceneHelpers.eclipticPlaneHelper;
        this.equatorialPolarGridHelper = this.sceneHelpers.equatorialPolarGridHelper;
        this.equatorialPlaneHelper = this.sceneHelpers.equatorialPlaneHelper;
    }

    disposeAxesHelper() {
        if (this.sceneHelpers) {
            this.sceneHelpers.disposeAxesHelper();
            this.sceneHelpers.disposeEclipticPlane();
            this.sceneHelpers.disposeEquatorialPlane();
        }
        // Clear backward-compatible references
        this.axesHelper = null;
        this.eclipticPolarGridHelper = null;
        this.eclipticPlaneHelper = null;
        this.equatorialPolarGridHelper = null;
        this.equatorialPlaneHelper = null;
    }
    
    addLight() {
        // Create light manager and add lights
        this.lightManager = new LightManager(this.motherContainer);
        this.lightManager.create();

        // Backward-compatible property references
        this.light = this.lightManager.primaryLight;
        this.light2 = this.lightManager.craftLight;

        // Add motherContainer to scene (legacy coupling)
        this.scene.add(this.motherContainer);
    }

    disposeLight() {
        // In 2D mode, motherContainer doesn't exist
        if (!this.motherContainer) {
            return;
        }

        if (this.lightManager) {
            this.lightManager.dispose();
            this.lightManager = null;
        }

        // Clear backward-compatible references
        this.light = null;
        this.light2 = null;

        // If the motherContainer was added to the scene, remove it
        if (this.scene) {
            this.scene.remove(this.motherContainer);
        }
    }

    addCamera() {
        // Create camera controller
        this.cameraController = new CameraController(this.width, this.height, defaultCameraDistance);
        this.cameraController.controlsEnabled = this.cameraControlsEnabled;

        // Create main camera
        this.cameraController.createMainCamera(50);
        this.setCameraPosition(defaultCameraDistance, defaultCameraDistance, defaultCameraDistance);

        // Create craft and drone cameras
        this.cameraController.createCraftCamera(this.craft, 50);
        this.cameraController.createDroneCamera(this.drone, 100);

        // Create controls if enabled
        if (this.cameraControlsEnabled) {
            this.cameraController.createControls(
                theSceneHandler.renderer.domElement,
                cameraControlsCallback,
                render
            );
        }

        // Backward-compatible property references
        this.camera = this.cameraController.camera;
        this.craftCamera = this.cameraController.craftCamera;
        this.droneCamera = this.cameraController.droneCamera;
        this.cameraControls = this.cameraController.controls;

        this.setCameraParameters(null, true);
    }

    disposeCamera() {
        if (this.cameraController) {
            this.cameraController.dispose(this.craft, this.drone);
            this.cameraController = null;
        }

        // Clear backward-compatible references
        this.camera = null;
        this.craftCamera = null;
        this.droneCamera = null;
        this.cameraControls = null;
    }

    async addSpacecraftModel() {
        if (!globalConfig?.spacecraftModel?.enabled) {
            return;
        }

        const craftColor = planetProperties["SC"]["color"];
        const modelPath = window.missionConfig.modelPath + globalConfig.spacecraftModel.file;

        // Create spacecraft renderer for GLTF model
        this.spacecraftRenderer = new SpacecraftRenderer(this.motherContainer, craftSize, craftColor);
        await this.spacecraftRenderer.loadModel(modelPath);

        // Backward-compatible property references
        this.craft = this.spacecraftRenderer.craft;
        this.craftInner = this.spacecraftRenderer.craftInner;
        this.craftAxesHelper = this.spacecraftRenderer.axesHelper;
        this.craftVisible = this.spacecraftRenderer.visible;
    }

    disposeSpacecraftModel() {
        if (this.spacecraftRenderer) {
            this.spacecraftRenderer.disposeModel();
            this.spacecraftRenderer = null;
        }

        // Clear backward-compatible references
        this.craft = null;
        this.craftInner = null;
        this.craftAxesHelper = null;
        this.craftVisible = false;
    }
    
    init3dRest() {

        // console.log("init3dRest() called");

        this.scene = new THREE.Scene();
        this.motherContainer = new THREE.Group();

        this.computeDimensions(); render(); wait20().then();
        this.addLight(); render(); wait20().then();
        this.addSky(); render(); wait20().then();
        this.addMoon(); render(); wait20().then();
        this.addEarth(); render(); wait20().then();
        
        this.setPrimaryAndSecondaryBodies(); render(); wait20().then();
        this.addSpacecraft(); render(); wait20().then();
        // await this.addSpacecraftModel(); render(); wait20().then();
        this.addCamera(); render(); wait20().then();
        this.initialized3D = true; render(); wait20().then();

        this.addEarthLocations(); render(); wait20().then();
        this.addMoonLocations(); render(); wait20().then();   

        this.addSpacecraftCurve(); render(); wait20().then();
        this.addLineOfSight(); render(); wait20().then();
        this.addAxesHelper(); render(); wait20().then();

        clearEventInfo();
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
        nOrbitPoints = orbitCurveActions.addOrbitCurveVectors({
            config,
            curve: this.curve,
            curveVelocities: this.curveVelocities,
        });
    }

    processLandingVectors() {
        nLandingPoints = orbitCurveActions.addLandingCurveVectors({
            config,
            landingCurve: this.landingCurve,
            landingCurveVelocities: this.landingCurveVelocities,
        });
    }

    cameraDisntance(position) {
        return distance3D(position);
    }   

    plotEarthLocation(long, lat, color) {
        var locationRadiusScale = 0.001;
        var geometry = new THREE.SphereGeometry(locationRadiusScale * earthRadius, 100, 100);
        var material = new THREE.MeshPhysicalMaterial({color: COL.BLACK, emissive: color, reflectivity: 0.0, transparent: false, opacity: 0.2});
        var sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = false;
        sphere.receiveShadow = false;
        var radiusScale = 1 - (locationRadiusScale/2);
        const pos = sphericalToCartesian(radiusScale * earthRadius, long, lat);
        sphere.position.set(pos.x, pos.y, pos.z);
        this.locations.push(sphere);
        this.earthContainer.add(sphere);
        return sphere;
    }

    plotMoonLocation(long, lat, color) {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        var locationRadiusScale = 0.005;
        var geometry = new THREE.SphereGeometry(locationRadiusScale * moonRadius, 100, 100);
        var material = new THREE.MeshStandardMaterial({color: color, emissive: color, transparent: false, opacity: 1.0});
        var sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = false;
        sphere.receiveShadow = false;
        var radiusScale = 1.005 - (locationRadiusScale/2);
        const pos = sphericalToCartesian(radiusScale * moonRadius, long, lat);
        sphere.position.set(pos.x, pos.y, pos.z);
        this.locations.push(sphere);
        this.moonContainer.add(sphere);
        return sphere;
    }

    rotateMoon(timeMs = animTime) {
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
        console.debug('Disposing AnimationScene with complete WebGL cleanup...');
        
        // Dispose all scene components
        this.disposeEarthLocations();
        this.disposeEarth();
        this.disposeSky();
        this.disposeMoonLocations();
        this.disposeMoon();
        this.disposeSpacecraftModel();
        this.disposeSpacecraftCurve();
        this.disposeMoonSOI();
        this.disposeLineOfSight();
        this.disposeAxesHelper();
        this.disposeLight();
        this.disposeCamera();
        this.disposeSpacecraft();

        // Dispose sceneHelpers instance
        if (this.sceneHelpers) {
            this.sceneHelpers = null;
        }

        // IMPORTANT: Don't dispose scene and motherContainer 
        // as these may be reused by the new mode initialization
        // Just dispose their WebGL resources, not the containers themselves
        
        console.debug('AnimationScene disposal completed');
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
        planetsForLocations: animationScenes[config].planetsForLocations
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
            toggleMode,
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
