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

    it("applies and restores Earth and Moon presentation overrides", () => {
        const originalEarthTexture = { name: "earth-base" };
        const photoEarthTexture = { name: "earth-photo" };
        const earth = createBodyWithMaterial({
            earthNightMapIntensity: 0.08,
            earthNightMapExponent: 2.25,
            earthDayGain: 1.0,
            earthDaySaturation: 1.0,
            earthAtmosphereRimStrength: 0.0,
        }, { map: originalEarthTexture });
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
        // Moon photometric overrides are now held flat at the asset-profile
        // defaults (DEFAULT_QUALITY_MOON_RENDER_SETTINGS). The Photo Mode
        // pass writes these values onto the moon material but they match the
        // defaults the main scene already uses, so the override is a visual
        // no-op for the moon. Earth fields above still vary with dominance.
        expect(moon.material.userData.moonShadowLift).toBeCloseTo(0.0, 3);
        expect(moon.material.userData.moonShadowWeightExponent).toBeCloseTo(1.92, 3);
        expect(moon.material.userData.moonTerminatorReliefStrength).toBeCloseTo(7.5, 2);
        expect(moon.material.userData.moonTerminatorShadowFloor).toBeCloseTo(0.0, 2);

        restore();

        expect(earth.material.map).toBe(originalEarthTexture);
        expect(earth.material.userData.earthPhotoTexture).toBe(originalEarthTexture);
        expect(earth.material.userData.earthNightMapIntensity).toBe(0.08);
        expect(earth.material.userData.earthDaySaturation).toBe(1.0);
        expect(moon.material.userData.moonShadowLift).toBe(0.015);
        expect(moon.material.userData.moonShadowWeightExponent).toBeUndefined();
        expect(moon.material.userData.moonTerminatorReliefStrength).toBeUndefined();
        expect(moon.material.userData.moonTerminatorShadowFloor).toBe(0.0);
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
