import { describe, expect, it } from "vitest";

import {
    createMissionLegacyMutableBindings,
    createMissionLegacyReadonlyBindings,
    createMissionLegacyStateBindings,
} from "../src/platform/js/app/mission-legacy-state-bindings.js";

function createOptions() {
    const state = {
        globalConfig: { mission: "cy3" },
        svgContainer: { id: "svg" },
        dataLoaded: false,
        svgX: 1,
        svgY: 2,
        svgWidth: 3,
        svgHeight: 4,
        offsetx: 5,
        offsety: 6,
        landingDataLoaded: false,
        epochJD: 7,
        epochDate: 8,
        startTime: 9,
        endTime: 10,
        endTimeSC: 11,
        latestEndTime: 12,
        timelineTotalSteps: 13,
        ticksPerAnimationStep: 14,
        PIXELS_PER_AU: 15,
        defaultCameraDistance: 16,
        trackWidth: 17,
        earthRadius: 18,
        moonRadius: 19,
        startLandingTime: 20,
        endLandingTime: 21,
        craftData: { craft: true },
        eventInfos: [{ key: "burn-a" }],
        ephemerisSource: "chebyshev",
        bodyEphemerisSources: { SC: "npz" },
        timeTransLunarInjection: 22,
        timeLunarOrbitInsertion: 23,
        theSceneHandler: { render: true },
        animDate: 24,
        svgRect: { width: 25 },
        sunLongitude: 26,
        frameMode: "inertial",
        craftId: "SC",
    };

    return {
        state,
        options: {
            getGlobalConfig: () => state.globalConfig,
            setGlobalConfig: (value) => { state.globalConfig = value; },
            getSvgContainer: () => state.svgContainer,
            setSvgContainer: (value) => { state.svgContainer = value; },
            getDataLoaded: () => state.dataLoaded,
            setDataLoaded: (value) => { state.dataLoaded = value; },
            getSvgX: () => state.svgX,
            setSvgX: (value) => { state.svgX = value; },
            getSvgY: () => state.svgY,
            setSvgY: (value) => { state.svgY = value; },
            getSvgWidth: () => state.svgWidth,
            setSvgWidth: (value) => { state.svgWidth = value; },
            getSvgHeight: () => state.svgHeight,
            setSvgHeight: (value) => { state.svgHeight = value; },
            getOffsetX: () => state.offsetx,
            setOffsetX: (value) => { state.offsetx = value; },
            getOffsetY: () => state.offsety,
            setOffsetY: (value) => { state.offsety = value; },
            getLandingDataLoaded: () => state.landingDataLoaded,
            setLandingDataLoaded: (value) => { state.landingDataLoaded = value; },
            getEpochJD: () => state.epochJD,
            setEpochJD: (value) => { state.epochJD = value; },
            getEpochDate: () => state.epochDate,
            setEpochDate: (value) => { state.epochDate = value; },
            getStartTime: () => state.startTime,
            setStartTime: (value) => { state.startTime = value; },
            getEndTime: () => state.endTime,
            setEndTime: (value) => { state.endTime = value; },
            getEndTimeSC: () => state.endTimeSC,
            setEndTimeSC: (value) => { state.endTimeSC = value; },
            getLatestEndTime: () => state.latestEndTime,
            setLatestEndTime: (value) => { state.latestEndTime = value; },
            getTimelineTotalSteps: () => state.timelineTotalSteps,
            setTimelineTotalSteps: (value) => { state.timelineTotalSteps = value; },
            getTicksPerAnimationStep: () => state.ticksPerAnimationStep,
            setTicksPerAnimationStep: (value) => { state.ticksPerAnimationStep = value; },
            getPixelsPerAU: () => state.PIXELS_PER_AU,
            setPixelsPerAU: (value) => { state.PIXELS_PER_AU = value; },
            getDefaultCameraDistance: () => state.defaultCameraDistance,
            setDefaultCameraDistance: (value) => { state.defaultCameraDistance = value; },
            getTrackWidth: () => state.trackWidth,
            setTrackWidth: (value) => { state.trackWidth = value; },
            getEarthRadius: () => state.earthRadius,
            setEarthRadius: (value) => { state.earthRadius = value; },
            getMoonRadius: () => state.moonRadius,
            setMoonRadius: (value) => { state.moonRadius = value; },
            getStartLandingTime: () => state.startLandingTime,
            setStartLandingTime: (value) => { state.startLandingTime = value; },
            getEndLandingTime: () => state.endLandingTime,
            setEndLandingTime: (value) => { state.endLandingTime = value; },
            getCraftData: () => state.craftData,
            setCraftData: (value) => { state.craftData = value; },
            getEventInfos: () => state.eventInfos,
            setEventInfos: (value) => { state.eventInfos = value; },
            getEphemerisSource: () => state.ephemerisSource,
            setEphemerisSource: (value) => { state.ephemerisSource = value; },
            getBodyEphemerisSources: () => state.bodyEphemerisSources,
            setBodyEphemerisSources: (value) => { state.bodyEphemerisSources = value; },
            getTimeTransLunarInjection: () => state.timeTransLunarInjection,
            setTimeTransLunarInjection: (value) => { state.timeTransLunarInjection = value; },
            getTimeLunarOrbitInsertion: () => state.timeLunarOrbitInsertion,
            setTimeLunarOrbitInsertion: (value) => { state.timeLunarOrbitInsertion = value; },
            getSceneHandler: () => state.theSceneHandler,
            setSceneHandler: (value) => { state.theSceneHandler = value; },
            getAnimDate: () => state.animDate,
            setAnimDate: (value) => { state.animDate = value; },
            getSvgRect: () => state.svgRect,
            setSvgRect: (value) => { state.svgRect = value; },
            getSunLongitude: () => state.sunLongitude,
            setSunLongitude: (value) => { state.sunLongitude = value; },
            getFrameMode: () => state.frameMode,
            getCraftId: () => state.craftId,
        },
    };
}

describe("mission legacy state bindings", () => {
    it("builds mutable bindings that preserve the legacy key contract", () => {
        const { state, options } = createOptions();

        const bindings = createMissionLegacyMutableBindings(options);

        expect(Object.keys(bindings)).toContain("globalConfig");
        expect(Object.keys(bindings)).toContain("svgContainer");
        expect(Object.keys(bindings)).toContain("sunLongitude");
        expect(bindings.ephemerisSource.get()).toBe("chebyshev");

        bindings.ephemerisSource.set("npz");
        bindings.sunLongitude.set(42);

        expect(state.ephemerisSource).toBe("npz");
        expect(state.sunLongitude).toBe(42);
    });

    it("builds readonly bindings for frame mode and craft id", () => {
        const { options } = createOptions();

        const bindings = createMissionLegacyReadonlyBindings(options);

        expect(bindings.frameMode()).toBe("inertial");
        expect(bindings.craftId()).toBe("SC");
    });

    it("returns mutable and readonly binding buckets together", () => {
        const { options } = createOptions();

        const result = createMissionLegacyStateBindings(options);

        expect(result.localStateBindings.globalConfig.get()).toEqual({ mission: "cy3" });
        expect(result.readonlyStateBindings.frameMode()).toBe("inertial");
        expect(result.readonlyStateBindings.craftId()).toBe("SC");
    });
});
