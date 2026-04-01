import { describe, expect, it, vi } from "vitest";

import { PHYSICS_CONSTANTS as PC } from "../src/platform/js/core/constants.js";
import { Animation3DController } from "../src/platform/js/controllers/animation-3d-controller.js";

function createCraftBodyState(x, y, z) {
    return {
        available: true,
        position: { x, y, z },
        velocity: { vx: 0, vy: 0, vz: 0 },
    };
}

function createTrailLine() {
    const attr = {
        array: new Float32Array(18),
        needsUpdate: false,
    };
    return {
        geometry: {
            getAttribute: vi.fn(() => attr),
            setDrawRange: vi.fn(),
            computeBoundingSphere: vi.fn(),
        },
    };
}

describe("Animation3DController", () => {
    it("updates trailing orbit draw ranges for each visible craft", () => {
        const tailLine = createTrailLine();
        const midLine = createTrailLine();
        const headGlowLine = createTrailLine();
        const headLine = createTrailLine();
        const scene = {
            initialized3D: true,
            light: { position: { set: vi.fn(() => ({ normalize: vi.fn() })) } },
            light2: { position: { set: vi.fn(() => ({ normalize: vi.fn() })) } },
            rotateEarth: vi.fn(),
            rotateMoon: vi.fn(),
            secondaryBody: "MOON",
            secondaryBody3D: { position: { set: vi.fn() } },
            craftsById: {
                ORB: {
                    position: { set: vi.fn() },
                    lookAt: vi.fn(),
                    up: { set: vi.fn() },
                },
            },
            dronesById: {},
            orbitTrailLinesByBodyId: {
                ORB: {
                    tailLine,
                    midLine,
                    headGlowLine,
                    headLine,
                },
            },
            curvesById: {
                ORB: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 2, y: 0, z: 0 },
                    { x: 3, y: 0, z: 0 },
                ],
            },
            curveTimesById: {
                ORB: [0, 1000, 2000, 3000],
            },
        };

        const controller = new Animation3DController("lunar", scene);
        controller.render({
            sunLongitude: 0,
            sunDirection: { x: 1, y: 0, z: 0 },
            time: 2500,
            bodies: {
                ORB: createCraftBodyState(10, 20, 30),
            },
        }, {
            craftId: "ORB",
            pixelsPerAU: PC.KM_PER_AU,
            updateCraftScale: vi.fn(),
        });

        expect(tailLine.geometry.setDrawRange).toHaveBeenCalledWith(0, expect.any(Number));
        expect(midLine.geometry.setDrawRange).toHaveBeenCalledWith(0, expect.any(Number));
        expect(headGlowLine.geometry.setDrawRange).toHaveBeenCalledWith(0, expect.any(Number));
        expect(headLine.geometry.setDrawRange).toHaveBeenCalledWith(0, expect.any(Number));
        expect(tailLine.geometry.computeBoundingSphere).toHaveBeenCalled();
        expect(midLine.geometry.computeBoundingSphere).toHaveBeenCalled();
        expect(headGlowLine.geometry.computeBoundingSphere).toHaveBeenCalled();
        expect(headLine.geometry.computeBoundingSphere).toHaveBeenCalled();
    });
});
