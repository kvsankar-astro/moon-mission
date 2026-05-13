import { describe, expect, it } from "vitest";

import { LIGHT_SETTINGS as LT } from "../src/platform/js/core/constants.js";
import {
    computeEarthshineLightState,
    computeMoonshineLightState,
} from "../src/platform/js/core/domain/reflected-lighting.js";

describe("reflected-lighting", () => {
    it("computes phased Earthshine toward the Moon from Earth->Moon geometry", () => {
        const state = computeEarthshineLightState({
            earthPosition: { x: 0, y: 0, z: 0 },
            moonPosition: { x: 1, y: 0, z: 0 },
            moonSunDirection: { x: -1, y: 0, z: 0 },
            minIntensity: 0,
            maxIntensity: 0.02,
            phaseExponent: 1,
        });

        expect(state.direction).toEqual({ x: -1, y: 0, z: 0 });
        expect(state.intensity).toBeCloseTo(0.02);
    });

    it("keeps Earthshine dark when Earth phase geometry is dark", () => {
        const state = computeEarthshineLightState({
            earthPosition: { x: 0, y: 0, z: 0 },
            moonPosition: { x: 1, y: 0, z: 0 },
            moonSunDirection: { x: 1, y: 0, z: 0 },
            minIntensity: 0,
            maxIntensity: 0.02,
            phaseExponent: 1,
        });

        expect(state.direction).toEqual({ x: -1, y: 0, z: 0 });
        expect(state.intensity).toBeCloseTo(0);
    });

    it("computes phased Moonshine toward Earth from Moon->Earth geometry", () => {
        const fullMoonState = computeMoonshineLightState({
            earthPosition: { x: 0, y: 0, z: 0 },
            moonPosition: { x: 1, y: 0, z: 0 },
            earthSunDirection: { x: -1, y: 0, z: 0 },
            minIntensity: 0,
            maxIntensity: 0.006,
            phaseExponent: 1,
            distanceWeight: 0,
        });
        const newMoonState = computeMoonshineLightState({
            earthPosition: { x: 0, y: 0, z: 0 },
            moonPosition: { x: 1, y: 0, z: 0 },
            earthSunDirection: { x: 1, y: 0, z: 0 },
            minIntensity: 0,
            maxIntensity: 0.006,
            phaseExponent: 1,
            distanceWeight: 0,
        });

        expect(fullMoonState.direction).toEqual({ x: 1, y: 0, z: 0 });
        expect(fullMoonState.intensity).toBeCloseTo(0.006);
        expect(newMoonState.intensity).toBeCloseTo(0);
    });

    it("keeps default Moonshine dramatically weaker than Earthshine", () => {
        expect(LT.MOONSHINE_INTENSITY).toBeLessThan(LT.EARTHSHINE_INTENSITY / 20);
    });
});
