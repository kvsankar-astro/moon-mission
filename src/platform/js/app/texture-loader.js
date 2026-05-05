import { DEFAULT_MOON_RENDER_ASSET_PROFILES, resolveMoonRenderAssetSelection } from "./moon-render-asset-profiles.js";

export const DEFAULT_SCENE_TEXTURE_FILES = {
    earthTexture: "images/earth/2_no_clouds_8k.jpg",
    // Mirrored from NASA's Blue Marble cloud composite to keep Photo Mode CORS-safe.
    earthPhotoTexture: "images/earth/nasa_blue_marble_clouds_2048.jpg",
    earthSpecularTexture: "images/earth/earthspec1k.jpg",
    earthNightTexture: "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg",
    moonMap: DEFAULT_MOON_RENDER_ASSET_PROFILES.fast.moonMap,
    moonDisplacementMap: DEFAULT_MOON_RENDER_ASSET_PROFILES.fast.moonDisplacementMap,
    // Primary sky background is treated as Milky Way + diffuse background layer.
    skyMilkyWayTexture: "images/sky/starmap_4k.jpg",
    skyTexture: "images/sky/starmap_4k.jpg",
    skyConstellationTexture: "images/sky/constellation_figures_2020_4k.jpg",
};

const PLACEHOLDER_COLORS = Object.freeze({
    earthTexture: 0x2f6fe0,
    earthPhotoTexture: 0x6b89c9,
    earthSpecularTexture: 0x111111,
    earthNightTexture: 0x000000,
    moonMap: 0x8f8f8f,
    moonDisplacementMap: 0x808080,
    skyMilkyWayTexture: 0x081325,
    skyTexture: 0x081325,
    skyConstellationTexture: 0x000000,
});

function loadTexture(loader, fileName) {
    return new Promise((resolve, reject) => {
        loader.load(
            fileName,
            (texture) => resolve(texture),
            undefined,
            (error) => reject(error),
        );
    });
}

async function loadTextureWithFallback(loader, primaryFileName, fallbackFileName, { logLabel = "" } = {}) {
    try {
        return await loadTexture(loader, primaryFileName);
    } catch (primaryError) {
        if (!fallbackFileName || fallbackFileName === primaryFileName) {
            throw primaryError;
        }

        console.warn(
            `Moon asset load failed for ${logLabel || primaryFileName}; falling back to fast profile asset.`,
            primaryError,
        );
        return loadTexture(loader, fallbackFileName);
    }
}

function setColorTextureSpace(THREE, texture) {
    if (!texture) return;
    if ("colorSpace" in texture && THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
    } else if ("encoding" in texture && THREE.sRGBEncoding) {
        texture.encoding = THREE.sRGBEncoding;
    }
}

function applyTextureDefaults({
    THREE,
    texturesByKey,
    minFilter = null,
}) {
    const textures = Object.values(texturesByKey);
    if (minFilter) {
        textures.forEach((texture) => {
            if (!texture) return;
            texture.minFilter = minFilter;
        });
    }

    // Color textures should be sampled in sRGB space.
    setColorTextureSpace(THREE, texturesByKey.earthTexture);
    setColorTextureSpace(THREE, texturesByKey.earthPhotoTexture);
    setColorTextureSpace(THREE, texturesByKey.earthNightTexture);
    setColorTextureSpace(THREE, texturesByKey.moonMap);
    setColorTextureSpace(THREE, texturesByKey.skyMilkyWayTexture);
    setColorTextureSpace(THREE, texturesByKey.skyTexture);
    setColorTextureSpace(THREE, texturesByKey.skyConstellationTexture);
}

function createSolidTexture(THREE, hexColor) {
    const color = THREE.Color ? new THREE.Color(hexColor) : null;
    const r = Math.max(0, Math.min(255, Math.round((color?.r ?? 0) * 255)));
    const g = Math.max(0, Math.min(255, Math.round((color?.g ?? 0) * 255)));
    const b = Math.max(0, Math.min(255, Math.round((color?.b ?? 0) * 255)));
    const data = new Uint8Array([r, g, b, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

export function createPlaceholderSceneTextures({
    THREE,
    minFilter = null,
    search = null,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    const moonAssets = resolveMoonRenderAssetSelection({ search, globalObject });
    const byKey = {
        earthTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthTexture),
        earthPhotoTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthPhotoTexture),
        earthSpecularTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthSpecularTexture),
        earthNightTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthNightTexture),
        moonMap: createSolidTexture(THREE, PLACEHOLDER_COLORS.moonMap),
        moonDisplacementMap: createSolidTexture(THREE, PLACEHOLDER_COLORS.moonDisplacementMap),
        skyMilkyWayTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.skyMilkyWayTexture),
        skyTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.skyTexture),
        skyConstellationTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.skyConstellationTexture),
    };

    applyTextureDefaults({
        THREE,
        texturesByKey: byKey,
        minFilter,
    });

    byKey.moonRenderProfile = moonAssets.profile;
    byKey.moonRenderSettings = moonAssets.activeRenderSettings || null;

    return byKey;
}

export function loadSceneTextures({
    THREE,
    files = DEFAULT_SCENE_TEXTURE_FILES,
    minFilter = null,
    search = null,
    globalObject = typeof window !== "undefined" ? window : globalThis,
}) {
    const loader = new THREE.TextureLoader();
    const moonAssets = resolveMoonRenderAssetSelection({ search, globalObject });
    const resolvedFiles = {
        ...files,
        moonMap: moonAssets.active.moonMap || files.moonMap,
        moonDisplacementMap: moonAssets.active.moonDisplacementMap || files.moonDisplacementMap,
    };

    const entries = Object.entries(resolvedFiles);
    const promises = entries.map(([key, fileName]) => {
        if (key === "moonMap" || key === "moonDisplacementMap") {
            return loadTextureWithFallback(
                loader,
                fileName,
                moonAssets.fallback[key],
                { logLabel: `${moonAssets.profile}.${key}` },
            );
        }
        return loadTexture(loader, fileName);
    });

    return Promise.all(promises).then((textures) => {
        const byKey = {};
        for (let i = 0; i < entries.length; i += 1) {
            const [key] = entries[i];
            byKey[key] = textures[i];
        }
        if (!byKey.skyTexture && byKey.skyMilkyWayTexture) {
            byKey.skyTexture = byKey.skyMilkyWayTexture;
        }

        applyTextureDefaults({
            THREE,
            texturesByKey: byKey,
            minFilter,
        });

        byKey.moonRenderProfile = moonAssets.profile;
        byKey.moonRenderSettings = moonAssets.activeRenderSettings || null;

        return byKey;
    });
}
