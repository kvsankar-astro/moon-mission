import { computeOrbitOverlapOpacities } from "./orbit-overlap-core.js";
import {
    hasOrbitStyleDensityHints,
    ORBIT_TRAIL_STYLE,
    resolveOverlapAdjustedOpacity,
} from "./orbit-trail-style.js";

const DEFAULT_DEBOUNCE_MS = 220;
const DEFAULT_OPTIONS = Object.freeze({
    gridSizePx: 6,
    sampleStepPx: 3,
    minFactor: 0.16,
    maxFactor: 1,
    chunkDensityPercentile: 0.82,
    normalizationPercentile: 0.94,
    densityExponent: 1.35,
});
// Temporary global kill-switch: keep refinement code available, but bypass runtime usage.
const ORBIT_OVERLAP_REFINEMENT_ENABLED = false;

const sceneStateByScene = new WeakMap();
const sceneByJobId = new Map();

let nextJobId = 1;
let workerInstance = null;
/** @type {any} */
let hideIndicatorTimer = null;

function setOverlapIndicator(status, text, { sticky = false } = {}) {
    if (typeof document === "undefined") {
        return;
    }
    const host = document.getElementById("orbit-overlap-status");
    const label = document.getElementById("orbit-overlap-status-text");
    if (!host || !label) {
        return;
    }

    if (hideIndicatorTimer) {
        clearTimeout(hideIndicatorTimer);
        hideIndicatorTimer = 0;
    }

    if (!status) {
        host.hidden = true;
        host.classList.add("orbit-overlap-status--hidden");
        host.removeAttribute("data-status");
        label.textContent = "";
        return;
    }

    host.hidden = false;
    host.classList.remove("orbit-overlap-status--hidden");
    host.setAttribute("data-status", status);
    label.textContent = text || "Orbit ready";

    if (status === "done" && !sticky) {
        hideIndicatorTimer = window.setTimeout(() => {
            const currentHost = document.getElementById("orbit-overlap-status");
            if (!currentHost) return;
            currentHost.hidden = true;
            currentHost.classList.add("orbit-overlap-status--hidden");
            currentHost.removeAttribute("data-status");
            const currentLabel = document.getElementById("orbit-overlap-status-text");
            if (currentLabel) currentLabel.textContent = "";
            hideIndicatorTimer = null;
        }, 1600);
    }
}

function getSceneOverlapState(scene) {
    let state = sceneStateByScene.get(scene);
    if (!state) {
        state = {
            /** @type {any} */
            timer: null,
            activeJobId: null,
            appliedSignature: "",
            pendingSignature: "",
            activeStatus: "",
        };
        sceneStateByScene.set(scene, state);
    }
    return state;
}

function getOrbitBackgroundChunkCount(scene, dimension) {
    const source = dimension === "3D"
        ? scene?.orbitBackgroundChunksByBodyId
        : scene?.orbitSvgBackgroundChunksByBodyId;
    let count = 0;
    for (const chunks of Object.values(source || {})) {
        count += Array.isArray(chunks) ? chunks.length : 0;
    }
    return count;
}

function hasAuthoredOrbitStyleMetadata(scene) {
    const metadataByBodyId = scene?.orbitStyleMetadataByBodyId || {};
    return Object.values(metadataByBodyId).some(
        (metadata) => metadata && typeof metadata === "object",
    );
}

function hasPrecomputedDensityHints(scene) {
    const metadataByBodyId = scene?.orbitStyleMetadataByBodyId || {};
    for (const metadata of Object.values(metadataByBodyId)) {
        if (hasOrbitStyleDensityHints(metadata)) {
            return true;
        }
    }
    return false;
}

function isSceneOrbitReady(scene, dimension) {
    if (!scene) return false;
    if (dimension === "3D") {
        const addCurveDoneState = scene?.constructor?.SCENE_STATE_ADD_CURVE_DONE;
        return scene.state === addCurveDoneState && getOrbitBackgroundChunkCount(scene, "3D") > 0;
    }
    return getOrbitBackgroundChunkCount(scene, "2D") > 0;
}

function clearScenePendingState(state) {
    if (!state) return;
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = 0;
    }
    state.activeJobId = null;
    state.pendingSignature = "";
    state.activeStatus = "";
}

