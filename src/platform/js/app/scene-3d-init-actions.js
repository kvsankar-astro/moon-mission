import { resolveMoonRenderAssetProfile } from "./moon-render-asset-profiles.js";

export function createScene3dInitActions({
    THREE,
    createPlaceholderSceneTextures,
    loadSceneTextures,
    applyAndRefreshSceneTextures,
    render,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    function init3d(scene, callback) {
        if (scene.initialized3D) {
            return;
        }

        const placeholderTextures = createPlaceholderSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            globalObject,
        });
        applyAndRefreshSceneTextures(scene, placeholderTextures, { disposePrevious: false });
        scene.init3dRest();
        callback();

        loadSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            globalObject,
        }).then(
            (textures) => {
                const applyTextures = (resolvedTextures) => {
                    applyAndRefreshSceneTextures(scene, resolvedTextures, { disposePrevious: true });
                    render?.();
                };
                applyTextures(textures);

                const requestedProfile = resolveMoonRenderAssetProfile({ globalObject });
                if ((textures?.moonRenderProfile || "fast") === requestedProfile) {
                    return;
                }

                loadSceneTextures({
                    THREE,
                    minFilter: THREE.LinearFilter,
                    globalObject,
                }).then(
                    (latestTextures) => {
                        applyTextures(latestTextures);
                    },
                    (error) => {
                        console.warn("Moon profile refresh after scene init failed:", error);
                    },
                );
            },
            (error) => {
                console.error("Error: couldn't load textures. Using placeholders:", error);
            },
        );
    }

    return { init3d };
}
