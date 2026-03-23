export function applySceneTextures(scene, textures) {
    scene.earthTexture = textures.earthTexture;
    scene.earthSpecularTexture = textures.earthSpecularTexture;
    scene.moonMap = textures.moonMap;
    scene.moonDisplacementMap = textures.moonDisplacementMap;
    scene.skyTexture = textures.skyTexture;
    scene.skyConstellationTexture = textures.skyConstellationTexture;
}

