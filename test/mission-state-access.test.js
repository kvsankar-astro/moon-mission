import { describe, expect, it } from "vitest";

import {
    createMissionLocalStateCells,
    createMissionStateCells,
} from "../src/platform/js/app/mission-state-access.js";

const LOCAL_WRITABLE_KEYS = [
    "globalConfig",
    "svgContainer",
    "dataLoaded",
    "svgX",
    "svgY",
    "svgWidth",
    "svgHeight",
    "offsetx",
    "offsety",
    "landingDataLoaded",
    "epochJD",
    "epochDate",
    "startTime",
    "endTime",
    "endTimeSC",
    "latestEndTime",
    "timelineTotalSteps",
    "ticksPerAnimationStep",
    "PIXELS_PER_AU",
    "defaultCameraDistance",
    "trackWidth",
    "earthRadius",
    "moonRadius",
    "startLandingTime",
    "endLandingTime",
    "craftData",
    "eventInfos",
    "ephemerisSource",
    "bodyEphemerisSources",
    "timeTransLunarInjection",
    "timeLunarOrbitInsertion",
    "theSceneHandler",
    "animDate",
    "svgRect",
    "sunLongitude",
];

const EXPECTED_STATE_KEYS = [
    "PIXELS_PER_AU",
    "animDate",
    "animTime",
    "animationRunning",
    "bodyEphemerisSources",
    "config",
    "craftData",
    "craftId",
    "currentDimension",
    "dataLoaded",
    "defaultCameraDistance",
    "dimensionChanged",
    "earthRadius",
    "effectiveOrbitStyle",
    "endLandingTime",
    "endTime",
    "endTimeSC",
    "epochDate",
    "epochJD",
    "ephemerisSource",
    "eventInfos",
    "frameMode",
    "globalConfig",
    "landingDataLoaded",
    "lunarCraterDisplayMode",
    "lunarCraterHoverLabels",
    "lunarCraterMaxDiameterKm",
    "lunarCraterMinDiameterKm",
    "lunarFeatureExcludedKeys",
    "lunarFeatureSearchQuery",
    "lunarFeatureTypeFilters",
    "lastInputActivityMs",
    "latestEndTime",
    "missionStartCalled",
    "moonRadius",
    "mouseDown",
    "mousedownTimeout",
    "offsetx",
    "offsety",
    "orbitStyle",
    "previousDimension",
    "startLandingFlag",
    "startLandingTime",
    "startTime",
    "sunLongitude",
    "svgContainer",
    "svgHeight",
    "svgRect",
    "svgWidth",
    "svgX",
    "svgY",
    "theSceneHandler",
    "ticksPerAnimationStep",
    "timeLunarOrbitInsertion",
    "timeTransLunarInjection",
    "timelineTotalSteps",
    "timeoutHandle",
    "timeoutHandleZoom",
    "trackWidth",
    "trailTailBrightness2D",
    "trailTailBrightness3D",
    "trailTrackBrightness2D",
    "trailTrackBrightness3D",
    "viewAuxiliaryPanels",
    "viewBodyHalos",
    "viewConstellationLines",
    "viewCraters",
    "viewEarthClouds",
    "viewEclipticPlane",
    "viewEquatorialPlane",
    "viewFPS",
    "viewLunarCraters",
    "viewMoonHillSphere",
    "viewMoonOsculatingOrbit",
    "viewMoonSOI",
    "viewOrbit",
    "viewOrbitDescent",
    "viewPhotoMode",
    "viewPolarAxes",
    "viewPoles",
    "viewSky",
    "viewXYZAxes",
];