function parseSvgMatrix(transformText) {
    const match = typeof transformText === "string"
        ? transformText.match(/matrix\(([^)]+)\)/)
        : null;
    if (!match) {
        return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }
    const values = match[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
    if (values.length !== 6) {
        return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }
    return {
        a: values[0],
        b: values[1],
        c: values[2],
        d: values[3],
        e: values[4],
        f: values[5],
    };
}

function transformSvgPoint(point, matrix) {
    return {
        x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
        y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f,
    };
}

function cloneScreenPoint(point) {
    return {
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
    };
}

function serializeChunk(chunk, projector = cloneScreenPoint) {
    if (!Array.isArray(chunk) || chunk.length < 2) {
        return null;
    }
    const points = [];
    for (const point of chunk) {
        const projected = projector(point);
        if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
            continue;
        }
        points.push(projected);
    }
    return points.length >= 2 ? points : null;
}

function build2DJobPayload(scene) {
    const matrix = parseSvgMatrix(scene?.orbitSvgTransformMatrix);
    const chunksByBodyId = {};
    for (const [bodyId, chunks] of Object.entries(scene?.orbitSvgBackgroundChunksByBodyId || {})) {
        const projectedChunks = [];
        for (const chunk of chunks || []) {
            const rawPoints = Array.isArray(chunk?.points) ? chunk.points : chunk;
            const projected = serializeChunk(rawPoints, (point) => transformSvgPoint(point, matrix));
            if (projected) {
                projectedChunks.push(projected);
            }
        }
        if (projectedChunks.length > 0) {
            chunksByBodyId[bodyId] = projectedChunks;
        }
    }
    return chunksByBodyId;
}

function project3DPoint(point, scene, viewportWidth, viewportHeight) {
    const projected = point.clone().project(scene.camera);
    if (
        !Number.isFinite(projected.x) ||
        !Number.isFinite(projected.y) ||
        !Number.isFinite(projected.z)
    ) {
        return null;
    }
    return {
        x: ((projected.x + 1) * 0.5) * viewportWidth,
        y: ((1 - projected.y) * 0.5) * viewportHeight,
    };
}

function build3DJobPayload(scene, viewportWidth, viewportHeight) {
    if (!scene?.camera) {
        return {};
    }
    scene.camera.updateMatrixWorld?.(true);
    scene.camera.updateProjectionMatrix?.();
    const chunksByBodyId = {};
    for (const [bodyId, chunks] of Object.entries(scene?.orbitBackgroundChunksByBodyId || {})) {
        const projectedChunks = [];
        for (const chunk of chunks || []) {
            const rawPoints = Array.isArray(chunk?.points) ? chunk.points : chunk;
            const projected = serializeChunk(
                rawPoints,
                (point) => project3DPoint(point, scene, viewportWidth, viewportHeight),
            );
            if (projected) {
                projectedChunks.push(projected);
            }
        }
        if (projectedChunks.length > 0) {
            chunksByBodyId[bodyId] = projectedChunks;
        }
    }
    return chunksByBodyId;
}

function apply2DOpacities(scene, opacitiesByBodyId) {
    if (typeof document === "undefined") return;
    scene.orbitOverlapOpacitiesByBodyId = opacitiesByBodyId;
    for (const [bodyId, opacities] of Object.entries(opacitiesByBodyId || {})) {
        const orbitGroup = document.getElementById(`orbit-${bodyId}`);
        if (!orbitGroup) continue;
        const elements = orbitGroup.querySelectorAll(".orbit-trail-background");
        const baseOpacities = scene.orbitSvgBackgroundBaseOpacitiesByBodyId?.[bodyId] || [];
        elements.forEach((element, index) => {
            const overlapFactor = opacities[index];
            const baseOpacity = baseOpacities[index] || ORBIT_TRAIL_STYLE.backgroundOpacity2D;
            element.setAttribute(
                "stroke-opacity",
                resolveOverlapAdjustedOpacity(baseOpacity, overlapFactor).toFixed(3),
            );
        });
    }
}

function apply3DOpacities(scene, opacitiesByBodyId) {
    scene.orbitOverlapOpacitiesByBodyId = opacitiesByBodyId;
    for (const [bodyId, opacities] of Object.entries(opacitiesByBodyId || {})) {
        const lines = scene.orbitLinesByBodyId?.[bodyId] || [];
        const baseOpacities = scene.orbitBackgroundBaseOpacitiesByBodyId?.[bodyId] || [];
        lines.forEach((line, index) => {
            const overlapFactor = opacities[index];
            if (!line?.material) return;
            line.material.opacity = resolveOverlapAdjustedOpacity(
                baseOpacities[index] || ORBIT_TRAIL_STYLE.backgroundOpacity3D,
                overlapFactor,
            );
            line.material.transparent = true;
            line.material.depthWrite = false;
            line.material.needsUpdate = true;
        });
    }
}

