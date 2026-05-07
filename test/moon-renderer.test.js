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

    it("initializes lunar photometric presentation defaults on the Moon material", () => {
        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        const normalTexture = new THREE.Texture();

        moonRenderer.setTextures(colorTexture, displacementTexture, normalTexture);
        moonRenderer.create();

        const material = moonRenderer.mesh.material;
        expect(material.userData.moonHighlightBoost).toBeCloseTo(1.025, 4);
        expect(material.userData.moonTerminatorShadowFloor).toBeCloseTo(0.0, 4);
        expect(material.userData.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 4);

        moonRenderer.dispose();
    });

    it("refreshes Moon shader uniforms from mesh onBeforeRender after userData changes", () => {
        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        const normalTexture = new THREE.Texture();

        moonRenderer.setTextures(colorTexture, displacementTexture, normalTexture);
        moonRenderer.create();

        const material = moonRenderer.mesh.material;
        material.userData.moonPhotometricShader = {
            uniforms: {
                uMoonShadowLift: { value: 0 },
                uMoonTerminatorShadowFloor: { value: 0 },
            },
        };
        material.userData.moonShadowLift = 0.37;
        material.userData.moonTerminatorShadowFloor = 0.22;

        moonRenderer.mesh.onBeforeRender();

        expect(material.userData.moonPhotometricShader.uniforms.uMoonShadowLift.value).toBe(0.37);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonTerminatorShadowFloor.value).toBe(0.22);

        moonRenderer.dispose();
    });

    it("injects Moon artificial ambient outside the directional-light guard", () => {
        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        const normalTexture = new THREE.Texture();

        moonRenderer.setTextures(colorTexture, displacementTexture, normalTexture);
        moonRenderer.create();

        const material = moonRenderer.mesh.material;
        const shader = {
            uniforms: {},
            fragmentShader: [
                "#include <common>",
                "#include <lights_fragment_begin>",
                "#include <lights_fragment_end>",
            ].join("\n"),
        };

        material.onBeforeCompile(shader);

        expect(shader.fragmentShader).toContain("float moonShadowWeight = 1.0");
        expect(shader.fragmentShader).toContain("#endif\n    reflectedLight.indirectDiffuse += diffuseColor.rgb * ( uMoonShadowLift * moonShadowWeight * 0.72 );");

        moonRenderer.dispose();
    });
});
