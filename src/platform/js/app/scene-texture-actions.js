export function applySceneTextures(scene, textures) {
    scene.earthTexture = textures.earthTexture;
    scene.earthSpecularTexture = textures.earthSpecularTexture;
    scene.moonMap = textures.moonMap;
    scene.moonDisplacementMap = textures.moonDisplacementMap;
    scene.skyTexture = textures.skyTexture || textures.skyMilkyWayTexture || scene.skyTexture;
    scene.skyConstellationTexture = textures.skyConstellationTexture;
}

function disposeTextureIfReplaced(previousTexture, nextTexture) {
    if (!previousTexture || previousTexture === nextTexture) {
        return;
    }
    previousTexture.dispose?.();
}

export function applyAndRefreshSceneTextures(scene, textures, { disposePrevious = false } = {}) {
    const previousTextures = {
        earthTexture: scene.earthTexture || null,
        earthSpecularTexture: scene.earthSpecularTexture || null,
        moonMap: scene.moonMap || null,
        moonDisplacementMap: scene.moonDisplacementMap || null,
        skyTexture: scene.skyTexture || null,
        skyConstellationTexture: scene.skyConstellationTexture || null,
    };

    applySceneTextures(scene, textures);

    let earthHandled = false;
    if (scene.earthRenderer?.updateTextures) {
        scene.earthRenderer.updateTextures(
            scene.earthTexture,
            scene.earthSpecularTexture,
            { disposePrevious },
        );
        earthHandled = true;
    }

    let moonHandled = false;
    if (scene.moonRenderer?.updateTextures) {
        scene.moonRenderer.updateTextures(
            scene.moonMap,
            scene.moonDisplacementMap,
            null,
            { disposePrevious },
        );
        moonHandled = true;
    }

    let skyHandled = false;
    if (scene.skyRenderer?.updateTextures) {
        scene.skyRenderer.updateTextures(
            scene.skyTexture,
            scene.skyConstellationTexture,
            { disposePrevious },
        );
        skyHandled = true;
    }

    // Fallback disposal for pre-init swaps (renderers not created yet).
    if (disposePrevious) {
        if (!earthHandled) {
            disposeTextureIfReplaced(previousTextures.earthTexture, scene.earthTexture);
            disposeTextureIfReplaced(previousTextures.earthSpecularTexture, scene.earthSpecularTexture);
        }
        if (!moonHandled) {
            disposeTextureIfReplaced(previousTextures.moonMap, scene.moonMap);
            disposeTextureIfReplaced(previousTextures.moonDisplacementMap, scene.moonDisplacementMap);
        }
        if (!skyHandled) {
            disposeTextureIfReplaced(previousTextures.skyTexture, scene.skyTexture);
            disposeTextureIfReplaced(previousTextures.skyConstellationTexture, scene.skyConstellationTexture);
        }
    }
}
