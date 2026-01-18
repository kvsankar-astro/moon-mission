export function createCameraActions({
    animationScenes,
    getConfig,
    readCameraMode,
    readPlaneSelection,
    setPlaneSelection,
    handlePlaneChange,
    readLookMode,
    render,
    getViewSky,
}) {
    function setLookModeForScene(scene, mode) {
        if (!scene || !scene.cameraController?.setFromToModes) return;

        // Only look mode is changed for now; position remains manual.
        scene.cameraController.setFromToModes("manual", mode);
    }

    function toggleCamera() {
        const val = readCameraMode();

        const config = getConfig();
        const scene = animationScenes[config];
        if (scene && scene.initialized3D) {
            if (val === "default") {
                setLookModeForScene(scene, "manual");
            } else {
                setLookModeForScene(scene, "moon");
            }

            scene.setCameraParameters(false);
            scene.skyContainer.visible = scene.cameraController?.lookMode !== "moon" && getViewSky();
        }

        render();
    }

    function togglePlane() {
        setPlaneSelection(readPlaneSelection());
        handlePlaneChange(false, false);
    }

    function toggleCameraPos() {
        const val = readCameraMode();
        const config = getConfig();
        if (animationScenes[config] && animationScenes[config].initialized3D) {
            animationScenes[config].toggleCameraPos(val);
        }
    }

    function toggleCameraLook() {
        const val = readLookMode();
        const config = getConfig();
        if (animationScenes[config] && animationScenes[config].initialized3D) {
            animationScenes[config].toggleCameraLook(val);
        }
    }

    return { toggleCamera, togglePlane, toggleCameraPos, toggleCameraLook };
}
