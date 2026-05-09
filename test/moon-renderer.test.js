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

    it("does not build the generated normal map during setRenderSettings before create() runs", () => {
        // Regression for the addMoon() call sequence:
        //   setTextures(...) -> setRenderSettings(...) -> create(..., defer=true)
        // The defer flag on create() is useless if setRenderSettings already
        // triggered the build. Before this fix, _refreshGeneratedNormalMap fired
        // inside setRenderSettings even when this.mesh was null, paying the
        // full ~300-500ms canvas+Float32 cost on the first-frame path.
        const originalDocument = globalThis.document;
        const createElement = vi.fn(() => ({
            width: 0,
            height: 0,
            getContext: vi.fn(() => ({
                drawImage: vi.fn(),
                getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })),
            })),
        }));
        vi.stubGlobal("document", { ...originalDocument, createElement });

        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };

        // Mirror the real addMoon() sequence.
        moonRenderer.setTextures(colorTexture, displacementTexture);
        moonRenderer.setRenderSettings({ normalMapMaxWidth: 64 });

        // setRenderSettings must not have built the normal map (no mesh yet).
        expect(createElement).not.toHaveBeenCalled();
        expect(moonRenderer.generatedNormalMap).toBeNull();

        moonRenderer.create(false, false, { deferGeneratedNormalMap: true });

        // create(defer=true) must not build either.
        expect(createElement).not.toHaveBeenCalled();
        expect(moonRenderer.generatedNormalMap).toBeNull();
        expect(moonRenderer.mesh.material.bumpMap).toBe(displacementTexture);
        expect(moonRenderer.mesh.material.normalMap).toBeNull();

        // Now upgrade explicitly (simulates the requestIdleCallback in addMoon).
        moonRenderer.refreshGeneratedNormalMap();
        expect(createElement).toHaveBeenCalled();
        expect(moonRenderer.generatedNormalMap).toBeTruthy();
        expect(moonRenderer.mesh.material.normalMap).toBe(moonRenderer.generatedNormalMap);
        expect(moonRenderer.mesh.material.bumpMap).toBeNull();

        moonRenderer.dispose();
    });

    it("skips the synchronous generated normal-map build when deferGeneratedNormalMap is set", () => {
        const originalDocument = globalThis.document;
        // Spy on createElement to prove no canvas is constructed (which is the
        // expensive step inside buildMoonNormalMapFromHeightTexture).
        const createElement = vi.fn(() => ({
            width: 0,
            height: 0,
            getContext: vi.fn(() => ({
                drawImage: vi.fn(),
                getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })),
            })),
        }));
        vi.stubGlobal("document", { ...originalDocument, createElement });

        const moonRenderer = new MoonRenderer(1);
        const colorTexture = new THREE.Texture();
        const displacementTexture = new THREE.Texture();
        displacementTexture.image = { width: 2, height: 2 };
        moonRenderer.setTextures(colorTexture, displacementTexture);
        moonRenderer.create(false, false, { deferGeneratedNormalMap: true });

        expect(createElement).not.toHaveBeenCalled();
        expect(moonRenderer.generatedNormalMap).toBeNull();
        // The mesh material should fall back to bumpMap-based shading until
        // refreshGeneratedNormalMap is called.
        expect(moonRenderer.mesh.material.bumpMap).toBe(displacementTexture);
        expect(moonRenderer.mesh.material.normalMap).toBeNull();

        // Now upgrade and confirm the normal map is actually built.
        moonRenderer.refreshGeneratedNormalMap();
        expect(createElement).toHaveBeenCalled();
        expect(moonRenderer.generatedNormalMap).toBeTruthy();
        expect(moonRenderer.mesh.material.normalMap).toBe(moonRenderer.generatedNormalMap);
        expect(moonRenderer.mesh.material.bumpMap).toBeNull();

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
        expect(material.userData.moonHighlightBoost).toBeCloseTo(1.35, 4);
        expect(material.userData.moonTerminatorShadowFloor).toBeCloseTo(0.0, 4);
        expect(material.userData.moonTerminatorIndirectOcclusion).toBeCloseTo(1.0, 4);
        expect(material.userData.moonTerrainShadowStrength).toBeCloseTo(2.2, 4);
        expect(material.userData.moonTerrainShadowTexelStride).toBeCloseTo(7.0, 4);
        expect(material.userData.moonTerrainShadowSlopeBias).toBeCloseTo(0.0014, 4);
        expect(material.userData.moonHeightTexelSize.x).toBeCloseTo(0.5, 4);
        expect(material.userData.moonHeightTexelSize.y).toBeCloseTo(0.5, 4);

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
                uMoonHeightMap: { value: null },
                uMoonHeightTexelSize: { value: new THREE.Vector2() },
                uMoonTerrainShadowStrength: { value: 0 },
                uMoonTerrainShadowTexelStride: { value: 0 },
                uMoonTerrainShadowSlopeBias: { value: 0 },
            },
        };
        material.userData.moonShadowLift = 0.37;
        material.userData.moonTerminatorShadowFloor = 0.22;
        material.userData.moonTerrainShadowStrength = 0.77;
        material.userData.moonTerrainShadowTexelStride = 4.5;
        material.userData.moonTerrainShadowSlopeBias = 0.031;

        moonRenderer.mesh.onBeforeRender();

        expect(material.userData.moonPhotometricShader.uniforms.uMoonShadowLift.value).toBe(0.37);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonTerminatorShadowFloor.value).toBe(0.22);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonHeightMap.value).toBe(displacementTexture);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonTerrainShadowStrength.value).toBe(0.77);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonTerrainShadowTexelStride.value).toBe(4.5);
        expect(material.userData.moonPhotometricShader.uniforms.uMoonTerrainShadowSlopeBias.value).toBe(0.031);

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
                "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
            ].join("\n"),
        };

        material.onBeforeCompile(shader);

        expect(material.customProgramCacheKey()).toContain("moon-photometric-v19");
        expect(shader.uniforms.uMoonHeightMap.value).toBe(displacementTexture);
        expect(shader.fragmentShader).toContain("float moonLocalReliefDelta = moonNdotL - moonSmoothNdotL");
        expect(shader.fragmentShader).toContain("float moonTerrainReliefBand = 1.0 - smoothstep");
        expect(shader.fragmentShader).toContain("float moonTerrainCavity = max");
        expect(shader.fragmentShader).toContain("float moonFinalTerrainTone = clamp");
        expect(shader.fragmentShader).toContain("reflectedLight.indirectDiffuse *= 1.0 - moonCavityDarken");
        expect(shader.fragmentShader).toContain("float moonTerrainSelfShadow = 0.0");
        expect(shader.fragmentShader).toContain("reflectedLight.directDiffuse *= 1.0 - moonTerrainShadow");
        expect(shader.fragmentShader).toContain("float moonShadowWeight = 1.0");
        expect(shader.fragmentShader).toContain("#endif\n    reflectedLight.indirectDiffuse += diffuseColor.rgb * ( uMoonShadowLift * moonShadowWeight * 0.72 );");

        moonRenderer.dispose();
    });
});
