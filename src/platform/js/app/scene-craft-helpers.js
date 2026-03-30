import {
    isMissionCraftBody,
    resolveMissionCraft,
    resolvePrimaryMissionCraft,
} from "../core/domain/mission-config.js";
import {
    ORBIT_TRAIL_STYLE,
    resolveHeadOpacity3D,
    resolveTailOpacity3D,
    resolveTrackOpacity3D,
} from "./orbit-trail-style.js";

function getSceneMissionCraftIds(scene, globalConfig) {
    const bodyIds = Array.isArray(scene?.planetsForLocations)
        ? scene.planetsForLocations
        : [];

    const seen = new Set();
    const craftIds = [];
    for (const bodyId of bodyIds) {
        if (!isMissionCraftBody(globalConfig, bodyId)) continue;
        const craft = resolveMissionCraft(globalConfig, bodyId);
        const canonicalId = craft?.id || bodyId;
        if (!canonicalId || seen.has(canonicalId)) continue;
        seen.add(canonicalId);
        craftIds.push(bodyId);
    }

    if (craftIds.length > 0) {
        return craftIds;
    }

    const primaryCraft = resolvePrimaryMissionCraft(globalConfig);
    return [primaryCraft?.id || "SC"];
}

function getScenePrimaryCraftId(scene, globalConfig) {
    const primaryCraft = resolvePrimaryMissionCraft(globalConfig);
    const preferredId = primaryCraft?.id || "SC";
    const bodyIds = getSceneMissionCraftIds(scene, globalConfig);
    for (const bodyId of bodyIds) {
        const craft = resolveMissionCraft(globalConfig, bodyId);
        if ((craft?.id || bodyId) === preferredId) {
            return bodyId;
        }
    }
    if (bodyIds.includes("SC")) {
        return "SC";
    }
    return bodyIds[0] || preferredId;
}

function isSceneCraftBody(scene, globalConfig, bodyId) {
    return getSceneMissionCraftIds(scene, globalConfig).includes(bodyId);
}

function getSceneActiveCraftId(scene, globalConfig) {
    const activeCraftId = scene?.activeCraftId;
    const craftIds = getSceneMissionCraftIds(scene, globalConfig);
    if (activeCraftId && craftIds.includes(activeCraftId)) {
        return activeCraftId;
    }
    return getScenePrimaryCraftId(scene, globalConfig);
}

function filterSceneCraftIds(scene, globalConfig, bodyIds) {
    const craftIds = getSceneMissionCraftIds(scene, globalConfig);
    if (!Array.isArray(bodyIds)) {
        return [];
    }

    const seen = new Set();
    const filtered = [];
    for (const bodyId of bodyIds) {
        if (!bodyId || !craftIds.includes(bodyId) || seen.has(bodyId)) continue;
        seen.add(bodyId);
        filtered.push(bodyId);
    }
    return filtered;
}

function getSceneVisibleCraftIds(scene, globalConfig, requestedVisibleCraftIds = undefined) {
    const craftIds = getSceneMissionCraftIds(scene, globalConfig);
    const explicitVisibleCraftIds = filterSceneCraftIds(
        scene,
        globalConfig,
        requestedVisibleCraftIds,
    );
    if (requestedVisibleCraftIds !== undefined) {
        return explicitVisibleCraftIds;
    }

    const storedVisibleCraftIds = filterSceneCraftIds(
        scene,
        globalConfig,
        scene?.visibleCraftIds,
    );
    if (Array.isArray(scene?.visibleCraftIds)) {
        return storedVisibleCraftIds;
    }

    if (scene?.viewAdditionalCrafts) {
        return craftIds;
    }

    return [getSceneActiveCraftId(scene, globalConfig)].filter(Boolean);
}

function setSceneVisibleCraftIds(scene, globalConfig = null, requestedVisibleCraftIds = undefined) {
    if (!scene) return [];
    const nextVisibleCraftIds = getSceneVisibleCraftIds(
        scene,
        globalConfig,
        requestedVisibleCraftIds,
    );
    scene.visibleCraftIds = nextVisibleCraftIds;
    scene.viewAdditionalCrafts = nextVisibleCraftIds.length > 1;
    return nextVisibleCraftIds;
}

function getSceneCraftObject(scene, globalConfig = null, bodyId = null) {
    const targetCraftId = bodyId || getSceneActiveCraftId(scene, globalConfig);
    return scene?.craftsById?.[targetCraftId] || null;
}

function getSceneDroneObject(scene, globalConfig = null, bodyId = null) {
    const targetCraftId = bodyId || getSceneActiveCraftId(scene, globalConfig);
    return scene?.dronesById?.[targetCraftId] || null;
}

