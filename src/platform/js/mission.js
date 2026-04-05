
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
    d3SelectAll,
    updateEventInfo,
    updateD3ElementText,
    updateFPSCounter,
} from "./core/dom.js";
import { generateCurveFromChebyshev } from "./chebyshev.js";
import { SceneHelpers } from "./rendering/scene-helpers.js";
import { AnimationController } from "./animation/animation-controller.js";
import { bindSettingsPanel } from "./ui/event-handlers.js";
import { createEventBus } from "./core/event-bus.js";
import { startMissionApp } from "./app/mission-app.js";
import { showElementById } from "./ui/dom-helpers.js";
import { computeSceneCameraParameters } from "./app/camera-parameters-core.js";
import {
    generateBodyCurve,
    getBodyEphemerisState,
    resolveBodySource,
} from "./data/ephemeris-provider.js";
import { resolveMissionCraft } from "./core/domain/mission-config.js";
import { initSceneHandlerDom } from "./app/scene-handler-init.js";
import {
    DEFAULT_VIEW_STATE,
} from "./app/plane-view-state.js";
import { createEphemerisInfoPanelActions } from "./app/ephemeris-info-panel.js";
import { createMissionLegacyState } from "./app/mission-legacy-state.js";
import { createMissionRuntimeHandlersEntry } from "./app/mission-runtime-handlers-entry.js";
import { createMissionRuntimeWireupEntry } from "./app/mission-runtime-wireup-entry.js";
import { createMissionSceneEntry } from "./app/mission-scene-entry.js";
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
import { createTimelineDockController } from "./app/timeline-dock-controller.js";
import {
    getSceneActiveCraftId,
    getSceneVisibleCraftIds,
} from "./app/scene-craft-helpers.js";

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
    viewMoonHighlightRing: initialMissionViewState.viewMoonHighlightRing,
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

const eventBus = createEventBus();
let timelineDockController = null;
let lastTimelineEventsRef = null;

function ensureTimelineDockController() {
    if (timelineDockController) return timelineDockController;
    timelineDockController = createTimelineDockController({
        onSeekTime: (timeMs) => {
            animationController.setTime(timeMs);
        },
        onMarkerSelect: (eventInfo) => {
            if (eventInfo?.clickable === false) return;
            if (!(eventInfo?.startTime instanceof Date)) return;
            animationController.goToEvent(eventInfo.startTime.getTime());
        },
        onMarkerHover: (eventInfo) => {
            const hoverText = eventInfo?.hoverText || eventInfo?.infoText || eventInfo?.label || "";
            if (hoverText) {
                updateEventInfo(hoverText);
            }
        },
        onMarkerLeave: () => {
            clearEventInfo();
        },
        onCraftSelect: (craftId) => {
            const viewToggle = document.getElementById("view-additional-crafts");
            const craftSelect = document.getElementById("active-craft-select");
            if (viewToggle) {
                viewToggle.checked = true;
            }
            if (craftSelect) {
                craftSelect.value = craftId;
            }
            setView?.();
        },
    });
    timelineDockController.bind();
    return timelineDockController;
}

function syncTimelineDock() {
    if (!timelineDockController) return;

    const cfg = runtimeViewState.getConfig();
    const scene = animationScenes[cfg];
    const stepDurationMs = Math.max(
        1,
        Math.round(scene?.stepDurationInMilliSeconds || TC.ONE_MINUTE_MS),
    );
    const dockStartTime = Number.isFinite(startTime) ? startTime : 0;
    const rawDockEndTime = Number.isFinite(latestEndTime)
        ? latestEndTime - stepDurationMs
        : dockStartTime;
    const dockEndTime = Math.max(dockStartTime, rawDockEndTime);

    timelineDockController.setRange({
        startTimeMs: dockStartTime,
        endTimeMs: dockEndTime,
        stepMs: stepDurationMs,
    });
    timelineDockController.setCurrentTime(runtimeSessionState.getAnimTime());

    if (eventInfos !== lastTimelineEventsRef) {
        timelineDockController.setEvents(eventInfos || []);
        lastTimelineEventsRef = eventInfos;
    }

    const visibleCraftIds = getSceneVisibleCraftIds(scene, globalConfig);
    const activeCraftId = getSceneActiveCraftId(scene, globalConfig);
    timelineDockController.setCrafts(
        visibleCraftIds.map((bodyId) => {
            const craft = resolveMissionCraft(globalConfig, bodyId);
            return {
                id: bodyId,
                label:
                    craft?.viewLabel ||
                    craft?.name ||
                    craft?.mnemonic ||
                    craft?.id ||
                    bodyId,
                roleLabel: craft?.primary ? "Primary" : "Additional",
                color:
                    craft?.orbitcolor ||
                    craft?.color ||
                    null,
                active: bodyId === activeCraftId,
            };
        }),
    );
}

