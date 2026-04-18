const DEFAULT_MOON_VISIBILITY_SAMPLES = createFibonacciSphereSamples(240);

function createFibonacciSphereSamples(count = 720) {
    const sampleCount = Math.max(64, Math.floor(count));
    const points = new Float32Array(sampleCount * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < sampleCount; i += 1) {
        const y = 1 - (2 * (i + 0.5)) / sampleCount;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        points[i * 3] = Math.cos(theta) * radius;
        points[i * 3 + 1] = y;
        points[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return points;
}

function normalizeVectorInPlace(vector) {
    if (!vector) return false;
    const length = Math.hypot(vector.x || 0, vector.y || 0, vector.z || 0);
    if (!Number.isFinite(length) || length <= 1e-9) {
        return false;
    }
    vector.x /= length;
    vector.y /= length;
    vector.z /= length;
    return true;
}

function roundPercentParts(parts) {
    const floors = parts.map((value) => Math.floor(Math.max(0, value)));
    let sum = floors.reduce((acc, value) => acc + value, 0);
    let remaining = Math.max(0, 100 - sum);
    const remainders = parts
        .map((value, index) => ({ index, remainder: Math.max(0, value) - floors[index] }))
        .sort((a, b) => b.remainder - a.remainder);
    let cursor = 0;
    while (remaining > 0 && remainders.length > 0) {
        floors[remainders[cursor % remainders.length].index] += 1;
        remaining -= 1;
        cursor += 1;
    }
    sum = floors.reduce((acc, value) => acc + value, 0);
    if (sum !== 100 && floors.length > 0) {
        floors[0] += 100 - sum;
    }
    return floors;
}

function hasFinitePositionVector(vector) {
    return !!vector &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z);
}

function resolveCraftPositionFromSceneState(sceneState, preferredCraftId = null) {
    const bodies = sceneState?.bodies;
    if (!bodies || typeof bodies !== "object") return null;

    const toPosition = (body) => {
        const pos = body?.position;
        return hasFinitePositionVector(pos)
            ? { x: pos.x, y: pos.y, z: pos.z }
            : null;
    };

    if (preferredCraftId) {
        const preferred = toPosition(bodies[preferredCraftId]);
        if (preferred) return preferred;
    }

    const fallbackSc = toPosition(bodies.SC);
    if (fallbackSc) return fallbackSc;

    for (const [bodyId, bodyState] of Object.entries(bodies)) {
        const normalizedId = String(bodyId || "").toUpperCase();
        if (normalizedId === "EARTH" || normalizedId === "MOON" || normalizedId === "SUN") {
            continue;
        }
        const pos = toPosition(bodyState);
        if (pos) return pos;
    }

    return null;
}

function resolveBodyPositionFromSceneState(sceneState, primaryBody, bodyId) {
    const bodies = sceneState?.bodies;
    const direct = bodies?.[bodyId]?.position;
    if (hasFinitePositionVector(direct)) {
        return direct;
    }

    const normalizedPrimaryBody = String(primaryBody || "").toUpperCase();
    if (normalizedPrimaryBody === bodyId) {
        return { x: 0, y: 0, z: 0 };
    }

    return null;
}

function computeMobileMoonVisibilityInfoFromSceneState({
    sceneState,
    primaryBody,
    preferredCraftId = null,
    samples = DEFAULT_MOON_VISIBILITY_SAMPLES,
} = {}) {
    const bodies = sceneState?.bodies;
    if (!bodies || typeof bodies !== "object") return null;

    const earthPos = resolveBodyPositionFromSceneState(sceneState, primaryBody, "EARTH");
    const moonPos = resolveBodyPositionFromSceneState(sceneState, primaryBody, "MOON");
    const craftPos = resolveCraftPositionFromSceneState(sceneState, preferredCraftId);
    if (!hasFinitePositionVector(earthPos) || !hasFinitePositionVector(moonPos) || !craftPos) {
        return null;
    }

    const craftFromMoonDir = {
        x: craftPos.x - moonPos.x,
        y: craftPos.y - moonPos.y,
        z: craftPos.z - moonPos.z,
    };
    const earthFromMoonDir = {
        x: earthPos.x - moonPos.x,
        y: earthPos.y - moonPos.y,
        z: earthPos.z - moonPos.z,
    };
    if (!normalizeVectorInPlace(craftFromMoonDir) || !normalizeVectorInPlace(earthFromMoonDir)) {
        return null;
    }

    const sunDirection = sceneState?.sunDirections?.moonCentered || sceneState?.sunDirection;
    if (!hasFinitePositionVector(sunDirection)) {
        return null;
    }
    const sunFromMoonDir = {
        x: sunDirection.x,
        y: sunDirection.y,
        z: sunDirection.z,
    };
    if (!normalizeVectorInPlace(sunFromMoonDir)) {
        return null;
    }

    let visibleCount = 0;
    let nearDay = 0;
    let nearNight = 0;
    let farDay = 0;
    let farNight = 0;

    for (let i = 0; i < samples.length; i += 3) {
        const nx = samples[i];
        const ny = samples[i + 1];
        const nz = samples[i + 2];
        const visibleDot = nx * craftFromMoonDir.x + ny * craftFromMoonDir.y + nz * craftFromMoonDir.z;
        if (visibleDot <= 0) continue;
        visibleCount += 1;

        const near = (nx * earthFromMoonDir.x + ny * earthFromMoonDir.y + nz * earthFromMoonDir.z) >= 0;
        const day = (nx * sunFromMoonDir.x + ny * sunFromMoonDir.y + nz * sunFromMoonDir.z) >= 0;

        if (near) {
            if (day) nearDay += 1;
            else nearNight += 1;
        } else if (day) {
            farDay += 1;
        } else {
            farNight += 1;
        }
    }

    if (visibleCount <= 0) {
        return null;
    }

    const rawParts = [
        (nearDay * 100) / visibleCount,
        (nearNight * 100) / visibleCount,
        (farDay * 100) / visibleCount,
        (farNight * 100) / visibleCount,
    ];
    const [nearDayPct, nearNightPct, farDayPct, farNightPct] = roundPercentParts(rawParts);

    return {
        nearPct: nearDayPct + nearNightPct,
        farPct: farDayPct + farNightPct,
        nearDayPct,
        nearNightPct,
        farDayPct,
        farNightPct,
    };
}

function buildMobileMoonVisibilitySignature(visibilityInfo) {
    if (!visibilityInfo) return "";
    return [
        visibilityInfo.nearDayPct,
        visibilityInfo.nearNightPct,
        visibilityInfo.farDayPct,
        visibilityInfo.farNightPct,
    ].join("|");
}

function shouldShowMobileMoonVisibility({
    isMobileViewport = false,
    activeTab = "",
    activeViewPresetId = "",
} = {}) {
    return !!isMobileViewport && activeTab === "views" && activeViewPresetId === "moon";
}

function shouldRunMobileMoonVisibilityLoop({
    isMobileViewport = false,
    activeTab = "",
} = {}) {
    return !!isMobileViewport && activeTab === "views";
}

function shouldSkipMobileMoonVisibilityUpdate({
    force = false,
    nowMs,
    lastUpdateMs,
    minIntervalMs,
} = {}) {
    if (force) return false;
    if (!Number.isFinite(nowMs) || !Number.isFinite(lastUpdateMs) || !Number.isFinite(minIntervalMs)) {
        return false;
    }
    return (nowMs - lastUpdateMs) < minIntervalMs;
}

export {
    DEFAULT_MOON_VISIBILITY_SAMPLES,
    buildMobileMoonVisibilitySignature,
    computeMobileMoonVisibilityInfoFromSceneState,
    createFibonacciSphereSamples,
    hasFinitePositionVector,
    normalizeVectorInPlace,
    resolveBodyPositionFromSceneState,
    resolveCraftPositionFromSceneState,
    roundPercentParts,
    shouldRunMobileMoonVisibilityLoop,
    shouldShowMobileMoonVisibility,
    shouldSkipMobileMoonVisibilityUpdate,
};
