import {
    MOON_RENDER_ASSET_PATHS_STORAGE_KEY,
    MOON_RENDER_ASSET_PROFILE_STORAGE_KEY,
} from "./moon-render-asset-profiles.js";

function normalizeProfile(value) {
    return String(value || "").trim().toLowerCase() === "quality" ? "quality" : "fast";
}

function readStoredProfile(globalObject) {
    const storage = safeGetStorage(globalObject);
    const storedProfile = storage?.getItem?.(MOON_RENDER_ASSET_PROFILE_STORAGE_KEY);
    return storedProfile ? normalizeProfile(storedProfile) : null;
}

function readQueryProfile(globalObject) {
    try {
        const params = new URLSearchParams(String(globalObject?.location?.search || ""));
        const raw = params.get("moonRenderProfile") || params.get("moonProfile");
        return raw ? normalizeProfile(raw) : null;
    } catch {
        return null;
    }
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
    applyAndRefreshSceneTextures,
    render,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    async function setMoonRenderProfile(profile) {
        const normalized = persistActiveProfile(globalObject, profile);
        const sceneMap = animationScenes || {};
        const initializedScenes = Object.values(sceneMap).filter((scene) => !!scene?.initialized3D);

        if (!initializedScenes.length) {
            return normalized;
        }

        const textures = await loadSceneTextures({
            THREE,
            minFilter: THREE.LinearFilter,
            globalObject,
        });

        initializedScenes.forEach((scene) => {
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
        return readQueryProfile(globalObject) || readStoredProfile(globalObject) || "fast";
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