function resetSceneOverlapOpacities(scene) {
    if (!scene) return;
    scene.orbitOverlapOpacitiesByBodyId = {};

    for (const [bodyId, lines] of Object.entries(scene.orbitLinesByBodyId || {})) {
        const baseOpacities = scene.orbitBackgroundBaseOpacitiesByBodyId?.[bodyId] || [];
        lines.forEach((line, index) => {
            if (!line?.material) return;
            const fallbackOpacity = line?.userData?.baseOpacity || ORBIT_TRAIL_STYLE.backgroundOpacity3D;
            const baseOpacity = baseOpacities[index] || fallbackOpacity;
            line.material.opacity = resolveOverlapAdjustedOpacity(baseOpacity, 1);
            line.material.transparent = true;
            line.material.depthWrite = false;
            line.material.needsUpdate = true;
        });
    }

    if (typeof document === "undefined") {
        return;
    }
    for (const [bodyId] of Object.entries(scene.orbitSvgBackgroundChunksByBodyId || {})) {
        const orbitGroup = document.getElementById(`orbit-${bodyId}`);
        if (!orbitGroup) continue;
        const baseOpacities = scene.orbitSvgBackgroundBaseOpacitiesByBodyId?.[bodyId] || [];
        orbitGroup.querySelectorAll(".orbit-trail-background").forEach((element, index) => {
            const baseOpacity = baseOpacities[index] || ORBIT_TRAIL_STYLE.backgroundOpacity2D;
            element.setAttribute(
                "stroke-opacity",
                resolveOverlapAdjustedOpacity(baseOpacity, 1).toFixed(3),
            );
        });
    }
}

function getWorker() {
    if (workerInstance || typeof Worker !== "function") {
        return workerInstance;
    }
    try {
        workerInstance = new Worker(
            new URL("../workers/orbit-overlap-worker.js", import.meta.url),
            { type: "module" },
        );
        workerInstance.onmessage = (event) => {
            const { jobId, opacitiesByBodyId, error } = event.data || {};
            const scene = sceneByJobId.get(jobId);
            sceneByJobId.delete(jobId);
            if (!scene) return;
            const state = getSceneOverlapState(scene);
            if (state.activeJobId !== jobId) {
                return;
            }
            state.activeJobId = null;
            state.activeStatus = "";
            if (error) {
                state.pendingSignature = "";
                setOverlapIndicator("error", "Orbit refine failed", { sticky: true });
                return;
            }
            if (scene.orbitOverlapDimension === "2D") {
                apply2DOpacities(scene, opacitiesByBodyId || {});
            } else {
                apply3DOpacities(scene, opacitiesByBodyId || {});
            }
            state.appliedSignature = state.pendingSignature;
            state.pendingSignature = "";
            setOverlapIndicator("done", "Orbit refined");
            scene.orbitOverlapRender?.();
        };
    } catch (error) {
        console.warn("Orbit overlap worker unavailable; using sync fallback", error);
        workerInstance = null;
    }
    return workerInstance;
}

function runSyncFallback(scene, chunksByBodyId, options) {
    try {
        const result = computeOrbitOverlapOpacities(chunksByBodyId, options);
        if (scene.orbitOverlapDimension === "2D") {
            apply2DOpacities(scene, result.opacitiesByBodyId);
        } else {
            apply3DOpacities(scene, result.opacitiesByBodyId);
        }
    } catch (error) {
        setOverlapIndicator("error", "Orbit refine failed", { sticky: true });
        return;
    }
    const state = getSceneOverlapState(scene);
    state.activeJobId = null;
    state.appliedSignature = state.pendingSignature;
    state.pendingSignature = "";
    state.activeStatus = "";
    setOverlapIndicator("done", "Orbit refined");
    scene.orbitOverlapRender?.();
}

function get2DSignature(scene) {
    return JSON.stringify({
        dimension: "2D",
        transform: scene?.orbitSvgTransformMatrix || "",
        config: scene?.name || "",
    });
}

