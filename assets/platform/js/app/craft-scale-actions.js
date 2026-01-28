export function createCraftScaleActions({
    THREE,
    animationScenes,
    getConfig,
    getJoyRideFlag,
    getLandingFlag,
    getDefaultCameraDistance,
    getAnimTime,
    isLocationAvaialable,
}) {
    function updateCraftScale() {
        const config = getConfig();
        const scene = animationScenes[config];
        if (!scene || !scene.initialized3D) return;

        const craftLocation = new THREE.Vector3();
        scene.craft.getWorldPosition(craftLocation);

        const cameraLocation = new THREE.Vector3();
        if (getJoyRideFlag()) {
            scene.camera.getWorldPosition(cameraLocation); // not craftCamera
        } else if (getLandingFlag()) {
            scene.droneCamera.getWorldPosition(cameraLocation);
        } else {
            scene.camera.getWorldPosition(cameraLocation);
        }

        const distance = cameraLocation.distanceTo(craftLocation);
        let scale = distance / getDefaultCameraDistance();
        const fov = scene?.camera?.fov;
        if (Number.isFinite(fov) && fov > 0) {
            scale = scale * (fov / 50);
        }
        if (getLandingFlag()) scale = scale * 5;

        scene.craft.scale.set(scale, scale, scale);
        scene.drone.scale.set(scale, scale, scale);

        if (isLocationAvaialable("SC", getAnimTime())) {
            scene.craft.visible = scene.craftVisible;
            scene.drone.visible = false;
        } else {
            scene.craft.visible = false;
            scene.drone.visible = false;
        }
    }

    function cameraControlsCallback() {
        const config = getConfig();
        const scene = animationScenes[config];
        if (!scene || !scene.craft || !scene.initialized3D) return;
        updateCraftScale();
    }

    return { updateCraftScale, cameraControlsCallback };
}
