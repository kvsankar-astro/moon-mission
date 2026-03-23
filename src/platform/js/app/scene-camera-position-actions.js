export function computeCameraDistance(position, distance3D) {
    return distance3D(position);
}

export function createSceneCameraPositionActions({ cameraControlsCallback, distance3D }) {
    function setCameraPosition(scene, x, y, z) {
        if (scene.cameraController) {
            scene.cameraController.setPosition(x, y, z);
        }

        if (scene.skyContainer && scene.camera) {
            scene.skyContainer.position.setFromMatrixPosition(scene.camera.matrixWorld);
        }

        if (scene.cameraController) {
            scene.cameraController.update();
            cameraControlsCallback();
        }
    }

    function cameraDisntance(position) {
        return computeCameraDistance(position, distance3D);
    }

    return { setCameraPosition, cameraDisntance };
}

