import { LIGHT_SETTINGS as LT } from "../core/constants.js";

export function applySceneTextures(scene, textures) {
    scene.earthTexture = textures.earthTexture;
    scene.earthSpecularTexture = textures.earthSpecularTexture;
    scene.moonMap = textures.moonMap;
    scene.moonDisplacementMap = textures.moonDisplacementMap;
    scene.moonRenderProfile = textures.moonRenderProfile || scene.moonRenderProfile || "fast";
    scene.moonRenderSettings = textures.moonRenderSettings || scene.moonRenderSettings || null;
    scene.skyTexture = textures.skyTexture || textures.skyMilkyWayTexture || scene.skyTexture;
    scene.skyConstellationTexture = textures.skyConstellationTexture;
}

function syncLunarMoonFillLights(scene) {
    const renderSettings = scene?.moonRenderSettings || null;
    const suppressLunarAmbientWash =
        (
            (Number.isFinite(Number(renderSettings?.terminatorIndirectOcclusion)) &&
                Number(renderSettings?.terminatorIndirectOcclusion) >= 0.9) ||
            (Number.isFinite(Number(renderSettings?.terminatorShadowFloor)) &&
                Number(renderSettings?.terminatorShadowFloor) <= 0.05)
        );

    const bodyAmbientLight = scene?.lightManager?.bodyAmbientLight || null;
    if (bodyAmbientLight) {
        bodyAmbientLight.intensity = suppressLunarAmbientWash
            ? 0.0
            : (Number.isFinite(LT.AMBIENT_INTENSITY) ? LT.AMBIENT_INTENSITY : 0.01);
    }
    if (scene?.lightFill) {
        if (!Number.isFinite(scene.lightFill.intensity) || scene.lightFill.intensity <= 0) {
            scene.lightFill.intensity = Number.isFinite(LT.EARTHSHINE_INTENSITY) ? LT.EARTHSHINE_INTENSITY : 0.02;
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
    syncLunarMoonFillLights(scene);
    syncMoonShadowTuning(scene);

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
