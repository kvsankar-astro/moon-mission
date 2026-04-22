import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/platform/js/data/ephemeris-provider.js", () => ({
    getBodyEphemerisState: vi.fn(),
}));

import { getBodyEphemerisState } from "../src/platform/js/data/ephemeris-provider.js";
import { COMPARISON_REFERENCE_DISTANCE_KM } from "../src/platform/js/core/domain/comparison-display.js";
import {
    createNormalizedComparisonDisplayState,
    normalizeComparisonCurveVectors,
} from "../src/platform/js/app/comparison-normalization.js";

describe("comparison normalization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns raw vectors when compare mode is disabled", () => {
        const vectors = [{ x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6, timeMs: 0 }];

        expect(normalizeComparisonCurveVectors({
            compareMode: false,
            vectors,
            config: "geo",
        })).toBe(vectors);
        expect(getBodyEphemerisState).not.toHaveBeenCalled();
    });

    it("normalizes vectors against the primary Earth-Moon span at each display time", () => {
        getBodyEphemerisState.mockImplementation(({ timeMs, bodyId }) => ({
            available: true,
            position: {
                x: bodyId === "MOON"
                    ? (timeMs === 0
                        ? COMPARISON_REFERENCE_DISTANCE_KM / 2
                        : COMPARISON_REFERENCE_DISTANCE_KM)
                    : 0,
                y: 0,
                z: 0,
            },
        }));

        const vectors = normalizeComparisonCurveVectors({
            compareMode: true,
            vectors: [
                { x: 10, y: 0, z: 0, vx: 1, vy: 0, vz: 0, timeMs: 0 },
                { x: 15, y: 5, z: 0, vx: 1, vy: 1, vz: 0, timeMs: 1000 },
            ],
            config: "geo",
            globalConfig: { spacecraft_mnemonic: "SC" },
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: {},
            chebyshevDataLoaded: {},
            resolveBodySource: (bodyId) => (bodyId === "MOON" ? "chebyshev" : "npz"),
            defaultSpacecraftSource: "npz",
        });

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(2);
        expect(getBodyEphemerisState).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                bodyId: "MOON",
                timeMs: 0,
                resolvedSource: "chebyshev",
            }),
        );
        expect(vectors[0].x).toBe(20);
        expect(vectors[1].x).toBe(15);
        expect(vectors[1].y).toBe(5);
    });

    it("reuses normalization scales for repeated timestamps", () => {
        getBodyEphemerisState.mockReturnValue({
            available: true,
            position: {
                x: COMPARISON_REFERENCE_DISTANCE_KM / 2,
                y: 0,
                z: 0,
            },
        });

        const vectors = normalizeComparisonCurveVectors({
            compareMode: true,
            vectors: [
                { x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: 0, timeMs: 0 },
                { x: 2, y: 0, z: 0, vx: 0, vy: 0, vz: 0, timeMs: 0 },
            ],
            config: "geo",
            globalConfig: {},
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: {},
            chebyshevDataLoaded: {},
            defaultSpacecraftSource: "chebyshev",
        });

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(1);
        expect(vectors[0].x).toBe(2);
        expect(vectors[1].x).toBe(4);
    });

    it("normalizes comparison overlay curves against the overlay mission moon anchor", () => {
        getBodyEphemerisState.mockImplementation(({ bodyId }) => ({
            available: true,
            position: {
                x: bodyId === "CMP_ARTEMIS1_CM__MOON"
                    ? COMPARISON_REFERENCE_DISTANCE_KM / 4
                    : COMPARISON_REFERENCE_DISTANCE_KM / 2,
                y: 0,
                z: 0,
            },
        }));

        const vectors = normalizeComparisonCurveVectors({
            compareMode: true,
            bodyId: "CMP_ARTEMIS1_CM",
            vectors: [
                { x: 10, y: 5, z: 0, vx: 1, vy: 0, vz: 0, timeMs: 0 },
            ],
            config: "geo",
            globalConfig: {
                comparisonOverlay: {
                    compareCraftId: "CMP_ARTEMIS1_CM",
                    normalizationSupportBodyIdsByOrigin: {
                        geo: "CMP_ARTEMIS1_CM__MOON",
                    },
                    normalizationSourceBodyIdsByOrigin: {
                        geo: "MOON",
                    },
                },
            },
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: {},
            chebyshevDataLoaded: {},
            defaultSpacecraftSource: "npz",
        });

        expect(getBodyEphemerisState).toHaveBeenCalledWith(
            expect.objectContaining({
                bodyId: "CMP_ARTEMIS1_CM__MOON",
                resolvedSource: "chebyshev",
            }),
        );
        expect(vectors[0].x).toBe(40);
        expect(vectors[0].y).toBe(20);
    });

    it("normalizes comparison overlay live state against the overlay mission moon anchor", () => {
        getBodyEphemerisState.mockImplementation(({ bodyId }) => ({
            available: true,
            position: {
                x: bodyId === "CMP_ARTEMIS1_CM__MOON"
                    ? COMPARISON_REFERENCE_DISTANCE_KM / 4
                    : COMPARISON_REFERENCE_DISTANCE_KM / 2,
                y: 0,
                z: 0,
            },
        }));

        const displayState = createNormalizedComparisonDisplayState({
            time: 0,
            config: "geo",
            bodies: {
                MOON: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 2,
                        y: 0,
                        z: 0,
                    },
                    velocity: { vx: 1, vy: 0, vz: 0 },
                },
                CMP_ARTEMIS1_CM: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 8,
                        y: 5,
                        z: 0,
                    },
                    nextPosition: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 8 + 1,
                        y: 6,
                        z: 0,
                    },
                    velocity: { vx: 1, vy: 1, vz: 0 },
                    nextVelocity: { vx: 1, vy: 1, vz: 0 },
                },
            },
        }, {
            globalConfig: {
                comparisonOverlay: {
                    compareCraftId: "CMP_ARTEMIS1_CM",
                    normalizationSupportBodyIdsByOrigin: {
                        geo: "CMP_ARTEMIS1_CM__MOON",
                    },
                    normalizationSourceBodyIdsByOrigin: {
                        geo: "MOON",
                    },
                },
            },
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: {},
            chebyshevDataLoaded: {},
            defaultSpacecraftSource: "chebyshev",
        });

        expect(displayState.bodies.MOON.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM,
            6,
        );
        expect(displayState.bodies.CMP_ARTEMIS1_CM.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM / 2,
            6,
        );
        expect(displayState.bodies.CMP_ARTEMIS1_CM.position.y).toBeCloseTo(20, 12);
        expect(displayState.comparisonNormalizationScaleByBodyId.CMP_ARTEMIS1_CM).toBeCloseTo(
            4,
            12,
        );
    });
});
