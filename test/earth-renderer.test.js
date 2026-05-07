import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { EarthRenderer } from "../src/platform/js/rendering/earth-renderer.js";

describe("EarthRenderer", () => {
    it("initializes day-night presentation shader defaults on the Earth material", () => {
        const renderer = new EarthRenderer(1);
        renderer.setTextures(new THREE.Texture(), new THREE.Texture(), new THREE.Texture());
        renderer.create();

        const material = renderer.mesh.material;
        expect(material.userData.earthDayGain).toBe(1);
        expect(material.userData.earthDaySaturation).toBe(1);
        expect(material.userData.earthNightsideLift).toBe(0);
        expect(material.userData.earthMoonshineLift).toBe(0);
        expect(material.userData.earthAtmosphereRimStrength).toBe(0);
        expect(material.userData.earthNightMapIntensity).toBeCloseTo(0.08, 4);
        expect(material.userData.earthNightMapExponent).toBeCloseTo(2.25, 4);
        expect(material.userData.earthPhotoBlend).toBe(0);
        expect(material.userData.earthPhotoTexture).toBe(material.map);

        renderer.dispose();
    });

    it("keeps the photo texture aligned with the base map when Earth textures are refreshed", () => {
        const baseTexture = new THREE.Texture();
        const replacementTexture = new THREE.Texture();
        const renderer = new EarthRenderer(1);
        renderer.setTextures(baseTexture, new THREE.Texture(), new THREE.Texture());
        renderer.create();

        renderer.updateTextures(replacementTexture, new THREE.Texture(), new THREE.Texture(), {
            disposePrevious: false,
        });

        const material = renderer.mesh.material;
        expect(material.map).toBe(replacementTexture);
        expect(material.userData.earthPhotoTexture).toBe(replacementTexture);

        renderer.dispose();
    });

    it("refreshes Earth shader uniforms from mesh onBeforeRender after userData changes", () => {
        const baseTexture = new THREE.Texture();
        const cloudTexture = new THREE.Texture();
        const renderer = new EarthRenderer(1);
        renderer.setTextures(baseTexture, new THREE.Texture(), new THREE.Texture());
        renderer.create();

        const material = renderer.mesh.material;
        material.userData.earthNightsideShader = {
            uniforms: {
                uEarthNightsideLift: { value: 0 },
                uEarthMoonshineLift: { value: 0 },
                uEarthPhotoBlend: { value: 0 },
                uEarthPhotoMap: { value: baseTexture },
            },
        };
        material.userData.earthNightsideLift = 0.42;
        material.userData.earthMoonshineLift = 0.33;
        material.userData.earthPhotoBlend = 1;
        material.userData.earthPhotoTexture = cloudTexture;

        renderer.mesh.onBeforeRender();

        expect(material.userData.earthNightsideShader.uniforms.uEarthNightsideLift.value).toBe(0.42);
        expect(material.userData.earthNightsideShader.uniforms.uEarthMoonshineLift.value).toBe(0.33);
        expect(material.userData.earthNightsideShader.uniforms.uEarthPhotoBlend.value).toBe(1);
        expect(material.userData.earthNightsideShader.uniforms.uEarthPhotoMap.value).toBe(cloudTexture);

        renderer.dispose();
    });

    it("refreshes every compiled Earth shader for auxiliary panel renderers", () => {
        const renderer = new EarthRenderer(1);
        renderer.setTextures(new THREE.Texture(), new THREE.Texture(), new THREE.Texture());
        renderer.create();

        const material = renderer.mesh.material;
        const createShader = () => ({
            uniforms: {},
            fragmentShader: [
                "#include <common>",
                "#include <map_fragment>",
                "#include <lights_fragment_begin>",
            ].join("\n"),
        });
        const firstShader = createShader();
        const secondShader = createShader();
        material.onBeforeCompile(firstShader);
        material.onBeforeCompile(secondShader);

        material.userData.earthNightsideLift = 1.2;
        material.userData.earthMoonshineLift = 0.8;
        renderer.mesh.onBeforeRender();

        expect(firstShader.uniforms.uEarthNightsideLift.value).toBeCloseTo(1.2, 6);
        expect(secondShader.uniforms.uEarthNightsideLift.value).toBeCloseTo(1.2, 6);
        expect(firstShader.uniforms.uEarthMoonshineLift.value).toBeCloseTo(0.8, 6);
        expect(secondShader.uniforms.uEarthMoonshineLift.value).toBeCloseTo(0.8, 6);

        renderer.dispose();
    });

    it("injects a visible nightside fill path for Earth Ambient", () => {
        const renderer = new EarthRenderer(1);
        renderer.setTextures(new THREE.Texture(), new THREE.Texture(), new THREE.Texture());
        renderer.create();

        const material = renderer.mesh.material;
        const shader = {
            uniforms: {},
            fragmentShader: [
                "#include <common>",
                "#include <map_fragment>",
                "#include <lights_fragment_begin>",
            ].join("\n"),
        };

        material.onBeforeCompile(shader);

        expect(shader.fragmentShader).toContain("float earthNightWeight = 1.0");
        expect(shader.fragmentShader).toContain("vec3 earthAmbientSurfaceColor = diffuseColor.rgb");
        expect(shader.fragmentShader).toContain("totalEmissiveRadiance *= uEarthNightMapIntensity");
        expect(shader.fragmentShader).toContain("float earthNightsideLift = uEarthNightsideLift * earthNightWeight");
        expect(shader.fragmentShader).toContain("reflectedLight.indirectDiffuse += earthNightsideFillColor");
        expect(shader.fragmentShader).toContain("totalEmissiveRadiance += earthNightsideFillColor");
        expect(shader.fragmentShader).toContain("float earthMoonshineLift = uEarthMoonshineLift * earthNightWeight");
        expect(shader.fragmentShader).toContain("reflectedLight.indirectDiffuse += earthMoonshineFillColor");
        expect(shader.fragmentShader).toContain("totalEmissiveRadiance += earthMoonshineFillColor");

        renderer.dispose();
    });
});
