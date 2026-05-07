import {
    MOON_RENDER_ASSET_PATHS_STORAGE_KEY,
    MOON_RENDER_ASSET_PROFILE_STORAGE_KEY,
    resolveMoonRenderAssetProfile,
} from "./moon-render-asset-profiles.js";

function normalizeProfile(value) {
    return String(value || "").trim().toLowerCase() === "quality" ? "quality" : "fast";
}

function safeGetStorage(globalObject) {
    try {
        return globalObject?.localStorage || null;
    } catch {
        return null;
    }
}

function persistActiveProfile(globalObject, profile) {
    const normalized = normalizeProfile(profile);
    globalObject.MOON_RENDER_ASSET_PROFILE = normalized;
    const storage = safeGetStorage(globalObject);
    storage?.setItem?.(MOON_RENDER_ASSET_PROFILE_STORAGE_KEY, normalized);
    return normalized;
}

export function createMoonRenderProfileActions({
    THREE,
    animationScenes,
    loadSceneTextures,
    loadMoonRenderProfileTextures = null,
    applyAndRefreshSceneTextures,
    render,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    const loadMoonTextures = typeof loadMoonRenderProfileTextures === "function"
        ? loadMoonRenderProfileTextures
        : loadSceneTextures;
    let latestProfileLoadId = 0;

    async function setMoonRenderProfile(profile) {
        const normalized = persistActiveProfile(globalObject, profile);
        latestProfileLoadId += 1;
        const profileLoadId = latestProfileLoadId;
        const sceneMap = animationScenes || {};
        const initializedScenes = Object.values(sceneMap).filter((scene) => !!scene?.initialized3D);

        if (!initializedScenes.length) {
            return normalized;
        }

        const textures = await loadMoonTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            moonRenderProfile: normalized,
            globalObject,
        });

        const activeProfile = getMoonRenderProfile();
        if (profileLoadId !== latestProfileLoadId || activeProfile !== normalized) {
            return activeProfile;
        }

        Object.values(sceneMap).filter((scene) => !!scene?.initialized3D).forEach((scene) => {
            applyAndRefreshSceneTextures(scene, textures, { disposePrevious: true });
        });

        render?.();
        return normalized;
    }

    function getMoonRenderProfile() {
        const globalValue = String(globalObject?.MOON_RENDER_ASSET_PROFILE || "").trim();
        if (globalValue) {
            return normalizeProfile(globalValue);
        }
        return resolveMoonRenderAssetProfile({ globalObject });
    }

    function resetMoonRenderAssetPathOverrides() {
        delete globalObject.MOON_RENDER_ASSET_PATHS;
        const storage = safeGetStorage(globalObject);
        storage?.removeItem?.(MOON_RENDER_ASSET_PATHS_STORAGE_KEY);
    }

    return {
        getMoonRenderProfile,
        setMoonRenderProfile,
        resetMoonRenderAssetPathOverrides,
    };
}
