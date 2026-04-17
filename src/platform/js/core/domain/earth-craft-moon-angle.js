function hasFiniteVector3(vector) {
    return !!vector &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z);
}

function computeAngleDegreesBetweenVectors(fromVertexA, fromVertexB) {
    if (!hasFiniteVector3(fromVertexA) || !hasFiniteVector3(fromVertexB)) return null;
    const aMag = Math.hypot(fromVertexA.x, fromVertexA.y, fromVertexA.z);
    const bMag = Math.hypot(fromVertexB.x, fromVertexB.y, fromVertexB.z);
    if (!Number.isFinite(aMag) || !Number.isFinite(bMag) || aMag <= 1e-9 || bMag <= 1e-9) {
        return null;
    }
    const dot = fromVertexA.x * fromVertexB.x + fromVertexA.y * fromVertexB.y + fromVertexA.z * fromVertexB.z;
    const cosine = dot / (aMag * bMag);
    if (!Number.isFinite(cosine)) return null;
    const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosine)));
    if (!Number.isFinite(angleRadians)) return null;
    return angleRadians * (180 / Math.PI);
}

function resolveCraftPositionFromSceneState(sceneState) {
    const bodies = sceneState?.bodies;
    if (!bodies || typeof bodies !== "object") return null;

    const telemetryBodyId = String(sceneState?.telemetryBodyId || "").toUpperCase();
    if (telemetryBodyId && hasFiniteVector3(bodies[telemetryBodyId]?.position)) {
        return bodies[telemetryBodyId].position;
    }
    if (hasFiniteVector3(bodies.SC?.position)) {
        return bodies.SC.position;
    }

    for (const [bodyId, bodyState] of Object.entries(bodies)) {
        const normalizedId = String(bodyId || "").toUpperCase();
        if (normalizedId === "EARTH" || normalizedId === "MOON" || normalizedId === "SUN") {
            continue;
        }
        if (hasFiniteVector3(bodyState?.position)) {
            return bodyState.position;
        }
    }
    return null;
}

function computeEarthCraftMoonAngleFromSceneState(sceneState) {
    const scPos = resolveCraftPositionFromSceneState(sceneState);
    const earthPos = sceneState?.bodies?.EARTH?.position;
    const moonPos = sceneState?.bodies?.MOON?.position;
    if (!hasFiniteVector3(scPos) || !hasFiniteVector3(earthPos) || !hasFiniteVector3(moonPos)) {
        return null;
    }

    return computeAngleDegreesBetweenVectors(
        {
            x: earthPos.x - moonPos.x,
            y: earthPos.y - moonPos.y,
            z: earthPos.z - moonPos.z,
        },
        {
            x: scPos.x - moonPos.x,
            y: scPos.y - moonPos.y,
            z: scPos.z - moonPos.z,
        },
    );
}

export {
    computeAngleDegreesBetweenVectors,
    computeEarthCraftMoonAngleFromSceneState,
    hasFiniteVector3,
};
