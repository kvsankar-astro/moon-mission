import { resolveMoonRenderAssetProfile } from "./moon-render-asset-profiles.js";

export function createScene3dInitActions({
    THREE,
    createPlaceholderSceneTextures,
    loadSceneTextures,
    loadMoonRenderProfileTextures = null,
    applyAndRefreshSceneTextures,
    render,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    const loadMoonTextures = typeof loadMoonRenderProfileTextures === "function"
        ? loadMoonRenderProfileTextures
        : loadSceneTextures;

    function markTextureLoadDone(scene, state) {
        scene.textureLoadState = state;
        scene.textureLoadPending = false;
        scene.textureLoadPromise = null;
    }

    function resolveRequestedMoonProfile() {
        return resolveMoonRenderAssetProfile({ globalObject });
    }

    function refreshMoonProfileInBackground(scene, requestedProfile, applyTextures) {
        if (!scene || !requestedProfile || requestedProfile === (scene.moonRenderProfile || "fast")) {
            return null;
        }

        scene.moonTextureLoadState = "loading";
        scene.moonTextureLoadPending = true;
        scene.moonTextureLoadPromise = loadMoonTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            moonRenderProfile: requestedProfile,
            globalObject,
        }).then(
            (textures) => {
                if (resolveRequestedMoonProfile() !== requestedProfile) {
                    scene.moonTextureLoadState = "stale";
                    return;
                }
                applyTextures(textures);
                scene.moonTextureLoadState = "ready";
            },
            (error) => {
                console.warn("Moon profile refresh after scene init failed:", error);
                scene.moonTextureLoadState = "error";
            },
        ).finally(() => {
            scene.moonTextureLoadPending = false;
            scene.moonTextureLoadPromise = null;
        });
        return scene.moonTextureLoadPromise;
    }

    function beginTextureLoad(scene) {
        if (!scene || scene.textureLoadState === "loading" || scene.textureLoadState === "ready") {
            return scene?.textureLoadPromise || null;
        }

        scene.textureLoadState = "loading";
        scene.textureLoadPending = true;
        const requestedProfile = resolveRequestedMoonProfile();
        scene.textureLoadPromise = loadSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            moonRenderProfile: requestedProfile,
            globalObject,
        }).then(
            (textures) => {
                const applyTextures = (resolvedTextures) => {
                    // Pass requestRender so the deferred generated-normal-map
                    // refresh (scheduled inside applyAndRefreshSceneTextures
                    // when disposePrevious=true) wakes the on-demand render
                    // loop after the build completes. Without this the
                    // upgraded normal map only becomes visible on the next
                    // user interaction — visible regression on Artemis II's
                    // quality-profile startup path.
                    applyAndRefreshSceneTextures(scene, resolvedTextures, {
                        disposePrevious: true,
                        requestRender: render,
                    });
                    render?.();
                };
                applyTextures(textures);

                const latestRequestedProfile = resolveRequestedMoonProfile();
                if ((textures?.moonRenderProfile || "fast") !== latestRequestedProfile) {
                    return refreshMoonProfileInBackground(
                        scene,
                        latestRequestedProfile,
                        applyTextures,
                    ).finally(() => {
                        markTextureLoadDone(scene, "ready");
                    });
                }
                markTextureLoadDone(scene, "ready");
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