function createRuntimeViewState(overrides = {}) {
    const state = {
        config: "geo",
        currentDimension: "3D",
        previousDimension: null,
        dimensionChanged: false,
        viewAuxiliaryPanels: true,
        viewOrbit: true,
        viewOrbitDescent: false,
        viewCraters: false,
        viewLunarCraters: false,
        lunarCraterHoverLabels: true,
        lunarCraterDisplayMode: "hover",
        lunarCraterMinDiameterKm: 80,
        lunarCraterMaxDiameterKm: 600,
        lunarFeatureTypeFilters: {},
        lunarFeatureSearchQuery: "",
        lunarFeatureExcludedKeys: [],
        viewXYZAxes: false,
        viewPoles: false,
        viewPolarAxes: false,
        viewSky: true,
        viewConstellationLines: false,
        viewMoonSOI: false,
        viewMoonHillSphere: false,
        viewBodyHalos: true,
        viewEarthClouds: true,
        viewPhotoMode: false,
        viewMoonOsculatingOrbit: false,
        viewEclipticPlane: false,
        viewEquatorialPlane: false,
        viewFPS: false,
        orbitStyle: "trail",
        trailTrackBrightness2D: 1,
        trailTrackBrightness3D: 1,
        trailTailBrightness2D: 1,
        trailTailBrightness3D: 1,
        ...overrides,
    };

    return {
        state,
        runtimeViewState: {
            getConfig: () => state.config,
            setConfig: (value) => { state.config = value; },
            getCurrentDimension: () => state.currentDimension,
            setCurrentDimension: (value) => { state.currentDimension = value; },
            getPreviousDimension: () => state.previousDimension,
            setPreviousDimension: (value) => { state.previousDimension = value; },
            getDimensionChanged: () => state.dimensionChanged,
            setDimensionChanged: (value) => { state.dimensionChanged = value; },
            getViewAuxiliaryPanels: () => state.viewAuxiliaryPanels,
            setViewAuxiliaryPanels: (value) => { state.viewAuxiliaryPanels = value; },
            getViewOrbit: () => state.viewOrbit,
            setViewOrbit: (value) => { state.viewOrbit = value; },
            getViewOrbitDescent: () => state.viewOrbitDescent,
            setViewOrbitDescent: (value) => { state.viewOrbitDescent = value; },
            getViewCraters: () => state.viewCraters,
            setViewCraters: (value) => { state.viewCraters = value; },
            getViewLunarCraters: () => state.viewLunarCraters,
            setViewLunarCraters: (value) => { state.viewLunarCraters = value; },
            getLunarCraterHoverLabels: () => state.lunarCraterHoverLabels,
            setLunarCraterHoverLabels: (value) => { state.lunarCraterHoverLabels = value; },
            getLunarCraterDisplayMode: () => state.lunarCraterDisplayMode,
            setLunarCraterDisplayMode: (value) => { state.lunarCraterDisplayMode = value; },
            getLunarCraterMinDiameterKm: () => state.lunarCraterMinDiameterKm,
            setLunarCraterMinDiameterKm: (value) => { state.lunarCraterMinDiameterKm = value; },
            getLunarCraterMaxDiameterKm: () => state.lunarCraterMaxDiameterKm,
            setLunarCraterMaxDiameterKm: (value) => { state.lunarCraterMaxDiameterKm = value; },
            getLunarFeatureTypeFilters: () => state.lunarFeatureTypeFilters,
            setLunarFeatureTypeFilters: (value) => { state.lunarFeatureTypeFilters = value; },
            getLunarFeatureSearchQuery: () => state.lunarFeatureSearchQuery,
            setLunarFeatureSearchQuery: (value) => { state.lunarFeatureSearchQuery = value; },
            getLunarFeatureExcludedKeys: () => state.lunarFeatureExcludedKeys,
            setLunarFeatureExcludedKeys: (value) => { state.lunarFeatureExcludedKeys = value; },
            getViewXYZAxes: () => state.viewXYZAxes,
            setViewXYZAxes: (value) => { state.viewXYZAxes = value; },
            getViewPoles: () => state.viewPoles,
            setViewPoles: (value) => { state.viewPoles = value; },
            getViewPolarAxes: () => state.viewPolarAxes,
            setViewPolarAxes: (value) => { state.viewPolarAxes = value; },
            getViewSky: () => state.viewSky,
            setViewSky: (value) => { state.viewSky = value; },
            getViewConstellationLines: () => state.viewConstellationLines,
            setViewConstellationLines: (value) => { state.viewConstellationLines = value; },
            getViewMoonSOI: () => state.viewMoonSOI,
            setViewMoonSOI: (value) => { state.viewMoonSOI = value; },
            getViewMoonHillSphere: () => state.viewMoonHillSphere,
            setViewMoonHillSphere: (value) => { state.viewMoonHillSphere = value; },
            getViewBodyHalos: () => state.viewBodyHalos,
            setViewBodyHalos: (value) => { state.viewBodyHalos = value; },
            getViewEarthClouds: () => state.viewEarthClouds,
            setViewEarthClouds: (value) => { state.viewEarthClouds = value; },
            getViewPhotoMode: () => state.viewPhotoMode,
            setViewPhotoMode: (value) => { state.viewPhotoMode = value; },
            getViewMoonOsculatingOrbit: () => state.viewMoonOsculatingOrbit,
            setViewMoonOsculatingOrbit: (value) => { state.viewMoonOsculatingOrbit = value; },
            getViewEclipticPlane: () => state.viewEclipticPlane,
            setViewEclipticPlane: (value) => { state.viewEclipticPlane = value; },
            getViewEquatorialPlane: () => state.viewEquatorialPlane,
            setViewEquatorialPlane: (value) => { state.viewEquatorialPlane = value; },
            getViewFPS: () => state.viewFPS,
            setViewFPS: (value) => { state.viewFPS = value; },
            getOrbitStyle: () => state.orbitStyle,
            setOrbitStyle: (value) => { state.orbitStyle = value; },
            getTrailTrackBrightness2D: () => state.trailTrackBrightness2D,
            setTrailTrackBrightness2D: (value) => { state.trailTrackBrightness2D = value; },
            getTrailTrackBrightness3D: () => state.trailTrackBrightness3D,
            setTrailTrackBrightness3D: (value) => { state.trailTrackBrightness3D = value; },
            getTrailTailBrightness2D: () => state.trailTailBrightness2D,
            setTrailTailBrightness2D: (value) => { state.trailTailBrightness2D = value; },
            getTrailTailBrightness3D: () => state.trailTailBrightness3D,
            setTrailTailBrightness3D: (value) => { state.trailTailBrightness3D = value; },
        },
    };
}

