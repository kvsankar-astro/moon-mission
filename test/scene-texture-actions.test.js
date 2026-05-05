import { describe, expect, it } from "vitest";

import { applyAndRefreshSceneTextures } from "../src/platform/js/app/scene-texture-actions.js";
import { LIGHT_SETTINGS as LT } from "../src/platform/js/core/constants.js";

describe("scene-texture-actions", () => {
    it("keeps Earthshine fill available for detailed lunar render profiles", () => {
        const scene = {
            lightManager: {
                bodyAmbientLight: { intensity: 0.5 },
                primaryLight: null,
            },
            lightFill: { intensity: 0 },
            lightMoonshine: { intensity: 0 },
            moonRenderSettings: null,
            earthTexture: null,
            earthPhotoTexture: null,
            earthSpecularTexture: null,
            moonMap: null,
            moonDisplacementMap: null,
            skyTexture: null,
            skyConstellationTexture: null,
        };

        applyAndRefreshSceneTextures(scene, {
            earthTexture: null,
            earthPhotoTexture: null,
            earthSpecularTexture: null,
            earthNightTexture: null,
            moonMap: null,
            moonDisplacementMap: null,
            skyTexture: null,
            skyConstellationTexture: null,
            moonRenderProfile: "quality",
            moonRenderSettings: {
                terminatorIndirectOcclusion: 1.0,
                terminatorShadowFloor: 0.0,
            },
        });

        expect(scene.lightManager.bodyAmbientLight.intensity).toBe(0);
        expect(scene.earthPhotoTexture).toBe(null);
        expect(scene.lightFill.intensity).toBe(LT.EARTHSHINE_INTENSITY);
        expect(scene.lightMoonshine.intensity).toBe(LT.MOONSHINE_INTENSITY);
    });

    it("stores a dedicated Earth photo texture without disturbing the engineering day texture", () => {
        const engineeringTexture = { name: "earth-engineering" };
        const photoTexture = { name: "earth-photo" };
        const scene = {
            lightManager: {
                bodyAmbientLight: { intensity: 0.5 },
                primaryLight: null,
            },
            lightFill: { intensity: 0 },
            lightMoonshine: { intensity: 0 },
            moonRenderSettings: null,
            earthTexture: null,
            earthPhotoTexture: null,
            earthSpecularTexture: null,
            moonMap: null,
            moonDisplacementMap: null,
            skyTexture: null,
            skyConstellationTexture: null,
        };

        applyAndRefreshSceneTextures(scene, {
            earthTexture: engineeringTexture,
            earthPhotoTexture: photoTexture,
            earthSpecularTexture: null,
            earthNightTexture: null,
            moonMap: null,
            moonDisplacementMap: null,
            skyTexture: null,
            skyConstellationTexture: null,
            moonRenderProfile: "fast",
            moonRenderSettings: null,
        });

        expect(scene.earthTexture).toBe(engineeringTexture);
        expect(scene.earthPhotoTexture).toBe(photoTexture);
    });
});
