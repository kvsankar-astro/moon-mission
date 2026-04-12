import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import {
    CAMERA_LOOK_MODE,
    CAMERA_POSITION_MODE,
    CameraController,
} from "../src/platform/js/rendering/camera-controller.js";

function createController() {
    const controller = new CameraController(1280, 720, 10);
    controller.createMainCamera(60);
    controller.controls = {
        target: new THREE.Vector3(),
        dispatchEvent: vi.fn(),
        enabled: true,
        noPan: false,
        noRotate: false,
        noZoom: false,
    };
    return controller;
}

function createWheelEvent(deltaY = 120) {
    return {
        deltaY,
        preventDefault: vi.fn(),
    };
}

describe("CameraController mounted wheel FoV behavior", () => {
    it("does not remap mounted wheel input to FoV by default", () => {
        const controller = createController();
        const spacecraft = new THREE.Object3D();
        spacecraft.position.set(12, -4, 7);
        spacecraft.updateMatrixWorld(true);

        controller.setFromToModes(CAMERA_POSITION_MODE.SPACECRAFT, CAMERA_LOOK_MODE.MANUAL);
        controller.updateFromTo({ spacecraft });
        const initialPosition = controller.camera.position.clone();
        const initialFov = controller.camera.fov;
        const wheelEvent = createWheelEvent(120);

        controller._handleMountedWheelAsFov(wheelEvent);

        expect(wheelEvent.preventDefault).not.toHaveBeenCalled();
        expect(controller.camera.position.distanceTo(initialPosition)).toBeLessThan(1e-12);
        expect(controller.camera.fov).toBe(initialFov);
        expect(controller.controls.dispatchEvent).not.toHaveBeenCalled();
    });

    it("does nothing in manual position mode", () => {
        const controller = createController();
        const initialFov = controller.camera.fov;
        const initialPosition = controller.camera.position.clone();
        const wheelEvent = createWheelEvent(-240);

        controller.setFromToModes(CAMERA_POSITION_MODE.MANUAL, CAMERA_LOOK_MODE.MANUAL);
        controller._handleMountedWheelAsFov(wheelEvent);

        expect(wheelEvent.preventDefault).not.toHaveBeenCalled();
        expect(controller.camera.fov).toBe(initialFov);
        expect(controller.camera.position.distanceTo(initialPosition)).toBeLessThan(1e-12);
    });

    it("preserves mounted offset distance as the followed body moves", () => {
        const controller = createController();
        const spacecraft = new THREE.Object3D();
        spacecraft.position.set(3, 2, 1);
        spacecraft.updateMatrixWorld(true);

        controller.setFromToModes(CAMERA_POSITION_MODE.SPACECRAFT, CAMERA_LOOK_MODE.MANUAL);
        controller.setMountOffset(new THREE.Vector3(0, 0, 5));
        controller.updateFromTo({ spacecraft });

        spacecraft.position.set(-8, 5, 13);
        spacecraft.updateMatrixWorld(true);
        controller.updateFromTo({ spacecraft });

        expect(controller.camera.position.distanceTo(spacecraft.position)).toBeCloseTo(5, 8);
    });

    it("preserves full camera offset in follow mode as the target moves", () => {
        const controller = createController();
        const moon = new THREE.Object3D();
        moon.position.set(100, 200, 300);
        moon.updateMatrixWorld(true);

        controller.camera.position.set(150, 210, 320);
        controller.setFromToModes(CAMERA_POSITION_MODE.MANUAL, CAMERA_LOOK_MODE.MOON);
        controller.updateFromTo({ moon });

        expect(controller.camera.position.x).toBeCloseTo(150, 8);
        expect(controller.camera.position.y).toBeCloseTo(210, 8);
        expect(controller.camera.position.z).toBeCloseTo(320, 8);

        moon.position.set(110, 220, 330);
        moon.updateMatrixWorld(true);
        controller.updateFromTo({ moon });

        expect(controller.camera.position.x).toBeCloseTo(160, 8);
        expect(controller.camera.position.y).toBeCloseTo(230, 8);
        expect(controller.camera.position.z).toBeCloseTo(350, 8);
    });

    it("can still opt into mounted FoV wheel behavior explicitly", () => {
        const controller = createController();
        const spacecraft = new THREE.Object3D();
        spacecraft.position.set(12, -4, 7);
        spacecraft.updateMatrixWorld(true);

        controller.setMountedWheelFovEnabled(true);
        controller.setFromToModes(CAMERA_POSITION_MODE.SPACECRAFT, CAMERA_LOOK_MODE.MANUAL);
        controller.updateFromTo({ spacecraft });
        const initialPosition = controller.camera.position.clone();
        const initialFov = controller.camera.fov;
        const wheelEvent = createWheelEvent(120);

        controller._handleMountedWheelAsFov(wheelEvent);

        expect(wheelEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(controller.camera.position.distanceTo(initialPosition)).toBeLessThan(1e-12);
        expect(controller.camera.fov).toBeCloseTo(initialFov + 1, 8);
        expect(controller.controls.dispatchEvent).toHaveBeenCalledWith({ type: "change" });
    });
});
