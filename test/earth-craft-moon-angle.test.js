import { describe, expect, it } from "vitest";

import {
    computeAngleDegreesBetweenVectors,
    computeEarthCraftMoonAngleFromSceneState,
} from "../src/platform/js/core/domain/earth-craft-moon-angle.js";

describe("earth craft moon angle", () => {
    it("computes the angle from scene-state body positions", () => {
        const angleDegrees = computeEarthCraftMoonAngleFromSceneState({
            telemetryBodyId: "CH3L",
            bodies: {
                EARTH: {
                    position: { x: 1, y: 0, z: 0 },
                },
                MOON: {
                    position: { x: 0, y: 0, z: 0 },
                },
                CH3L: {
                    position: { x: 0, y: 1, z: 0 },
                },
            },
        });

        expect(angleDegrees).toBeCloseTo(90, 6);
    });

    it("falls back to SC and then the first available craft position", () => {
        expect(computeEarthCraftMoonAngleFromSceneState({
            bodies: {
                EARTH: {
                    position: { x: 1, y: 0, z: 0 },
                },
                MOON: {
                    position: { x: 0, y: 0, z: 0 },
                },
                SC: {
                    position: { x: 1, y: 0, z: 0 },
                },
            },
        })).toBeCloseTo(0, 6);

        expect(computeEarthCraftMoonAngleFromSceneState({
            bodies: {
                EARTH: {
                    position: { x: 1, y: 0, z: 0 },
                },
                MOON: {
                    position: { x: 0, y: 0, z: 0 },
                },
                SUN: {
                    position: { x: 100, y: 100, z: 0 },
                },
                ORBITER: {
                    position: { x: 0, y: 1, z: 0 },
                },
            },
        })).toBeCloseTo(90, 6);
    });

    it("returns null when required vectors are unavailable or degenerate", () => {
        expect(computeEarthCraftMoonAngleFromSceneState({
            bodies: {
                EARTH: {
                    position: { x: 1, y: 0, z: 0 },
                },
                MOON: {
                    position: { x: 0, y: 0, z: 0 },
                },
            },
        })).toBeNull();

        expect(computeAngleDegreesBetweenVectors(
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
        )).toBeNull();
    });
});