function syncActiveCraftControl() {
    const additionalCraftOption = document.getElementById("additional-crafts-option");
    const additionalCraftToggle = document.getElementById("view-additional-crafts");
    const descentOrbitOption = document.getElementById("orbit-descent-option");
    const row = document.getElementById("active-craft-row");
    const select = document.getElementById("active-craft-select");

    const missionCraftCount = Array.isArray(globalConfig?.crafts) ? globalConfig.crafts.length : 1;
    const hasAdditionalCrafts = missionCraftCount > 1;
    if (additionalCraftOption) {
        additionalCraftOption.classList.toggle("settings-option--hidden", !hasAdditionalCrafts);
    }
    if (!hasAdditionalCrafts && additionalCraftToggle) {
        additionalCraftToggle.checked = false;
    }

    const hasDescentOrbit = !!(globalConfig?.landing?.enabled);
    if (descentOrbitOption) {
        descentOrbitOption.classList.toggle("settings-option--hidden", !hasDescentOrbit);
    }

    if (!row || !select) return;

    if (!hasAdditionalCrafts) {
        row.classList.add("settings-row--hidden");
        select.innerHTML = "";
        return;
    }

    const cfg = runtimeViewState.getConfig();
    const scene = animationScenes[cfg];
    const visibleCraftIds = getSceneVisibleCraftIds(scene, globalConfig);
    const activeCraftId = getSceneActiveCraftId(scene, globalConfig);

    if (!Array.isArray(visibleCraftIds) || visibleCraftIds.length <= 1) {
        row.classList.add("settings-row--hidden");
        select.innerHTML = "";
        return;
    }

    row.classList.remove("settings-row--hidden");
    const optionSignature = visibleCraftIds
        .map((bodyId) => {
            const craft = resolveMissionCraft(globalConfig, bodyId);
            return `${bodyId}:${craft?.viewLabel || craft?.name || craft?.mnemonic || craft?.id || bodyId}`;
        })
        .join("|");
    if (select.dataset.optionSignature !== optionSignature) {
        select.innerHTML = "";
        for (const bodyId of visibleCraftIds) {
            const craft = resolveMissionCraft(globalConfig, bodyId);
            const option = document.createElement("option");
            option.value = bodyId;
            option.textContent =
                craft?.viewLabel ||
                craft?.name ||
                craft?.mnemonic ||
                craft?.id ||
                bodyId;
            select.appendChild(option);
        }
        select.dataset.optionSignature = optionSignature;
    }
    if (activeCraftId) {
        select.value = activeCraftId;
    }
}

const SPEED_RATE_LABELS = new Map([
    [60, "1 min/sec"],
    [300, "5 min/sec"],
    [900, "15 min/sec"],
    [1800, "30 min/sec"],
    [3600, "1 hr/sec"],
    [10800, "3 hr/sec"],
    [21600, "6 hr/sec"],
    [43200, "12 hr/sec"],
    [86400, "1 day/sec"],
]);

function formatSimRateLabel(multiplier, isRealtime) {
    if (isRealtime) return "1 sec/sec";
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0) return "1 min/sec";
    const rounded = Math.round(value);
    if (SPEED_RATE_LABELS.has(rounded)) return SPEED_RATE_LABELS.get(rounded);
    const minutesPerSecond = value / 60;
    if (minutesPerSecond >= 60) {
        const hoursPerSecond = minutesPerSecond / 60;
        if (hoursPerSecond >= 24) {
            return `${(hoursPerSecond / 24).toFixed(2).replace(/\.00$/, "")} day/sec`;
        }
        return `${hoursPerSecond.toFixed(2).replace(/\.00$/, "")} hr/sec`;
    }
    return `${minutesPerSecond.toFixed(2).replace(/\.00$/, "")} min/sec`;
}

