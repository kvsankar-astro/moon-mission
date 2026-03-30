import {
    resolveBackgroundOpacity,
    resolveOverlapAdjustedOpacity,
} from "./orbit-trail-style.js";
import { applySceneOrbitVisibility } from "./scene-craft-helpers.js";

function normalizeBodyId(bodyId) {
    return typeof bodyId === "string" ? bodyId.trim().toUpperCase() : "";
}

function normalizePhaseOrbitStyleMetadata(phaseMeta) {
    const bodies = phaseMeta?.bodies;
    if (!bodies || typeof bodies !== "object") {
        return {};
    }

    const normalized = {};
    for (const [bodyId, metadata] of Object.entries(bodies)) {
        const normalizedBodyId = normalizeBodyId(bodyId);
        if (!normalizedBodyId || !metadata || typeof metadata !== "object") {
            continue;
        }
        normalized[normalizedBodyId] = metadata;
    }
    return normalized;
}

function getSceneOrbitStyleMetadata(scene, bodyId) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    if (!normalizedBodyId || !scene) return null;
    return (
        scene.orbitStyleMetadataByBodyId?.[normalizedBodyId] ||
        scene.loadedOrbitStyleMetadataByBodyId?.[normalizedBodyId] ||
        null
    );
}

function seedSceneOrbitStyleMetadata(scene) {
    if (!scene) return {};
    const loaded = scene.loadedOrbitStyleMetadataByBodyId || {};
    scene.orbitStyleMetadataByBodyId = { ...loaded };
    return scene.orbitStyleMetadataByBodyId;
}

function update3DSceneOrbitOpacities(scene, bodyId, metadata) {
    scene.orbitBackgroundBaseOpacitiesByBodyId ||= {};
    scene.orbitOverlapOpacitiesByBodyId ||= {};
    const chunks = scene?.orbitBackgroundChunksByBodyId?.[bodyId] || [];
    const curveTimes = scene?.curveTimesById?.[bodyId] || [];
    const nextBaseOpacities = chunks.map((chunk) => {
        const startIndex = Math.max(0, Number(chunk?.startIndex) || 0);
        const endIndex = Math.min(
            Math.max(0, curveTimes.length - 1),
            Number.isFinite(Number(chunk?.endIndex))
                ? Number(chunk.endIndex)
                : startIndex + Math.max(0, ((chunk?.points?.length || 2) - 1)),
        );
        return resolveBackgroundOpacity({
            metadata,
            startTimeMs: curveTimes[startIndex],
            endTimeMs: curveTimes[endIndex],
            dimension: "3D",
            opacityOverride: scene?.trailContextOpacity3D,
        });
    });
    scene.orbitBackgroundBaseOpacitiesByBodyId[bodyId] = nextBaseOpacities;

    const orbitLines = scene?.orbitLinesByBodyId?.[bodyId] || [];
    orbitLines.forEach((orbitLine, index) => {
        const baseOpacity = nextBaseOpacities[index];
        const overlapFactor = scene.orbitOverlapOpacitiesByBodyId?.[bodyId]?.[index];
        if (!orbitLine) return;
        orbitLine.userData = {
            ...(orbitLine.userData || {}),
            baseOpacity,
        };
        if (orbitLine.material) {
            orbitLine.material.opacity = resolveOverlapAdjustedOpacity(baseOpacity, overlapFactor);
            orbitLine.material.needsUpdate = true;
        }
    });
}

function update2DSceneOrbitOpacities(scene, bodyId, metadata) {
    scene.orbitSvgBackgroundBaseOpacitiesByBodyId ||= {};
    scene.orbitOverlapOpacitiesByBodyId ||= {};
    const chunks = scene?.orbitSvgBackgroundChunksByBodyId?.[bodyId] || [];
    const orbitTimes = scene?.orbitTimesByBodyId?.[bodyId] || [];
    const nextBaseOpacities = chunks.map((chunk) =>
        resolveBackgroundOpacity({
            metadata,
            startTimeMs: orbitTimes[chunk?.startIndex],
            endTimeMs: orbitTimes[chunk?.endIndex],
            dimension: "2D",
            opacityOverride: scene?.trailContextOpacity2D,
        }),
    );
    scene.orbitSvgBackgroundBaseOpacitiesByBodyId[bodyId] = nextBaseOpacities;

    if (typeof document === "undefined") {
        return;
    }
    const orbitGroup = document.getElementById(`orbit-${bodyId}`);
    if (!orbitGroup) {
        return;
    }
    orbitGroup
        .querySelectorAll(".orbit-trail-background")
        .forEach((element, index) => {
            const baseOpacity = nextBaseOpacities[index];
            if (Number.isFinite(baseOpacity)) {
                const overlapFactor = scene.orbitOverlapOpacitiesByBodyId?.[bodyId]?.[index];
                element.setAttribute(
                    "stroke-opacity",
                    resolveOverlapAdjustedOpacity(baseOpacity, overlapFactor).toFixed(3),
                );
            }
        });
}

function applyOrbitStyleMetadataToScene(options = {}) {
    const {
        scene,
        phaseMeta,
        render = null,
        globalConfig = null,
        viewOrbit = undefined,
        orbitStyle = "trail",
    } = options;
    if (!scene || !phaseMeta) return false;

    const bodyMetadata = normalizePhaseOrbitStyleMetadata(phaseMeta);
    if (Object.keys(bodyMetadata).length === 0) {
        return false;
    }

    scene.loadedOrbitStyleMetadataByBodyId = {
        ...(scene.loadedOrbitStyleMetadataByBodyId || {}),
        ...bodyMetadata,
    };
    scene.orbitStyleMetadataByBodyId = {
        ...(scene.orbitStyleMetadataByBodyId || {}),
        ...bodyMetadata,
    };
    scene.orbitOverlapOpacitiesByBodyId = {};

    for (const [bodyId, metadata] of Object.entries(bodyMetadata)) {
        update3DSceneOrbitOpacities(scene, bodyId, metadata);
        update2DSceneOrbitOpacities(scene, bodyId, metadata);
    }

    if (typeof viewOrbit === "boolean") {
        applySceneOrbitVisibility(
            scene,
            globalConfig,
            viewOrbit,
            orbitStyle || "trail",
        );
    }
    render?.();
    return true;
}

function refreshSceneOrbitStyleOpacities(scene) {
    if (!scene) return false;

    const bodyIds = new Set([
        ...Object.keys(scene.loadedOrbitStyleMetadataByBodyId || {}),
        ...Object.keys(scene.orbitStyleMetadataByBodyId || {}),
        ...Object.keys(scene.orbitLinesByBodyId || {}),
        ...Object.keys(scene.orbitSvgBackgroundChunksByBodyId || {}),
    ]);

    for (const bodyId of bodyIds) {
        const metadata = getSceneOrbitStyleMetadata(scene, bodyId);
        update3DSceneOrbitOpacities(scene, bodyId, metadata);
        update2DSceneOrbitOpacities(scene, bodyId, metadata);
    }
    return bodyIds.size > 0;
}

export {
    applyOrbitStyleMetadataToScene,
    getSceneOrbitStyleMetadata,
    normalizePhaseOrbitStyleMetadata,
    refreshSceneOrbitStyleOpacities,
    seedSceneOrbitStyleMetadata,
};
