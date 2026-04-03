export function createScene3dInitActions({
    THREE,
    createPlaceholderSceneTextures,
    loadSceneTextures,
    applyAndRefreshSceneTextures,
    render,
}) {
    function init3d(scene, callback) {
        if (scene.initialized3D) {
            return;
        }

        const placeholderTextures = createPlaceholderSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
        });
        applyAndRefreshSceneTextures(scene, placeholderTextures, { disposePrevious: false });
        scene.init3dRest();
        callback();

        loadSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
        }).then(
            (textures) => {
                applyAndRefreshSceneTextures(scene, textures, { disposePrevious: true });
                render?.();
            },
            (error) => {
                console.error("Error: couldn't load textures. Using placeholders:", error);
            },
        );
    }

    return { init3d };
}
