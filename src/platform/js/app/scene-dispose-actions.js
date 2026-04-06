export function createSceneDisposeActions() {
    function dispose(scene) {
        console.debug("Disposing AnimationScene with complete WebGL cleanup...");

        scene.disposeEarthLocations();
        scene.disposeBodyHalos?.();
        scene.disposeEarth();
        scene.disposeSky();
        scene.disposeSun();
        scene.disposeMoonLocations();
        scene.disposeMoon();
        scene.disposeSpacecraftModel();
        scene.disposeSpacecraftCurve();
        scene.disposeMoonSOI();
        scene.disposeLineOfSight();
        scene.disposeAxesHelper();
        scene.disposeLight();
        scene.disposeCamera();
        scene.disposeSpacecraft();

        if (scene.sceneHelpers) {
            scene.sceneHelpers = null;
        }

        console.debug("AnimationScene disposal completed");
    }

    return { dispose };
}