function createRuntimeSessionState(overrides = {}) {
    const state = {
        animTime: 1000,
        animationRunning: false,
        ...overrides,
    };

    return {
        state,
        runtimeSessionState: {
            getAnimTime: () => state.animTime,
            setAnimTime: (value) => { state.animTime = value; },
            getAnimationRunning: () => state.animationRunning,
        },
    };
}

function createRuntimeInteractionState(overrides = {}) {
    const state = {
        startLandingFlag: false,
        mousedownTimeout: 25,
        timeoutHandleZoom: null,
        mouseDown: false,
        missionStartCalled: false,
        legacyTimeoutHandle: 99,
        lastInputActivityMs: -Infinity,
        ...overrides,
    };

    return {
        state,
        runtimeInteractionState: {
            getStartLandingFlag: () => state.startLandingFlag,
            setStartLandingFlag: (value) => { state.startLandingFlag = value; },
            getMouseDownTimeout: () => state.mousedownTimeout,
            setMouseDownTimeout: (value) => { state.mousedownTimeout = value; },
            getTimeoutHandleZoom: () => state.timeoutHandleZoom,
            setTimeoutHandleZoom: (value) => { state.timeoutHandleZoom = value; },
            getMouseDown: () => state.mouseDown,
            setMouseDown: (value) => { state.mouseDown = value; },
            getMissionStartCalled: () => state.missionStartCalled,
            setMissionStartCalled: (value) => { state.missionStartCalled = value; },
            getLegacyTimeoutHandle: () => state.legacyTimeoutHandle,
            markInputActivity: (value) => { state.lastInputActivityMs = value; },
            getLastInputActivityMs: () => state.lastInputActivityMs,
        },
    };
}

function createLocalState() {
    return {
        globalConfig: { mission: "cy3" },
        svgContainer: null,
        dataLoaded: false,
        svgX: 0,
        svgY: 0,
        svgWidth: 800,
        svgHeight: 600,
        offsetx: 0,
        offsety: 0,
        landingDataLoaded: false,
        epochJD: 2460000,
        epochDate: new Date("2023-07-14T00:00:00Z"),
        startTime: 10,
        endTime: 20,
        endTimeSC: 30,
        latestEndTime: 40,
        timelineTotalSteps: 50,
        ticksPerAnimationStep: 60,
        PIXELS_PER_AU: 100,
        defaultCameraDistance: 500,
        trackWidth: 2,
        earthRadius: 6371,
        moonRadius: 1737,
        startLandingTime: 70,
        endLandingTime: 80,
        craftData: { craft: true },
        eventInfos: [{ key: "burn-a" }],
        ephemerisSource: "chebyshev",
        bodyEphemerisSources: { SC: "npz" },
        timeTransLunarInjection: 90,
        timeLunarOrbitInsertion: 100,
        theSceneHandler: { render: true },
        animDate: new Date("2023-07-15T00:00:00Z"),
        svgRect: { width: 800 },
        sunLongitude: 180,
        frameMode: "inertial",
        craftId: "SC",
    };
}

