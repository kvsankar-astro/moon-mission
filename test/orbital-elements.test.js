import { describe, expect, it } from "vitest";

import { PHYSICS_CONSTANTS as PC } from "../src/platform/js/core/constants.js";
import {
    deriveOsculatingElementsFromState,
    sampleOsculatingOrbitPoints,
} from "../src/platform/js/core/domain/orbital-elements.js";

describe("orbital-elements", () => {
    it("derives a near-circular equatorial orbit from state vectors", () => {
        const radiusKm = 384400;
        const circularSpeed = Math.sqrt(PC.EARTH_GM_KM3_S2 / radiusKm);

        const elements = deriveOsculatingElementsFromState({
            position: { x: radiusKm, y: 0, z: 0 },
            velocity: { x: 0, y: circularSpeed, z: 0 },
        });

        expect(elements).toBeTruthy();
        expect(elements.semiMajorAxis).toBeCloseTo(radiusKm, 3);
        expect(elements.eccentricity).toBeCloseTo(0, 8);
        expect(elements.inclination).toBeCloseTo(0, 8);
    });

    it("samples a closed orbit loop in the inertial frame", () => {
        const radiusKm = 384400;
        const circularSpeed = Math.sqrt(PC.EARTH_GM_KM3_S2 / radiusKm);

        const sampled = sampleOsculatingOrbitPoints({
            position: { x: radiusKm, y: 0, z: 0 },
            velocity: { x: 0, y: circularSpeed, z: 0 },
            sampleCount: 64,
        });

        expect(sampled).toBeTruthy();
        expect(sampled.points).toHaveLength(64);

        for (const point of sampled.points) {
            const radius = Math.sqrt((point.x * point.x) + (point.y * point.y) + (point.z * point.z));
            expect(radius).toBeCloseTo(radiusKm, 1);
            expect(point.z).toBeCloseTo(0, 6);
        }
    });
});
