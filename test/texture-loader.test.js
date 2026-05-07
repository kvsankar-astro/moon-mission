import { describe, expect, it, vi } from "vitest";

import {
    loadMoonRenderProfileTextures,
    loadSceneTextures,
} from "../src/platform/js/app/texture-loader.js";

function createFakeThree(loadCalls) {
    class TextureLoader {
        load(fileName, onLoad) {
            loadCalls.push(fileName);
            onLoad({
                fileName,
                dispose: vi.fn(),
            });
        }
    }

    return {
        TextureLoader,
        LinearFilter: "linear",
        RGBAFormat: "rgba",
        SRGBColorSpace: "srgb",
        DataTexture: class DataTexture {
            constructor(data, width, height, format) {
                this.data = data;
                this.image = { width, height };
                this.format = format;
                this.dispose = vi.fn();
            }
        },
        Color: class Color {
            constructor(hexColor) {
                this.r = ((hexColor >> 16) & 255) / 255;
                this.g = ((hexColor >> 8) & 255) / 255;
                this.b = (hexColor & 255) / 255;
            }
        },
    };
}

describe("texture-loader", () => {
    it("shares one load for repeated texture URLs", async () => {
        const loadCalls = [];
        const THREE = createFakeThree(loadCalls);
        const files = {
            earthTexture: "/textures/earth-day.jpg",
            earthPhotoTexture: "/textures/earth-photo.jpg",
            earthSpecularTexture: "/textures/earth-spec.jpg",
            earthNightTexture: "/textures/earth-night.jpg",
            moonMap: "/textures/moon-fast.jpg",
            moonDisplacementMap: "/textures/moon-height.png",
            skyMilkyWayTexture: "/textures/sky.jpg",
            skyTexture: "/textures/sky.jpg",
            skyConstellationTexture: "/textures/constellation.jpg",
        };
        const globalObject = {
            MOON_RENDER_ASSET_PATHS: {
                fast: {
                    moonMap: files.moonMap,
                    moonDisplacementMap: files.moonDisplacementMap,
                },
            },
        };

        const textures = await loadSceneTextures({ THREE, files, globalObject });

        expect(loadCalls.filter((fileName) => fileName === "/textures/sky.jpg")).toHaveLength(1);
        expect(textures.skyTexture).toBe(textures.skyMilkyWayTexture);
    });

    it("can load only the active Moon render profile textures", async () => {
        const loadCalls = [];
        const THREE = createFakeThree(loadCalls);
        const globalObject = {
            MOON_RENDER_ASSET_PATHS: {
                quality: {
                    moonMap: "/textures/moon-quality.jpg",
                    moonDisplacementMap: "/textures/moon-quality-height.png",
                },
            },
        };

        const textures = await loadMoonRenderProfileTextures({
            THREE,
            moonRenderProfile: "quality",
            globalObject,
        });

        expect(loadCalls).toEqual([
            "/textures/moon-quality.jpg",
            "/textures/moon-quality-height.png",
        ]);
        expect(textures).toMatchObject({
            moonRenderProfile: "quality",
        });
        expect(textures.moonMap.fileName).toBe("/textures/moon-quality.jpg");
        expect(textures.earthTexture).toBeUndefined();
    });

    it("does not share a texture object across Moon color and height roles", async () => {
        const loadCalls = [];
        const THREE = createFakeThree(loadCalls);
        const globalObject = {
            MOON_RENDER_ASSET_PATHS: {
                quality: {
                    moonMap: "/textures/shared-moon-source.png",
                    moonDisplacementMap: "/textures/shared-moon-source.png",
                },
            },
        };

        const textures = await loadMoonRenderProfileTextures({
            THREE,
            moonRenderProfile: "quality",
            globalObject,
        });

        expect(loadCalls).toEqual([
            "/textures/shared-moon-source.png",
            "/textures/shared-moon-source.png",
        ]);
        expect(textures.moonMap).not.toBe(textures.moonDisplacementMap);
    });
});
