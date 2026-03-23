export function createSceneCameraControllerActions({
    CameraController,
    getDefaultCameraDistance,
    getRendererDomElement,
    cameraControlsCallback,
    render,
}) {
    function addCamera(scene) {
        const defaultCameraDistance = getDefaultCameraDistance();
        scene.cameraController = new CameraController(
            scene.width,
            scene.height,
            defaultCameraDistance,
        );
        scene.cameraController.controlsEnabled = scene.cameraControlsEnabled;

        scene.cameraController.createMainCamera(50);
        scene.setCameraPosition(
            defaultCameraDistance,
            defaultCameraDistance,
            defaultCameraDistance,
        );

        scene.cameraController.createCraftCamera(scene.craft, 50);
        scene.cameraController.createDroneCamera(scene.drone, 100);

        if (scene.cameraControlsEnabled) {
            scene.cameraController.createControls(
                getRendererDomElement(),
                cameraControlsCallback,
                render,
            );
        }

        scene.camera = scene.cameraController.camera;
        scene.craftCamera = scene.cameraController.craftCamera;
        scene.droneCamera = scene.cameraController.droneCamera;
        scene.cameraControls = scene.cameraController.controls;

        scene.setCameraParameters(null, true);
    }

    function disposeCamera(scene) {
        if (scene.cameraController) {
            scene.cameraController.dispose(scene.craft, scene.drone);
            scene.cameraController = null;
        }

        scene.camera = null;
        scene.craftCamera = null;
        scene.droneCamera = null;
        scene.cameraControls = null;
    }

    return { addCamera, disposeCamera };
}

