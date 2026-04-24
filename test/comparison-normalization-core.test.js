import { describe, expect, it, vi } from "vitest";

import { COMPARISON_REFERENCE_DISTANCE_KM } from "../src/platform/js/core/domain/comparison-display.js";
import {
    createComparisonNormalizationScaleResolver,
    createNormalizedComparisonDisplayStateWithScaleResolver,
    normalizeComparisonCurveVectorsByScaleResolver,
    resolveComparisonNormalizationAnchorBodyId,
} from "../src/platform/js/core/domain/comparison-normalization.js";

describe("comparison normalization core", () => {
    it("resolves comparison craft anchors through overlay support aliases", () => {
        expect(resolveComparisonNormalizationAnchorBodyId({
            globalConfig: {
                comparisonOverlay: {
                    compareCraftId: "CMP_ARTEMIS1_CM",
                    normalizationSupportBodyIdsByOrigin: {
                        geo: "CMP_ARTEMIS1_CM__MOON",
                    },
                },
            },
            bodyId: "CMP_ARTEMIS1_CM",
            config: "geo",
        })).toBe("CMP_ARTEMIS1_CM__MOON");
    });

    it("caches scale resolution and falls back to the overlay alias when needed", () => {
        const resolveBodyDistanceKm = vi.fn(({ bodyId }) => {
            if (bodyId === "MOON") {
                return Number.NaN;
            }
            if (bodyId === "CMP_ARTEMIS1_CM__MOON") {
                return COMPARISON_REFERENCE_DISTANCE_KM / 2;
            }
            return COMPARISON_REFERENCE_DISTANCE_KM;
        });
        const resolveScaleForBodyTime = createComparisonNormalizationScaleResolver({
            config: "geo",
            globalConfig: {
                comparisonOverlay: {
                    normalizationSupportBodyIdsByOrigin: {
                        geo: "CMP_ARTEMIS1_CM__MOON",
                    },
                },
            },
            resolveBodyDistanceKm,
        });

        expect(resolveScaleForBodyTime({ bodyId: "MOON", timeMs: 1234 })).toBe(2);
        expect(resolveScaleForBodyTime({ bodyId: "MOON", timeMs: 1234 })).toBe(2);
        expect(resolveBodyDistanceKm).toHaveBeenCalledTimes(2);
        expect(resolveBodyDistanceKm).toHaveBeenNthCalledWith(1, {
            bodyId: "MOON",
            timeMs: 1234,
        });
        expect(resolveBodyDistanceKm).toHaveBeenNthCalledWith(2, {
            bodyId: "CMP_ARTEMIS1_CM__MOON",
            timeMs: 1234,
        });
    });

    it("normalizes vectors and live scene state through the injected scale resolver", () => {
        const resolveScaleForBodyTime = vi.fn(({ bodyId }) => (
            bodyId === "MOON" ? 2 : 4
        ));

        const vectors = normalizeComparisonCurveVectorsByScaleResolver({
            compareMode: true,
            bodyId: "SC",
            vectors: [
                {
                    x: COMPARISON_REFERENCE_DISTANCE_KM / 4,
                    y: 5,
                    z: 0,
                    vx: 1,
                    vy: 0,
                    vz: 0,
                    timeMs: 0,
                },
            ],
            resolveScaleForBodyTime,
        });
        expect(vectors[0].x).toBeCloseTo(COMPARISON_REFERENCE_DISTANCE_KM, 6);
        expect(vectors[0].y).toBeCloseTo(20, 12);

        const sceneState = createNormalizedComparisonDisplayStateWithScaleResolver({
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
                    velocity: { vx: 0, vy: 0, vz: 0 },
                },
                SC: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4,
                        y: 5,
                        z: 0,
                    },
                    nextPosition: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4 + 1,
                        y: 6,
                        z: 0,
                    },
                    velocity: { vx: 1, vy: 1, vz: 0 },
                    nextVelocity: { vx: 1, vy: 1, vz: 0 },
                },
            },
        }, {
            resolveScaleForBodyTime,
        });

        expect(sceneState.bodies.MOON.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM,
            6,
        );
        expect(sceneState.bodies.SC.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM,
            6,
        );
        expect(sceneState.comparisonNormalizationScaleByBodyId.SC).toBe(4);
    });
});
