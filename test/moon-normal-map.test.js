import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { buildMoonNormalMapFromHeightTexture } from "../src/platform/js/rendering/moon-normal-map.js";

describe("moon-normal-map", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("inherits UV orientation and wrap modes from the source height texture", () => {
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

        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        displacementTexture.flipY = true;
        displacementTexture.wrapS = THREE.RepeatWrapping;
        displacementTexture.wrapT = THREE.MirroredRepeatWrapping;

        const normalTexture = buildMoonNormalMapFromHeightTexture(displacementTexture);

        expect(normalTexture).toBeTruthy();
        expect(normalTexture.flipY).toBe(true);
        expect(normalTexture.wrapS).toBe(THREE.RepeatWrapping);
        expect(normalTexture.wrapT).toBe(THREE.MirroredRepeatWrapping);
    });
});
