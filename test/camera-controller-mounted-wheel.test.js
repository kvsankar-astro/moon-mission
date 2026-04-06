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
    it("changes FoV without changing camera position in mounted spacecraft mode", () => {
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

        expect(wheelEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(controller.camera.position.distanceTo(initialPosition)).toBeLessThan(1e-12);
        expect(controller.camera.fov).toBeCloseTo(initialFov + 1, 8);
        expect(controller.controls.dispatchEvent).toHaveBeenCalledWith({ type: "change" });
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

    it("keeps camera anchored to spacecraft origin after wheel FoV updates", () => {
        const controller = createController();
        const spacecraft = new THREE.Object3D();
        spacecraft.position.set(3, 2, 1);
        spacecraft.updateMatrixWorld(true);

        controller.setFromToModes(CAMERA_POSITION_MODE.SPACECRAFT, CAMERA_LOOK_MODE.MANUAL);
        controller.updateFromTo({ spacecraft });
        controller._handleMountedWheelAsFov(createWheelEvent(-120));

        spacecraft.position.set(-8, 5, 13);
        spacecraft.updateMatrixWorld(true);
        controller.updateFromTo({ spacecraft });

        expect(controller.camera.position.distanceTo(spacecraft.position)).toBeLessThan(1e-12);
    });
});
