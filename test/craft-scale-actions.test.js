import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { createCraftScaleActions } from "../assets/platform/js/app/craft-scale-actions.js";

function createScene({
    craftVisible = true,
    hideCraftForMountedCamera = false,
    cameraX = 10,
} = {}) {
    const craft = new THREE.Object3D();
    const drone = new THREE.Object3D();
    const camera = new THREE.Object3D();

    craft.position.set(0, 0, 0);
    drone.position.set(0, 0, 0);
    camera.position.set(cameraX, 0, 0);

    return {
        initialized3D: true,
        craft,
        drone,
        camera,
        droneCamera: camera,
        craftVisible,
        hideCraftForMountedCamera,
    };
}

describe("createCraftScaleActions", () => {
    it("hides craft in mounted spacecraft camera mode", () => {
        const scene = createScene({ hideCraftForMountedCamera: true });
        const actions = createCraftScaleActions({
            THREE,
            animationScenes: { geo: scene },
            getConfig: () => "geo",
            getJoyRideFlag: () => false,
            getLandingFlag: () => false,
            getDefaultCameraDistance: () => 100,
            getAnimTime: () => 0,
            isLocationAvaialable: () => true,
        });

        actions.updateCraftScale();

        expect(scene.craft.visible).toBe(false);
    });

    it("keeps craft visible when mounted override is off", () => {
        const scene = createScene({ hideCraftForMountedCamera: false });
        const actions = createCraftScaleActions({
            THREE,
            animationScenes: { geo: scene },
            getConfig: () => "geo",
            getJoyRideFlag: () => false,
            getLandingFlag: () => false,
            getDefaultCameraDistance: () => 100,
            getAnimTime: () => 0,
            isLocationAvaialable: () => true,
        });

        actions.updateCraftScale();

        expect(scene.craft.visible).toBe(true);
    });
});
