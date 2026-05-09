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
        // Moon photometric overrides held flat at the asset-profile defaults
        // (DEFAULT_QUALITY_MOON_RENDER_SETTINGS). The composer applying these
        // values is now a visual no-op for the moon; composer panels render
        // the moon identically to Follow Moon in the main scene.
        expect(presentation.moonShadowLift).toBeCloseTo(0.0, 3);
        expect(presentation.moonShadowWeightExponent).toBeCloseTo(1.92, 3);
        expect(presentation.moonHighlightWeightExponent).toBeCloseTo(1.2, 3);
        expect(presentation.moonTerminatorContrast).toBeCloseTo(1.8, 3);
        expect(presentation.moonTerminatorReliefStrength).toBeCloseTo(7.5, 3);
        expect(presentation.moonTerminatorShadowFloor).toBeCloseTo(0.0, 3);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 3);
        expect(presentation.moonHighlightBoost).toBeCloseTo(1.20, 3);
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
        // Moon overrides are flat at asset-profile defaults regardless of
        // dominance — same expectations as the moon-dominant case.
        expect(presentation.moonShadowLift).toBeCloseTo(0.0, 3);
        expect(presentation.moonShadowWeightExponent).toBeCloseTo(1.92, 3);
        expect(presentation.moonHighlightWeightExponent).toBeCloseTo(1.2, 3);
        expect(presentation.moonTerminatorContrast).toBeCloseTo(1.8, 3);
        expect(presentation.moonTerminatorReliefStrength).toBeCloseTo(7.5, 3);
        expect(presentation.moonTerminatorShadowFloor).toBeCloseTo(0.0, 3);
        expect(presentation.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 3);
        expect(presentation.moonHighlightBoost).toBeCloseTo(1.20, 3);
    });
});
