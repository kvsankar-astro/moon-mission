import { describe, expect, it } from "vitest";

import {
    computeApparentDiskWeight,
    computeComposerBodyLightingPresentation,
} from "../src/platform/js/core/domain/flyby-lighting-presentation.js";

describe("flyby-lighting-presentation", () => {
    it("weights nearby large bodies more heavily in the frame", () => {
        const moonWeight = computeApparentDiskWeight({
            distance: 9000,
            radius: 1737.4,
        });
        const earthWeight = computeApparentDiskWeight({
            distance: 380000,
            radius: 6371,
        });

        expect(moonWeight).toBeGreaterThan(earthWeight);
    });

    it("keeps Earth night lights subdued when the Moon dominates the frame", () => {
        const presentation = computeComposerBodyLightingPresentation({
            distanceToEarth: 380000,
            earthRadius: 6371,
            distanceToMoon: 9000,
            moonRadius: 1737.4,
        });

        expect(presentation.dominantBody).toBe("moon");
        expect(presentation.exposureBias).toBeGreaterThan(1.35);
        expect(presentation.earthNightLightsGain).toBeLessThan(0.01);
        expect(presentation.earthNightMapExponent).toBeGreaterThan(3.2);
        expect(presentation.earthDayGain).toBeGreaterThan(1.14);
        expect(presentation.earthDaySaturation).toBeLessThan(0.55);
        expect(presentation.earthAtmosphereRimStrength).toBeGreaterThan(0.34);
        // Moon-dominant overrides push highlightBoost to mimic photographic
        // exposure compensation for the lunar disc; without this the lit side
        // reads as flat mid-gray instead of the bright surface real photos
        // capture. terminatorContrast stays moderate so lit terrain doesn't
        // darken too quickly into the terminator.
        expect(presentation.moonShadowLift).toBeCloseTo(0.05, 2);
        expect(presentation.moonShadowWeightExponent).toBeCloseTo(1.6, 2);
        expect(presentation.moonHighlightWeightExponent).toBeCloseTo(1.2, 2);
        expect(presentation.moonTerminatorContrast).toBeCloseTo(1.8, 2);
        expect(presentation.moonTerminatorReliefStrength).toBeCloseTo(7.5, 2);
        expect(presentation.moonTerminatorShadowFloor).toBeCloseTo(0.0, 2);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeCloseTo(0.85, 2);
        expect(presentation.moonHighlightBoost).toBeCloseTo(1.45, 2);
    });

    it("allows somewhat more Earth night-light visibility when Earth dominates the frame", () => {
        const presentation = computeComposerBodyLightingPresentation({
            distanceToEarth: 22000,
            earthRadius: 6371,
            distanceToMoon: 410000,
            moonRadius: 1737.4,
        });

        expect(presentation.dominantBody).toBe("earth");
        expect(presentation.exposureBias).toBeCloseTo(1.0, 3);
        expect(presentation.earthNightLightsGain).toBeGreaterThan(0.06);
        expect(presentation.earthNightMapExponent).toBeLessThan(1.9);
        expect(presentation.earthDayGain).toBeCloseTo(1.0, 3);
        expect(presentation.earthDaySaturation).toBeGreaterThan(0.83);
        expect(presentation.earthAtmosphereRimStrength).toBeLessThan(0.18);
        expect(presentation.moonShadowLift).toBeCloseTo(0.02, 3);
        expect(presentation.moonShadowWeightExponent).toBeCloseTo(1.92, 3);
        expect(presentation.moonHighlightWeightExponent).toBeCloseTo(1.1, 2);
        expect(presentation.moonTerminatorContrast).toBeCloseTo(2.0, 2);
        expect(presentation.moonTerminatorReliefStrength).toBeGreaterThan(7.4);
        expect(presentation.moonTerminatorShadowFloor).toBeCloseTo(0.0, 3);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 3);
        expect(presentation.moonHighlightBoost).toBeCloseTo(1.25, 2);
    });
});
