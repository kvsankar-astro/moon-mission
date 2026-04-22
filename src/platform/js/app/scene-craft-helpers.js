import {
    isMissionCraftBody,
    resolveMissionCraft,
    resolvePrimaryMissionCraft,
} from "../core/domain/mission-config.js";
import { resolveComparisonDefaultVisibleCraftIds } from "../core/domain/comparison-overlay.js";
import {
    ORBIT_TRAIL_STYLE,
    resolveOverlapAdjustedOpacity,
    resolveTrackOpacity3D,
    resolveTailVisualStyle,
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

function getSceneDefaultVisibleCraftIds(scene, globalConfig) {
    const comparisonVisibleCraftIds = filterSceneCraftIds(
        scene,
        globalConfig,
        resolveComparisonDefaultVisibleCraftIds(globalConfig),
    );
    if (comparisonVisibleCraftIds.length > 0) {
        return comparisonVisibleCraftIds;
    }

    return [getSceneActiveCraftId(scene, globalConfig)].filter(Boolean);
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

    return getSceneDefaultVisibleCraftIds(scene, globalConfig);
}

function getSceneOrbitBuildOrder(scene, globalConfig) {
    const craftIds = getSceneMissionCraftIds(scene, globalConfig);
    if (craftIds.length <= 1) {
        return craftIds;
    }

    const visibleCraftIds = new Set(getSceneVisibleCraftIds(scene, globalConfig));
    const activeCraftId = getSceneActiveCraftId(scene, globalConfig);
    const primaryCraftId = getScenePrimaryCraftId(scene, globalConfig);

    return craftIds
        .map((bodyId, index) => {
            const isVisible = visibleCraftIds.has(bodyId);
            let priority = 3;
            if (bodyId === activeCraftId) {
                priority = 0;
            } else if (bodyId === primaryCraftId) {
                priority = isVisible ? 1 : 2;
            } else if (isVisible) {
                priority = 1;
            }
            return {
                bodyId,
                index,
                priority,
            };
        })
        .sort((left, right) => {
            if (left.priority !== right.priority) {
                return left.priority - right.priority;
            }
            return left.index - right.index;
        })
        .map((entry) => entry.bodyId);
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
        const overlapOpacities = scene.orbitOverlapOpacitiesByBodyId?.[bodyId] || [];
        const baseOpacities = scene.orbitBackgroundBaseOpacitiesByBodyId?.[bodyId] || [];
        orbitLines.forEach((orbitLine, index) => {
            orbitLine.visible = visible;
            if (orbitLine.material) {
                orbitLine.material.transparent = isTrailStyle;
                orbitLine.material.opacity = isTrailStyle
                    ? resolveOverlapAdjustedOpacity(
                        baseOpacities[index] ||
                            orbitLine?.userData?.baseOpacity ||
                            resolveTrackOpacity3D(trailTrackBrightness3D) ||
                            ORBIT_TRAIL_STYLE.backgroundOpacity3D,
                        overlapOpacities[index],
                    )
                    : 1;
                orbitLine.material.linewidth = isTrailStyle
                    ? ORBIT_TRAIL_STYLE.backgroundLineWidth3DTrail
                    : (orbitLine?.userData?.lineWidthClassic ?? orbitLine.material.linewidth);
                orbitLine.material.depthWrite = !isTrailStyle;
                orbitLine.material.needsUpdate = true;
            }
        });
    }

    for (const [bodyId, generatedOrbitLine] of Object.entries(scene.generatedOrbitLinesByBodyId || {})) {
        if (!generatedOrbitLine) continue;
        generatedOrbitLine.visible = isLineVisibleForBody(bodyId);
        if (generatedOrbitLine.material) {
            generatedOrbitLine.material.transparent = true;
            generatedOrbitLine.material.opacity = viewOrbit ? 0.98 : 0;
            generatedOrbitLine.material.depthWrite = false;
            generatedOrbitLine.material.needsUpdate = true;
        }
    }

    for (const [bodyId, bundle] of Object.entries(scene.orbitTrailLinesByBodyId || {})) {
        const visible = isLineVisibleForBody(bodyId) && isTrailStyle;
        const tailStyle = resolveTailVisualStyle({
            dimension: "3D",
            prominence: trailTailBrightness3D,
        });
        if (bundle?.tailLine) {
            bundle.tailLine.visible = visible;
            if (bundle.tailLine.material) {
                bundle.tailLine.material.opacity = tailStyle.tailOpacity;
                bundle.tailLine.material.needsUpdate = true;
            }
        }
        if (bundle?.midLine) {
            bundle.midLine.visible = visible;
            if (bundle.midLine.material) {
                bundle.midLine.material.opacity = tailStyle.midOpacity;
                bundle.midLine.material.needsUpdate = true;
            }
        }
        if (bundle?.headGlowLine) {
            bundle.headGlowLine.visible = visible;
            if (bundle.headGlowLine.material) {
                bundle.headGlowLine.material.opacity = tailStyle.headGlowOpacity;
                bundle.headGlowLine.material.needsUpdate = true;
            }
        }
        if (bundle?.headLine) {
            bundle.headLine.visible = visible;
            if (bundle.headLine.material) {
                bundle.headLine.material.opacity = tailStyle.headOpacity;
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
    getSceneDefaultVisibleCraftIds,
    getSceneDroneObject,
    getSceneMissionCraftIds,
    getSceneOrbitBuildOrder,
    getScenePrimaryCraftId,
    getSceneVisibleCraftIds,
    isSceneCraftBody,
    setSceneVisibleCraftIds,
    syncSceneActiveCraft,
    shouldShowSceneCraft,
};