function roundNumber(value) {
    return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function get3DSignature(scene, viewportWidth, viewportHeight) {
    const camera = scene?.camera;
    return JSON.stringify({
        dimension: "3D",
        config: scene?.name || "",
        width: Math.round(viewportWidth || 0),
        height: Math.round(viewportHeight || 0),
        position: camera
            ? {
                x: roundNumber(camera.position.x),
                y: roundNumber(camera.position.y),
                z: roundNumber(camera.position.z),
            }
            : null,
        quaternion: camera
            ? {
                x: roundNumber(camera.quaternion.x),
                y: roundNumber(camera.quaternion.y),
                z: roundNumber(camera.quaternion.z),
                w: roundNumber(camera.quaternion.w),
            }
            : null,
        fov: roundNumber(camera?.fov),
    });
}

function requestSceneOrbitOverlapRefinement(params = {}) {
    const {
        scene,
        dimension,
        orbitStyle = "trail",
        viewportWidth,
        viewportHeight,
        render,
        options = DEFAULT_OPTIONS,
    } = params;
    if (!scene || orbitStyle !== "trail") {
        setOverlapIndicator(null);
        return;
    }
    const sceneState = getSceneOverlapState(scene);
    if (!ORBIT_OVERLAP_REFINEMENT_ENABLED) {
        clearScenePendingState(sceneState);
        sceneState.appliedSignature = "";
        sceneState.pendingSignature = "";
        if (!scene.orbitOverlapDisabledApplied) {
            resetSceneOverlapOpacities(scene);
            scene.orbitOverlapDisabledApplied = true;
        }
        setOverlapIndicator(null);
        return;
    }
    scene.orbitOverlapDisabledApplied = false;
    if (hasAuthoredOrbitStyleMetadata(scene)) {
        clearScenePendingState(sceneState);
        setOverlapIndicator(null);
        return;
    }
    if (hasPrecomputedDensityHints(scene)) {
        clearScenePendingState(sceneState);
        setOverlapIndicator(null);
        return;
    }
    if (!isSceneOrbitReady(scene, dimension)) {
        clearScenePendingState(sceneState);
        setOverlapIndicator(null);
        return;
    }

    const signature = dimension === "3D"
        ? get3DSignature(scene, viewportWidth, viewportHeight)
        : get2DSignature(scene);

    if (sceneState.appliedSignature === signature) {
        if (sceneState.activeStatus !== "done") {
            setOverlapIndicator(null);
        }
        return;
    }
    if (sceneState.pendingSignature === signature && (sceneState.timer || sceneState.activeJobId)) {
        return;
    }

    scene.orbitOverlapDimension = dimension;
    scene.orbitOverlapRender = render;
    sceneState.pendingSignature = signature;
    sceneState.activeStatus = "queued";
    setOverlapIndicator("queued", "Orbit refine queued", { sticky: true });
    if (sceneState.timer) {
        clearTimeout(sceneState.timer);
    }

    sceneState.timer = setTimeout(() => {
        sceneState.timer = 0;
        const chunksByBodyId = dimension === "3D"
            ? build3DJobPayload(
                scene,
                viewportWidth || window.innerWidth,
                viewportHeight || window.innerHeight,
            )
            : build2DJobPayload(scene);
        const hasChunks = Object.keys(chunksByBodyId).length > 0;
        if (!hasChunks) {
            clearScenePendingState(sceneState);
            setOverlapIndicator(null);
            return;
        }

        const effectiveOptions = {
            ...options,
            maxFactor: options.maxFactor ?? DEFAULT_OPTIONS.maxFactor,
            minFactor: Math.min(options.minFactor ?? DEFAULT_OPTIONS.minFactor, 1),
        };

        const jobId = nextJobId++;
        sceneState.activeJobId = jobId;
        sceneState.activeStatus = "running";
        setOverlapIndicator("running", "Orbit refining", { sticky: true });
        const worker = getWorker();
        if (worker) {
            sceneByJobId.set(jobId, scene);
            worker.postMessage({
                jobId,
                chunksByBodyId,
                options: effectiveOptions,
            });
            return;
        }

        runSyncFallback(scene, chunksByBodyId, effectiveOptions);
    }, DEFAULT_DEBOUNCE_MS);
}

function invalidateSceneOrbitOverlap(scene) {
    if (!scene) return;
    const state = getSceneOverlapState(scene);
    clearScenePendingState(state);
    state.appliedSignature = "";
    scene.orbitOverlapDisabledApplied = false;
    setOverlapIndicator(null);
}

export {
    invalidateSceneOrbitOverlap,
    requestSceneOrbitOverlapRefinement,
};
