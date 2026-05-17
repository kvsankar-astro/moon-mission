function adjustSceneCameraProjectionAndSky({ scene, cameraControlsCallback }) {
    if (!scene || !scene.cameraControlsEnabled || !scene.camera) {
        return;
    }

    scene.camera.updateProjectionMatrix();
    scene.camera.updateMatrixWorld?.(true);
    scene.skyContainer?.position?.copy?.(scene.camera.position);

    // Avoid snap-back when free-fly mode is active.
    if (!scene.cameraController?._freeFlyActive) {
        scene.cameraControls?.update?.();
        cameraControlsCallback?.();
    }
}

export { adjustSceneCameraProjectionAndSky };
