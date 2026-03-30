import { describe, expect, it } from "vitest";

import { computeOrbitOverlapOpacities } from "../src/platform/js/app/orbit-overlap-core.js";

describe("orbit overlap core", () => {
    it("dims denser chunks more than sparse chunks", () => {
        const result = computeOrbitOverlapOpacities({
            CH3L: [
                [{ x: 0, y: 0 }, { x: 36, y: 0 }],
                [{ x: 0, y: 0 }, { x: 36, y: 0 }],
                [{ x: 120, y: 120 }, { x: 156, y: 120 }],
            ],
        }, {
            gridSizePx: 6,
            sampleStepPx: 3,
            minFactor: 0.02,
            maxFactor: 0.15,
        });

        const opacities = result.opacitiesByBodyId.CH3L;
        expect(opacities[0]).toBeLessThan(opacities[2]);
        expect(opacities[1]).toBeLessThan(opacities[2]);
    });
});
