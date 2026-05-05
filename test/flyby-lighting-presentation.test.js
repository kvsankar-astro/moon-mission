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
        expect(presentation.moonShadowLift).toBeGreaterThan(0.15);
        expect(presentation.moonShadowWeightExponent).toBeLessThan(0.9);
        expect(presentation.moonHighlightWeightExponent).toBeLessThan(0.9);
        expect(presentation.moonTerminatorContrast).toBeGreaterThan(3.6);
        expect(presentation.moonTerminatorReliefStrength).toBeGreaterThan(10.0);
        expect(presentation.moonTerminatorShadowFloor).toBeGreaterThan(0.2);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeLessThan(0.45);
        expect(presentation.moonHighlightBoost).toBeGreaterThan(1.14);
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
        expect(presentation.moonHighlightWeightExponent).toBeCloseTo(1.0, 3);
        expect(presentation.moonTerminatorContrast).toBeLessThan(2.82);
        expect(presentation.moonTerminatorReliefStrength).toBeGreaterThan(7.4);
        expect(presentation.moonTerminatorShadowFloor).toBeCloseTo(0.0, 3);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 3);
        expect(presentation.moonHighlightBoost).toBeGreaterThan(1.02);
    });
});
