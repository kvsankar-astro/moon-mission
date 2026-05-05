import { LIGHT_SETTINGS as LT } from "../core/constants.js";

export function applySceneTextures(scene, textures) {
    scene.earthTexture = textures.earthTexture;
    scene.earthPhotoTexture = textures.earthPhotoTexture || textures.earthTexture || null;
    scene.earthSpecularTexture = textures.earthSpecularTexture;
    scene.earthNightTexture = textures.earthNightTexture;
    scene.moonMap = textures.moonMap;
    scene.moonDisplacementMap = textures.moonDisplacementMap;
    scene.moonRenderProfile = textures.moonRenderProfile || scene.moonRenderProfile || "fast";
    scene.moonRenderSettings = textures.moonRenderSettings || scene.moonRenderSettings || null;
    scene.skyTexture = textures.skyTexture || textures.skyMilkyWayTexture || scene.skyTexture;
    scene.skyConstellationTexture = textures.skyConstellationTexture;
}

function syncLunarMoonFillLights(scene) {
    const bodyAmbientLight = scene?.lightManager?.bodyAmbientLight || null;
    if (bodyAmbientLight) {
        bodyAmbientLight.intensity = Number.isFinite(LT.AMBIENT_INTENSITY)
            ? LT.AMBIENT_INTENSITY
            : 0;
    }
    if (scene?.lightFill) {
        if (!Number.isFinite(scene.lightFill.intensity) || scene.lightFill.intensity <= 0) {
            scene.lightFill.intensity = Number.isFinite(LT.EARTHSHINE_INTENSITY) ? LT.EARTHSHINE_INTENSITY : 0.02;
        }
    }
    if (scene?.lightMoonshine) {
        if (!Number.isFinite(scene.lightMoonshine.intensity) || scene.lightMoonshine.intensity <= 0) {
            scene.lightMoonshine.intensity = Number.isFinite(LT.MOONSHINE_INTENSITY) ? LT.MOONSHINE_INTENSITY : 0.0004;
        }
    }
}

function syncMoonShadowTuning(scene) {
    const primaryLight = scene?.lightManager?.primaryLight || null;
    const renderSettings = scene?.moonRenderSettings || null;
    if (!primaryLight?.shadow || !renderSettings) {
        return;
    }

    const shadowNormalBias = Number(renderSettings.shadowNormalBias);
    if (Number.isFinite(shadowNormalBias)) {
        primaryLight.shadow.normalBias = shadowNormalBias;
    }

    const shadowBias = Number(renderSettings.shadowBias);
    if (Number.isFinite(shadowBias)) {
        primaryLight.shadow.bias = shadowBias;
    }
}

function disposeTextureIfReplaced(previousTexture, nextTexture, sharedTextures = []) {
    if (!previousTexture || previousTexture === nextTexture) {
        return;
    }
    if (sharedTextures.some((texture) => texture && texture === previousTexture)) {
        return;
    }
    previousTexture.dispose?.();
}

export function applyAndRefreshSceneTextures(scene, textures, { disposePrevious = false } = {}) {
    const previousTextures = {
        earthTexture: scene.earthTexture || null,
        earthPhotoTexture: scene.earthPhotoTexture || null,
        earthSpecularTexture: scene.earthSpecularTexture || null,
        earthNightTexture: scene.earthNightTexture || null,
        moonMap: scene.moonMap || null,
        moonDisplacementMap: scene.moonDisplacementMap || null,
        skyTexture: scene.skyTexture || null,
        skyConstellationTexture: scene.skyConstellationTexture || null,
    };

    applySceneTextures(scene, textures);
    syncLunarMoonFillLights(scene);
    syncMoonShadowTuning(scene);

    let earthHandled = false;
    if (scene.earthRenderer?.updateTextures) {
        scene.earthRenderer.updateTextures(
            scene.earthTexture,
            scene.earthSpecularTexture,
            scene.earthNightTexture,
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
            {
                disposePrevious,
                renderSettings: scene.moonRenderSettings,
            },
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
        disposeTextureIfReplaced(previousTextures.earthPhotoTexture, scene.earthPhotoTexture, [
            scene.earthTexture,
            scene.earthSpecularTexture,
            scene.earthNightTexture,
        ]);
        if (!earthHandled) {
            disposeTextureIfReplaced(previousTextures.earthTexture, scene.earthTexture);
            disposeTextureIfReplaced(previousTextures.earthSpecularTexture, scene.earthSpecularTexture);
            disposeTextureIfReplaced(previousTextures.earthNightTexture, scene.earthNightTexture);
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
