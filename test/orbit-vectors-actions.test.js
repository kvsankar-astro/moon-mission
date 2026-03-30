import { describe, expect, it, vi } from "vitest";

import { createOrbitVectorsActions } from "../src/platform/js/app/orbit-vectors-actions.js";

function createChain() {
    return {
        append() {
            return this;
        },
        attr() {
            return this;
        },
        style() {
            return this;
        },
        text() {
            return this;
        },
        select() {
            return this;
        },
    };
}

function createLineBuilder() {
    const line = () => "M0,0";
    line.x = () => line;
    line.y = () => line;
    line.interpolate = () => line;
    return line;
}

function createActionsHarness() {
    const svgContainer = createChain();
    const state = {
        startTimeMs: 0,
        endTimeMs: 60000,
        source: "chebyshev",
    };
    const scene = {
        planetsForLocations: ["SC"],
        stepDurationInMilliSeconds: 60000,
        primaryBody: "EARTH",
        primaryBodyRadius: 1,
    };

    const generateBodyCurve = vi.fn(() => [
        { x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0, timeMs: 0 },
        { x: 2, y: 3, z: 4, vx: 0, vy: 0, vz: 0, timeMs: 60000 },
    ]);

    const actions = createOrbitVectorsActions({
        d3: {
            svg: {
                line: createLineBuilder,
            },
            select: () => createChain(),
        },
        sleep: async () => {},
        getSvgContainer: () => svgContainer,
        getCurrentDimension: () => "2D",
        getConfig: () => "geo",
        animationScenes: {
            geo: scene,
        },
        planetProperties: {
            SC: { orbitcolor: "#fff", r: 1, color: "#fff", name: "SC" },
            EARTH: { color: "#00f", name: "Earth" },
        },
        shouldDrawOrbit: () => true,
        chebyshevDataLoaded: {},
        chebyshevData: {},
        npzData: {},
        npzDataLoaded: {},
        getEphemerisSource: () => state.source,
        resolveBodySource: () => state.source,
        generateBodyCurve,
        getStartTime: () => state.startTimeMs,
        getLatestEndTime: () => state.endTimeMs,
        getZoomFactor: () => 1,
        getPlaneVariables: () => ({
            xFactor: 1,
            yFactor: 1,
            xVariable: "x",
            yVariable: "y",
        }),
        planetStartTime: () => 0,
        PC: { KM_PER_AU: 1 },
        UC: {
            CENTER_LABEL_OFFSET_X: 0,
            CENTER_LABEL_OFFSET_Y: 0,
        },
        getPixelsPerAU: () => 1,
        getEpochJD: () => 2451545,
        getEpochDate: () => new Date("2000-01-01T12:00:00Z"),
        setEpochDisplay: () => {},
    });

    return { actions, state, scene, generateBodyCurve };
}

describe("createOrbitVectorsActions", () => {
    it("reuses generated body curves when source and time range are unchanged", async () => {
        const { actions, generateBodyCurve } = createActionsHarness();

        await actions.processOrbitVectorsData();
        await actions.processOrbitVectorsData();

        expect(generateBodyCurve).toHaveBeenCalledTimes(1);
    });

    it("invalidates cached curves when the time range changes", async () => {
        const { actions, state, generateBodyCurve } = createActionsHarness();

        await actions.processOrbitVectorsData();
        state.endTimeMs = 120000;
        await actions.processOrbitVectorsData();

        expect(generateBodyCurve).toHaveBeenCalledTimes(2);
    });

    it("stores orbit svg points and times for dormant trail rendering", async () => {
        const { actions, scene } = createActionsHarness();

        await actions.processOrbitVectorsData();

        expect(scene.orbitSvgPointsByBodyId.SC).toEqual([
            { x: 1, y: -2 },
            { x: 2, y: -3 },
        ]);
        expect(scene.orbitTimesByBodyId.SC).toEqual([0, 60000]);
    });
});
