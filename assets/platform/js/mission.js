
// Copyright (c) 2013-2024 Sankaranarayanan Viswanathan. All rights reserved.

import { deg_to_rad, lunar_pole } from "./astro.js";
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
import { getStateFromChebyshev, loadChebyshevData, generateCurveFromChebyshev } from "./chebyshev.js";
import { getMoonState, getEarthFromMoonState } from "./astronomy-bodies.js";
import { degreesToRadians, distance3D, velocityToAngle } from "./utils/math-utils.js";

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
var planeChanged = false;
var planeChangesPending = false;

// animation control
var mouseDown = false;

// defaults for XY plane
var planeSelection = "DEFAULT"; // DEFAULT, XY, YZ, ZX, XY-, YZ-, ZX-
var previousPlaneSelection = null; // DEFAULT, XY, YZ, ZX, XY-, YZ-, ZX-
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

function showWhatsNew() {
    $("#dialog-whatsnew").dialog("open");
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
var globalConfig = null; // Store loaded config from config.json
var joyRideFlag = false;
var landingFlag = false;
var moonPhaseCamera = false;

// View variables

var configGeo = $("#origin-earth").is(":checked"); 
var configLunar = $("#origin-moon").is(":checked"); 
var config = configGeo ? "geo" : (configLunar ? "lunar" : "undefined");

var viewOrbit = $("#view-orbit").is(":checked"); 
var viewOrbitDescent = $("#view-orbit-descent").is(":checked"); 
 
 
var viewCraters = $("#view-craters").is(":checked"); 
var viewXYZAxes = $("#view-xyz-axes").is(":checked"); 
var viewPoles = $("#view-poles").is(":checked"); 
var viewPolarAxes = $("#view-polar-axes").is(":checked"); 
var viewSky = $("#view-sky").is(":checked"); 
var viewMoonSOI = $("#view-moonsoi").is(":checked");
var viewEclipticPlane = $("#view-eclipticplane").is(":checked");
var viewEquatorialPlane = $("#view-equatorialplane").is(":checked");
var viewFPS = $("#view-fps").is(":checked");

let wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let wait10 = () => wait(10);
let wait20 = () => wait(20);
let wait50 = () => wait(50);
async function sleep() { return new Promise(requestAnimationFrame); } // The Promise resolves after the next frame is painted

function fetchJson(url, callback = null, callbackError = null) {
    fetch(url, { headers: { 'accept': 'application/json; charset=utf8;' } }) 
      .then(r => { return r.json(); })  
      .then(r => {
        if (callback !== null) callback(r);
      })  
      .catch(err => {
        if (callbackError !== null) callbackError(err);
    }); 
};  


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

function updateDynamicLabels() {
    if (!globalConfig) return;

    // Get spacecraft name from config (fallback to defaults)
    const spacecraftName = globalConfig.mission_name || 'Spacecraft';
    const spacecraftShort = globalConfig.mission_name_short || globalConfig.spacecraft_mnemonic || 'SC';
    const ui = globalConfig.ui || {};

    // Update page title
    document.title = ui.pageTitle || `${spacecraftName} - Orbit Animation`;

    // Update mission link in header
    const missionLink = document.getElementById('mission-link');
    if (missionLink) {
        missionLink.textContent = ui.headerTitle || spacecraftName;
        missionLink.href = globalConfig.mission_url || '#';
    }

    // Update dynamic UI labels (use config ui values if available, else compute)
    const labelElements = [
        { id: 'label-lock-spacecraft', text: ui.lockOnLabel || spacecraftName },
        { id: 'label-orbit', text: ui.orbitLabel || `${spacecraftShort} Orbit` },
        { id: 'label-orbit-descent', text: ui.descentOrbitLabel || `${spacecraftShort} Descent Orbit` }
    ];

    updateMultipleElementsText(labelElements, true);

    // Update spacecraft mnemonic in the dedicated span element
    updateSpacecraftMnemonic(spacecraftShort);

    // console.debug('Dynamic labels updated:', { spacecraftName, spacecraftShort });
}

function updateMissionMetadata() {
    updateDynamicLabels();
    
    // Update planetProperties for spacecraft to use correct mnemonic in 2D view
    if (globalConfig && globalConfig.spacecraft_mnemonic) {
        planetProperties["SC"]["name"] = globalConfig.spacecraft_mnemonic;
    }
}

async function loadConfig() {
    if (globalConfig !== null) {
        return globalConfig; // Return cached config
    }
    
    // Get config path from mission config set by HTML
    if (!window.missionConfig || !window.missionConfig.dataPath) {
        console.error('No mission configuration found. Please set window.missionConfig in your HTML file.');
        return null;
    }
    
    const configPath = window.missionConfig.dataPath + 'config.json';
    console.debug(`Loading config from: ${configPath}`);
    
    try {
        const response = await fetch(configPath);
        if (response.ok) {
            globalConfig = await response.json();
            eventInfos = globalConfig.eventInfos || [];
            console.debug('Config loaded successfully:', globalConfig);
            
            // Note: SC and craftId remain as "SC" for internal use
            // globalConfig.spacecraft_mnemonic is used only for file path construction
            
            // Update UI elements based on config
            updateMissionMetadata();
            updateMoonUIFromConfig();
            updateLandingUIFromConfig();
            
            return globalConfig;
        } else {
            console.warn('Could not load config.json, using defaults');
            return null;
        }
    } catch (error) {
        console.warn('Error loading config.json:', error);
        return null;
    }
}

function updateMoonUIFromConfig() {
    const isMoonEnabled = globalConfig && globalConfig.is_lunar;
    
    if (isMoonEnabled) {
        // Show moon-related UI elements
        $("#origin-moon").closest('label').show();
        $("#origin-moon").show();
        $("#view-moonsoi").closest('label').show();
        $("#view-moonsoi").show();
        $(".geo").show(); // Show "Lock on Moon" checkbox in geocentric mode
    } else {
        // Hide moon-related UI elements
        $("#origin-moon").closest('label').hide();
        $("#origin-moon").hide();
        $("#view-moonsoi").closest('label').hide();
        $("#view-moonsoi").hide();
        $(".geo").hide(); // Hide "Lock on Moon" checkbox
        
        // If currently in lunar mode, switch to geo mode
        if (config === "lunar") {
            config = "geo";
            $("#origin-earth").prop("checked", true);
            $("#origin-moon").prop("checked", false);
        }
        
        // Ensure moon-related checkboxes are unchecked
        $("#checkbox-lock-moon").prop("checked", false);
        $("#view-moonsoi").prop("checked", false);
    }
}

function updateLandingUIFromConfig() {
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;
    
    if (isLandingEnabled) {
        // Show landing UI elements
        $("#landing").closest('label').show();
        $("#landing").show();
        $("#landingbutton").show();
    } else {
        // Hide landing UI elements and ensure landing is disabled
        $("#landing").closest('label').hide();
        $("#landing").hide();
        $("#landingbutton").hide();
        
        // If landing is currently active, turn it off
        if (landingFlag) {
            landingFlag = false;
            $("#landingbutton").removeClass("down");
            $("#landing").prop("checked", false);
        }
    }
}

function updateLandingTimesFromConfig() {
    if (globalConfig && globalConfig.landing && globalConfig.landing.enabled) {
        const cfg = globalConfig.landing;
        
        // Calculate start time from config
        const configStartYear = parseInt(cfg.start_year);
        const configStartMonth = parseInt(cfg.start_month);
        const configStartDay = parseInt(cfg.start_day);
        const configStartHour = parseInt(cfg.start_hour);
        const configStartMinute = parseInt(cfg.start_minute);
        
        startLandingTime = Date.UTC(configStartYear, configStartMonth - 1, configStartDay, configStartHour, configStartMinute, 0, 0);
        
        // Calculate end time from config
        const configStopYear = parseInt(cfg.stop_year);
        const configStopMonth = parseInt(cfg.stop_month);
        const configStopDay = parseInt(cfg.stop_day);
        const configStopHour = parseInt(cfg.stop_hour);
        const configStopMinute = parseInt(cfg.stop_minute);
        
        endLandingTime = Date.UTC(configStopYear, configStopMonth - 1, configStopDay, configStopHour, configStopMinute, 0, 0);
        
        console.debug('Updated landing times from config:', {
            startLandingTime: new Date(startLandingTime),
            endLandingTime: new Date(endLandingTime)
        });
    } else if (!globalConfig || !globalConfig.landing) {
        console.debug('Using default landing times (no config.landing found)');
    }
    // If landing.enabled is false, no message is logged
}


function getStartAndEndTimes(id) {
    let startTime, endTime;

    if (globalConfig && globalConfig[config]) {
        const phaseConfig = globalConfig[config];
        startTime = Date.UTC(
            parseInt(phaseConfig.start_year),
            parseInt(phaseConfig.start_month) - 1,
            parseInt(phaseConfig.start_day),
            parseInt(phaseConfig.start_hour),
            parseInt(phaseConfig.start_minute),
            0, 0
        );
        // Note: we should keep end times 1 minute (current resolution) less than the last orbit data point time argument
        endTime = Date.UTC(
            parseInt(phaseConfig.stop_year),
            parseInt(phaseConfig.stop_month) - 1,
            parseInt(phaseConfig.stop_day),
            parseInt(phaseConfig.stop_hour),
            parseInt(phaseConfig.stop_minute),
            0, 0
        ) - TC.ONE_MINUTE_MS;
    } else {
        return [null, null];
    }

    return [startTime, endTime];
}

class SceneHandler {

    constructor() {
        // console.log("SceneHandler ctor called");

        this.scene = null;
        this.renderer = null;
        this.canvasNode = null;
        this.initialized = false;

        this.init();
    }

    init() {

        // console.log("SceneHandler init() called");

        if (this.initialized) {
            return;
        }

        computeSVGDimensions();
        var width = svgWidth;
        var height = svgHeight; // - $("#svg-top-baseline").position().top;

        // add renderer
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        // Use fixed pixel ratio in test mode for consistent visual regression testing
        this.renderer.setPixelRatio(isTestMode ? 1.0 : window.devicePixelRatio);
        this.renderer.setSize(width, height);
        // this.renderer.domElement.style.display = "none";

        // document.body.appendChild(renderer.domElement);
        // console.log("Adding rendererer ...");
        this.canvasNode = d3.select("#canvas-wrapper")[0][0].appendChild(this.renderer.domElement); // TODO find a better D3 way to do this
        // this.canvasNode = d3.select("#canvas-wrapper").node().appendChild(this.renderer.domElement); // TODO find a better D3 way to do this

        window.addEventListener('resize', onWindowResize, {passive: false}); // TODO verify 

        // Prevent default drag behavior on the canvas
        this.renderer.domElement.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Also prevent selection
        this.renderer.domElement.style.userSelect = 'none';
        this.renderer.domElement.style.webkitUserSelect = 'none';
        this.renderer.domElement.style.MozUserSelect = 'none';

        $("#settings-panel-button").on("click", function() {
            $("#settings-panel").dialog({
                dialogClass: "dialog",
                modal: false,
                position: {
                    my: "left top",
                    at: "left bottom",
                    of: "#svg-top-baseline",
                    collision: "fit flip"},
                title: "Settings",
                closeOnEscape: false
                }).dialogExtend({
                    closable: true,
                    minimizable: false,
                    collapsable: false,
                    })/* .dialogExtend("collapse") */;
            $("#settings-panel")
                .closest('.ui-dialog')
                // .addClass("transparent-panel")
                .css({'background-image': 'none', 'border': '0', 'max-width': '80%', 'z-index': '9999'});

                });

        this.initialized = true;
    }

    render(animationScene) {

        // console.log("SceneHandler.render() called");

        if (animationScene.initialized3D) {

            updateCraftScale();

            if (moonPhaseCamera) {
                animationScene.camera.lookAt(animationScene.secondaryBody3D.position);            
            }
            
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
    if (animationScenes[config] && animationScenes[config].initialized3D) {

        // var origin = new THREE.Vector3(0, 0, 0);
        // var target = new THREE.Vector3();
        // var craftLocation = animationScenes[config].craft.getWorldPosition(target);
        // var distance = animationScenes[config].cameraControls.getWorldPos().distanceTo(craftLocation);
        // var scale =  distance / defaultCameraDistance;

        var craftLocation = new THREE.Vector3();
        animationScenes[config].craft.getWorldPosition(craftLocation);
        
        var cameraLocation = new THREE.Vector3();

        if (joyRideFlag) {
            animationScenes[config].camera.getWorldPosition(cameraLocation); // not craftCamera
        } else if (landingFlag) {
            animationScenes[config].droneCamera.getWorldPosition(cameraLocation);
        } else {
            animationScenes[config].camera.getWorldPosition(cameraLocation);
        }
        
        var distance = cameraLocation.distanceTo(craftLocation);
        var scale =  distance / defaultCameraDistance;
        if (landingFlag) { scale = scale * 5; }
        // console.log(`Setting scale to ${scale}`); // TODO seems to be buggy

        animationScenes[config].craft.scale.set(scale, scale, scale);
        animationScenes[config].drone.scale.set(scale, scale, scale);
        
        // animationScenes[config].craft.scale.set(10, 10, 10);

        if (isLocationAvaialable("SC", animTime)) {
            // console.log(`SC location avaialble: setting SC visibility to ${animationScenes[config].craftVisible}`);
            animationScenes[config].craft.visible = animationScenes[config].craftVisible;
            animationScenes[config].drone.visible = false;
        } else {
            // console.log(`SC location NOT avaialble: setting SC visibility to false`);
            animationScenes[config].craft.visible = false;
            animationScenes[config].drone.visible = false;
        }

    }
}

function cameraControlsCallback() {
    // console.log("cameraControlsCallback() called");
    // Check if scene is still valid before updating craft scale
    if (animationScenes[config] && animationScenes[config].craft && animationScenes[config].initialized3D) {
        updateCraftScale();
    }
}

// Based on https://stackoverflow.com/a/32038265
THREE.Object3D.prototype.rotateAroundWorldAxis = function() {

    // rotate object around axis in world space (the axis passes through point)
    // axis is assumed to be normalized
    // assumes object does not have a rotated parent

    var q = new THREE.Quaternion();

    return function rotateAroundWorldAxis( point, axis, angle ) {

        q.setFromAxisAngle( axis, angle );

        this.applyQuaternion( q );

        this.position.sub( point );
        this.position.applyQuaternion( q );
        this.position.add( point );

        return this;

    }

}();

// JSON map for plane selection camera positions and orientations
const planeCameraConfig = {
    "DEFAULT": { 
        geo: { posx: -1/6, posy: -1/30, posz: 1/24, dirx: 0, diry: 0, dirz: 1 },
        lunar: { posx: -1/96, posy: -1/96, posz: -1/96, dirx: 0, diry: 0, dirz: 1 }
    },
    "XY": { posx: 0, posy: 0, posz: 1, dirx: 0, diry: 1, dirz: 0 },
    "YZ": { posx: 1, posy: 0, posz: 0, dirx: 0, diry: 0, dirz: 1 },
    "ZX": { posx: 0, posy: 1, posz: 0, dirx: 1, diry: 0, dirz: 0 },
    "XY-": { posx: 0, posy: 0, posz: -1, dirx: 0, diry: 1, dirz: 0 },
    "YZ-": { posx: -1, posy: 0, posz: 0, dirx: 0, diry: 0, dirz: 1 },
    "ZX-": { posx: 0, posy: -1, posz: 0, dirx: 1, diry: 0, dirz: 0 }
};

// JSON map for plane selection 2D configuration variables
const planeVariableConfig = {
    "DEFAULT": { 
        plane: "DEFAULT", 
        xFactor: 1, yFactor: 1, zFactor: 1,
        xVariable: "x", yVariable: "y", zVariable: "z",
        vxVariable: "vx", vyVariable: "vy", vzVariable: "vz"
    },
    "XY": { 
        plane: "XY", 
        xFactor: 1, yFactor: 1, zFactor: 1,
        xVariable: "x", yVariable: "y", zVariable: "z",
        vxVariable: "vx", vyVariable: "vy", vzVariable: "vz"
    },
    "YZ": { 
        plane: "YZ", 
        xFactor: 1, yFactor: 1, zFactor: 1,
        xVariable: "y", yVariable: "z", zVariable: "x",
        vxVariable: "vy", vyVariable: "vz", vzVariable: "vx"
    },
    "ZX": { 
        plane: "ZX", 
        xFactor: 1, yFactor: 1, zFactor: 1,
        xVariable: "z", yVariable: "x", zVariable: "y",
        vxVariable: "vz", vyVariable: "vx", vzVariable: "vy"
    },
    "XY-": { 
        plane: "XY", 
        xFactor: -1, yFactor: 1, zFactor: 1,
        xVariable: "x", yVariable: "y", zVariable: "z",
        vxVariable: "vx", vyVariable: "vy", vzVariable: "vz"
    },
    "YZ-": { 
        plane: "YZ", 
        xFactor: -1, yFactor: 1, zFactor: 1,
        xVariable: "y", yVariable: "z", zVariable: "x",
        vxVariable: "vy", vyVariable: "vz", vzVariable: "vx"
    },
    "ZX-": { 
        plane: "ZX", 
        xFactor: -1, yFactor: 1, zFactor: 1,
        xVariable: "z", yVariable: "x", zVariable: "y",
        vxVariable: "vz", vyVariable: "vx", vzVariable: "vy"
    }
};

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

        this.stopCreationFlag = false;

        this.state = AnimationScene.SCENE_STATE_START;
    }


    stopCreation() {
        this.stopCreationFlag = true;
    }

    setCameraPosition(x, y, z) {
        // console.log(`Setting camera position to (${x}, ${y}, ${z}).`);

        this.camera.position.x = x;
        this.camera.position.y = y;
        this.camera.position.z = z;

        this.skyContainer.position.setFromMatrixPosition(this.camera.matrixWorld);
        this.camera.updateProjectionMatrix();
        if (this.cameraControls) { this.cameraControls.update(); cameraControlsCallback(); }
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
        computeSVGDimensions();
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
        // add Sky

        this.skyContainer = new THREE.Group();
        this.skyContainer.lookAt(0, Math.sin(PC.EARTH_AXIS_INCLINATION_RADS), Math.cos(PC.EARTH_AXIS_INCLINATION_RADS));

        // console.log("Creating Sky...");

        skyRadius = 200 * earthRadius;

        var skyGeometry = new THREE.SphereGeometry(skyRadius);

        var skyMaterial = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, map: this.skyTexture, opacity: 0.4 });
        skyMaterial.side = THREE.BackSide;
        var skyConstellationMaterial = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, map: this.skyConstellationTexture, opacity: 0.1 });
        skyConstellationMaterial.side = THREE.BackSide;

        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.sky.receiveShadow = false;
        this.sky.castShadow = false;
        this.sky.rotateX(Math.PI/2); // this is to get the orientation of the texture correct
        this.skyContainer.add(this.sky);

        this.skyConstellation = new THREE.Mesh(skyGeometry, skyConstellationMaterial);
        this.skyConstellation.receiveShadow = false;
        this.skyConstellation.castShadow = false;
        this.skyConstellation.rotateX(Math.PI/2); // this is to get the orientation of the texture correct
        this.skyContainer.add(this.skyConstellation);

        this.skyContainer.scale.set(-1, 1, 1);
        this.skyContainer.rotateZ(Math.PI);

        // console.log("Created Sky");
        
        this.motherContainer.add(this.skyContainer);

        render();
    }

    disposeSky() {
        if (this.skyContainer) {
            // Dispose of sky geometry
            if (this.sky && this.sky.geometry) {
                this.sky.geometry.dispose();
            }
            
            // Dispose of sky material
            if (this.sky && this.sky.material) {
                this.sky.material.dispose();
            }
            
            // Dispose of sky constellation geometry
            if (this.skyConstellation && this.skyConstellation.geometry) {
                this.skyConstellation.geometry.dispose();
            }
            
            // Dispose of sky constellation material
            if (this.skyConstellation && this.skyConstellation.material) {
                this.skyConstellation.material.dispose();
            }
            
            // Remove sky and sky constellation from skyContainer
            if (this.sky) {
                this.skyContainer.remove(this.sky);
            }
            if (this.skyConstellation) {
                this.skyContainer.remove(this.skyConstellation);
            }
            
            // Remove skyContainer from motherContainer
            if (this.motherContainer) {
                this.motherContainer.remove(this.skyContainer);
            }
            
            // Nullify references
            this.sky = null;
            this.skyConstellation = null;
            this.skyContainer = null;
        }
        
        // Dispose of textures
        if (this.skyTexture) {
            this.skyTexture.dispose();
            this.skyTexture = null;
        }
        if (this.skyConstellationTexture) {
            this.skyConstellationTexture.dispose();
            this.skyConstellationTexture = null;
        }
    }
    
    addEarth() {
        // add Earth

        this.earthContainer = new THREE.Group();
        this.earthContainer.lookAt(0, Math.sin(PC.EARTH_AXIS_INCLINATION_RADS), Math.cos(PC.EARTH_AXIS_INCLINATION_RADS));

        // console.log("Creating Earth...");
        // var earthColor = planetProperties["EARTH"]["color"];
        var earthGeometry = new THREE.SphereGeometry(earthRadius, 100, 100);
        var earthMaterial = new THREE.MeshPhongMaterial({
            // color: primaryBodyColor, 
            // specular: COL.BLACK,
            // shininess: 1,
            map: this.earthTexture,
            // bumpMap: this.earthBumpMapTexture,
            // bumpScale: 0.01,
            specularMap: this.earthSpecularTexture, // shininess on oceans
            specular: 0x101010,
            // side: THREE.DoubleSide
        });
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earth.receiveShadow = false;
        this.earth.castShadow = false;
        this.earth.rotateX(Math.PI/2); // this is to get the orientation of the texture correct
        this.earthContainer.add(this.earth);
        // console.log("Created Earth");

        // // add Earth glow

        // var earthGlowMaterial = THREEx.createAtmosphereMaterial();
        // earthGlowMaterial.uniforms.glowColor.value.set(0x00b3ff);
        // earthGlowMaterial.uniforms.coeficient.value = 0.8;
        // earthGlowMaterial.uniforms.power.value = 2.0;
        // this.earthGlow = new THREE.Mesh(earthGeometry, earthGlowMaterial);
        // this.earthGlow.scale.multiplyScalar(1.02);
        // this.earth.add(this.earthGlow);

        // add axes to Earth and Moon

        var earthPoleScale = 1.2;
        var earthNorthPolePoint = new THREE.Vector3(0, 0, +1 * earthRadius * earthPoleScale);
        var earthSouthPolePoint = new THREE.Vector3(0, 0, -1 * earthRadius * earthPoleScale);
        var earthAxisGeometry = new THREE.BufferGeometry();
        const vertices = [];
        vertices.push(earthNorthPolePoint.x, earthNorthPolePoint.y, earthNorthPolePoint.z);
        vertices.push(earthSouthPolePoint.x, earthSouthPolePoint.y, earthSouthPolePoint.z);
        earthAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        var earthAxisMaterial = new THREE.LineBasicMaterial({color: COL.EARTH_AXIS});
        this.earthAxis = new THREE.Line(earthAxisGeometry, earthAxisMaterial);
        this.earthAxis.visible = viewPolarAxes;

        var earthNorthPoleGeometry = new THREE.SphereGeometry(earthRadius/50, 100, 100);
        var earthNorthPoleMaterial = new THREE.MeshPhysicalMaterial({color: COL.BLACK, emissive: COL.NORTH_POLE, reflectivity: 0.0});
        this.earthNorthPoleSphere = new THREE.Mesh(earthNorthPoleGeometry, earthNorthPoleMaterial);
        this.earthNorthPoleSphere.castShadow = false;
        this.earthNorthPoleSphere.receiveShadow = false;
        this.earthNorthPoleSphere.position.set(0, 0, 0.985 * earthRadius);

        var earthSouthPoleGeometry = new THREE.SphereGeometry(earthRadius/50, 100, 100);
        var earthSouthPoleMaterial = new THREE.MeshPhysicalMaterial({color: COL.BLACK, emissive: COL.SOUTH_POLE, reflectivity: 0.0}); 
        this.earthSouthPoleSphere = new THREE.Mesh(earthSouthPoleGeometry, earthSouthPoleMaterial);
        this.earthSouthPoleSphere.castShadow = false;
        this.earthSouthPoleSphere.receiveShadow = false;
        this.earthSouthPoleSphere.position.set(0, 0, -0.985 * earthRadius);

        this.earthNorthPoleSphere.visible = viewPoles;
        this.earthSouthPoleSphere.visible = viewPoles;
        
        render();
    }
    
    disposeEarth() {
        if (this.earthContainer) {
            // Dispose of Earth geometry
            if (this.earth && this.earth.geometry) {
                this.earth.geometry.dispose();
            }
            
            // Dispose of Earth material
            if (this.earth && this.earth.material) {
                this.earth.material.dispose();
            }
            
            // Dispose of Earth axis geometry
            if (this.earthAxis && this.earthAxis.geometry) {
                this.earthAxis.geometry.dispose();
            }
            
            // Dispose of Earth axis material
            if (this.earthAxis && this.earthAxis.material) {
                this.earthAxis.material.dispose();
            }
            
            // Dispose of Earth North Pole geometry
            if (this.earthNorthPoleSphere && this.earthNorthPoleSphere.geometry) {
                this.earthNorthPoleSphere.geometry.dispose();
            }
            
            // Dispose of Earth North Pole material
            if (this.earthNorthPoleSphere && this.earthNorthPoleSphere.material) {
                this.earthNorthPoleSphere.material.dispose();
            }
            
            // Dispose of Earth South Pole geometry
            if (this.earthSouthPoleSphere && this.earthSouthPoleSphere.geometry) {
                this.earthSouthPoleSphere.geometry.dispose();
            }
            
            // Dispose of Earth South Pole material
            if (this.earthSouthPoleSphere && this.earthSouthPoleSphere.material) {
                this.earthSouthPoleSphere.material.dispose();
            }
            
            // Remove Earth and its components from earthContainer
            if (this.earth) {
                this.earthContainer.remove(this.earth);
            }
            if (this.earthAxis) {
                this.earthContainer.remove(this.earthAxis);
            }
            if (this.earthNorthPoleSphere) {
                this.earthContainer.remove(this.earthNorthPoleSphere);
            }
            if (this.earthSouthPoleSphere) {
                this.earthContainer.remove(this.earthSouthPoleSphere);
            }
            
            // Remove earthContainer from its parent (if it has one)
            if (this.earthContainer.parent) {
                this.earthContainer.parent.remove(this.earthContainer);
            }
            
            // Nullify references
            this.earth = null;
            this.earthAxis = null;
            this.earthNorthPoleSphere = null;
            this.earthSouthPoleSphere = null;
            this.earthContainer = null;
        }
        
        // Dispose of textures
        if (this.earthTexture) {
            this.earthTexture.dispose();
            this.earthTexture = null;
        }
        if (this.earthSpecularTexture) {
            this.earthSpecularTexture.dispose();
            this.earthSpecularTexture = null;
        }
    }

    addMoon() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            console.debug('Skipping moon creation - not a lunar mission');
            return;
        }
        // add Moon

        // var today = new Date();
        // var today = eventInfos[0]["startTime"];

        // var lp = lunar_pole(today);
        // var alpha = lp["alpha"];
        // var delta = lp["delta"];
        // var long = lp["long"];
        // var lat = lp["lat"];
        // var W = lp["W"];

        // console.log(`Lunar NP: (long, lat) = (${rad_to_deg(long)}, ${rad_to_deg(lat)}), W = ${rad_to_deg(W)}`);

        // var npx = moonRadius * Math.cos(lat) * Math.cos(long); 
        // var npy = moonRadius * Math.cos(lat) * Math.sin(long);
        // var npz = moonRadius * Math.sin(lat);

        // Stellarium rotation code for reference:
        // https://github.com/Stellarium/stellarium/blob/22218a4b3f9c17d10208278594ac9e83912c726c/src/core/modules/Planet.cpp
        // 
        // this.moonContainer.rotateZ(Math.PI / 2 + alpha);
        // this.moonContainer.rotateX(Math.PI / 2 - delta);
        // this.moonContainer.rotateX(-1 * PC.EARTH_AXIS_INCLINATION_RADS);
        // OR
        // this.moonContainer.rotateZ(Math.PI / 2 + long);
        // this.moonContainer.rotateX(Math.PI / 2 - lat);
        // OR
        // this.moonContainer.rotation.z = Math.PI / 2 + long
        // this.moonContainer.rotation.x = Math.PI / 2 - lat;
        // OR
        // this.moonContainer.lookAt(npx, npy, npz);
        
        var moonColor = planetProperties["MOON"]["color"];
        var moonGeometry = new THREE.SphereGeometry(moonRadius, 100, 100);
        var moonMaterial = new THREE.MeshStandardMaterial({
            map: this.moonMap,
            bumpMap: this.moonDisplacementMap,
            bumpScale: 0.003,  // Slightly adjusting for smoother surface details
            displacementMap: this.moonDisplacementMap,
            displacementScale: 0.008,  // Fine-tuning the displacement
            displacementBias: -0.004, // Fine-tuning the displacement
            roughness: 0.9,  // High roughness for a more matte finish
            metalness: 0.0,  // No metallic reflections
            emissive: 0x000000,  // No emissive light from the moon
            emissiveIntensity: 0.0,  // Ensure no self-illumination
        });
        
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        this.moon.receiveShadow = true;
        this.moon.castShadow = true;
        this.moon.rotateX(Math.PI/2);

        this.moonContainer = new THREE.Group();
        this.moonContainer.add(this.moon);
        this.addMoonSOI();

        this.rotateMoon();

        var moonPoleScale = 1.5;
        var moonNorthPolePoint = new THREE.Vector3(0, 0, +1 * moonRadius * moonPoleScale);
        var moonSouthPolePoint = new THREE.Vector3(0, 0, -1 * moonRadius * moonPoleScale);
        this.moonAxisVector = moonNorthPolePoint.clone().normalize();
        var moonAxisGeometry = new THREE.BufferGeometry();
        const vertices = [];
        vertices.push(moonNorthPolePoint.x, moonNorthPolePoint.y, moonNorthPolePoint.z);
        vertices.push(moonSouthPolePoint.x, moonSouthPolePoint.y, moonSouthPolePoint.z);
        moonAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        var moonAxisMaterial = new THREE.LineBasicMaterial({color: COL.MOON_AXIS});
        this.moonAxis = new THREE.Line(moonAxisGeometry, moonAxisMaterial);
        this.moonAxis.visible = viewPolarAxes;

        var moonNorthPoleGeometry = new THREE.SphereGeometry(moonRadius/50, 100, 100);
        var moonNorthPoleMaterial = new THREE.MeshPhysicalMaterial({color: COL.BLACK, emissive: COL.NORTH_POLE, reflectivity: 0.0});
        this.moonNorthPoleSphere = new THREE.Mesh(moonNorthPoleGeometry, moonNorthPoleMaterial);
        this.moonNorthPoleSphere.castShadow = false;
        this.moonNorthPoleSphere.receiveShadow = false;
        this.moonNorthPoleSphere.position.set(0, 0, 0.985 * moonRadius);

        var moonSouthPoleGeometry = new THREE.SphereGeometry(moonRadius/50, 100, 100);
        var moonSouthPoleMaterial = new THREE.MeshPhysicalMaterial({color: COL.BLACK, emissive: COL.SOUTH_POLE, reflectivity: 0.0});
        this.moonSouthPoleSphere = new THREE.Mesh(moonSouthPoleGeometry, moonSouthPoleMaterial);
        this.moonSouthPoleSphere.castShadow = false;
        this.moonSouthPoleSphere.receiveShadow = false;
        this.moonSouthPoleSphere.position.set(0, 0, -0.985 * moonRadius);

        this.moonNorthPoleSphere.visible = viewPoles;
        this.moonSouthPoleSphere.visible = viewPoles;

        render();
    }

    disposeMoon() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        if (this.moonContainer) {
            // Dispose of moon geometry
            if (this.moon && this.moon.geometry) {
                this.moon.geometry.dispose();
            }
            
            // Dispose of moon material
            if (this.moon && this.moon.material) {
                this.moon.material.dispose();
            }
            
            // Dispose of moon SOI geometry and material
            if (this.moonSOISphere) {
                if (this.moonSOISphere.geometry) {
                    this.moonSOISphere.geometry.dispose();
                }
                if (this.moonSOISphere.material) {
                    this.moonSOISphere.material.dispose();
                }
            }
            
            // Dispose of moon axis geometry and material
            if (this.moonAxis) {
                if (this.moonAxis.geometry) {
                    this.moonAxis.geometry.dispose();
                }
                if (this.moonAxis.material) {
                    this.moonAxis.material.dispose();
                }
            }
            
            // Dispose of moon pole spheres
            if (this.moonNorthPoleSphere) {
                if (this.moonNorthPoleSphere.geometry) {
                    this.moonNorthPoleSphere.geometry.dispose();
                }
                if (this.moonNorthPoleSphere.material) {
                    this.moonNorthPoleSphere.material.dispose();
                }
            }
            if (this.moonSouthPoleSphere) {
                if (this.moonSouthPoleSphere.geometry) {
                    this.moonSouthPoleSphere.geometry.dispose();
                }
                if (this.moonSouthPoleSphere.material) {
                    this.moonSouthPoleSphere.material.dispose();
                }
            }
            
            // Remove moon and its components from the scene
            this.moonContainer.remove(this.moon);
            this.moonContainer.remove(this.moonSOISphere);
            this.moonContainer.remove(this.moonAxis);
            this.moonContainer.remove(this.moonNorthPoleSphere);
            this.moonContainer.remove(this.moonSouthPoleSphere);
            
            // Remove moonContainer from its parent (if any)
            if (this.moonContainer.parent) {
                this.moonContainer.parent.remove(this.moonContainer);
            }
            
            // Nullify references
            this.moon = null;
            this.moonSOISphere = null;
            this.moonAxis = null;
            this.moonNorthPoleSphere = null;
            this.moonSouthPoleSphere = null;
            this.moonContainer = null;
        }
        
        // Dispose of textures
        if (this.moonTexture) {
            this.moonTexture.dispose();
            this.moonTexture = null;
        }
        if (this.moonDisplacementMap) {
            this.moonDisplacementMap.dispose();
            this.moonDisplacementMap = null;
        }
    }
    
    addMoonSOI() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }

        var radius = moonRadius * (PC.MOON_SOI_RADIUS_KM / PC.MOON_RADIUS_KM);
        var latSegments = 18;  // 10° increments
        var longSegments = 36; // 10° increments

        var geometry = new THREE.SphereGeometry(radius, longSegments, latSegments);
        var material = new THREE.MeshBasicMaterial({color: COL.MOON_SOI, wireframe: true});

        this.moonSOISphere = new THREE.Mesh(geometry, material);
        this.moon.add(this.moonSOISphere);
        this.moonSOISphere.visible = viewMoonSOI;
    }

    disposeMoonSOI() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }
        if (this.moonSOISphere) {
            this.moonSOISphere.geometry.dispose();
            this.moonSOISphere.material.dispose();
            this.moon.remove(this.moonSOISphere);
            this.moonSOISphere = null;
        }
    }

    addEarthLocations() {
        this.dwingeloo = this.plotEarthLocation(deg_to_rad(6.39616944444), deg_to_rad(52.8120194444), "#FF0000");
        this.chennai = this.plotEarthLocation(deg_to_rad(80.2707), deg_to_rad(13.0827), "#FF0000");

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
        // this.plotMoonLocation(deg_to_rad(0), deg_to_rad(0), "#FF00FF"); // TODO 2021 - for testing - (0deg longitude == Prime Meridian, 0deg latitude)

        // Some Moon locations for calibrsation
        //
        // Some of the values are from Wikipedia and some are from NASA:
        //
        // https://astrogeology.usgs.gov/search/map/Moon/Research/Craters/GoranSalamuniccar_MoonCraters
        //
        // this.plotMoonLocation(deg_to_rad(- 9.3),      deg_to_rad(+51.6), "#FF0000");      // Plato crater
        // this.plotMoonLocation(deg_to_rad(- 1.1),      deg_to_rad(+40.6), "#FF0000");      // Mons Piton
        // this.plotMoonLocation(deg_to_rad(+ 5.211),    deg_to_rad(+ 3.212), "#FF0000");    // Mosting A crater
        // this.plotMoonLocation(deg_to_rad(+22.1),      deg_to_rad(-70.1), "#FF0000");      // Manzinus C - https://en.wikipedia.org/wiki/Manzinus_(crater) 
        // this.plotMoonLocation(deg_to_rad(+21.753904), deg_to_rad(-69.996092), "#FF0000"); // Manzinus C - https://en.wikipedia.org/wiki/Manzinus_(crater) 
        // this.plotMoonLocation(deg_to_rad(+24.3),      deg_to_rad(-71.3), "#FF0000");      // Simpelius N - https://en.wikipedia.org/wiki/Simpelius_(crater) 
        // this.plotMoonLocation(deg_to_rad(24.103513),  deg_to_rad(-71.365233), "#FF0000"); // Simpelius N - https://en.wikipedia.org/wiki/Simpelius_(crater) 

        // Plot landing sites from config
        if (globalConfig && globalConfig.landingSites) {
            globalConfig.landingSites.forEach(site => {
                this.plotMoonLocation(
                    deg_to_rad(site.longitude), 
                    deg_to_rad(site.latitude), 
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

        var craftColor = planetProperties["SC"]["color"];
        var craftEdgeColor = 0xFF8000;
        // Based on https://stackoverflow.com/questions/49481332/how-to-create-3d-trapezoid-in-three-js 
        var craftGeometry = new THREE.CylinderGeometry(craftSize*0.8 / Math.sqrt(2), craftSize*1 / Math.sqrt(2), craftSize*0.8*1, 4, 1); 
        var craftMaterial = new THREE.MeshPhongMaterial({color: craftColor, transparent: false, opacity: 1.0});
        this.craftInner = new THREE.Mesh(craftGeometry, craftMaterial);
        var craftEdgesGeometry = new THREE.EdgesGeometry(craftGeometry);
        this.craftEdges = new THREE.LineSegments(craftEdgesGeometry, new THREE.LineBasicMaterial({color: craftEdgeColor}));
        this.craftInner.add(this.craftEdges);
        this.craftInner.rotateX(Math.PI/2); // this is to get the "top" of the craft pointing to Z
        this.craftInner.rotateY(Math.PI/4); // this is to get the orientation of the sides correct
        this.craftInner.layers.set(1);

        this.craft = new THREE.Group();
        this.craft.add(this.craftInner);
        this.craftAxesHelper = new THREE.AxesHelper(10);
        this.craftAxesHelper.position.copy(this.craftInner.position);
        this.craft.add(this.craftAxesHelper);
        this.craftAxesHelper.visible = false;
        this.craft.layers.set(1);
        this.craftVisible = true;
        this.craft.visible = this.craftVisible; 

        this.motherContainer.add(this.craft);

        var cubeGeometry = new THREE.BoxGeometry(craftSize, craftSize, craftSize);
        var cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        this.drone = new THREE.Mesh(cubeGeometry, cubeMaterial);
        this.drone.layers.set(1);
        this.drone.visible = false;
        this.motherContainer.add(this.drone);

    }

    disposeSpacecraft() {
        if (this.craft) {
            // Dispose of craft geometry
            if (this.craft.geometry) {
                this.craft.geometry.dispose();
            }
            
            // Dispose of craft material
            if (this.craft.material) {
                this.craft.material.dispose();
            }
            
            // Dispose of craft axes helper
            if (this.craftAxesHelper) {
                this.craftAxesHelper.dispose();
            }
            
            // Remove craft from motherContainer
            this.motherContainer.remove(this.craft);
            
            // Nullify references
            this.craft = null;
            this.craftAxesHelper = null;
        }

        if (this.drone) {
            // Dispose of drone geometry
            if (this.drone.geometry) {
                this.drone.geometry.dispose();
            }
            
            // Dispose of drone material
            if (this.drone.material) {
                this.drone.material.dispose();
            }
            
            // Remove drone from motherContainer
            this.motherContainer.remove(this.drone);
            
            // Nullify reference
            this.drone = null;
        }
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
        // add axes helper
        this.axesHelper = new THREE.AxesHelper(2*PIXELS_PER_AU*PC.EARTH_MOON_DISTANCE_MEAN_AU);
        this.motherContainer.add(this.axesHelper);
        this.axesHelper.visible = viewXYZAxes;

        const radius = earthRadius * 64;
        const sectors = 18;
        const rings = 6;
        const divisions = 64;

        this.eclipticPolarGridHelper = new THREE.PolarGridHelper(radius, sectors, rings, divisions, COL.ECLIPTIC_PLANE, COL.ECLIPTIC_PLANE);
        this.eclipticPolarGridHelper.rotation.x = Math.PI/2; 
        this.eclipticPolarGridHelper.visible = viewEclipticPlane;
        this.motherContainer.add(this.eclipticPolarGridHelper);
                
        const eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.eclipticPlaneHelper = new THREE.PlaneHelper(eclipticPlane, earthRadius * 128, COL.ECLIPTIC_PLANE);
        this.eclipticPlaneHelper.visible = viewEclipticPlane;
        this.motherContainer.add(this.eclipticPlaneHelper);

        this.equatorialPlaneContainer = new THREE.Group();
        this.equatorialPlaneContainer.lookAt(0, Math.sin(PC.EARTH_AXIS_INCLINATION_RADS), Math.cos(PC.EARTH_AXIS_INCLINATION_RADS));

        this.equatorialPolarGridHelper = new THREE.PolarGridHelper(radius, sectors, rings, divisions, COL.EQUATORIAL_PLANE, COL.EQUATORIAL_PLANE);
        this.equatorialPolarGridHelper.rotation.x = Math.PI/2;
        this.equatorialPolarGridHelper.visible = viewEquatorialPlane;
        this.equatorialPlaneContainer.add(this.equatorialPolarGridHelper);

        var direction = new THREE.Vector3();
        this.equatorialPlaneContainer.getWorldDirection(direction);
        const equatorialPlane = new THREE.Plane(direction, 0);        
        this.equatorialPlaneHelper = new THREE.PlaneHelper(equatorialPlane, earthRadius * 144, COL.EQUATORIAL_PLANE);
        this.equatorialPlaneHelper.visible = viewEquatorialPlane;
        this.equatorialPlaneContainer.add(this.equatorialPlaneHelper);

        this.motherContainer.add(this.equatorialPlaneContainer);
    }

    disposeAxesHelper() {
        if (this.axesHelper) {
            this.axesHelper.dispose();
            this.axesHelper = null;
        }

        if (this.eclipticPolarGridHelper) {
            this.eclipticPolarGridHelper.dispose();
            this.eclipticPolarGridHelper = null;    
        }

        if (this.eclipticPlaneHelper) {
            this.eclipticPlaneHelper.dispose();
            this.eclipticPlaneHelper = null;    
        }

        if (this.equatorialPlaneContainer) {    
            // THREE.Group doesn't have dispose(), just clear and remove
            this.equatorialPlaneContainer.clear();
            this.equatorialPlaneContainer = null;
        }

        if (this.equatorialPolarGridHelper) {
            this.equatorialPolarGridHelper.dispose();
            this.equatorialPolarGridHelper = null;    
        }       

        if (this.equatorialPlaneHelper) {
            this.equatorialPlaneHelper.dispose();
            this.equatorialPlaneHelper = null;    
        }
    }
    
    addLight() {
        // add light
        this.light = new THREE.DirectionalLight(LT.PRIMARY_COLOR, LT.PRIMARY_INTENSITY);
        this.motherContainer.add(this.light); // TODO attempt to fix lighting direction problem when piovoting on non-centered objects

        this.light2 = new THREE.DirectionalLight(LT.CRAFT_PRIMARY_COLOR, LT.CRAFT_PRIMARY_INTENSITY);
        this.light2.layers.set(1);
        this.motherContainer.add(this.light2);

        var ambientLight = new THREE.AmbientLight(LT.AMBIENT_COLOR, LT.AMBIENT_INTENSITY); // soft white light
        this.motherContainer.add(ambientLight);

        var ambientLightForCraft = new THREE.AmbientLight(LT.CRAFT_AMBIENT_COLOR, LT.CRAFT_AMBIENT_INTENSITY); // soft white light
        ambientLightForCraft.layers.set(1);
        this.motherContainer.add(ambientLightForCraft);

        this.scene.add(this.motherContainer);
    }

    disposeLight() {
        // In 2D mode, motherContainer doesn't exist
        if (!this.motherContainer) {
            return;
        }

        if (this.light) {
            this.motherContainer.remove(this.light);
            this.light.dispose();
            this.light = null;
        }

        if (this.light2) {
            this.motherContainer.remove(this.light2);
            this.light2.dispose();
            this.light2 = null;
        }

        // Remove ambient lights
        this.motherContainer.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                this.motherContainer.remove(child);
                child.dispose();
            }
        });

        // If the motherContainer was added to the scene, remove it
        if (this.scene) {
            this.scene.remove(this.motherContainer);
        }
    }

    addCamera() {
        // add camera
        var angle = 50.0;
        this.camera = new THREE.PerspectiveCamera(angle, this.width/this.height, 0.0001, 100000);
        // console.log(`defaultCameraDistance=${defaultCameraDistance}`);
        this.setCameraPosition(defaultCameraDistance, defaultCameraDistance, defaultCameraDistance);
        this.camera.up.set(0, 0, 1);

        this.craftCamera = new THREE.PerspectiveCamera(50, this.width/this.height, 0.0001, 100000);
        this.craft.add(this.craftCamera);
        this.craftCamera.up.set(0, 0, 1);

        this.droneCamera = new THREE.PerspectiveCamera(100, this.width/this.height, 0.0001, 100000);
        this.drone.add(this.droneCamera);

        // add camera controls
        if (this.cameraControlsEnabled) {
            this.cameraControls = new TrackballControls(this.camera, theSceneHandler.renderer.domElement, cameraControlsCallback);

            // TrackballControls settings
            this.cameraControls.rotateSpeed = 1.0;
            this.cameraControls.zoomSpeed = 1.0;
            this.cameraControls.panSpeed = 1.0;
            this.cameraControls.noZoom = false;
            this.cameraControls.noPan = false;
            this.cameraControls.staticMoving = true;
            this.cameraControls.dynamicDampingFactor = 0.3;
            this.cameraControls.keys = [65, 83, 68];
            this.cameraControls.addEventListener('change', render, {passive: true}); // TODO Verify   
        }

        this.setCameraParameters(null, true);
    }

    disposeCamera() {
        if (this.camera) {
            // Dispose of camera
            this.camera.remove(this.camera.children);
            this.camera = null;
        }

        if (this.craftCamera && this.craft) {
            // Dispose of craft camera
            this.craftCamera.remove(this.craftCamera.children);
            this.craft.remove(this.craftCamera);
            this.craftCamera = null;
        }

        if (this.droneCamera && this.drone) {
            // Dispose of drone camera
            this.droneCamera.remove(this.droneCamera.children);
            this.drone.remove(this.droneCamera);
            this.droneCamera = null;
        }

        if (this.cameraControls) {
            // Dispose of camera controls
            this.cameraControls.dispose();
            this.cameraControls = null;
        }
    }

    async addSpacecraftModel() {
        if (!globalConfig?.spacecraftModel?.enabled) {
            return;
        }
        
        const loader = new GLTFLoader();
        var animationScene = this;
        var done = false;

        const modelPath = window.missionConfig.modelPath + globalConfig.spacecraftModel.file;
        
        loader.load(modelPath, function (gltf) {

            // console.log("Loaded GLB.");

            animationScene.craft = new THREE.Group();

            animationScene.craftInner = gltf.scene;
            animationScene.craftInner.rotateX(Math.PI/2); // this is to get the "top" of the craft pointing to Z

            var bbox = new THREE.Box3().setFromObject(animationScene.craftInner);
            var bbox_xw = (bbox.max.x - bbox.min.x);
            var bbox_yw = (bbox.max.y - bbox.min.y);
            var bbox_zw = (bbox.max.z - bbox.min.z);
            var bbox_max_side = Math.max(bbox_xw, bbox_yw, bbox_zw);

            // var sphereGeometry = new THREE.SphereGeometry(bbox_max_side*0.5);
            // var sphereMaterial = new THREE.MeshStandardMaterial({metalness: 1.0, roughness: 0.0});
            // var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            // sphere.layers.set(1);
            // animationScene.craft.add(sphere);

            // console.log("model (xw, yw, zw) = " +  bbox_xw + ", " +  bbox_yw + ", " + bbox_zw);

            function setLayer(object, layer) {
                object.layers.set(layer);
                object.children.forEach(child => setLayer(child, layer));
            }
            setLayer(animationScene.craftInner, 1);

            animationScene.craft.add(animationScene.craftInner);
            animationScene.craftAxesHelper = new THREE.AxesHelper(10);
            animationScene.craftAxesHelper.position.copy(animationScene.craftInner.position);
            animationScene.craft.add(animationScene.craftAxesHelper);
            animationScene.craftAxesHelper.visible = true;
            animationScene.craft.layers.set(1);
            animationScene.craftVisible = true;
            animationScene.craft.visible = animationScene.craftVisible; 

            // Using PointLight below as they are NOT directional.
            // DirectionalLight has to be targeted, and that target direction seems to be absolute and not relative to the parent.
            // See https://stackoverflow.com/questions/45039999/three-js-light-from-camera-straight-to-object 

            var intensity = 2;
            var light1 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            var light2 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            var light3 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            var light4 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            var light5 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            var light6 = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            
            light1.layers.set(1);
            light2.layers.set(1);
            light3.layers.set(1);
            light4.layers.set(1);
            light5.layers.set(1);
            light6.layers.set(1);
            
            animationScene.craft.add(light1);
            animationScene.craft.add(light2);
            animationScene.craft.add(light3);
            animationScene.craft.add(light4);
            animationScene.craft.add(light5);
            animationScene.craft.add(light6);

            var scale = 0.6;
            light1.position.set(+1*scale*bbox_max_side, 0, 0);
            light2.position.set(0, +1*scale*bbox_max_side, 0);
            light3.position.set(0, 0, +1*scale*bbox_max_side);
            light4.position.set(-1*scale*bbox_max_side, 0, 0);
            light5.position.set(0, -1*scale*bbox_max_side, 0);
            light6.position.set(0, 0, -1*scale*bbox_max_side);

            animationScene.motherContainer.add(animationScene.craft);

            done = true;

        }, undefined, function (error) {
            console.error(error);        
        } );

        async function waitUntilDone() {
            // console.log("waitUntilDone(): done = " + done);
            while (!done) { 
                // console.log("Waiting in waitUntilDone() ..."); 
                await wait50(); 
            } 
        };

        await waitUntilDone();
    }

    disposeSpacecraftModel() {
        if (this.craft) {
            // Remove lights
            for (let i = this.craft.children.length - 1; i >= 0; i--) {
                const child = this.craft.children[i];
                if (child instanceof THREE.DirectionalLight) {
                    child.dispose();
                    this.craft.remove(child);
                }
            }

            // Dispose of geometry and material
            if (this.craft.geometry) {
                this.craft.geometry.dispose();
            }
            if (this.craft.material) {
                if (Array.isArray(this.craft.material)) {
                    this.craft.material.forEach(material => material.dispose());
                } else {
                    this.craft.material.dispose();
                }
            }

            // Remove from scene
            if (this.craft.parent) {
                this.craft.parent.remove(this.craft);
            }

            // Nullify reference
            this.craft = null;
        }

        if (this.craftAxesHelper) {
            this.craftAxesHelper.dispose();
            if (this.craftAxesHelper.parent) {
                this.craftAxesHelper.parent.remove(this.craftAxesHelper);
            }
            this.craftAxesHelper = null;
        }

        // Reset flags
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

        var distance = null;
        if (this.cameraControlsEnabled) {
            var cameraControls = this.cameraControls;
            var origin = new THREE.Vector3(0, 0, 0);
            distance = cameraControls.getPos().distanceTo(origin);
            // console.log("cameraDistance in setCameraParameters: " + distance);
        }

        if (moonPhaseCamera) {
            this.camera.fov = 1.0;
            this.setCameraPosition(0, 0, 0);
            this.camera.up.set(0, 0, 1);
            this.craftVisible = false;
        } else {
            this.camera.fov = 50.0;
            this.craftVisible = true;

            const preferredDistance = this.getPreferredDistance(config);
            if (planeSelection === "DEFAULT") {
                // For DEFAULT plane, always use the computed default positioning regardless of passed distance
                // This maintains the proper fractional positioning required for DEFAULT view

                this.setCameraPosition(preferredDistance.x, preferredDistance.y, preferredDistance.z);
                this.camera.up.set(0, 0, 1);
            } else {
                // For non-DEFAULT planes: at initialization use defaultCameraDistance, otherwise use provided distance
                const cameraDistance = isInitialization ? preferredDistance.length() : (distance !== null && distance > 0 ? distance : defaultCameraDistance);
                
                // Use planeCameraConfig for all non-DEFAULT plane selections
                const config3D = planeCameraConfig[planeSelection];
                if (config3D) {
                    this.setCameraPosition(config3D.posx * cameraDistance, config3D.posy * cameraDistance, config3D.posz * cameraDistance);
                    this.camera.up.set(config3D.dirx, config3D.diry, config3D.dirz);
                }
            }            
        }

        adjustCameraProjectionMatrixAndSkyAngle();
    }

    getPreferredDistance(config) {
        // Returns the preferred camera distance as a Vector3 for the given config
        if (config == "geo") {
            return new THREE.Vector3(
                -1*defaultCameraDistance/6, 
                -1*defaultCameraDistance/30, 
                defaultCameraDistance/24
            );
        } else {
            return new THREE.Vector3(
                -defaultCameraDistance/96, 
                -defaultCameraDistance/96, 
                -defaultCameraDistance/96
            );
        }
    }

    processOrbitVectorsData3D() {

        nOrbitPoints = 0;

        // Generate SC curve from Chebyshev data
        if (chebyshevDataLoaded[config] && chebyshevData[config]) {
            const stepMs = animationScenes[config].stepDurationInMilliSeconds;
            const vectors = generateCurveFromChebyshev(
                chebyshevData[config],
                startTime,
                latestEndTime,
                stepMs
            );

            for (const vec of vectors) {
                const x = (vec.x / PC.KM_PER_AU) * PIXELS_PER_AU;
                const y = (vec.y / PC.KM_PER_AU) * PIXELS_PER_AU;
                const z = (vec.z / PC.KM_PER_AU) * PIXELS_PER_AU;

                const vx = (vec.vx / PC.KM_PER_AU) * PIXELS_PER_AU;
                const vy = (vec.vy / PC.KM_PER_AU) * PIXELS_PER_AU;
                const vz = (vec.vz / PC.KM_PER_AU) * PIXELS_PER_AU;

                this.curve.push(new THREE.Vector3(x, y, z));
                this.curveVelocities.push(new THREE.Vector3(vx, vy, vz));

                ++nOrbitPoints;
            }
        }

        // console.log("nOrbitPoints = " + nOrbitPoints);
    }

    processLandingVectors() {
        // Check if landing is enabled in config
        const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;
        if (!isLandingEnabled || config != "lunar") return;

        nLandingPoints = 0;

        // Generate landing curve from Chebyshev data
        if (landingChebyshevLoaded && landingChebyshevData) {
            const stepMs = 1000; // Landing data uses 1-second resolution
            const vectors = generateCurveFromChebyshev(
                landingChebyshevData,
                startLandingTime,
                endLandingTime,
                stepMs
            );

            for (const vec of vectors) {
                const x = (vec.x / PC.KM_PER_AU) * PIXELS_PER_AU;
                const y = (vec.y / PC.KM_PER_AU) * PIXELS_PER_AU;
                const z = (vec.z / PC.KM_PER_AU) * PIXELS_PER_AU;

                const vx = (vec.vx / PC.KM_PER_AU) * PIXELS_PER_AU;
                const vy = (vec.vy / PC.KM_PER_AU) * PIXELS_PER_AU;
                const vz = (vec.vz / PC.KM_PER_AU) * PIXELS_PER_AU;

                this.landingCurve.push(new THREE.Vector3(x, y, z));
                this.landingCurveVelocities.push(new THREE.Vector3(vx, vy, vz));

                ++nLandingPoints;
            }
        }
    }

    toggleCameraPos(val) {
        // console.log("toggleCameraPos() called in mode " + this.name + " and target origin position " + val);

        if ((this.name == "geo") && (val == "EARTH")) { 
            // console.log("Setting camera position to Origin/Earth.");
            this.camera.position.set(0, 0, 0)
        };
        if ((this.name == "geo") && (val == "MOON")) { 
            // console.log("Setting camera position to Moon.");
            this.camera.position.set(this.secondaryBody3D.position);
        };
        if ((this.name == "lunar") && (val == "EARTH")) { 
            // console.log("Setting camera position to Earth.");
            this.camera.position.set(this.secondaryBody3D.position);
        };
        if ((this.name == "lunar") && (val == "MOON")) {
            // console.log("Setting camera position to Origin/Moon.");
            this.camera.position.set(0, 0, 0);
        };

        theSceneHandler.render(this);
    }

    toggleCameraLook(val) {
        // console.log("toggleCameraLook() called in mode " + this.name + " and target look position " + val);

        if (this.name == "geo") {

            if (val == "EARTH") { 
                // console.log("Setting camera look to Origin/Earth.");
                this.camera.lookAt(0, 0, 0);
                // this.camera.lookAt(this.secondaryBody3D.position);
            }
            if (val == "MOON") { 
                // console.log("Setting camera look to Moon.");
                this.camera.lookAt(this.secondaryBody3D.position);
            }
            if (val == "SC") {
                // console.log("Setting camera look to the craft.");
                this.camera.lookAt(this.craft.position);	
            }
        }

        if (this.name == "lunar") {

            if (val == "EARTH") { 
                // console.log("Setting camera look to Earth.");
                this.camera.lookAt(this.secondaryBody3D.position);
            }
            if (val == "MOON") {
                // console.log("Setting camera look to Origin/Moon.");
                this.camera.lookAt(0, 0, 0);
            }
            if (val == "SC") {
                // console.log("Setting camera look to the craft.");
                this.camera.lookAt(this.craft.position);
            }
        }
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
        var x = radiusScale * earthRadius * Math.cos(lat) * Math.cos(long); 
        var y = radiusScale * earthRadius * Math.cos(lat) * Math.sin(long);
        var z = radiusScale * earthRadius * Math.sin(lat);
        sphere.position.set(x, y, z);
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
        var x = radiusScale * moonRadius * Math.cos(lat) * Math.cos(long); 
        var y = radiusScale * moonRadius * Math.cos(lat) * Math.sin(long);
        var z = radiusScale * moonRadius * Math.sin(lat);
        sphere.position.set(x, y, z);
        this.locations.push(sphere);
        this.moonContainer.add(sphere);
        return sphere;
    }

    rotateMoon() {
        // Check if this is a lunar mission
        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }

        var today = new Date(animTime);
        var lp = lunar_pole(today);
        var alpha = lp["alpha"];
        var delta = lp["delta"];
        var W = lp["W"];
        
        this.moonContainer.rotation.set(0, 0, 0);
        this.moonContainer.rotateX(-1 * PC.EARTH_AXIS_INCLINATION_RADS);
        this.moonContainer.rotateZ(+1 * (Math.PI / 2 + alpha));
        this.moonContainer.rotateX(+1 * (Math.PI / 2 - delta));
        this.moonContainer.rotateZ(+1 * W);

        // console.log(`rotateMoon: (long, lat) = (${rad_to_deg(long)}, ${rad_to_deg(lat)}), W = ${rad_to_deg(W)}`);
    }

    rotateEarth() {
        var mst = deg_to_rad(getMST(new Date(animTime), PC.GREENWICH_LONGITUDE));
        this.earthContainer.rotation.z = mst;
        // this.losLine.geometry.verticesNeedUpdate = true;
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

function handleModeSwitch3(center, newMode, otherModes) {

    d3.select("#mode-" + newMode).attr("style", "color: blue; font-weight: bold");
    d3.select("#mode-" + newMode).attr("disabled", null);
    d3.selectAll("." + newMode).style("visibility", "visible");
    d3.selectAll("." + newMode).attr("display", "block");

    for (var i = 0; i < otherModes.length; ++i) {

        var otherMode = otherModes[i];

        d3.select("#mode-" + otherMode).attr("style", null);
        d3.select("#mode-" + otherMode).attr("disabled", "disabled");
        d3.selectAll("." + otherMode).style("visibility", "hidden");
        d3.selectAll("." + otherMode).attr("display", "none");
    }

    d3.select("#center").text(center);
}

function handleModeSwitchToGeo() {
    handleModeSwitch3("Earth", "geo", ["lunar"]);
}

function handleModeSwitchToLunar() {
    handleModeSwitch3("Moon", "lunar", ["geo"]);
}


function handleModeSwitch(mode) {
    if (mode == "geo") {
        handleModeSwitchToGeo();
    } else if (mode == "lunar") {
        handleModeSwitchToLunar();
    }
}

function handleDimensionSwitch(newDim) {

    var oldDim = (newDim === "3D") ? "2D" : "3D";

    // console.log("handleDimensionSwitch() called: oldDim = " + oldDim + "+ newDim = " + newDim);

    d3.selectAll(".dimension-" + newDim).style("visibility", "visible");
    d3.selectAll(".dimension-" + newDim).attr("display", "block");
    d3.selectAll(".dimension-" + oldDim).style("visibility", "hidden");
    d3.selectAll(".dimension-" + oldDim).attr("display", "none");

    // if (newDim == "3D") {
    //     $("#svg-wrapper").css("display", "none");
    //     theSceneHandler.renderer.domElement.style.display = "block";
    // } else {
    //     $("#svg-wrapper").css("display", "block");
    //     theSceneHandler.renderer.domElement.style.display = "none";
    // }
}

function addEvents() {
    if (!globalConfig || !globalConfig.events || !globalConfig.eventConfigs) {
        console.warn('Events configuration not loaded, using default events');
        return;
    }

    const events = globalConfig.events;
    const eventConfigs = globalConfig.eventConfigs;
    
    eventInfos = [];
    
    const configEvents = eventConfigs[config] || [];
    
    for (const eventKey of configEvents) {
        const eventData = events[eventKey];
        if (!eventData) {
            console.warn(`Event ${eventKey} not found in configuration`);
            continue;
        }
        
        let startTime;
        if (eventData.startTime === "dynamic") {
            if (eventKey === "now") {
                startTime = new Date();
            } else if (eventKey.endsWith("DataEnd")) {
                const spacecraftMnemonic = globalConfig?.spacecraft_mnemonic || "SC";
                startTime = new Date(getStartAndEndTimes(spacecraftMnemonic)[1]);
            } else {
                console.warn(`Dynamic start time not handled for event ${eventKey}`);
                continue;
            }
        } else {
            startTime = new Date(eventData.startTime);
        }
        
        const eventInfo = {
            startTime: startTime,
            durationSeconds: eventData.durationSeconds,
            label: eventData.label,
            burnFlag: eventData.burnFlag,
            infoText: eventData.infoText,
            body: eventData.body
        };
        
        eventInfos.push(eventInfo);
    }
    
    eventInfos.sort(function(a, b) {
        return a.startTime - b.startTime;
    });
}

async function initConfig() {

    // console.log("initConfig() called");

    if (animationScenes[config] && animationScenes[config].state >= AnimationScene.SCENE_STATE_INIT_CONFIG_DONE) {
        // console.log("initConfig() returning as already initialized");
        if (config == "geo") {
            handleModeSwitchToGeo();
        } else if (config == "lunar") {
            handleModeSwitchToLunar();
        }

        d3.select("#checkbox-lock-moon").property("checked", animationScenes[config].lockOnMoon);
        d3.select("#checkbox-lock-earth").property("checked", animationScenes[config].lockOnEarth);   
        d3.select("#checkbox-lock-sc").property("checked", animationScenes[config].lockOnSC);

        d3.select("#checkbox-lock-xy").property("checked", animationScenes[config].lockOnXY);
        d3.select("#checkbox-lock-zx").property("checked", animationScenes[config].lockOnZX);
        d3.select("#checkbox-lock-yz").property("checked", animationScenes[config].lockOnYZ);
        d3.select("#checkbox-lock-xy-minus").property("checked", animationScenes[config].lockOnXYMinus);
        d3.select("#checkbox-lock-zx-minus").property("checked", animationScenes[config].lockOnZXMinus);
        d3.select("#checkbox-lock-yz-minus").property("checked", animationScenes[config].lockOnYZMinus);

        return;
    }

    // Load external configuration
    const configData = await loadConfig();
    
    // Update landing times from config if available
    updateLandingTimesFromConfig();
    
    // Update landing UI visibility from config
    updateLandingUIFromConfig();

    addEvents();

    // Get TLI and LOI times from config (only for lunar missions)
    if (globalConfig.is_lunar && globalConfig.events.tli) {
        timeTransLunarInjection = new Date(globalConfig.events.tli.startTime).getTime();
    }
    if (globalConfig.is_lunar && globalConfig.events.loi) {
        timeLunarOrbitInsertion = new Date(globalConfig.events.loi.startTime).getTime();
    }

    if (!theSceneHandler) {
        theSceneHandler = new SceneHandler();
    }    

    if (config == "geo") {

        if (!animationScenes[config]) {
            // console.log("Creating new AnimationScene for " + config);
            animationScenes[config] = new AnimationScene(config);    
        }

        computeSVGDimensions();
    
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
            animationScenes[config].orbitsJson = `${window.missionConfig.dataPath}${cfg.orbits_file}.json`;
            animationScenes[config].orbitsCheb = `${window.missionConfig.dataPath}${cfg.orbits_file}-cheb.json`;
        }
        animationScenes[config].orbitsJsonFileSizeInBytes = 34793 * 1024; // TODO
        animationScenes[config].stepsPerHop = 4;

        startTime                  = getStartAndEndTimes("EARTH")[0];
        endTime                    = getStartAndEndTimes("EARTH")[1];
        endTimeSC                 = getStartAndEndTimes(spacecraftMnemonic)[1];

        latestEndTime = endTime;
        timelineTotalSteps = (latestEndTime - startTime) / animationScenes[config].stepDurationInMilliSeconds;
        ticksPerAnimationStep = 1;

        epochJD = "N/A";
        epochDate = "N/A";

        // timelineIndex = 0; // Don't reset in case we are switching between modes

        handleModeSwitchToGeo();

    } else if (config == "lunar") {

        if (!animationScenes[config]) {
            // console.log("Creating new AnimationScene for " + config);
            animationScenes[config] = new AnimationScene(config);    
        }

        computeSVGDimensions();
    
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
            animationScenes[config].orbitsJson = `${window.missionConfig.dataPath}${cfg.orbits_file}.json`;
            animationScenes[config].orbitsCheb = `${window.missionConfig.dataPath}${cfg.orbits_file}-cheb.json`;
        }

        animationScenes[config].orbitsJsonFileSizeInBytes = 34800 * 1024; // TODO
        animationScenes[config].stepsPerHop = 4;

        startTime                  = getStartAndEndTimes("EARTH")[0];
        endTime                    = getStartAndEndTimes("EARTH")[1];
        endTimeSC                 = getStartAndEndTimes(spacecraftMnemonic)[1];

        latestEndTime = endTime;
        timelineTotalSteps = (latestEndTime - startTime) / animationScenes[config].stepDurationInMilliSeconds;
        ticksPerAnimationStep = 1;

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

        $("#burn" + (i+1)).on("click", function() { burnButtonHandler(i); });
    }

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

