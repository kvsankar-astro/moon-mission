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
        // exposureBias is now flat at 1.0 in all framings — composer and aux
        // panels render the moon at the same renderer.toneMappingExposure as
        // the main scene (1.14), instead of getting a +42% boost on
        // moon-dominant frames that flattened crater contrast.
        expect(presentation.exposureBias).toBeCloseTo(1.0, 3);
        // Earth fields still vary by dominance — Photo Mode for Earth is
        // unaffected by this commit.
        expect(presentation.earthNightLightsGain).toBeLessThan(0.01);
        expect(presentation.earthNightMapExponent).toBeGreaterThan(3.2);
        expect(presentation.earthDayGain).toBeGreaterThan(1.14);
        expect(presentation.earthDaySaturation).toBeLessThan(0.55);
        expect(presentation.earthAtmosphereRimStrength).toBeGreaterThan(0.34);
        // Moon photometric values are intentionally NOT exposed here — the
        // composer / aux panels render the moon with whatever the active
        // profile (Standard/Fast or Detailed/Quality) wrote on its material.
        // Earlier code hard-coded DEFAULT_QUALITY values as a "no-op", which
        // silently retuned Standard renders.
        expect(presentation.moonShadowLift).toBeUndefined();
        expect(presentation.moonShadowWeightExponent).toBeUndefined();
        expect(presentation.moonHighlightWeightExponent).toBeUndefined();
        expect(presentation.moonTerminatorContrast).toBeUndefined();
        expect(presentation.moonTerminatorReliefStrength).toBeUndefined();
        expect(presentation.moonTerminatorShadowFloor).toBeUndefined();
        expect(presentation.moonTerminatorIndirectOcclusion).toBeUndefined();
        expect(presentation.moonHighlightBoost).toBeUndefined();
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
        // Moon photometric values are intentionally NOT exposed regardless
        // of dominance — same expectations as the moon-dominant case.
        expect(presentation.moonShadowLift).toBeUndefined();
        expect(presentation.moonHighlightBoost).toBeUndefined();
        expect(presentation.moonTerminatorReliefStrength).toBeUndefined();
    });
});
