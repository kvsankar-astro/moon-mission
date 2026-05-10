import { describe, expect, it } from "vitest";

import {
    applyPhotoModeBodyPresentation,
    applyPhotoModeExposure,
    resolvePhotoModeLightingPresentation,
} from "../src/platform/js/app/photo-mode-render-presentation.js";

function createBodyWithMaterial(userData, extras = {}) {
    const material = {
        userData: { ...userData },
        map: extras.map || null,
    };
    return {
        material,
        traverse(callback) {
            callback({
                isMesh: true,
                material,
            });
        },
    };
}

describe("photo-mode-render-presentation", () => {
    it("resolves no presentation when photo mode is disabled", () => {
        const presentation = resolvePhotoModeLightingPresentation({
            enabled: false,
            cameraPosition: { x: 0, y: 0, z: 0 },
            earthPosition: { x: 10, y: 0, z: 0 },
            earthRadius: 1,
            moonPosition: { x: 5, y: 0, z: 0 },
            moonRadius: 1,
        });

        expect(presentation).toBe(null);
    });

    it("applies and restores Earth presentation overrides; leaves Moon untouched", () => {
        const originalEarthTexture = { name: "earth-base" };
        const photoEarthTexture = { name: "earth-photo" };
        const earth = createBodyWithMaterial({
            earthNightMapIntensity: 0.08,
            earthNightMapExponent: 2.25,
            earthDayGain: 1.0,
            earthDaySaturation: 1.0,
            earthAtmosphereRimStrength: 0.0,
        }, { map: originalEarthTexture });
        // Moon material starts with non-default values — the photo-mode
        // pass must NOT overwrite them. (Earlier code hard-coded the
        // quality-profile defaults onto the moon material as a "no-op",
        // which silently retuned Standard/Fast renders.)
        const moon = createBodyWithMaterial({
            moonShadowLift: 0.015,
            moonTerminatorContrast: 2.78,
            moonTerminatorShadowFloor: 0.0,
            moonTerminatorIndirectOcclusion: 1.0,
            moonHighlightBoost: 1.025,
        });
        const presentation = resolvePhotoModeLightingPresentation({
            enabled: true,
            cameraPosition: { x: 0, y: 0, z: 0 },
            earthPosition: { x: 380000, y: 0, z: 0 },
            earthRadius: 6371,
            moonPosition: { x: 9000, y: 0, z: 0 },
            moonRadius: 1737.4,
        });

        const restore = applyPhotoModeBodyPresentation({
            earth,
            moon,
            presentation,
            earthDayTexture: photoEarthTexture,
        });

        expect(earth.material.map).toBe(originalEarthTexture);
        expect(earth.material.userData.earthPhotoTexture).toBe(photoEarthTexture);
        expect(earth.material.userData.earthPhotoBlend).toBeCloseTo(0.56, 4);
        expect(earth.material.userData.earthNightMapIntensity).toBeLessThan(0.02);
        expect(earth.material.userData.earthDaySaturation).toBeLessThan(0.55);
        // Moon photometric values must remain the input fixture's values,
        // not be replaced with quality-profile defaults.
        expect(moon.material.userData.moonShadowLift).toBe(0.015);
        expect(moon.material.userData.moonTerminatorContrast).toBe(2.78);
        expect(moon.material.userData.moonHighlightBoost).toBe(1.025);

        restore();

        expect(earth.material.map).toBe(originalEarthTexture);
        expect(earth.material.userData.earthPhotoTexture).toBe(originalEarthTexture);
        expect(earth.material.userData.earthNightMapIntensity).toBe(0.08);
        expect(earth.material.userData.earthDaySaturation).toBe(1.0);
        // Restore is a no-op for moon since nothing was overridden.
        expect(moon.material.userData.moonShadowLift).toBe(0.015);
        expect(moon.material.userData.moonTerminatorContrast).toBe(2.78);
    });

    it("preserves Standard/Fast profile moon photometric values across photo-mode override", () => {
        // Reviewer-flagged regression: hard-coding DEFAULT_QUALITY values onto
        // the moon material silently retuned Standard renders. This test
        // pins the contract — values come in, same values come out.
        const fastProfileMoon = createBodyWithMaterial({
            moonShadowLift: 0.0,
            moonShadowWeightExponent: 1.9,
            moonHighlightWeightExponent: 1.2,
            moonTerminatorContrast: 1.8,
            moonTerminatorReliefStrength: 7.0,
            moonTerminatorShadowFloor: 0.04,
            moonTerminatorIndirectOcclusion: 0.96,
            moonHighlightBoost: 1.15,
        });
        const presentation = resolvePhotoModeLightingPresentation({
            enabled: true,
            cameraPosition: { x: 0, y: 0, z: 0 },
            earthPosition: { x: 380000, y: 0, z: 0 },
            earthRadius: 6371,
            moonPosition: { x: 9000, y: 0, z: 0 },
            moonRadius: 1737.4,
        });

        const restore = applyPhotoModeBodyPresentation({
            moon: fastProfileMoon,
            presentation,
        });

        expect(fastProfileMoon.material.userData.moonShadowLift).toBe(0.0);
        expect(fastProfileMoon.material.userData.moonShadowWeightExponent).toBe(1.9);
        expect(fastProfileMoon.material.userData.moonHighlightWeightExponent).toBe(1.2);
        expect(fastProfileMoon.material.userData.moonTerminatorContrast).toBe(1.8);
        expect(fastProfileMoon.material.userData.moonTerminatorReliefStrength).toBe(7.0);
        expect(fastProfileMoon.material.userData.moonTerminatorShadowFloor).toBe(0.04);
        expect(fastProfileMoon.material.userData.moonTerminatorIndirectOcclusion).toBe(0.96);
        expect(fastProfileMoon.material.userData.moonHighlightBoost).toBe(1.15);

        restore();

        expect(fastProfileMoon.material.userData.moonHighlightBoost).toBe(1.15);
        expect(fastProfileMoon.material.userData.moonTerminatorShadowFloor).toBe(0.04);
    });

    it("allows callers to explicitly disable Earth cloud/photo blending", () => {
        const originalEarthTexture = { name: "earth-base" };
        const photoEarthTexture = { name: "earth-photo" };
        const earth = createBodyWithMaterial({
            earthPhotoTexture: photoEarthTexture,
            earthPhotoBlend: 0.56,
            earthNightMapIntensity: 0.08,
            earthNightMapExponent: 2.25,
            earthDayGain: 1.0,
            earthDaySaturation: 1.0,
            earthAtmosphereRimStrength: 0.0,
        }, { map: originalEarthTexture });
        const presentation = resolvePhotoModeLightingPresentation({
            enabled: true,
            cameraPosition: { x: 0, y: 0, z: 0 },
            earthPosition: { x: 380000, y: 0, z: 0 },
            earthRadius: 6371,
            moonPosition: { x: 9000, y: 0, z: 0 },
            moonRadius: 1737.4,
        });

        const restore = applyPhotoModeBodyPresentation({
            earth,
            presentation,
            earthDayTextureBlend: 0,
        });

        expect(earth.material.userData.earthPhotoTexture).toBe(photoEarthTexture);
        expect(earth.material.userData.earthPhotoBlend).toBe(0);

        restore();

        expect(earth.material.userData.earthPhotoTexture).toBe(photoEarthTexture);
        expect(earth.material.userData.earthPhotoBlend).toBe(0.56);
    });

    it("applies Earth cloud/photo blending even when photo lighting presentation is disabled", () => {
        const originalEarthTexture = { name: "earth-base" };
        const photoEarthTexture = { name: "earth-photo" };
        const earth = createBodyWithMaterial({
            earthPhotoTexture: originalEarthTexture,
            earthPhotoBlend: 0,
            earthNightMapIntensity: 0.08,
            earthNightMapExponent: 2.25,
            earthDayGain: 1.0,
            earthDaySaturation: 1.0,
            earthAtmosphereRimStrength: 0.0,
        }, { map: originalEarthTexture });

        const restore = applyPhotoModeBodyPresentation({
            earth,
            presentation: null,
            earthDayTexture: photoEarthTexture,
        });

        expect(earth.material.userData.earthPhotoTexture).toBe(photoEarthTexture);
        expect(earth.material.userData.earthPhotoBlend).toBeCloseTo(0.56, 4);
        expect(earth.material.userData.earthNightMapIntensity).toBe(0.08);

        restore();

        expect(earth.material.userData.earthPhotoTexture).toBe(originalEarthTexture);
        expect(earth.material.userData.earthPhotoBlend).toBe(0);
    });

    it("applies and restores renderer exposure bias", () => {
        const renderer = { toneMappingExposure: 1.14 };
        const presentation = { exposureBias: 1.42 };

        const restore = applyPhotoModeExposure({
            renderer,
            presentation,
        });

        expect(renderer.toneMappingExposure).toBeCloseTo(1.6188, 4);

        restore();

        expect(renderer.toneMappingExposure).toBeCloseTo(1.14, 6);
    });
});