function toggleMode() {

    var val = $('input[name=mode]:checked').val();
    // console.log("toggleMode() called with value " + val + ", currentDimension = " + currentDimension);


    if (config != val) {

        if (animationScenes[config]) {
            // console.log("animationScenes[config].state = " + animationScenes[config].state);
            if (animationScenes[config].state != AnimationScene.SCENE_STATE_ADD_CURVE_DONE) {
                animationScenes[config].stopCreation();
                // console.log("Disposing of AnimationScene for " + config + ", as it's not fully initialized.");
                animationScenes[config].dispose();
                delete animationScenes[config];
            } else {
                // console.log("Not disposing of AnimationScene for " + config + ", as it's fully initialized: state = " + animationScenes[config].state);
            }
        }

        config = val;
        // orbitDataProcessed[config] = false;
        initAnimation({'reset': false});
    }
}

function onWindowResize() {
    render(); // TODO is this the right thing to do here?
}

function setDimensionTop() {
    setDimension(false);
}

function setDimension(init_flag = false) {
    var val = $('input[name=dimension]:checked').val();
    // console.log(`setDimension() called with value ${val}`);
    currentDimension = val;

    if (currentDimension != previousDimension) {
        dimensionChanged = true;
    }

    if (val == "3D") {
        // Clean up SVG when switching to 3D mode
        d3.select("svg").remove();
        svgContainer = null;

        if (!animationScenes[config].initialized3D) {

            // console.log("Initializing 3D for " + config);
            var msg = "Loading 3D data. This may take a while. Please wait ..."
            // d3.select("#eventinfo").text(msg);
            $("#progressbar").progressbar();
            $("#progressbar").progressbar("option", "value", false);
            $("#progressbar").show();
            updateProgressLabel(msg);

            animationScenes[config].processOrbitVectorsData3D();
            animationScenes[config].processLandingVectors();
            
            animationScenes[config].init3d(function() {

                // console.log("init3d() callback called");
                // d3.select("#eventinfo").text("");
                $("#progressbar").hide();
                handleDimensionSwitch(val);
                handlePlaneChange(dimensionChanged, init_flag);
                setLocation();
                if (startLandingFlag) { startLandingFlag = false; toggleLanding(); }
            });

        } else {

            handleDimensionSwitch(val);
            handlePlaneChange(dimensionChanged, init_flag);
            setLocation();
            if (startLandingFlag) { startLandingFlag = false; toggleLanding(); }
        }
    } else {
        
        initSVG();
        loadOrbitDataIfNeededAndProcess(function() {
            if (currentDimension !== "2D") {
                return;
            }
            handleDimensionSwitch(val);
            handlePlaneChange(dimensionChanged, init_flag);
            setLocation();
            adjustLabelLocations();
            if (startLandingFlag) { startLandingFlag = false; toggleLanding(); }
        });
    }

    dimensionChanged = false;
    previousDimension = currentDimension;
}

