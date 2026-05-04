import { describe, expect, it, vi, afterEach } from "vitest";
import * as THREE from "three";

import { MoonRenderer } from "../src/platform/js/rendering/moon-renderer.js";

describe("MoonRenderer", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps generated normal-map flipY aligned with the source displacement texture", () => {
        const originalDocument = globalThis.document;
        const pixelData = new Uint8ClampedArray([
            0, 0, 0, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            0, 0, 0, 255,
        ]);
        const context2d = {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({ data: pixelData })),
        };
        vi.stubGlobal("document", {
            ...originalDocument,
            createElement: vi.fn(() => ({
                width: 0,
                height: 0,
                getContext: vi.fn(() => context2d),
            })),
        });

        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        displacementTexture.flipY = true;
        displacementTexture.wrapS = THREE.RepeatWrapping;
        displacementTexture.wrapT = THREE.MirroredRepeatWrapping;

        moonRenderer.setTextures(colorTexture, displacementTexture);
        moonRenderer.create();

        expect(moonRenderer.generatedNormalMap).toBeTruthy();
        expect(moonRenderer.generatedNormalMap.flipY).toBe(true);
        expect(moonRenderer.generatedNormalMap.wrapS).toBe(THREE.RepeatWrapping);
        expect(moonRenderer.generatedNormalMap.wrapT).toBe(THREE.MirroredRepeatWrapping);

        moonRenderer.dispose();
    });
});