function syncSceneActiveCraft(scene, globalConfig = null, preferredCraftId = null) {
    if (!scene) return null;

    const craftIds = getSceneMissionCraftIds(scene, globalConfig);
    const nextActiveCraftId =
        preferredCraftId && craftIds.includes(preferredCraftId)
            ? preferredCraftId
            : getSceneActiveCraftId(scene, globalConfig);

    const previousCraft = scene.craft || null;
    const previousDrone = scene.drone || null;
    const nextCraft = getSceneCraftObject(scene, globalConfig, nextActiveCraftId);
    const nextDrone = getSceneDroneObject(scene, globalConfig, nextActiveCraftId);

    if (scene.craftCamera && previousCraft && nextCraft && previousCraft !== nextCraft) {
        previousCraft.remove?.(scene.craftCamera);
        nextCraft.add?.(scene.craftCamera);
    }
    if (scene.droneCamera && previousDrone && nextDrone && previousDrone !== nextDrone) {
        previousDrone.remove?.(scene.droneCamera);
        nextDrone.add?.(scene.droneCamera);
    }

    scene.activeCraftId = nextActiveCraftId;
    scene.spacecraftRenderer = scene.spacecraftRenderersById?.[nextActiveCraftId] || null;
    scene.craft = nextCraft;
    scene.craftInner = scene.craftInnersById?.[nextActiveCraftId] || null;
    scene.craftEdges = scene.craftEdgesById?.[nextActiveCraftId] || null;
    scene.craftAxesHelper = scene.craftAxesHelpersById?.[nextActiveCraftId] || null;
    scene.drone = nextDrone;
    scene.craftVisible = !!nextCraft;

    return nextActiveCraftId;
}

function shouldShowSceneCraft({ scene, globalConfig = null, bodyId }) {
    if (!bodyId) return false;
    if (!isSceneCraftBody(scene, globalConfig, bodyId)) {
        return true;
    }
    return getSceneVisibleCraftIds(scene, globalConfig).includes(bodyId);
}

function applySceneOrbitVisibility(
    scene,
    globalConfig = null,
    viewOrbit = true,
    orbitStyle = "classic",
    trailTrackBrightness3D = 1,
    trailTailBrightness3D = 1,
) {
    if (!scene) return;
    const isTrailStyle = orbitStyle === "trail";

    const isLineVisibleForBody = (bodyId) =>
        !!viewOrbit &&
        shouldShowSceneCraft({
            scene,
            globalConfig,
            bodyId,
        });

    for (const [bodyId, orbitLines] of Object.entries(scene.orbitLinesByBodyId || {})) {
        const visible = isLineVisibleForBody(bodyId);
        orbitLines.forEach((orbitLine) => {
            orbitLine.visible = visible;
            if (orbitLine.material) {
                orbitLine.material.transparent = isTrailStyle;
                orbitLine.material.opacity = isTrailStyle
                    ? resolveTrackOpacity3D(trailTrackBrightness3D)
                    : 1;
                orbitLine.material.depthWrite = !isTrailStyle;
                orbitLine.material.needsUpdate = true;
            }
        });
    }

    for (const [bodyId, bundle] of Object.entries(scene.orbitTrailLinesByBodyId || {})) {
        const visible = isLineVisibleForBody(bodyId) && isTrailStyle;
        if (bundle?.tailLine) {
            bundle.tailLine.visible = visible;
            if (bundle.tailLine.material) {
                bundle.tailLine.material.opacity = resolveTailOpacity3D(trailTailBrightness3D);
                bundle.tailLine.material.needsUpdate = true;
            }
        }
        if (bundle?.headLine) {
            bundle.headLine.visible = visible;
            if (bundle.headLine.material) {
                bundle.headLine.material.opacity = resolveHeadOpacity3D(trailTailBrightness3D);
                bundle.headLine.material.needsUpdate = true;
            }
        }
    }

    // During async orbit construction, lines may exist before a craft's full slice
    // array has finished building. Fall back to the line's tagged body id so hidden
    // craft arcs never flash into view before reconciliation completes.
    for (const orbitLine of scene.orbitLines || []) {
        const bodyId = orbitLine?.userData?.bodyId;
        if (!bodyId) {
            orbitLine.visible = false;
            continue;
        }
        orbitLine.visible = isLineVisibleForBody(bodyId);
    }
}

export {
    applySceneOrbitVisibility,
    getSceneActiveCraftId,
    getSceneCraftObject,
    getSceneDroneObject,
    getSceneMissionCraftIds,
    getScenePrimaryCraftId,
    getSceneVisibleCraftIds,
    isSceneCraftBody,
    setSceneVisibleCraftIds,
    syncSceneActiveCraft,
    shouldShowSceneCraft,
};