function updateSpeedControlsUI(multiplier, isRealtime) {
    const slowerButton = document.getElementById("slower");
    const realtimeButton = document.getElementById("realtime");
    const fasterButton = document.getElementById("faster");
    const label = formatSimRateLabel(multiplier, isRealtime);
    const numericMultiplier = Number(multiplier || 0);
    const atMaxSpeed = !isRealtime && Math.abs(numericMultiplier - 86400) < 1e-3;

    if (realtimeButton) {
        realtimeButton.textContent = label;
        realtimeButton.title = isRealtime
            ? "Realtime active (1 sec/sec)."
            : `Current speed ${label}. Click to set realtime (1 sec/sec).`;
        realtimeButton.setAttribute(
            "aria-label",
            isRealtime
                ? "Realtime active (1 sec/sec)."
                : `Current speed ${label}. Click to set realtime (1 sec/sec).`,
        );
        realtimeButton.classList.toggle("down", !!isRealtime);
        realtimeButton.setAttribute("aria-pressed", isRealtime ? "true" : "false");
    }

    if (slowerButton) {
        slowerButton.disabled = !!isRealtime;
        slowerButton.setAttribute("aria-disabled", isRealtime ? "true" : "false");
    }

    if (fasterButton) {
        fasterButton.disabled = atMaxSpeed;
        fasterButton.setAttribute("aria-disabled", atMaxSpeed ? "true" : "false");
    }
}

function updateTransportControlsUI(isPlaying) {
    const transportCluster = document.querySelector(".controls-cluster--transport");
    if (!transportCluster) return;
    transportCluster.classList.toggle("is-playing", !!isPlaying);
}

// Animation Controller instance
// Callbacks sync global state and update UI for backward compatibility
var animationController = new AnimationController({
    onTimeChange: (time) => {
        runtimeSessionState.setAnimTime(time);
        bridgeActions.setLocation();    // Update scene positions
        syncTimelineDock();
        syncActiveCraftControl();
        eventBus.emit("animation:timeChanged", { time });
    },
    onPlayStateChange: (isPlaying) => {
        runtimeSessionState.setAnimationRunning(isPlaying);
        updateD3ElementText("#animate", isPlaying ? "Pause" : "Play");
        updateTransportControlsUI(isPlaying);
        setView?.();
        eventBus.emit(isPlaying ? "animation:play" : "animation:pause", { isPlaying });
    },
    onSpeedChange: (multiplier, isRealtime) => {
        updateSpeedControlsUI(multiplier, isRealtime);
        eventBus.emit("animation:speedChanged", { multiplier, isRealtime });
    }
});

window.addEventListener("load", function () {
    updateTransportControlsUI(animationController.getIsRunning());
    updateSpeedControlsUI(
        animationController.getSpeedMultiplier(),
        animationController.getIsRealtimeSpeed(),
    );
    const nowButton = document.getElementById("missionnow");
    if (nowButton && nowButton.dataset.bound !== "true") {
        nowButton.dataset.bound = "true";
        nowButton.addEventListener("click", function () {
            animationController.goToNow();
        });
    }
    ensureTimelineDockController();
    syncTimelineDock();
    syncActiveCraftControl();
});

var globalConfig = null; // Store loaded config from config.json

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
    getViewPolarAxes: () => runtimeViewState.getViewPolarAxes(),
    getViewPoles: () => runtimeViewState.getViewPoles(),
    getAnimTime: () => runtimeSessionState.getAnimTime(),
    getEarthRadius: () => earthRadius,
    getViewCraters: () => runtimeViewState.getViewCraters(),
    getRuntimeFlags: () => runtimeSessionState.getRuntimeFlags(),
    ensureSceneViewState: sceneViewStateActions.ensureSceneViewState,
    getBodyEphemerisState,
    getEphemerisSource: () => ephemerisSource,
    getViewSky: () => runtimeViewState.getViewSky(),
    getViewConstellationLines: () => runtimeViewState.getViewConstellationLines(),
    getViewMoonSOI: () => runtimeViewState.getViewMoonSOI(),
    getViewMoonHighlightRing: () => runtimeViewState.getViewMoonHighlightRing(),
    getViewMoonOsculatingOrbit: () => runtimeViewState.getViewMoonOsculatingOrbit(),
    getViewXYZAxes: () => runtimeViewState.getViewXYZAxes(),
    getViewAuxiliaryPanels: () => runtimeViewState.getViewAuxiliaryPanels(),
    getViewEclipticPlane: () => runtimeViewState.getViewEclipticPlane(),
    getViewEquatorialPlane: () => runtimeViewState.getViewEquatorialPlane(),
    getEventInfos: () => eventInfos,
});

