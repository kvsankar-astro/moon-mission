export function createScene3dInitActions({ THREE, loadSceneTextures, applySceneTextures }) {
    function init3d(scene, callback) {
        if (scene.initialized3D) {
            return;
        }

        loadSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
        }).then(
            (textures) => {
                applySceneTextures(scene, textures);
                scene.init3dRest();
                callback();
            },
            (error) => {
                console.error("Error: couldn't load textures:", error);
            },
        );
    }

    return { init3d };
}

