export function createCameraActions({
    animationScenes,
    getConfig,
    readCameraMode,
    readPlaneSelection,
    setPlaneSelection,
    handlePlaneChange,
    readLookMode,
    render,
    getMoonPhaseCamera,
    setMoonPhaseCamera,
    getViewSky,
}) {
    function toggleCamera() {
        const val = readCameraMode();

        if (val === "default") {
            setMoonPhaseCamera(false);
        } else {
            setMoonPhaseCamera(true);
        }

        const config = getConfig();
        if (animationScenes[config] && animationScenes[config].initialized3D) {
            animationScenes[config].setCameraParameters(false);
            animationScenes[config].skyContainer.visible = !getMoonPhaseCamera() && getViewSky();
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