function render() {
    if (!theSceneHandler) return;
    var animationScene = animationScenes[runtimeViewState.getConfig()];
    if (!animationScene) return;
    theSceneHandler.render(animationScene);
}

const bindStateCell = (get, set) => ({ get, set });
const bindReadonlyStateCell = (get) => ({ get, set: () => {} });

const missionStateCells = {
    globalConfig: bindStateCell(() => globalConfig, (value) => { globalConfig = value; }),
    config: bindStateCell(() => runtimeViewState.getConfig(), (value) => { runtimeViewState.setConfig(value); }),
    currentDimension: bindStateCell(
        () => runtimeViewState.getCurrentDimension(),
        (value) => { runtimeViewState.setCurrentDimension(value); },
    ),
    previousDimension: bindStateCell(
        () => runtimeViewState.getPreviousDimension(),
        (value) => { runtimeViewState.setPreviousDimension(value); },
    ),
    dimensionChanged: bindStateCell(
        () => runtimeViewState.getDimensionChanged(),
        (value) => { runtimeViewState.setDimensionChanged(value); },
    ),
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
    animTime: bindStateCell(
        () => runtimeSessionState.getAnimTime(),
        (value) => { runtimeSessionState.setAnimTime(value); },
    ),
    craftData: bindStateCell(() => craftData, (value) => { craftData = value; }),
    eventInfos: bindStateCell(() => eventInfos, (value) => { eventInfos = value; }),
    ephemerisSource: bindStateCell(() => ephemerisSource, (value) => { ephemerisSource = value; }),
    bodyEphemerisSources: bindStateCell(() => bodyEphemerisSources, (value) => { bodyEphemerisSources = value; }),
    timeTransLunarInjection: bindStateCell(() => timeTransLunarInjection, (value) => { timeTransLunarInjection = value; }),
    timeLunarOrbitInsertion: bindStateCell(() => timeLunarOrbitInsertion, (value) => { timeLunarOrbitInsertion = value; }),
    theSceneHandler: bindStateCell(() => theSceneHandler, (value) => { theSceneHandler = value; }),
    startLandingFlag: bindStateCell(
        () => runtimeInteractionState.getStartLandingFlag(),
        (value) => { runtimeInteractionState.setStartLandingFlag(value); },
    ),
    viewAuxiliaryPanels: bindStateCell(
        () => runtimeViewState.getViewAuxiliaryPanels(),
        (value) => { runtimeViewState.setViewAuxiliaryPanels(value); },
    ),
    viewOrbit: bindStateCell(() => runtimeViewState.getViewOrbit(), (value) => { runtimeViewState.setViewOrbit(value); }),
    viewOrbitDescent: bindStateCell(
        () => runtimeViewState.getViewOrbitDescent(),
        (value) => { runtimeViewState.setViewOrbitDescent(value); },
    ),
    viewCraters: bindStateCell(() => runtimeViewState.getViewCraters(), (value) => { runtimeViewState.setViewCraters(value); }),
    viewXYZAxes: bindStateCell(() => runtimeViewState.getViewXYZAxes(), (value) => { runtimeViewState.setViewXYZAxes(value); }),
    viewPoles: bindStateCell(() => runtimeViewState.getViewPoles(), (value) => { runtimeViewState.setViewPoles(value); }),
    viewPolarAxes: bindStateCell(
        () => runtimeViewState.getViewPolarAxes(),
        (value) => { runtimeViewState.setViewPolarAxes(value); },
    ),
    viewSky: bindStateCell(() => runtimeViewState.getViewSky(), (value) => { runtimeViewState.setViewSky(value); }),
    viewConstellationLines: bindStateCell(
        () => runtimeViewState.getViewConstellationLines(),
        (value) => { runtimeViewState.setViewConstellationLines(value); },
    ),
    viewMoonSOI: bindStateCell(() => runtimeViewState.getViewMoonSOI(), (value) => { runtimeViewState.setViewMoonSOI(value); }),
    viewMoonHighlightRing: bindStateCell(
        () => runtimeViewState.getViewMoonHighlightRing(),
        (value) => { runtimeViewState.setViewMoonHighlightRing(value); },
    ),
    viewMoonOsculatingOrbit: bindStateCell(
        () => runtimeViewState.getViewMoonOsculatingOrbit(),
        (value) => { runtimeViewState.setViewMoonOsculatingOrbit(value); },
    ),
    viewEclipticPlane: bindStateCell(
        () => runtimeViewState.getViewEclipticPlane(),
        (value) => { runtimeViewState.setViewEclipticPlane(value); },
    ),
    viewEquatorialPlane: bindStateCell(
        () => runtimeViewState.getViewEquatorialPlane(),
        (value) => { runtimeViewState.setViewEquatorialPlane(value); },
    ),
    viewFPS: bindStateCell(() => runtimeViewState.getViewFPS(), (value) => { runtimeViewState.setViewFPS(value); }),
    orbitStyle: bindStateCell(
        () => runtimeViewState.getOrbitStyle(),
        (value) => { runtimeViewState.setOrbitStyle(value); },
    ),
    effectiveOrbitStyle: bindReadonlyStateCell(() => getEffectiveOrbitStyle()),
    trailTrackBrightness2D: bindStateCell(
        () => runtimeViewState.getTrailTrackBrightness2D(),
        (value) => { runtimeViewState.setTrailTrackBrightness2D(value); },
    ),
    trailTrackBrightness3D: bindStateCell(
        () => runtimeViewState.getTrailTrackBrightness3D(),
        (value) => { runtimeViewState.setTrailTrackBrightness3D(value); },
    ),
    trailTailBrightness2D: bindStateCell(
        () => runtimeViewState.getTrailTailBrightness2D(),
        (value) => { runtimeViewState.setTrailTailBrightness2D(value); },
    ),
    trailTailBrightness3D: bindStateCell(
        () => runtimeViewState.getTrailTailBrightness3D(),
        (value) => { runtimeViewState.setTrailTailBrightness3D(value); },
    ),
    animDate: bindStateCell(() => animDate, (value) => { animDate = value; }),
    mousedownTimeout: bindStateCell(
        () => runtimeInteractionState.getMouseDownTimeout(),
        (value) => { runtimeInteractionState.setMouseDownTimeout(value); },
    ),
    timeoutHandleZoom: bindStateCell(
        () => runtimeInteractionState.getTimeoutHandleZoom(),
        (value) => { runtimeInteractionState.setTimeoutHandleZoom(value); },
    ),
    mouseDown: bindStateCell(
        () => runtimeInteractionState.getMouseDown(),
        (value) => { runtimeInteractionState.setMouseDown(value); },
    ),
    missionStartCalled: bindStateCell(
        () => runtimeInteractionState.getMissionStartCalled(),
        (value) => { runtimeInteractionState.setMissionStartCalled(value); },
    ),
    timeoutHandle: bindReadonlyStateCell(() => runtimeInteractionState.getLegacyTimeoutHandle()),
    animationRunning: bindReadonlyStateCell(() => runtimeSessionState.getAnimationRunning()),
    svgRect: bindStateCell(() => svgRect, (value) => { svgRect = value; }),
    sunLongitude: bindStateCell(() => sunLongitude, (value) => { sunLongitude = value; }),
    craftId: bindReadonlyStateCell(() => craftId),
};