function showPlanet(planet) {
    return true;
}

function shouldDrawOrbit(planet) {
    return ((planet == "MARS") ||
            (planet == "SC") ||
            (planet == "MOON") ||
            (planet == "EARTH") || 
 
            (((config == "lunar") || (config == "helio")) && (planet == "CSS")));
}

function planetStartTime(planet) {
    var times = getStartAndEndTimes(planet);
    return times[0];
}

function isLocationAvaialable(planet, date) {
    var flag = false;
    if (planet === "SC" && chebyshevDataLoaded[config] && chebyshevData[config]?.time_range) {
        const jd = new Date(date).getJD_TDB();
        const range = chebyshevData[config].time_range;
        flag = (jd >= range.start) && (jd <= range.end);
    } else {
        flag = ((date >= startTime) && (date <= endTimeSC));
    }
    // var d = new Date(date);
    // console.log("isLocationAvaialable() called for body " + planet + " for time " + d + ": returning " + flag);
    return flag;
}

function rotate(x, y, phi) { // unused function for now

    var phi = phi / PC.DEGREES_PER_RADIAN;
    var retx;
    var rety;

    retx = x * cos(phi) - y * sin(phi);
    rety = y * cos(phi) + x * sin(phi);
    return {"x": retx, "y": rety};
}

