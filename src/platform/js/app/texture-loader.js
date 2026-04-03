export const DEFAULT_SCENE_TEXTURE_FILES = {
    earthTexture: "images/earth/2_no_clouds_8k.jpg",
    earthSpecularTexture: "images/earth/earthspec1k.jpg",
    moonMap: "images/moon/Solarsystemscope_texture_8k_moon.jpg",
    moonDisplacementMap: "images/moon/ldem_16_gsfc.png",
    skyTexture: "images/sky/starmap_2020_4k_stars.jpg",
    skyConstellationTexture: "images/sky/constellation_figures_2020_4k.jpg",
};

const PLACEHOLDER_COLORS = Object.freeze({
    earthTexture: 0x2f6fe0,
    earthSpecularTexture: 0x111111,
    moonMap: 0x8f8f8f,
    moonDisplacementMap: 0x808080,
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
    setColorTextureSpace(THREE, texturesByKey.moonMap);
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
}) {
    const byKey = {
        earthTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthTexture),
        earthSpecularTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.earthSpecularTexture),
        moonMap: createSolidTexture(THREE, PLACEHOLDER_COLORS.moonMap),
        moonDisplacementMap: createSolidTexture(THREE, PLACEHOLDER_COLORS.moonDisplacementMap),
        skyTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.skyTexture),
        skyConstellationTexture: createSolidTexture(THREE, PLACEHOLDER_COLORS.skyConstellationTexture),
    };

    applyTextureDefaults({
        THREE,
        texturesByKey: byKey,
        minFilter,
    });

    return byKey;
}

export function loadSceneTextures({
    THREE,
    files = DEFAULT_SCENE_TEXTURE_FILES,
    minFilter = null,
}) {
    const loader = new THREE.TextureLoader();

    const entries = Object.entries(files);
    const promises = entries.map(([, fileName]) => loadTexture(loader, fileName));

    return Promise.all(promises).then((textures) => {
        const byKey = {};
        for (let i = 0; i < entries.length; i += 1) {
            const [key] = entries[i];
            byKey[key] = textures[i];
        }

        applyTextureDefaults({
            THREE,
            texturesByKey: byKey,
            minFilter,
        });

        return byKey;
    });
}