const {
    initAnimation,
    processOrbitData,
    animateLoop,
    main,
} = createMissionRuntimeHandlersEntry({
    performanceRef: performance,
    requestAnimationFrameRef: requestAnimationFrame,
    startMissionApp,
    eventBus,
    toggleModeGuarded,
    toggleRelativeMode,
    getSetView: () => setView,
    getSetDimensionTop: () => setDimensionTop,
    getStartupAnimTimeOverride: () => initialMissionViewState.startupAnimTimeOverride,
    getMissionRuntimeWireup: () => missionRuntimeWireup,
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
});

({ missionRuntimeWireup } = createMissionRuntimeWireupEntry({
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
    processOrbitData,
    animateLoop,
    initAnimation,
    isRelativeMode,
    isTestMode,
}));

toggleMode = function (...args) {
    missionRuntimeWireup.toggleMode(...args);
    syncTimelineDock();
    syncActiveCraftControl();
};
setDimensionTop = function (...args) {
    missionRuntimeWireup.setDimensionTop(...args);
    syncTimelineDock();
    syncActiveCraftControl();
};
setView = function (...args) {
    missionRuntimeWireup.setView(...args);
    syncTimelineDock();
    syncActiveCraftControl();
};
export { main };

// Expose variables globally for testing
window.animationScenes = animationScenes;
window.AnimationScene = AnimationScene;

window.addEventListener('load', main);

// end of file