function setLabelLocation(planetKey) {

    var planetProps = planetProperties[planetKey];

    if (isLocationAvaialable(planetKey, animTime)) {

        // var index = timelineIndex - planetProperties[planetKey]["offset"];

        var [planet_pos, planet_vel] = getBodyLocation(planetKey, animTime);
        if (!planet_pos) {
            // Data not available, hide the label
            d3.select("#label-" + planetKey).attr("visibility", "hidden");
            return;
        }
        var x = xFactor * planet_pos[xVariable];
        var y = yFactor * planet_pos[yVariable];

        var newx = +1 * (x / PC.KM_PER_AU) * PIXELS_PER_AU;
        var newy = -1 * (y / PC.KM_PER_AU) * PIXELS_PER_AU;

        var labelx = newx + planetProps.labelOffsetX/zoomFactor;
        var labely = newy + planetProps.labelOffsetY/zoomFactor;

        d3.select("#label-" + planetKey)
            .attr("visibility", showPlanet(planetKey) ? "visible" : "hidden")
            .attr("x", labelx)
            .attr("y", labely)
            .attr("font-size", 10/zoomFactor);

    } else {
        d3.select("#label-" + planetKey)
            .attr("visibility", "hidden");
    }
}

function getBodyLocation(craftid, t) {
    // console.log("getBodyLocation(" + craftId + ", " + t + ")");

    // Check if landing is enabled before using landing time range
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;

    // For SC (spacecraft), use Chebyshev data
    if (craftid === "SC") {
        // Landing phase - use landing Chebyshev
        if ((config == "lunar") && isLandingEnabled && (t >= startLandingTime) && (t < endLandingTime - TC.ONE_SECOND_MS)) {
            if (landingChebyshevLoaded && landingChebyshevData) {
                const jd = new Date(t).getJD_TDB();
                const state = getStateFromChebyshev(landingChebyshevData, jd);
                if (state) {
                    return [
                        new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z),
                        new THREE.Vector3(state.vel.vx, state.vel.vy, state.vel.vz)
                    ];
                }
            }
            console.debug(`Landing Chebyshev data not available for time ${t}`);
            return [null, null];
        }

        // Regular orbital phase - use Chebyshev
        if (chebyshevDataLoaded[config] && chebyshevData[config]) {
            const jd = new Date(t).getJD_TDB();
            const state = getStateFromChebyshev(chebyshevData[config], jd);
            if (state) {
                return [
                    new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z),
                    new THREE.Vector3(state.vel.vx, state.vel.vy, state.vel.vz)
                ];
            }
        }
        console.debug(`Chebyshev data not available for SC at time ${t}`);
        return [null, null];
    }

    // Use Astronomy Engine for Moon and Earth positions
    if (craftid === "MOON" && config === "geo") {
        const state = getMoonState(t);
        return [
            new THREE.Vector3(state.x, state.y, state.z),
            new THREE.Vector3(state.vx, state.vy, state.vz)
        ];
    }

    if (craftid === "EARTH" && config === "lunar") {
        const state = getEarthFromMoonState(t);
        return [
            new THREE.Vector3(state.x, state.y, state.z),
            new THREE.Vector3(state.vx, state.vy, state.vz)
        ];
    }

    // Unknown body
    console.error(`Unknown body: ${craftid} in config ${config}`);
    return [null, null];
}

