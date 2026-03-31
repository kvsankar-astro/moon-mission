import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/platform/js/data/ephemeris-provider.js", () => ({
    getBodyEphemerisState: vi.fn(),
}));

vi.mock("../src/platform/js/data/relative-frame-provider.js", () => ({
    getRelativeFrameQuaternion: vi.fn(),
}));

import { getBodyEphemerisState } from "../src/platform/js/data/ephemeris-provider.js";
import { getRelativeFrameQuaternion } from "../src/platform/js/data/relative-frame-provider.js";
import { computeBodyState, computeSceneState } from "../src/platform/js/scene-state.js";

function createData(overrides = {}) {
    return {
        chebyshevData: {},
        chebyshevDataLoaded: {},
        npzData: {},
        npzDataLoaded: {},
        landingNpzData: null,
        landingNpzLoaded: false,
        landingChebyshevData: null,
        landingChebyshevLoaded: false,
        globalConfig: { spacecraft_mnemonic: "SC", landing: { enabled: false } },
        startLandingTime: Number.NEGATIVE_INFINITY,
        endLandingTime: Number.POSITIVE_INFINITY,
        frameMode: "inertial",
        ephemerisSource: "chebyshev",
        bodySources: {},
        ...overrides,
    };
}

function createSceneOptions(overrides = {}) {
    return {
        sunLongitude: 0,
        chebyshevData: {},
        chebyshevDataLoaded: {},
        npzData: {},
        npzDataLoaded: {},
        landingNpzData: null,
        landingNpzLoaded: false,
        landingChebyshevData: null,
        landingChebyshevLoaded: false,
        globalConfig: { spacecraft_mnemonic: "SC", landing: { enabled: false }, is_lunar: false },
        startLandingTime: Number.NEGATIVE_INFINITY,
        endLandingTime: Number.POSITIVE_INFINITY,
        eventInfos: [],
        missionTimes: {
            timeTransLunarInjection: Number.POSITIVE_INFINITY,
            timeLunarOrbitInsertion: Number.POSITIVE_INFINITY,
        },
        planetsForLocations: ["SC"],
        frameMode: "inertial",
        ephemerisSource: "chebyshev",
        bodySources: {},
        ...overrides,
    };
}

describe("computeBodyState", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRelativeFrameQuaternion.mockReturnValue(null);
    });

    it("skips next-state ephemeris lookup when includeNextState is false", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 2, z: 3 },
            velocity: { vx: 4, vy: 5, vz: 6 },
            available: true,
        });

        const state = computeBodyState(
            "SC",
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createData({ includeNextState: false }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(1);
        expect(state.available).toBe(true);
        expect(state.nextPosition).toEqual(state.position);
        expect(state.nextVelocity).toEqual(state.velocity);
    });

    it("keeps next-state lookup enabled by default", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 2, z: 3 },
            velocity: { vx: 4, vy: 5, vz: 6 },
            available: true,
        });

        const state = computeBodyState(
            "SC",
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createData(),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(2);
        expect(state.available).toBe(true);
        expect(state.nextPosition).toEqual({ x: 1, y: 2, z: 3 });
        expect(state.nextVelocity).toEqual({ vx: 4, vy: 5, vz: 6 });
    });

    it("reuses precomputed Moon ephemeris when provided", () => {
        const state = computeBodyState(
            "MOON",
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createData({
                frameMode: "relative",
                precomputedBodyEphemeris: {
                    MOON: {
                        position: { x: 3, y: 4, z: 0 },
                        velocity: { vx: 6, vy: 8, vz: 0 },
                        available: true,
                    },
                },
            }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(0);
        expect(state.available).toBe(true);
        expect(state.position).toEqual({ x: 5, y: 0, z: 0 });
        expect(state.velocity).toEqual({ vx: 10, vy: 0, vz: 0 });
    });
});

describe("computeSceneState", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRelativeFrameQuaternion.mockReturnValue(null);
    });

    it("forwards includeNextState to spacecraft state computation", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 2, z: 3 },
            velocity: { vx: 4, vy: 5, vz: 6 },
            available: true,
        });

        computeSceneState(
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createSceneOptions({ includeNextState: false }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(1);
    });

    it("reuses relative-frame Moon state instead of querying Moon twice", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 0, z: 0 },
            velocity: { vx: 0, vy: 1, vz: 0 },
            available: true,
        });

        computeSceneState(
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createSceneOptions({
                includeNextState: false,
                frameMode: "relative",
                planetsForLocations: ["SC", "MOON"],
            }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(2);
        expect(
            getBodyEphemerisState.mock.calls.filter(([args]) => args.bodyId === "MOON"),
        ).toHaveLength(1);
    });

    it("skips Moon basis lookup when relative chebyshev data is already precomputed", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 0, z: 0 },
            velocity: { vx: 0, vy: 1, vz: 0 },
            available: true,
        });
        getRelativeFrameQuaternion.mockReturnValue({
            w: 1,
            x: 0,
            y: 0,
            z: 0,
        });

        computeSceneState(
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createSceneOptions({
                includeNextState: false,
                frameMode: "relative",
                planetsForLocations: ["SC"],
                chebyshevData: {
                    geo: {
                        metadata: { mode: "relative" },
                    },
                },
            }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(1);
        expect(
            getBodyEphemerisState.mock.calls.filter(([args]) => args.bodyId === "MOON"),
        ).toHaveLength(0);
        expect(getRelativeFrameQuaternion).toHaveBeenCalledTimes(1);
    });

    it("rotates sun direction with precomputed relative frame data", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 0, z: 0 },
            velocity: { vx: 0, vy: 1, vz: 0 },
            available: true,
        });
        getRelativeFrameQuaternion.mockReturnValue({
            w: Math.SQRT1_2,
            x: 0,
            y: 0,
            z: Math.SQRT1_2,
        });

        const sceneState = computeSceneState(
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createSceneOptions({
                includeNextState: false,
                frameMode: "relative",
                planetsForLocations: ["SC"],
                sunLongitude: 0,
                chebyshevData: {
                    geo: {
                        metadata: { mode: "relative" },
                    },
                },
            }),
        );

        expect(sceneState.sunDirection.x).toBeCloseTo(0, 12);
        expect(sceneState.sunDirection.y).toBeCloseTo(1, 12);
        expect(sceneState.sunDirection.z).toBeCloseTo(0, 12);
    });

    it("does not rotate sun direction again when relative sun data is already in frame", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 0, z: 0 },
            velocity: { vx: 0, vy: 1, vz: 0 },
            available: true,
        });
        getRelativeFrameQuaternion.mockReturnValue({
            w: Math.SQRT1_2,
            x: 0,
            y: 0,
            z: Math.SQRT1_2,
        });

        const sceneState = computeSceneState(
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createSceneOptions({
                includeNextState: false,
                frameMode: "relative",
                planetsForLocations: ["SC"],
                sunLongitude: 0,
                chebyshevData: {
                    geo: {
                        metadata: { mode: "relative", sun_frame: "relative" },
                    },
                },
            }),
        );

        expect(sceneState.sunDirection.x).toBeCloseTo(1, 12);
        expect(sceneState.sunDirection.y).toBeCloseTo(0, 12);
        expect(sceneState.sunDirection.z).toBeCloseTo(0, 12);
    });
});
