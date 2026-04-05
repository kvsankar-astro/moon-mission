import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/platform/js/data/ephemeris-provider.js", () => ({
    getBodyEphemerisState: vi.fn(),
}));

vi.mock("../src/platform/js/data/relative-frame-provider.js", () => ({
    getRelativeFrameQuaternion: vi.fn(),
}));

import { getBodyEphemerisState } from "../src/platform/js/data/ephemeris-provider.js";
import { getRelativeFrameQuaternion } from "../src/platform/js/data/relative-frame-provider.js";
import { computeBodyState, computeSceneState, findActiveEvent } from "../src/platform/js/scene-state.js";

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

    it("computes telemetry for non-SC primary craft IDs", () => {
        getBodyEphemerisState.mockImplementation(({ bodyId }) => {
            if (bodyId === "CH3L") {
                return {
                    position: { x: 1000, y: 0, z: 0 },
                    velocity: { vx: 0, vy: 2, vz: 0 },
                    available: true,
                };
            }
            if (bodyId === "MOON") {
                return {
                    position: { x: 2000, y: 0, z: 0 },
                    velocity: { vx: 0, vy: 1, vz: 0 },
                    available: true,
                };
            }
            return {
                position: { x: 0, y: 0, z: 0 },
                velocity: { vx: 0, vy: 0, vz: 0 },
                available: false,
            };
        });

        const sceneState = computeSceneState(
            Date.parse("2023-08-23T12:20:00Z"),
            "geo",
            createSceneOptions({
                includeNextState: false,
                globalConfig: {
                    spacecraft_mnemonic: "CH3L",
                    primaryCraftId: "CH3L",
                    landing: { enabled: false },
                    is_lunar: true,
                    crafts: [
                        { id: "CH3L", mnemonic: "CH3L", primary: true },
                        { id: "CH3O", mnemonic: "CH3O", primary: false },
                    ],
                },
                planetsForLocations: ["MOON", "CH3L"],
                eventInfos: [],
            }),
        );

        expect(sceneState.telemetryBodyId).toBe("CH3L");
        expect(sceneState.telemetry).toBeTruthy();
        expect(sceneState.telemetry.distancePrimary).toBeCloseTo(1000, 6);
        expect(sceneState.telemetry.velocityPrimary).toBeCloseTo(2, 6);
        expect(sceneState.telemetry.distanceMoon).toBeCloseTo(1000, 6);
    });

    it("matches active burn events for non-SC craft bodies", () => {
        getBodyEphemerisState.mockImplementation(({ bodyId }) => {
            if (bodyId === "CH3L") {
                return {
                    position: { x: 1000, y: 0, z: 0 },
                    velocity: { vx: 0, vy: 2, vz: 0 },
                    available: true,
                };
            }
            if (bodyId === "MOON") {
                return {
                    position: { x: 2000, y: 0, z: 0 },
                    velocity: { vx: 0, vy: 1, vz: 0 },
                    available: true,
                };
            }
            return {
                position: { x: 0, y: 0, z: 0 },
                velocity: { vx: 0, vy: 0, vz: 0 },
                available: false,
            };
        });

        const burnTime = new Date("2023-08-23T12:20:00Z");
        const sceneState = computeSceneState(
            burnTime.getTime(),
            "geo",
            createSceneOptions({
                includeNextState: false,
                globalConfig: {
                    spacecraft_mnemonic: "CH3L",
                    primaryCraftId: "CH3L",
                    landing: { enabled: false },
                    is_lunar: true,
                    crafts: [{ id: "CH3L", mnemonic: "CH3L", primary: true }],
                },
                planetsForLocations: ["MOON", "CH3L"],
                eventInfos: [{
                    burnFlag: true,
                    body: "CH3L",
                    startTime: burnTime,
                    label: "Lander burn",
                }],
            }),
        );

        expect(sceneState.activeEvent?.label).toBe("Lander burn");
    });
});

describe("findActiveEvent", () => {
    it("keeps legacy SC default matching behavior", () => {
        const burnTime = new Date("2023-07-14T10:00:00Z");
        const event = findActiveEvent(
            burnTime.getTime(),
            [{ burnFlag: true, body: "CH3L", startTime: burnTime }],
        );
        expect(event).toBeNull();
    });

    it("matches preferred non-SC body IDs", () => {
        const burnTime = new Date("2023-07-14T10:00:00Z");
        const event = findActiveEvent(
            burnTime.getTime(),
            [{ burnFlag: true, body: "CH3L", startTime: burnTime, label: "CH3 event" }],
            ["CH3L"],
        );
        expect(event?.label).toBe("CH3 event");
    });
});
