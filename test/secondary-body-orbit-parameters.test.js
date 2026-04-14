import { describe, expect, it } from "vitest";

import { PHYSICS_CONSTANTS as PC } from "../src/platform/js/core/constants.js";
import { resolveSecondaryBodyOrbitGravitationalParameter } from "../src/platform/js/app/secondary-body-orbit-parameters.js";
import { sampleOsculatingOrbitPoints } from "../src/platform/js/core/domain/orbital-elements.js";

describe("secondary-body-orbit-parameters", () => {
    it("uses the combined Earth-Moon gravitational parameter for geo and lunar scenes", () => {
        const expected = PC.EARTH_GM_KM3_S2 + PC.MOON_GM_KM3_S2;

        expect(resolveSecondaryBodyOrbitGravitationalParameter(PC, "geo")).toBeCloseTo(expected, 8);
        expect(resolveSecondaryBodyOrbitGravitationalParameter(PC, "lunar")).toBeCloseTo(expected, 8);
    });

    it("keeps the sampled Earth-in-lunar orbit bound for a real lunar-scene state", () => {
        const sampled = sampleOsculatingOrbitPoints({
            position: {
                x: 384680.8147653101,
                y: 80765.95367989717,
                z: 19693.39854569362,
            },
            velocity: {
                x: -0.1710618545412301,
                y: 0.9864605881474244,
                z: 0.07741818919282722,
            },
            gravitationalParameter: resolveSecondaryBodyOrbitGravitationalParameter(PC, "lunar"),
            sampleCount: 64,
        });

        expect(sampled).toBeTruthy();
        expect(sampled.points).toHaveLength(64);
    });
});
