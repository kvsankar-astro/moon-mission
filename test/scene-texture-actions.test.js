import { describe, expect, it, vi } from "vitest";

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

    it("preserves existing non-Moon textures during a profile-only Moon update", () => {
        const earthTexture = { name: "earth" };
        const skyTexture = { name: "sky" };
        const moonMap = { name: "moon-quality" };
        const moonDisplacementMap = { name: "moon-height-quality" };
        const scene = {
            lightManager: {
                bodyAmbientLight: { intensity: 0.5 },
                primaryLight: null,
            },
            lightFill: { intensity: 0 },
            lightMoonshine: { intensity: 0 },
            moonRenderSettings: null,
            earthTexture,
            earthPhotoTexture: earthTexture,
            earthSpecularTexture: null,
            earthNightTexture: null,
            moonMap: { name: "moon-fast" },
            moonDisplacementMap: { name: "moon-height-fast" },
            skyTexture,
            skyConstellationTexture: null,
            earthRenderer: {
                updateTextures: vi.fn(),
            },
            skyRenderer: {
                updateTextures: vi.fn(),
            },
        };

        applyAndRefreshSceneTextures(scene, {
            moonMap,
            moonDisplacementMap,
            moonRenderProfile: "quality",
            moonRenderSettings: {
                displacementScale: 0.0128,
            },
        });

        expect(scene.earthTexture).toBe(earthTexture);
        expect(scene.earthPhotoTexture).toBe(earthTexture);
        expect(scene.skyTexture).toBe(skyTexture);
        expect(scene.moonMap).toBe(moonMap);
        expect(scene.moonDisplacementMap).toBe(moonDisplacementMap);
        expect(scene.moonRenderProfile).toBe("quality");
        expect(scene.earthRenderer.updateTextures).not.toHaveBeenCalled();
        expect(scene.skyRenderer.updateTextures).not.toHaveBeenCalled();
    });
});
