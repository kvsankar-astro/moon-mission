import { resolveMoonRenderAssetProfile } from "./moon-render-asset-profiles.js";

export function createScene3dInitActions({
    THREE,
    createPlaceholderSceneTextures,
    loadSceneTextures,
    applyAndRefreshSceneTextures,
    render,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    function markTextureLoadDone(scene, state) {
        scene.textureLoadState = state;
        scene.textureLoadPending = false;
        scene.textureLoadPromise = null;
    }

    function beginTextureLoad(scene) {
        if (!scene || scene.textureLoadState === "loading" || scene.textureLoadState === "ready") {
            return scene?.textureLoadPromise || null;
        }

        scene.textureLoadState = "loading";
        scene.textureLoadPending = true;
        scene.textureLoadPromise = loadSceneTextures({
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
                    markTextureLoadDone(scene, "ready");
                    return;
                }

                return loadSceneTextures({
                    THREE,
                    minFilter: THREE.LinearFilter,
                    globalObject,
                }).then(
                    (latestTextures) => {
                        applyTextures(latestTextures);
                        markTextureLoadDone(scene, "ready");
                    },
                    (error) => {
                        console.warn("Moon profile refresh after scene init failed:", error);
                        markTextureLoadDone(scene, "ready");
                    },
                );
            },
            (error) => {
                console.error("Error: couldn't load textures. Using placeholders:", error);
                markTextureLoadDone(scene, "error");
            },
        );
        return scene.textureLoadPromise;
    }

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
        scene.textureLoadState = "deferred";
        scene.textureLoadPending = false;
        scene.textureLoadPromise = null;
        scene.beginTextureLoad = () => beginTextureLoad(scene);
    }

    return { init3d };
}
