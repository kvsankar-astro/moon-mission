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
    it("updates positions for every craft body present in the scene state", () => {
        const primaryCraft = {
            position: { set: vi.fn() },
            lookAt: vi.fn(),
            up: { set: vi.fn() },
        };
        const compareCraft = {
            position: { set: vi.fn() },
            lookAt: vi.fn(),
            up: { set: vi.fn() },
        };
        const scene = {
            initialized3D: true,
            light: { position: { set: vi.fn(() => ({ normalize: vi.fn() })) } },
            light2: { position: { set: vi.fn(() => ({ normalize: vi.fn() })) } },
            rotateEarth: vi.fn(),
            rotateMoon: vi.fn(),
            secondaryBody: "MOON",
            secondaryBody3D: { position: { set: vi.fn() } },
            craftsById: {
                ORB: primaryCraft,
                CMP: compareCraft,
            },
            dronesById: {},
            orbitTrailLinesByBodyId: {},
            curvesById: {},
            curveTimesById: {},
        };

        const controller = new Animation3DController("geo", scene);
        controller.render({
            sunLongitude: 0,
            sunDirection: { x: 1, y: 0, z: 0 },
            time: 2500,
            bodies: {
                ORB: createCraftBodyState(10, 20, 30),
                CMP: createCraftBodyState(-15, 5, 12),
            },
        }, {
            craftId: "ORB",
            pixelsPerAU: PC.KM_PER_AU,
            updateCraftScale: vi.fn(),
        });

        expect(primaryCraft.position.set).toHaveBeenCalledWith(10, 20, 30);
        expect(compareCraft.position.set).toHaveBeenCalledWith(-15, 5, 12);
    });

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

    it("applies compare-mode display overrides without altering raw scene state", () => {
        const fixedSunDirection = { x: 0, y: 1, z: 0 };
        const updateSolarArrayTracking = vi.fn();
        const craft = {
            position: { set: vi.fn() },
            lookAt: vi.fn(),
            up: { set: vi.fn() },
            quaternion: { multiply: vi.fn() },
        };
        const scene = {
            initialized3D: true,
            light: {
                position: { set: vi.fn() },
                target: { position: { set: vi.fn() }, updateMatrixWorld: vi.fn() },
                shadow: { camera: { updateProjectionMatrix: vi.fn() } },
            },
            light2: { position: { set: vi.fn() } },
            lightFill: {
                position: { set: vi.fn() },
                intensity: 0.25,
            },
            sunRenderer: {
                setDirection: vi.fn(),
                updateAppearance: vi.fn(),
            },
            skyRenderer: {
                setTime: vi.fn(),
            },
            rotateEarth: vi.fn(),
            rotateMoon: vi.fn(),
            secondaryBody: "MOON",
            secondaryBody3D: { position: { set: vi.fn() } },
            craftsById: {
                ORB: craft,
            },
            dronesById: {},
            spacecraftRenderersById: {
                ORB: {
                    updateSolarArrayTracking,
                },
            },
            orbitTrailLinesByBodyId: {},
            curvesById: {},
            curveTimesById: {},
        };

        const controller = new Animation3DController("geo", scene);
        controller.render({
            sunLongitude: 0,
            sunDirection: { x: 1, y: 0, z: 0 },
            sunDirections: {
                earthCentered: { x: 1, y: 0, z: 0 },
            },
            time: 2500,
            bodies: {
                EARTH: createCraftBodyState(0, 0, 0),
                MOON: createCraftBodyState(0.0025, 0, 0),
                ORB: createCraftBodyState(10, 20, 30),
            },
        }, {
            craftId: "ORB",
            pixelsPerAU: PC.KM_PER_AU,
            compareMode: true,
            compareDisplayProfile: {
                freezeEarthRotation: true,
                freezeMoonRotation: true,
                freezeSkyOrientation: true,
                disableEarthshine: true,
                fixedSunDirection,
            },
        });

        expect(scene.skyRenderer.setTime).not.toHaveBeenCalled();
        expect(scene.rotateEarth).not.toHaveBeenCalled();
        expect(scene.rotateMoon).not.toHaveBeenCalled();
        expect(scene.sunRenderer.setDirection).toHaveBeenCalledWith(0, 1, 0);
        expect(scene.light2.position.set).toHaveBeenCalledWith(0, 1, 0);
        expect(updateSolarArrayTracking).toHaveBeenCalledWith(fixedSunDirection);
        expect(scene.lightFill.intensity).toBe(0);
    });
});
