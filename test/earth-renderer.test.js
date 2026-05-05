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
        expect(material.userData.earthAtmosphereRimStrength).toBe(0);
        expect(material.userData.earthNightMapIntensity).toBeCloseTo(0.08, 4);
        expect(material.userData.earthNightMapExponent).toBeCloseTo(2.25, 4);

        renderer.dispose();
    });
});
