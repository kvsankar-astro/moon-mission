import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
    isStarVisibleForMagnitudeLimit,
    StarRenderer,
} from "../src/platform/js/rendering/StarRenderer.js";

describe("StarRenderer", () => {
    it("supports a runtime limiting magnitude uniform", () => {
        const parent = new THREE.Group();
        const renderer = new StarRenderer(parent, {
            catalog: [
                { raDeg: 0, decDeg: 0, vmag: 1, name: "Bright" },
                { raDeg: 10, decDeg: 0, vmag: 5, name: "Faint" },
            ],
        });

        expect(renderer.uniforms.uMagnitudeLimit.value).toBe(8);

        renderer.setParams({ magnitudeLimit: 4.2 });
        expect(renderer.uniforms.uMagnitudeLimit.value).toBeCloseTo(4.2);

        renderer.setParams({ magnitudeLimit: -3 });
        expect(renderer.uniforms.uMagnitudeLimit.value).toBe(-3);

        renderer.setParameters({ magnitude_limit: 99 });
        expect(renderer.uniforms.uMagnitudeLimit.value).toBe(8);
    });

    it("treats lower limiting magnitude as fewer visible stars", () => {
        const magnitudes = [-1, 0, 2, 4, 6];
        const visibleAt2 = magnitudes.filter((magnitude) => isStarVisibleForMagnitudeLimit(magnitude, 2));
        const visibleAt6 = magnitudes.filter((magnitude) => isStarVisibleForMagnitudeLimit(magnitude, 6));

        expect(visibleAt2).toEqual([-1, 0, 2]);
        expect(visibleAt6).toEqual(magnitudes);
        expect(visibleAt2.length).toBeLessThan(visibleAt6.length);
    });
});
