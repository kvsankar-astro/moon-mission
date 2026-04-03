export const DEFAULT_SCENE_TEXTURE_FILES = {
    earthTexture: "images/earth/2_no_clouds_8k.jpg",
    earthSpecularTexture: "images/earth/earthspec1k.jpg",
    moonMap: "images/moon/Solarsystemscope_texture_8k_moon.jpg",
    moonDisplacementMap: "images/moon/ldem_16_gsfc.png",
    skyTexture: "images/sky/starmap_2020_4k_stars.jpg",
    skyConstellationTexture: "images/sky/constellation_figures_2020_4k.jpg",
};

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

export function loadSceneTextures({
    THREE,
    files = DEFAULT_SCENE_TEXTURE_FILES,
    minFilter = null,
}) {
    const loader = new THREE.TextureLoader();

    const entries = Object.entries(files);
    const promises = entries.map(([, fileName]) => loadTexture(loader, fileName));

    return Promise.all(promises).then((textures) => {
        if (minFilter) {
            textures.forEach((texture) => {
                texture.minFilter = minFilter;
            });
        }

        const setColorTextureSpace = (texture) => {
            if (!texture) return;
            if ("colorSpace" in texture && THREE.SRGBColorSpace) {
                texture.colorSpace = THREE.SRGBColorSpace;
            } else if ("encoding" in texture && THREE.sRGBEncoding) {
                texture.encoding = THREE.sRGBEncoding;
            }
        };

        const byKey = {};
        for (let i = 0; i < entries.length; i += 1) {
            const [key] = entries[i];
            byKey[key] = textures[i];
        }

        // Color textures should be sampled in sRGB space.
        setColorTextureSpace(byKey.earthTexture);
        setColorTextureSpace(byKey.moonMap);
        setColorTextureSpace(byKey.skyTexture);
        setColorTextureSpace(byKey.skyConstellationTexture);

        return byKey;
    });
}