function createLocalStateCells(localState) {
    return createMissionLocalStateCells({
        mutableStateAccessors: Object.fromEntries(
            LOCAL_WRITABLE_KEYS.map((key) => [
                key,
                [
                    () => localState[key],
                    (value) => { localState[key] = value; },
                ],
            ]),
        ),
        readonlyStateAccessors: {
            frameMode: () => localState.frameMode,
            craftId: () => localState.craftId,
        },
    });
}

describe("mission state access", () => {
    it("builds the full mission state cell contract with local, runtime, and derived cells", () => {
        const localState = createLocalState();
        const { state: viewState, runtimeViewState } = createRuntimeViewState();
        const { state: sessionState, runtimeSessionState } = createRuntimeSessionState();
        const { state: interactionState, runtimeInteractionState } = createRuntimeInteractionState();
        let effectiveOrbitStyle = "trail";

        const cells = createMissionStateCells({
            localStateCells: createLocalStateCells(localState),
            runtimeViewState,
            runtimeSessionState,
            runtimeInteractionState,
            getEffectiveOrbitStyle: () => effectiveOrbitStyle,
        });

        expect(Object.keys(cells).sort()).toEqual([...EXPECTED_STATE_KEYS].sort());

        expect(cells.globalConfig.get()).toEqual({ mission: "cy3" });
        cells.globalConfig.set({ mission: "apollo11" });
        expect(localState.globalConfig).toEqual({ mission: "apollo11" });

        expect(cells.config.get()).toBe("geo");
        cells.config.set("lunar");
        expect(viewState.config).toBe("lunar");

        expect(cells.animTime.get()).toBe(1000);
        cells.animTime.set(4321);
        expect(sessionState.animTime).toBe(4321);

        expect(cells.startLandingFlag.get()).toBe(false);
        cells.startLandingFlag.set(true);
        expect(interactionState.startLandingFlag).toBe(true);

        cells.trailTrackBrightness3D.set(0.4);
        expect(viewState.trailTrackBrightness3D).toBe(0.4);

        expect(cells.effectiveOrbitStyle.get()).toBe("trail");
        effectiveOrbitStyle = "classic";
        expect(cells.effectiveOrbitStyle.get()).toBe("classic");
    });

    it("keeps readonly cells non-mutating while writable cells still update their sources", () => {
        const localState = createLocalState();
        const { state: viewState, runtimeViewState } = createRuntimeViewState();
        const { state: sessionState, runtimeSessionState } = createRuntimeSessionState({
            animationRunning: true,
        });
        const { state: interactionState, runtimeInteractionState } = createRuntimeInteractionState({
            legacyTimeoutHandle: 123,
        });

        const cells = createMissionStateCells({
            localStateCells: createLocalStateCells(localState),
            runtimeViewState,
            runtimeSessionState,
            runtimeInteractionState,
            getEffectiveOrbitStyle: () => "trail",
        });

        cells.frameMode.set("relative");
        cells.craftId.set("LM");
        cells.timeoutHandle.set(456);
        cells.animationRunning.set(false);

        expect(localState.frameMode).toBe("inertial");
        expect(localState.craftId).toBe("SC");
        expect(interactionState.legacyTimeoutHandle).toBe(123);
        expect(sessionState.animationRunning).toBe(true);

        cells.viewOrbit.set(false);
        cells.mouseDown.set(true);
        cells.sunLongitude.set(270);

        expect(viewState.viewOrbit).toBe(false);
        expect(interactionState.mouseDown).toBe(true);
        expect(localState.sunLongitude).toBe(270);
    });

    it("builds local mission state cells from mutable and readonly accessor buckets", () => {
        const localState = createLocalState();
        const cells = createMissionLocalStateCells({
            mutableStateAccessors: {
                globalConfig: [
                    () => localState.globalConfig,
                    (value) => { localState.globalConfig = value; },
                ],
                sunLongitude: [
                    () => localState.sunLongitude,
                    (value) => { localState.sunLongitude = value; },
                ],
            },
            readonlyStateAccessors: {
                frameMode: () => localState.frameMode,
            },
        });

        expect(cells.globalConfig.get()).toEqual({ mission: "cy3" });
        cells.globalConfig.set({ mission: "apollo17" });
        expect(localState.globalConfig).toEqual({ mission: "apollo17" });

        expect(cells.sunLongitude.get()).toBe(180);
        cells.sunLongitude.set(42);
        expect(localState.sunLongitude).toBe(42);

        expect(cells.frameMode.get()).toBe("inertial");
        cells.frameMode.set("relative");
        expect(localState.frameMode).toBe("inertial");
    });
});
