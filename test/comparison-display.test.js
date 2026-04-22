import { describe, expect, it } from "vitest";

import {
    COMPARISON_REFERENCE_DISTANCE_KM,
    createComparisonDisplayState,
    resolveComparisonNormalizationScaleFromSceneState,
    transformComparisonCurveVectors,
} from "../src/platform/js/core/domain/comparison-display.js";

describe("comparison display", () => {
    it("resolves a normalization scale from the current Earth-Moon span", () => {
        const scale = resolveComparisonNormalizationScaleFromSceneState({
            config: "geo",
            bodies: {
                MOON: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 2,
                        y: 0,
                        z: 0,
                    },
                },
            },
        });

        expect(scale).toBeCloseTo(2, 12);
    });

    it("creates a compare display state without mutating telemetry", () => {
        const rawSceneState = {
            config: "geo",
            telemetry: {
                distancePrimary: 123,
            },
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
                SC: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4,
                        y: 10,
                        z: 0,
                    },
                    nextPosition: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4 + 5,
                        y: 20,
                        z: 0,
                    },
                    velocity: { vx: 5, vy: 10, vz: 0 },
                    nextVelocity: { vx: 5, vy: 10, vz: 0 },
                },
            },
        };

        const displayState = createComparisonDisplayState(rawSceneState);

        expect(displayState.telemetry).toBe(rawSceneState.telemetry);
        expect(displayState.comparisonNormalizationScale).toBeCloseTo(2, 12);
        expect(displayState.bodies.MOON.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM,
            6,
        );
        expect(displayState.bodies.SC.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM / 2,
            6,
        );
        expect(displayState.bodies.SC.position.y).toBeCloseTo(20, 12);
        expect(displayState.bodies.SC.velocity.vx).toBeCloseTo(10, 12);
        expect(displayState.bodies.SC.velocity.vy).toBeCloseTo(20, 12);
        expect(rawSceneState.bodies.SC.position.y).toBe(10);
    });

    it("transforms orbit vectors with per-sample normalization scales", () => {
        const vectors = transformComparisonCurveVectors(
            [
                {
                    x: 10,
                    y: 0,
                    z: 0,
                    vx: 1,
                    vy: 0,
                    vz: 0,
                    timeMs: 0,
                },
                {
                    x: 12,
                    y: 2,
                    z: 0,
                    vx: 1,
                    vy: 1,
                    vz: 0,
                    timeMs: 1000,
                },
            ],
            (vector) => (vector.timeMs === 0 ? 2 : 3),
        );

        expect(vectors[0].x).toBe(20);
        expect(vectors[0].y).toBe(0);
        expect(vectors[1].x).toBe(36);
        expect(vectors[1].y).toBe(6);
        expect(vectors[0].vx).toBeCloseTo(16, 12);
        expect(vectors[0].vy).toBeCloseTo(6, 12);
        expect(vectors[1].vx).toBeCloseTo(3, 12);
        expect(vectors[1].vy).toBeCloseTo(3, 12);
    });
});