function setLocation() {

    if (!orbitDataProcessed[config]) {
        return;
    }

    // console.log("setLocation(): timelineIndex = " + timelineIndex + ", timelineTotalSteps = " + timelineTotalSteps);

    // animTime = startTime + timelineIndex * animationScenes[config].stepDurationInMilliSeconds;
    var animTimeDate = new Date(animTime);
    // console.log("animTimeDate = " + animTimeDate);
    animDate.html(animTimeDate); // TODO add custom formatting 

    var ephemYear = animTimeDate.getUTCFullYear();
    var ephemMonth = animTimeDate.getUTCMonth() + 1;
    var ephemDay = animTimeDate.getUTCDate();
    var ephemHours = animTimeDate.getUTCHours();
    var ephemMinutes = animTimeDate.getUTCMinutes();
    var ephemSeconds = animTimeDate.getUTCSeconds();
    var ephemDate = {'year': ephemYear, 'month': ephemMonth, 'day': ephemDay, 'hours': ephemHours, 'minutes': ephemMinutes, 'seconds': ephemSeconds};
    // console.log(ephemDate);
    $const.tlong = 0.0; // longitude
    $const.glat = 0.0; // latitude
    $processor.init(); // TODO not sure whether this needs to be called every time or just once
    var ephemSun = $moshier.body.sun;
    $processor.calc(ephemDate, ephemSun);
    // console.log(ephemSun.position);
    sunLongitude = degreesToRadians(ephemSun.position.apparentLongitude);
    // console.log("Sun longitude: " + sunLongitude * 180.0 / Math.PI);

    // var ephemMoon = $moshier.body.moon;
    // $processor.calc(ephemDate, ephemMoon);
    // console.log(ephemMoon.position);

    if (animationScenes[config] && animationScenes[config].initialized3D) {

        var animationScene = animationScenes[config];
        animationScene.light.position.set(Math.cos(sunLongitude), Math.sin(sunLongitude), 0).normalize();
        animationScene.light2.position.set(Math.cos(sunLongitude), Math.sin(sunLongitude), 0).normalize();
        animationScene.rotateEarth();
        animationScene.rotateMoon();

        adjustCameraProjectionMatrixAndSkyAngle();
    }
    
    // console.log("animTime = " + animTime);
    // console.log("helioCentricPhaseStartTime = " + helioCentricPhaseStartTime);
    // console.log("lunarPhaseStartTime = " + lunarPhaseStartTime);

    // Only show phase information for lunar missions
    if (globalConfig && globalConfig.is_lunar) {
        // These phase elements exist in HTML, not SVG, so they're safe to update
        d3.select("#phase-1").html("Earth Bound Phase");
        d3.select("#phase-2").html("Lunar Bound Phase");
        d3.select("#phase-3").html("Lunar Orbit Phase");
        
        if (animTime < timeTransLunarInjection) {
            d3.select("#phase-1").html("<b><u>Earth Bound Phase</u></b>");
        } else if (animTime < timeLunarOrbitInsertion) {
            d3.select("#phase-2").html("<b><u>Lunar Bound Phase</u></b>");
        } else {
            d3.select("#phase-3").html("<b><u>Lunar Orbit Phase</u></b>");
        }
    }

    for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {


        var planetKey = animationScenes[config].planetsForLocations[i];
        var planetProps = planetProperties[planetKey];

        if (isLocationAvaialable(planetKey, animTime)) {

            var [craft_pos, craft_vel] = getBodyLocation(planetKey, animTime);
            if (!craft_pos) {
                // Data not available for this time, skip this planet
                continue;
            }
            var [realx, realy, realz] = [craft_pos.x, craft_pos.y, craft_pos.z];
            // console.log("realx = " + realx + ", realy = " + realy + ", realz = " + realz);
            var craft_pos_next = null;
            var craft_vel_next = null;
            if (isLocationAvaialable(planetKey, animTime + TC.ONE_MINUTE_MS)) {
                [craft_pos_next, craft_vel_next] = getBodyLocation(planetKey, animTime + TC.ONE_MINUTE_MS);
            }
            if (!craft_pos_next) {
                // Use current position for next if not available
                craft_pos_next = craft_pos;
                craft_vel_next = craft_vel;
            }
            var [realx_next, realy_next, realz_next] = [craft_pos_next.x, craft_pos_next.y, craft_pos_next.z]; 

            var realx_screen = +1 * (realx / PC.KM_PER_AU) * PIXELS_PER_AU;
            var realy_screen = +1 * (realy / PC.KM_PER_AU) * PIXELS_PER_AU; // note the sign; it's +1
            var realz_screen = +1 * (realz / PC.KM_PER_AU) * PIXELS_PER_AU;

            var realx_screen_next = +1 * (realx_next / PC.KM_PER_AU) * PIXELS_PER_AU;
            var realy_screen_next = +1 * (realy_next / PC.KM_PER_AU) * PIXELS_PER_AU; // note the sign; it's +1
            var realz_screen_next = +1 * (realz_next / PC.KM_PER_AU) * PIXELS_PER_AU;

            // Only calculate 2D SVG coordinates and update DOM in 2D mode
            var newx, newy, newz, x, y, z, vx, vy, vz;
            if (currentDimension == "2D") {
                [x, y, z] = [xFactor*craft_pos[xVariable], yFactor*craft_pos[yVariable], zFactor*craft_pos[zVariable]];
                [vx, vy, vz] = [xFactor*craft_vel[xVariable], yFactor*craft_vel[yVariable], zFactor*craft_vel[zVariable]];

                newx = +1 * (x / PC.KM_PER_AU) * PIXELS_PER_AU;
                newy = -1 * (y / PC.KM_PER_AU) * PIXELS_PER_AU;
                newz = +1 * (z / PC.KM_PER_AU) * PIXELS_PER_AU;

                d3.select("#" + planetKey)
                    .attr("visibility", showPlanet(planetKey) ? "visible" : "hidden")
                    .attr("cx", newx)
                    .attr("cy", newy);
            }

            if (planetKey == animationScenes[config].secondaryBody) {
                if (animationScenes[config] && animationScenes[config].initialized3D) {
                    animationScenes[config].secondaryBody3D.position.set(realx_screen, realy_screen, realz_screen);
                }                
            } else if (planetKey == craftId) {
                if (animationScenes[config] && animationScenes[config].initialized3D) {
                    
                    animationScenes[config].craft.position.set(realx_screen, realy_screen, realz_screen);
                    
                    var droneScale = 1.05;
                    var [deltax, deltay, deltaz] = [realx_screen_next - realx_screen, realy_screen_next - realy_screen, realz_screen_next - realz_screen];
                    animationScenes[config].drone.position.set(
                        droneScale*(realx_screen-deltax), 
                        droneScale*(realy_screen-deltay), 
                        droneScale*(realz_screen-deltaz));
                    // console.log("drone position 1 = ", animationScenes[config].drone.position);

                    animationScenes[config].craft.lookAt(realx_screen_next, realy_screen_next, realz_screen_next);
                    animationScenes[config].drone.lookAt(realx_screen, realy_screen, realz_screen);
                    animationScenes[config].craft.up.set(0, 0, 1);
                    // animationScenes[config].drone.up.set(0, 0, 1);
                    updateCraftScale();
                }                                
            }

            if (planetKey == "SC") {
                
                // Only update 2D-specific craftData in 2D mode
                if (currentDimension == "2D") {
                    craftData["x"] = newx;
                    craftData["y"] = newy;
                    craftData["z"] = newz;
                }
                
                var r = craft_pos.length();

                var pbr;
                if (config == "geo") {
                    pbr = PC.EARTH_RADIUS_KM; 
                } else if (config == "lunar") {
                    pbr = PC.MOON_RADIUS_KM;
                }

                var altitude = r - pbr;
                d3.select("#distance-" + planetKey + "-" + animationScenes[config].primaryBody).text(FORMAT_METRIC(r));
                d3.select("#altitude-" + planetKey + "-" + animationScenes[config].primaryBody).text(FORMAT_METRIC(altitude));

                var v = craft_vel.length();
                d3.select("#velocity-" + planetKey + "-" + animationScenes[config].primaryBody).text(FORMAT_METRIC(v));

                if (config == "geo" && globalConfig.is_lunar) {
                    // relative to Moon (only for lunar missions)

                    var [moon_pos, moon_vel] = getBodyLocation("MOON", animTime);
                    if (moon_pos) {
                        var dr = moon_pos.distanceTo(craft_pos);
                        var dv = moon_vel.distanceTo(craft_vel);

                        var altitudeMoon = dr - PC.MOON_RADIUS_KM;
                        d3.select("#distance-" + planetKey +"-MOON").text(FORMAT_METRIC(dr));
                        d3.select("#altitude-" + planetKey +"-MOON").text(FORMAT_METRIC(altitudeMoon));
                        d3.select("#velocity-" + planetKey +"-MOON").text(FORMAT_METRIC(dv));
                    }
                }

                if (config == "lunar") {
                    // relative to Earth

                    var [earth_pos, earth_vel] = getBodyLocation("EARTH", animTime);
                    if (!earth_pos) continue;
                    var dr = earth_pos.distanceTo(craft_pos);
                    var dv = earth_vel.distanceTo(craft_vel);

                    var altitudeEarth = dr - PC.EARTH_RADIUS_KM;
                    d3.select("#distance-" + planetKey +"-EARTH").text(FORMAT_METRIC(dr));
                    d3.select("#altitude-" + planetKey +"-EARTH").text(FORMAT_METRIC(altitudeEarth));
                    d3.select("#velocity-" + planetKey +"-EARTH").text(FORMAT_METRIC(dv));
                }

                if (currentDimension === "2D") {
                    // show burn
                    craftData["angle"] = velocityToAngle(vx, vy);
                    var transformString = "translate (" + newx + ", " + newy + ") ";
                    transformString += "rotate(" + craftData["angle"] + " 0 0) ";
                    transformString += "scale (" + 1/zoomFactor + " " + 1/zoomFactor + ") ";
                    d3.select("#burng").attr("transform", transformString);
                }
            }

        } else {

            // if (animationScenes[config].initialized3D) {
            //     animationScenes[config].craft.visible = false;    
            // }            

            d3.select("#" + planetKey)
                .attr("visibility", "hidden");

            d3.select("#distance-" + planetKey).text("");
            d3.select("#velocity-" + planetKey).text("");
            d3.select("#distance-" + planetKey + "-Earth").text("");
            d3.select("#velocity-" + planetKey + "-Earth").text("");
            d3.select("#distance-" + planetKey + "-Moon").text("");
            d3.select("#velocity-" + planetKey + "-Moon").text("");
        }
    }

    // Only run 2D-specific functions in 2D mode
    if (currentDimension == "2D") {
        for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {

            var planetKey = animationScenes[config].planetsForLocations[i];
            setLabelLocation(planetKey);
        }

        zoomChangeTransform(0);
        showGreenwichLongitude();
    }

    for (var i = 0; i < eventInfos.length; ++i) {
        // var burnTime = new Date(eventInfos[i]["startTime"].getTime() + (eventInfos[i]["durationSeconds"] * 1000 / 2));
        var burnTime = new Date(eventInfos[i]["startTime"].getTime());
        var burnFlag = eventInfos[i]["burnFlag"];
        if (!burnFlag) {
            continue;
        }
        var difftime = Math.abs(animTimeDate.getTime() - burnTime.getTime());
        if (difftime < 1 * 20 * 60 * 1000) {


            if (eventInfos[i]["body"] === "SC") {
                d3.select("#burng").style("visibility", "visible");
                updateEventInfo(eventInfos[i]["infoText"]);
                break;                
                updateEventInfo(eventInfos[i]["infoText"]);
                break;
            }
        } else {
            d3.select("#burng").style("visibility", "hidden");
            clearEventInfo();
        }
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

function showGreenwichLongitude() {
    if (currentDimension != "2D") return;
    
    if (config == "helio") return;

    var mst = getMST(new Date(animTime), PC.GREENWICH_LONGITUDE);

    var radialLength = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;

    var x1 = 0;
    var y1 = 0;
    var x2 = +1 * radialLength * Math.cos(mst/PC.DEGREES_PER_RADIAN);
    var y2 = -1 * radialLength * Math.sin(mst/PC.DEGREES_PER_RADIAN);

    d3.select("#Greenwich")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2);
}

function adjustLabelLocations() {

    for (var i = 0; i < animationScenes[config].planetsForOrbits.length; ++i) {
        var planetKey = animationScenes[config].planetsForLocations[i];
        d3.selectAll("#orbit-" + planetKey).attr("r", (0.5/zoomFactor));
        var strokeWidth = planetProperties[planetKey]["stroke-width"];
        d3.selectAll("#ellipse-orbit-" + planetKey).attr("stroke-width", (strokeWidth/zoomFactor));
    }

    // d3.select("#" + primaryBody).attr("r", (primaryBodyRadius/zoomFactor));

    for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {

        var planetKey = animationScenes[config].planetsForLocations[i];
        setLabelLocation(planetKey);

        var planetProps = planetProperties[planetKey];
        
        if (planetKey == "MOON") {
            var moonRadius = (PC.MOON_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;
            d3.selectAll("#" + planetKey).attr("r", Math.max(moonRadius, (planetProps.r/zoomFactor)));
        } else {
            d3.selectAll("#" + planetKey).attr("r", (planetProps.r/zoomFactor));
        }

        d3.select("#orbit-" + planetKey)
            .selectAll("path")
            .attr("style", "stroke: " + planetProps.orbitcolor + "; stroke-width: " + (1.0/zoomFactor) + "; fill: none");

        d3.select("#label-" + planetKey).attr("font-size", (10/zoomFactor));
    }

    d3.select("#Greenwich").attr("style", "stroke: LightBlue; stroke-opacity: 0.5; " + "stroke-width: " + (0.5/zoomFactor));
    
    var radialLength = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * PIXELS_PER_AU;
    d3.select("#label-" + animationScenes[config].primaryBody).attr("x", (-1 * radialLength + UC.CENTER_LABEL_OFFSET_X/zoomFactor));
    d3.select("#label-" + animationScenes[config].primaryBody).attr("y", (-1 * radialLength + UC.CENTER_LABEL_OFFSET_Y/zoomFactor));
    
    d3.select("#label-" + animationScenes[config].primaryBody).attr("font-size", (10/zoomFactor));

    var transformString = "translate (" + craftData["x"] + ", " + craftData["y"] + ") ";
    transformString += "rotate(" + craftData["angle"] + " 0 0) ";
    var burnZoomFactor = Math.max(0.25, zoomFactor);
    // console.log("zoomFactor = " + zoomFactor);
    transformString += "scale (" + 1/burnZoomFactor + " " + 1/burnZoomFactor + ") ";
    d3.select("#burng").attr("transform", transformString);

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
                setDimension(true);
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

    if (prevFrameTime != null) {    
        deltaFrameTime = curFrameTime - prevFrameTime;
    }
    prevFrameTime = curFrameTime;
    
    ++animateLoopCount;
    if (animateLoopCount % ticksPerAnimationStep < 0.1) {
        
        animateLoopCount = 0;

        if (animationRunning) {
            if (realtimespeed) {
                animTime += deltaFrameTime;
            } else {
                animTime += animTimeStepMinutes * TC.ONE_MINUTE_MS;
            }
            
            if (animTime > endTime - TC.ONE_MINUTE_MS) {
                animTime = endTime - TC.ONE_MINUTE_MS;
                stopAnimation();
            }
            setLocation();
        }
    }

    if (animationScenes[config] && animationScenes[config].initialized3D && animationScenes[config].cameraControlsEnabled) {
        animationScenes[config].skyContainer.position.setFromMatrixPosition(animationScenes[config].camera.matrixWorld);
        animationScenes[config].cameraControls.update();
        cameraControlsCallback();
    }

    requestAnimationFrame(animateLoop);
 
}

export function main() {
    const onloadStartTime = performance.now();

    $("#reset").on("click", reset);

    $("#origin-earth").on("click", toggleMode);
    $("#origin-moon").on("click", toggleMode);
    $("#camera-default").on("click", toggleCamera);
    $("#camera-moon").on("click", toggleCamera);
    $("#checkbox-lock-sc").on("click", toggleLockSC);
    $("#checkbox-lock-moon").on("click", toggleLockMoon);
    $("#checkbox-lock-earth").on("click", toggleLockEarth);

    $("#checkbox-lock-default").on("click", togglePlane);
    $("#checkbox-lock-xy").on("click", togglePlane);
    $("#checkbox-lock-zx").on("click", togglePlane);
    $("#checkbox-lock-yz").on("click", togglePlane);

    $("#checkbox-lock-xy-minus").on("click", togglePlane);
    $("#checkbox-lock-zx-minus").on("click", togglePlane);
    $("#checkbox-lock-yz-minus").on("click", togglePlane);


    $("#view-orbit").on("click", setView);
    $("#view-orbit-descent").on("click", setView);
    $("#view-craters").on("click", setView);
    $("#view-xyz-axes").on("click", setView);
    $("#view-poles").on("click", setView);
    $("#view-polar-axes").on("click", setView);
    $("#view-sky").on("click", setView);
    $("#view-moonsoi").on("click", setView);
    $("#view-eclipticplane").on("click", setView);
    $("#view-equatorialplane").on("click", setView);
    $("#view-fps").on("click", setView);

    $("#dimension-2D").on("click", setDimensionTop);
    $("#dimension-3D").on("click", setDimensionTop);

    $("#animate").on("click", cy3Animate);
    $("#joyride").on("click", toggleJoyRide);
    $("#joyridebutton").on("click", toggleJoyRide);
    $("#landing").on("click", toggleLanding);
    $("#landingbutton").on("click", toggleLanding);

    $("#info-button").on("click", toggleInfo);

    initAnimation({'reset': true}); // no need to await here - we are just kickstarting the setup 
    const onloadEndTime = performance.now() - onloadStartTime;
    // console.log("onload() took " + onloadEndTime + " ms");
}

// TODO - find a better way to handle the following

function f1()  { zoomIn();          timeoutHandleZoom = setTimeout(f1,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f2()  { zoomOut();         timeoutHandleZoom = setTimeout(f2,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f3()  { panLeft();         timeoutHandleZoom = setTimeout(f3,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f4()  { panRight();        timeoutHandleZoom = setTimeout(f4,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f5()  { panUp();           timeoutHandleZoom = setTimeout(f5,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f6()  { panDown();         timeoutHandleZoom = setTimeout(f6,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f7()  { forward();         timeoutHandleZoom = setTimeout(f7,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f8()  { fastForward();     timeoutHandleZoom = setTimeout(f8,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f9()  { backward();        timeoutHandleZoom = setTimeout(f9,  mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f10() { fastBackward();    timeoutHandleZoom = setTimeout(f10, mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f11() { slower();          timeoutHandleZoom = setTimeout(f11, mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f12() { resetspeed();      timeoutHandleZoom = setTimeout(f12, mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f13() { faster();          timeoutHandleZoom = setTimeout(f13, mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}
function f14() { realtime();        timeoutHandleZoom = setTimeout(f14, mousedownTimeout); if (mousedownTimeout > 10) { mousedownTimeout -= 10; }}

function zoomFunction(f) {
    mouseDown = true;
    f();
    timeoutHandleZoom = setTimeout(f, UC.ZOOM_TIMEOUT);
}

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
    
    animationScenes[config].lockOnSC = false;
    animationScenes[config].lockOnMoon = false;
    animationScenes[config].lockOnEarth = false;
    
    d3.select("#checkbox-lock-sc").property("checked", false);
    d3.select("#checkbox-lock-moon").property("checked", false);
    d3.select("#checkbox-lock-earth").property("checked", false);

    d3SelectAll("button").attr("disabled", true);

    var handlers = {
        "zoomin":       { "mousedown":  f1 },
        "zoomout":      { "mousedown":  f2  },
        "panleft":      { "mousedown":  f3  },
        "panright":     { "mousedown":  f4  },
        "panup":        { "mousedown":  f5  },
        "pandown":      { "mousedown":  f6  },
        "forward":      { "mousedown":  f7  },
        "fastforward":  { "mousedown":  f8  },
        "backward":     { "mousedown":  f9  },
        "fastbackward": { "mousedown":  f10 },
        "slower":       { "mousedown":  f11 },
        "resetspeed":   { "mousedown":  f12 },
        "faster":       { "mousedown":  f13 },
        "realtime":     { "mousedown":  f14 },
    };

    var buttons = [
        "zoomin", "zoomout",
        "panleft", "panright", "panup", "pandown",
        "forward", "fastforward", "backward", "fastbackward",
        "slower", "resetspeed", "faster", "realtime"
    ];

    for (var i = 0; i < buttons.length; ++i) {

        var b = buttons[i];

        d3.select("#" + b).on("mousedown", handlers[b]["mousedown"]);

        d3.select("#" + b).on("mouseup", function() {

            mousedownTimeout = UC.ZOOM_TIMEOUT;
            mouseDown = false;
            clearTimeout(timeoutHandleZoom);
            timeoutHandleZoom = null;

            zoomEnd();
        });
        d3.select("#" + b).on("mouseout", function() {

            mouseDown = false;
            if (timeoutHandleZoom == null) return;
            clearTimeout(timeoutHandleZoom);
            timeoutHandleZoom = null;

            zoomEnd();
        });
        d3.select("#" + b).on("click", function() {
            // TODO - would there be a case where mousedown is not called?
        });
    }

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
        initSVG();
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

async function processOrbitData() {
    // console.log("processOrbitData() called");

    $("#progressbar").hide();
    clearProgressLabel();

    // Update configuration from metadata if available
    updateConfigFromMetadata();
    
    // Only process SVG orbit vectors in 2D mode
    if (currentDimension === "2D") {
        await processOrbitVectorsData();
    }
    await sleep();

    // TODO d3v7 handling
    // var zoom = d3.zoom().on("zoom", handleZoom).on("end", zoomEnd);

    // console.log("offsetx = " + offsetx + ", panx = " + panx + ", offsety = " + offsety + ", pany = " + pany);

    // Only create SVG rect in 2D mode
    if (currentDimension === "2D") {
        svgRect = d3.select("#svg")
            .append("rect")
                .attr("id", "svg-rect")
                .attr("point-events", "all")
                .attr("class", "overlay")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", svgWidth)
                .attr("height", svgHeight)
                .attr("style", "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0")
                // .attr("class", "background")
                .call(d3.behavior.zoom()
                    .translate([offsetx+panx, offsety+pany])
                    .scale(zoomFactor)
                    .on("zoom", handleZoom)
                    .on("zoomend", zoomEnd));
    }

    // TODO d3v7 way of zoom
    // svgRect = d3.select("#svg")
    //     .append("rect")
    //         .attr("id", "svg-rect")
    //         .attr("class", "overlay")
    //         .attr("x", 0)
    //         .attr("y", 0)
    //         .attr("width", svgWidth)
    //         .attr("height", svgHeight)
    //         .attr("style", "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0")
    //         // .attr("class", "background");
    //         .zoom(zoom);
        
    // TODO handle error with d3v7        
    // d3.select("#svg-rect").call(zoom
    //     .translateBy(offsetx+panx, offsety+pany)
    //     .scaleBy(zoomFactor)
    //     );

    // svgRect = d3.select("#svg")
    //     .append("rect")
    //         .attr("id", "svg-rect")
    //         .attr("class", "overlay")
    //         .attr("x", 0)
    //         .attr("y", 0)
    //         .attr("width", svgWidth)
    //         .attr("height", svgHeight)
    //         .attr("style", "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0")
    //         // .attr("class", "background")
    //         .call(zoom.transform,
    //             d3.zoomIdentity
    //             .translate([offsetx+panx, offsety+pany])
    //             .call(zoom.transform,
    //                 d3.zoomIdentity
    //             .scale(zoomFactor)
    //             .on("zoom", zoom)
    //             .on("zoomend", zoomEnd)));

    if (!missionStartCalled) {
        missionStart();
    }
    d3SelectAll("button").attr("disabled", null);

    /*
    if (!bannerShown) {
        bannerShown = true;
        $("#banner").dialog({height: 200, width: 400, modal: true});
    }
    */

    if (!animationRunning) {
        updateD3ElementText("#animate", "Play");
    }

    zoomChangeTransform(0);

    orbitDataProcessed[config] = true;

    // console.log("processOrbitData() returning");
}

async function loadLandingDataAndProcess() {
    // Check if landing is enabled in config
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;
    if (!isLandingEnabled) return;

    if (!landingDataLoaded) {
        // Use config data for landing if available
        const configData = globalConfig;
        const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
        let landingDataCheb = `${window.missionConfig.dataPath}landing-${spacecraftMnemonic}-cheb.json`;

        if (configData && configData.landing) {
            const cfg = configData.landing;
            landingDataCheb = `${window.missionConfig.dataPath}${cfg.orbits_file}-cheb.json`;
        }

        // Load Chebyshev data for landing phase
        try {
            console.log(`Loading landing Chebyshev data from ${landingDataCheb}`);
            landingChebyshevData = await loadChebyshevData(landingDataCheb);
            landingChebyshevLoaded = true;
            landingDataLoaded = true;
            console.log(`Landing Chebyshev data loaded: ${landingChebyshevData.segments.length} segments`);
        } catch (chebError) {
            console.error(`Failed to load landing Chebyshev data: ${chebError}`);
            landingChebyshevLoaded = false;
        }
    }
}

async function loadOrbitDataIfNeededAndProcess(callback) {

    if (!orbitDataLoaded[config]) {

        // console.log("Loading orbit data for " + config);

        var msg = dataLoaded ? "" : ("Loading orbit data ... ");
        $("#progressbar").progressbar();
        $("#progressbar").progressbar("option", "value", false);
        $("#progressbar").show();
        updateProgressLabel(msg);
        await sleep();

        try {
            // Load Chebyshev JSON for spacecraft (SC) trajectory
            const chebUrl = animationScenes[config].orbitsCheb;
            console.log(`Loading Chebyshev data from ${chebUrl}`);

            chebyshevData[config] = await loadChebyshevData(chebUrl);
            chebyshevDataLoaded[config] = true;
            console.log(`Chebyshev data loaded for ${config}: ${chebyshevData[config].segments.length} segments`);

            dataLoaded = true;
            orbitDataLoaded[config] = true;

            $("#progressbar").hide();
            await processOrbitData();
            await sleep();
            callback();

        } catch(error) {
            console.error("Error loading Chebyshev data:", error);
            $("#progressbar").hide();
            d3.select("#eventinfo").text("Error: failed to load orbit data.");
        }
    } else {
        // console.log("Orbit data already loaded for " + config);
        await processOrbitData();
        await sleep();
        callback();
    }
}

function computeSVGDimensions() {
    svgX = 0;
    svgY = $("#svg-top-baseline").position().top;
    svgWidth = window.innerWidth;
    svgHeight = window.innerHeight; // - (svgY + $("#footer-wrapper").outerHeight(true));
    offsetx = svgWidth * (1 / 2) - UC.SVG_ORIGIN_X;
    offsety = svgHeight * (1 / 2) - UC.SVG_ORIGIN_Y;

    // console.log("svgX = " + svgX + ", svgY = " + svgY + ", svgWidth = " + svgWidth + ", svgHeight = " + svgHeight + 
    //     ", offsetx = " + offsetx + ", offsety = " + offsety);
}

function initSVG() {
    d3.select("svg").remove();

    computeSVGDimensions();

    svgContainer = d3.select("#svg-wrapper")
        .attr("class", config + " dimension-2D")
        .append("svg")
            .attr("id", "svg")
            // .attr("x", svgX)
            // .attr("y", svgY)
            // .attr("width", svgWidth)
            // .attr("height", svgHeight)    
            .attr("overflow", "visible") // added for SVG elements to be visible in Chrome 36+; TODO side effects analysis
            .attr("class", "dimension-2D")
            .attr("display", currentDimension === "2D" ? "block" : "none")
            .style("visibility", currentDimension === "2D" ? "visible" : "hidden")
        .append("g")
            .attr("transform", "translate(" + offsetx + ", " + offsety + ")");

    //  d3.select("svg")
    //     // .attr("x", svgX)
    //     // .attr("y", svgY)
    //     .attr("width", svgWidth)
    //     .attr("height", svgHeight);

    updateProgressLabel("Loading orbit data ...");

    dataLoaded = false;

    /*
    d3.xhr("whatsnew-cy3.html")
        .get(function(error, data) {
            if (error) {
                // console.log("Error: unable to load whatsnew.html");
            } else {
                // console.log("whatsnew.html = " + data);
                updateD3ElementHTML("#banner", data.response);
           }
        });
    */
}

function handleZoom(event) {
    var x = d3.event.translate[0];
    var y = d3.event.translate[1];
    zoomFactor = d3.event.scale;
    panx = x - offsetx;
    pany = y - offsety;
    zoomChangeTransform();
}

function handleZoomNew(event) {
    // console.log(event);
    x = event.transform.x || 0;
    y = event.transform.y || 0;
    zoomFactor = event.transform.k || 1;
    panx = x - offsetx;
    pany = y - offsety;
    zoomChangeTransform();
}

function zoomEnd() {
    adjustLabelLocations();
}

function processOrbitElementsData() {

    // console.log("processOrbitElementsData() called");
    
    // Only process if svgContainer exists (2D mode)
    if (!svgContainer) {
        console.debug("SVG container not initialized, skipping processOrbitElementsData");
        return;
    }

    // Add elliptical orbits

    for (var i = 0; i < animationScenes[config].planetsForOrbits.length; ++i) {

        var planetKey = animationScenes[config].planetsForOrbits[i];
        var planetProps = planetProperties[planetKey];
        var planetId = planetProps.id;
        var planet = animationScenes[config].orbits[planetId];
        var elements = planet["elements"];

        // console.log("Processing orbit data of " + planetKey);

        for (var jd in elements) { // only 1 is expected

            var el = elements[jd];
            epochJD = jd;
            epochDate = el.date;
            // consoloe.log(planetKey + ": epochjd: " + epochjd + ", epochDate: " + epochDate);

            var cx = -1 * (el.a / PC.KM_PER_AU) * el.ec * PIXELS_PER_AU;
            var cy = 0 * PIXELS_PER_AU;
            var rx = (el.a / PC.KM_PER_AU) * PIXELS_PER_AU;
            var ry = rx * (Math.sqrt(1 - el.ec * el.ec));

            var angle = parseFloat(el.om) + parseFloat(el.w);
            while (angle >= PC.DEGREES_PER_CIRCLE) angle -= PC.DEGREES_PER_CIRCLE;
            angle = -1 * angle;

            svgContainer.append("ellipse")
                .attr("id", "ellipse-orbit-" + planetKey)
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("rx", rx)
                .attr("ry", ry)
                .attr("stroke", planetProps.orbitcolor)
                .attr("stroke-width", (1.0/zoomFactor))
                .attr("fill", "none")
                .attr("transform", "rotate(" + angle + " 0 0)");
        }
    }
}


async function processOrbitVectorsData() {
    // Add spacecraft orbits (2D SVG mode)

    // Only process if svgContainer exists (2D mode)
    if (!svgContainer) {
        console.debug("SVG container not initialized, skipping processOrbitVectorsData");
        return;
    }

    for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {

        var planetKey = animationScenes[config].planetsForLocations[i];
        var planetProps = planetProperties[planetKey];

        if (shouldDrawOrbit(planetKey)) {
            if (!svgContainer || currentDimension !== "2D") {
                return;
            }
            // Generate vectors from Chebyshev data
            let vectors = [];
            if (chebyshevDataLoaded[config] && chebyshevData[config]) {
                const stepMs = animationScenes[config].stepDurationInMilliSeconds;
                vectors = generateCurveFromChebyshev(
                    chebyshevData[config],
                    startTime,
                    latestEndTime,
                    stepMs
                );
            }

            if (vectors.length === 0) {
                console.warn(`No orbit data available for ${planetKey} in 2D mode`);
                continue;
            }

            svgContainer.append("g")
                .attr("id", "orbit-" + planetKey)
                .attr("visibility", "visible");

            var line = d3.svg.line()
                .x(function(d) { return +1 * xFactor*d[xVariable] / PC.KM_PER_AU * PIXELS_PER_AU; } )
                .y(function(d) { return -1 * yFactor*d[yVariable] / PC.KM_PER_AU *PIXELS_PER_AU; } )
                .interpolate("cardinal-open");

            // TODO d3v7
            // var line = d3.line()
            //     .x(function(d) { return +1 * xFactor*d[xVariable] / PC.KM_PER_AU * PIXELS_PER_AU; } )
            //     .y(function(d) { return -1 * yFactor*d[yVariable] / PC.KM_PER_AU *PIXELS_PER_AU; } )
            //     .curve(d3.curveCardinalOpen);

            svgContainer.select("#" + "orbit-" + planetKey)
                .append("path")
                .attr("d", line(vectors))
                .attr("style", "stroke: " + planetProps.orbitcolor + "; stroke-width: " + (1.0/zoomFactor) + "; fill: none")
                .attr("visibility", "inherit");
        }
    }

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    // Add center planet - Sun/Earth/Mars/Moon

    svgContainer.append("circle")
        .attr("id", animationScenes[config].primaryBody)
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", animationScenes[config].primaryBodyRadius)
        .attr("fill-opacity", "0.6")
        .attr("stroke", "none")
        .attr("stroke-width", 0)
        .attr("fill", planetProperties[animationScenes[config].primaryBody].color);

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    if ((config == "geo") || (config == "helio")) {

        svgContainer
            .append("g")
                .attr("class", "label")
            .append("text")
                .attr("id", "label-" + animationScenes[config].primaryBody)
                .attr("x", UC.CENTER_LABEL_OFFSET_X)
                .attr("y", UC.CENTER_LABEL_OFFSET_Y)
                .attr("font-size", 10/zoomFactor)
                .attr("fill", planetProperties[animationScenes[config].primaryBody].color)
                .text(planetProperties[animationScenes[config].primaryBody].name);
    }

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    if (config == "martian") {
           var r = 3390/PC.KM_PER_AU*PIXELS_PER_AU/zoomFactor;
           svgContainer.append("image")
               .attr("id", "mars-image")
               .attr("xlink:href", "cy3-mars-image-transparent.gif")
               .attr("x", -r)
               .attr("y", -r)
               .attr("height", 2*r)
               .attr("width", 2*r);
    }

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    // Add planetary positions

    for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {

        var planetKey = animationScenes[config].planetsForLocations[i];
        var planetProps = planetProperties[planetKey];

        // If a planet location is avialable only after an interval of time from the epoch (startTime)
        // For example, Maven and the Mars Orbiter Mission were launched at different times.
        // The "offset" vallue is to take care of such scenarios.

        var planetIndexOffset = (planetStartTime(planetKey) - startTime) / animationScenes[config].stepDurationInMilliSeconds;
        planetProperties[planetKey]["offset"] = planetIndexOffset;

        svgContainer.append("circle")
            .attr("id", planetKey)
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", planetProps.r/zoomFactor)
            .attr("stroke", "none")
            .attr("stroke-width", 0)
            .attr("fill", planetProps.color);

    }

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    // Add fire

    svgContainer.append("g")
            .attr("id", "burng")
            .style("visibility", "hidden")
        .append("polygon")
            .attr("id", "burn")
            .attr("points", "3 9 3 -9 45 0")
            .attr("fill", "red");

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    // Add labels

    svgContainer.append("g")
        .attr("id", "labels")
        .attr("class", "label");

    for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {

        var planetKey = animationScenes[config].planetsForLocations[i];
        var planetProps = planetProperties[planetKey];

        d3.select("#labels")
            .append("text")
                .attr("id", "label-" + planetKey)
                .attr("x", 0)
                .attr("y", 0)
                .attr("font-size", 10/zoomFactor)
                .attr("fill", planetProps.color);

        d3.select("#label-"+planetKey).text(planetProps.name);
    }

    await sleep();
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    if (config == "geo") {

        // Add Greenwich longitude

        svgContainer.append("line")
            .attr("id", "Greenwich")
            .attr("class", "geo")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 0)
            .attr("style", "stroke: DarkGray; stroke-opacity: 0.5; stroke-width: " + (0.5/zoomFactor))
            .attr("visibility", "inherit");
    }

    await sleep();

    d3.select("#epochjd").html(epochJD);
    d3.select("#epochdate").html(epochDate);
}

function cy3Animate() {

    if (animationRunning) {
        stopAnimation();
    } else {
        animationRunning = true;
        stopAnimationFlag = false;
        if (animTime >= endTime - TC.ONE_MINUTE_MS) animTime = startTime;
        updateD3ElementText("#animate", "Pause");
    }
}

function fastBackward() {
    animTime -= animationScenes[config].stepsPerHop * TC.ONE_MINUTE_MS;
    if (animTime < startTime) animTime = startTime;
    setLocation();
}

function backward() {
    animTime -= TC.ONE_MINUTE_MS;
    if (animTime < startTime) animTime = startTime;
    setLocation();
}

function stopAnimation() {
    animationRunning = false;
    stopAnimationFlag = true;
    clearTimeout(timeoutHandle);
    updateD3ElementText("#animate", "Play");
}

function forward() {
    animTime += TC.ONE_MINUTE_MS;
    if (animTime > endTime - TC.ONE_MINUTE_MS) {
        animTime = endTime - TC.ONE_MINUTE_MS;
    }
    setLocation();
}

function fastForward() {
    animTime += animationScenes[config].stepsPerHop * TC.ONE_MINUTE_MS;
    if (animTime > endTime - TC.ONE_MINUTE_MS) {
        animTime = endTime - TC.ONE_MINUTE_MS;
    }
    setLocation();
}

function missionStart() {
    missionStartCalled = true;
    stopAnimation();
    animTime = startTime;
    // console.log("missionStart(): animTime = " + animTime);
    setLocation();
}

function missionSetTime() {
    stopAnimation();
    if (animTime < startTime) {
        // console.log("missionSetTime(): animTime < startTime");
        animTime = startTime;
    } else if (animTime > endTime - TC.ONE_MINUTE_MS) {
        // console.log("missionSetTime(): animTime >= endTime");
        animTime = endTime - TC.ONE_MINUTE_MS;
    }
    setLocation();
}

function missionNow() {
    animTime = new Date().getTime();
    // console.log(animTime);
    missionSetTime();
}

function missionTLI() {
    animTime = timeTransLunarInjection;
    missionSetTime();
}

function missionLunar() {
    animTime = timeLunarOrbitInsertion;
    missionSetTime();
}

function missionEnd() {
    animTime = endTime;
    missionSetTime();
}

function faster() {
    if (realtimespeed) {
        realtimespeed = false;
        animTimeStepMinutes = deltaFrameTime / TC.ONE_MINUTE_MS * UC.SPEED_CHANGE_FACTOR;
    } else {
        animTimeStepMinutes *= UC.SPEED_CHANGE_FACTOR;	
    }
// console.log("animTimeStepMinutes = " + animTimeStepMinutes);
}

function resetspeed() {
    realtimespeed = false;
    animTimeStepMinutes = 1;
    // console.log("animTimeStepMinutes = " + animTimeStepMinutes);
}

function slower() {
    if (realtimespeed) {
        realtimespeed = false;
        animTimeStepMinutes = deltaFrameTime / TC.ONE_MINUTE_MS / UC.SPEED_CHANGE_FACTOR;
    } else {
        animTimeStepMinutes /= UC.SPEED_CHANGE_FACTOR;	
    }
    // console.log("animTimeStepMinutes = " + animTimeStepMinutes);
}

function realtime() {
    realtimespeed = true;
    // console.log("realtimespeed set to true");
}

function zoomChangeTransform(t) {
    
    // Only process in 2D mode when svgContainer exists
    if (!svgContainer || currentDimension !== "2D") {
        return;
    }

    var cy3x = 0;
    var cy3y = 0;

    if (animationScenes[config].lockOnSC) {
        var scElement = d3.select("#SC");
        if (!scElement.empty()) {
            cy3x = parseFloat(scElement.attr("cx"));
            cy3y = parseFloat(scElement.attr("cy"));
        }
    }

    if (animationScenes[config].lockOnMoon) {
        var moonElement = d3.select("#MOON");
        if (!moonElement.empty()) {
            cy3x = parseFloat(moonElement.attr("cx"));
            cy3y = parseFloat(moonElement.attr("cy"));
        }
    }

    if (animationScenes[config].lockOnEarth) {
        var earthElement = d3.select("#EARTH");
        if (!earthElement.empty()) {
            cy3x = parseFloat(earthElement.attr("cx"));
            cy3y = parseFloat(earthElement.attr("cy"));
        }
    }

    var container = svgContainer;
    // if (t != 0) {
    //     container = svgContainer.transition().delay(t);
    // }

    container
        .attr("transform",
            "matrix("
            + zoomFactor
            + ", 0"
            + ", 0"
            + ", " + zoomFactor
            + ", " + (offsetx+panx+cy3x-zoomFactor*(cy3x)-cy3x)
            + ", " + (offsety+pany+cy3y-zoomFactor*(cy3y)-cy3y)
            + ")"
        );

    // var zoom = d3.zoom().on("zoom", handleZoom).on("end", adjustLabelLocations);

    // sychronize D3's state // TODO
    // svgRect && svgRect
    //     .call(zoom.transform,
    //         d3.zoomIdentity
    //         .translate([offsetx+panx, offsety+pany])
    //         .scale(zoomFactor));
}

function zoomChange(t) {
    zoomChangeTransform(t);
    showGreenwichLongitude();
}

function zoomOut() {
    zoomFactor /= UC.ZOOM_SCALE;
    var factor = 1/UC.ZOOM_SCALE;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function zoomIn() {
    zoomFactor *= UC.ZOOM_SCALE;
    var factor = UC.ZOOM_SCALE;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function panLeft() {
    panx += +10;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function panRight() {
    panx += -10;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function panUp() {
    pany += +10;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function panDown() {
    pany += -10;
    zoomChange(UC.ZOOM_TIMEOUT);
}

function reset() {

    panx = 0;
    pany = 0;
    zoomFactor = 1;

    zoomChange(UC.ZOOM_TIMEOUT);
    zoomEnd();
}

function toggleInfo() {
    $("#stats").toggle();
}

function toggleLockSC() {
    animationScenes[config].previousLockOnSC = animationScenes[config].lockOnSC;
    animationScenes[config].lockOnSC = !animationScenes[config].lockOnSC;
    
    animationScenes[config].previousLockOnMoon = animationScenes[config].lockOnMoon;
    animationScenes[config].lockOnMoon = false;
    d3.select("#checkbox-lock-moon").property("checked", false);
    
    animationScenes[config].previousLockOnEarth = animationScenes[config].lockOnEarth;
    animationScenes[config].lockOnEarth = false;
    d3.select("#checkbox-lock-earth").property("checked", false);

    reset();
}

function toggleLockMoon() {
    animationScenes[config].previousLockOnMoon = animationScenes[config].lockOnMoon;
    animationScenes[config].lockOnMoon = !animationScenes[config].lockOnMoon;

    animationScenes[config].previousLockOnSC = animationScenes[config].lockOnSC;
    animationScenes[config].lockOnSC = false;
    d3.select("#checkbox-lock-sc").property("checked", false);

    animationScenes[config].previousLockOnEarth = animationScenes[config].lockOnEarth;
    animationScenes[config].lockOnEarth = false;
    d3.select("#checkbox-lock-earth").property("checked", false);

    reset();
}

function toggleLockEarth() {
    animationScenes[config].previousLockOnEarth = animationScenes[config].lockOnEarth;
    animationScenes[config].lockOnEarth = !animationScenes[config].lockOnEarth;
    animationScenes[config].previousLockOnSC = animationScenes[config].lockOnSC;
    animationScenes[config].lockOnSC = false;
    d3.select("#checkbox-lock-sc").property("checked", false);
    
    animationScenes[config].previousLockOnMoon = animationScenes[config].lockOnMoon;
    animationScenes[config].lockOnMoon = false;
    d3.select("#checkbox-lock-moon").property("checked", false);

    reset();
}

function toggleCameraPos() {
    var val = $('input[name=camera]:checked').val();
    if (animationScenes[config] && animationScenes[config].initialized3D) {
        animationScenes[config].toggleCameraPos(val);
    }
}

function toggleCameraLook() {
    var val = $('input[name=look]:checked').val();
    if (animationScenes[config] && animationScenes[config].initialized3D) {
        animationScenes[config].toggleCameraLook(val);
    }
}

function handlePlaneChange(dimension_changed = false, init_flag = false) {

    // TODO Dimension/Plane combined state handler to be created and the dirty logic below to be simplified and readable
    // Current implementation: 
    // If the plane is changed while in 2D (or 3D), an equivalent change will be done in 3D (or 2D, respectively).
    // That plane change will be seen when the dimension is switched.
    // Please note that the SVG is constrained to 6 views as it's 2D. 
    // Also note that if the 3D view is altered by the user, it won't be reset simply because of switching to 2D, not changing the plane there and coming back to 3D.

    var oldPlaneSelection = previousPlaneSelection;

    if (planeSelection != previousPlaneSelection) {
        planeChanged = true;
        previousPlaneSelection = planeSelection;
        planeChangesPending = true;
    } else {
        planeChanged = false;
    }

    // console.debug("handlePlaneChange(): init_flag=" + init_flag + ", dimension_changed=" + dimension_changed + ", planeChanged=" + planeChanged, ", " + oldPlaneSelection + " -> " + planeSelection);
    
    if (init_flag && planeSelection == "DEFAULT") {
        // console.debug("handlePlaneChange(): init_flag is true and planeSelection is DEFAULT; so returning without changes.");
        planeChangesPending = false;
        return;
    }
    if ((!dimension_changed && !planeChanged)) {
        // console.debug("handlePlaneChange(): dimension_changed is false and planeChanged is false; so returning without changes.");
        return;
    }
    if (dimension_changed && !planeChangesPending) {
        // console.debug("handlePlaneChange(): dimension_changed is true and planeChangesPending is false; so returning without changes.");
        return;
    }

    // Apply plane variable configuration for all plane selections
    const planeConfig = planeVariableConfig[planeSelection];
    if (planeConfig) {
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
    }

    // Apply camera parameters for 3D mode after plane selection logic
    if (currentDimension == "3D") {
        animationScenes[config].setCameraParameters(init_flag);
    }

    if (currentDimension == "2D") {

        initSVG();
        loadOrbitDataIfNeededAndProcess(function() {
            handleDimensionSwitch(currentDimension);
            setLocation();  
        });
        

    } else if (currentDimension == "3D") {

        // TODO check logic
        loadOrbitDataIfNeededAndProcess(function() {
            handleDimensionSwitch(currentDimension);
            setLocation();    
        })
    }

    if (planeChangesPending && dimension_changed) {
        planeChangesPending = false;
    }
}

function togglePlane() {
    
    planeSelection = $('input[name=plane]:checked').val();
    handlePlaneChange(false, false);
}

function toggleJoyRide() {
    if (landingFlag) { toggleLanding(); }
    joyRideFlag = !joyRideFlag;
    animationScenes[config].craft.visible = !joyRideFlag;
    animationScenes[config].craftEdges.visible = !joyRideFlag;
    $("#joyridebutton").toggleClass("down");
    $("#joyride").prop("checked", joyRideFlag);
    if (joyRideFlag) {
        animationScenes[config].motherContainer.position.set(0, 0, 0);    
        
        $("#view-orbit").prop("checked", false); 
        $("#view-orbit-descent").prop("checked", false); 
 
 
        $("#view-craters").prop("checked", false); 
        $("#view-xyz-axes").prop("checked", false); 
        $("#view-poles").prop("checked", false); 
        $("#view-polar-axes").prop("checked", false); 
        $("#view-sky").prop("checked", true); 
        $("#view-moonsoi").prop(":checked", false); 
        $("#view-eclipticplane").prop(":checked", false); 
        $("#view-equatorialplane").prop(":checked", false); 
        setView();

    } else {
        $("#view-orbit").prop("checked", true);
        $("#view-orbit-descent").prop("checked", true);  
 
 
        $("#view-craters").prop("checked", true); 
        $("#view-xyz-axes").prop("checked", true); 
        $("#view-poles").prop("checked", true); 
        $("#view-polar-axes").prop("checked", true);
        $("#view-sky").prop("checked", true); 
        $("#view-moonsoi").prop(":checked", false); 
        $("#view-eclipticplane").prop(":checked", false); 
        $("#view-equatorialplane").prop(":checked", false); 
        setView();
    }
    updateCraftScale();
    render();
}

function toggleLanding() {
    // Check if landing is enabled in config
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;
    if (!isLandingEnabled) return;
    
    if (joyRideFlag) { toggleJoyRide(); }
    landingFlag = !landingFlag;
    animationScenes[config].craft.visible = true;
    animationScenes[config].craftEdges.visible = true;
    $("#landingbutton").toggleClass("down");
    $("#landing").prop("checked", landingFlag);
    if (landingFlag) {
        animationScenes[config].motherContainer.position.set(0, 0, 0);    
        
        $("#view-orbit").prop("checked", false); 
        $("#view-orbit-descent").prop("checked", true); 
 
 
        $("#view-craters").prop("checked", false); 
        $("#view-xyz-axes").prop("checked", false); 
        $("#view-poles").prop("checked", false); 
        $("#view-polar-axes").prop("checked", false); 
        $("#view-sky").prop("checked", true); 
        $("#view-moonsoi").prop(":checked", false); 
        $("#view-eclipticplane").prop(":checked", false); 
        $("#view-equatorialplane").prop(":checked", false); 
        setView();

    } else {
        $("#view-orbit").prop("checked", true);
        $("#view-orbit-descent").prop("checked", true);  
 
 
        $("#view-craters").prop("checked", true); 
        $("#view-xyz-axes").prop("checked", true); 
        $("#view-poles").prop("checked", true); 
        $("#view-polar-axes").prop("checked", true);
        $("#view-sky").prop("checked", true); 
        $("#view-moonsoi").prop(":checked", false); 
        $("#view-eclipticplane").prop(":checked", false); 
        $("#view-equatorialplane").prop(":checked", false); 
        setView();
    }
    updateCraftScale();
    render();
}

function setView() {
    // console.log("setView() called");

    viewOrbit = $("#view-orbit").is(":checked"); 
    viewOrbitDescent = $("#view-orbit-descent").is(":checked"); 
 
 
    viewCraters = $("#view-craters").is(":checked"); 
    viewXYZAxes = $("#view-xyz-axes").is(":checked"); 
    viewPoles = $("#view-poles").is(":checked"); 
    viewPolarAxes = $("#view-polar-axes").is(":checked"); 
    viewSky = $("#view-sky").is(":checked"); 
    viewMoonSOI = $("#view-moonsoi").is(":checked"); 
    viewEclipticPlane = $("#view-eclipticplane").is(":checked"); 
    viewEquatorialPlane = $("#view-equatorialplane").is(":checked"); 
    viewFPS = $("#view-fps").is(":checked"); 

    // Control FPS counter visibility
    setFPSCounterVisibility(viewFPS);

    ["geo", "lunar"].map(function(cfg) {
        // console.log("Setting view for config: " + cfg);

        if (animationScenes[cfg] && animationScenes[cfg].initialized3D) {
            animationScenes[cfg].orbitLines.map((orbitLine) => {orbitLine.visible = viewOrbit;});
            if (cfg == "lunar" && globalConfig && globalConfig.landing && globalConfig.landing.enabled) { 
                animationScenes[cfg].landingOrbitLine.visible = viewOrbitDescent; 
            }
        
            
            animationScenes[cfg].locations.map(x => x.visible = viewCraters);
        
            animationScenes[cfg].axesHelper.visible = viewXYZAxes;
        
            animationScenes[cfg].earthNorthPoleSphere.visible = viewPoles;
            animationScenes[cfg].earthSouthPoleSphere.visible = viewPoles;
            
            // Only show moon elements if this is a lunar mission
            if (globalConfig && globalConfig.is_lunar) {
                animationScenes[cfg].moonNorthPoleSphere.visible = viewPoles;
                animationScenes[cfg].moonSouthPoleSphere.visible = viewPoles;
                animationScenes[cfg].moonAxis.visible = viewPolarAxes;
                animationScenes[cfg].moonSOISphere.visible = viewMoonSOI;
            }
        
            animationScenes[cfg].earthAxis.visible = viewPolarAxes;
            
            animationScenes[cfg].skyContainer.visible = viewSky;  
            animationScenes[cfg].eclipticPlaneHelper.visible = viewEclipticPlane;
            animationScenes[cfg].eclipticPolarGridHelper.visible = viewEclipticPlane;
            animationScenes[cfg].equatorialPlaneHelper.visible = viewEquatorialPlane;
            animationScenes[cfg].equatorialPolarGridHelper.visible = viewEquatorialPlane;
        }
    
    });

    render();
}

function toggleCamera() {
    var val = $('input[name=camera]:checked').val();
    // console.log("toggleCamera() called with value " + val);

    if (val =="default") {
        moonPhaseCamera = false;
    } else {
        moonPhaseCamera = true;
    }

    if (animationScenes[config] && animationScenes[config].initialized3D) {
        animationScenes[config].setCameraParameters(false);
        animationScenes[config].skyContainer.visible = !moonPhaseCamera && viewSky;
    }

    render();
}

function burnButtonHandler(index) {
    // console.log("burnButtonHandler() called for event index: " + index);
    // animTime = eventInfos[index]["startTime"];
    if (eventInfos[index]["label"] == "⏰ Now") {
        animTime = new Date().getTime();
    } else {
        // animTime = new Date(eventInfos[index]["startTime"].getTime() + (eventInfos[index]["durationSeconds"] * 1000 / 2));    
        animTime = new Date(eventInfos[index]["startTime"].getTime()).getTime();
    }
    
    // console.log("burnButtonHandler(): animTime = " + animTime + ", startTime = " + startTime + ", endTime = " + endTime);
    missionSetTime();
}

// adapted from - http://stackoverflow.com/questions/9318674/javascript-number-currency-formatting


// The following function getMST() is from
//
// http://mysite.verizon.net/res148h4j/javascript/script_clock.html
//
//
/*
** "getMST" computes Mean Sidereal Time in units of degrees. Use lon = 0 to
** get the Greenwich MST.
**
** returns: time in degrees
*/
function getMST(t, lon)
{
    var year   = t.getUTCFullYear();
    var month  = t.getUTCMonth() + 1;
    var day    = t.getUTCDate();
    var hour   = t.getUTCHours();
    var minute = t.getUTCMinutes();
    var second = t.getUTCSeconds();

    // 1994 June 16th at 18h UT
    // days since J2000: -2024.75
    // GMST: 174.77111347427126
    //       11h 39m 5.0672s
    // year   = 1994;
    // month  = 6;
    // day    = 16;
    // hour   = 18;
    // minute = 0;
    // second = 0;

    if( month == 1 || month == 2 )
    {
    year = year - 1;
    month = month + 12;
    }

    var a = Math.floor( year/100 );
    var b = 2 - a + Math.floor( a/4 );

    var c = Math.floor(365.25 * year);
    var d = Math.floor(30.6001 * (month + 1));

    // days since J2000.0
    var jd = b + c + d - 730550.5 + day + (hour + minute/60.0 + second/3600.0)/24.0;

    var jt   = jd/36525.0;                   // julian centuries since J2000.0
    var GMST = 280.46061837 + 360.98564736629*jd + 0.000387933*jt*jt - jt*jt*jt/38710000 + lon;
    if( GMST > 0.0 )
    {
        while( GMST > 360.0 )
            GMST -= 360.0;
    }
    else
    {
        while( GMST < 0.0 )
            GMST += 360.0;
    }

    return GMST;
}

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
