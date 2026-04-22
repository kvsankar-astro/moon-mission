import { PHYSICS_CONSTANTS as PC } from "../constants.js";

const COMPARISON_REFERENCE_DISTANCE_KM =
    PC.EARTH_MOON_DISTANCE_MEAN_AU * PC.KM_PER_AU;
const COMPARISON_DISTANCE_EPSILON_KM = 1e-6;

function asFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function cloneObject(value) {
    return value && typeof value === "object" ? { ...value } : value;
}

function magnitudeFromPosition(position) {
    const x = asFiniteNumber(position?.x);
    const y = asFiniteNumber(position?.y);
    const z = asFiniteNumber(position?.z);
    if (x === null || y === null || z === null) {
        return Number.NaN;
    }
    return Math.hypot(x, y, z);
}

function scalePosition(position, scale) {
    const x = asFiniteNumber(position?.x);
    const y = asFiniteNumber(position?.y);
    const z = asFiniteNumber(position?.z);
    if (x === null || y === null || z === null) {
        return cloneObject(position);
    }
    return {
        x: x * scale,
        y: y * scale,
        z: z * scale,
    };
}

function scaleVelocity(velocity, scale) {
    const vx = asFiniteNumber(velocity?.vx);
    const vy = asFiniteNumber(velocity?.vy);
    const vz = asFiniteNumber(velocity?.vz);
    if (vx === null || vy === null || vz === null) {
        return cloneObject(velocity);
    }
    return {
        vx: vx * scale,
        vy: vy * scale,
        vz: vz * scale,
    };
}

function deriveVelocityFromPositions(position, nextPosition) {
    const x = asFiniteNumber(position?.x);
    const y = asFiniteNumber(position?.y);
    const z = asFiniteNumber(position?.z);
    const nextX = asFiniteNumber(nextPosition?.x);
    const nextY = asFiniteNumber(nextPosition?.y);
    const nextZ = asFiniteNumber(nextPosition?.z);
    if (
        x === null || y === null || z === null ||
        nextX === null || nextY === null || nextZ === null
    ) {
        return null;
    }

    const velocity = {
        vx: nextX - x,
        vy: nextY - y,
        vz: nextZ - z,
    };
    const speed = Math.hypot(velocity.vx, velocity.vy, velocity.vz);
    return speed > COMPARISON_DISTANCE_EPSILON_KM ? velocity : null;
}

function resolveComparisonNormalizationBodyId(config) {
    return String(config || "").trim().toLowerCase() === "lunar"
        ? "EARTH"
        : "MOON";
}

function resolveComparisonDistanceState(sceneState) {
    const bodies = sceneState?.bodies || {};
    const preferredBodyId = resolveComparisonNormalizationBodyId(sceneState?.config);
    const preferredState = bodies[preferredBodyId];
    if (preferredState?.available) {
        return preferredState;
    }

    if (preferredBodyId !== "MOON" && bodies.MOON?.available) {
        return bodies.MOON;
    }
    if (preferredBodyId !== "EARTH" && bodies.EARTH?.available) {
        return bodies.EARTH;
    }
    return null;
}

function resolveComparisonNormalizationScaleFromDistance(
    distanceKm,
    referenceDistanceKm = COMPARISON_REFERENCE_DISTANCE_KM,
) {
    const normalizedDistance = asFiniteNumber(distanceKm);
    const normalizedReference = asFiniteNumber(referenceDistanceKm);
    if (
        normalizedDistance === null ||
        normalizedReference === null ||
        normalizedDistance <= COMPARISON_DISTANCE_EPSILON_KM ||
        normalizedReference <= COMPARISON_DISTANCE_EPSILON_KM
    ) {
        return 1;
    }
    return normalizedReference / normalizedDistance;
}

function resolveComparisonNormalizationScaleFromSceneState(
    sceneState,
    options = {},
) {
    const referenceDistanceKm =
        asFiniteNumber(options.referenceDistanceKm) ||
        COMPARISON_REFERENCE_DISTANCE_KM;
    const distanceState = resolveComparisonDistanceState(sceneState);
    const distanceKm = magnitudeFromPosition(distanceState?.position);
    return resolveComparisonNormalizationScaleFromDistance(
        distanceKm,
        referenceDistanceKm,
    );
}

function transformComparisonBodyState(bodyState, scale) {
    if (!bodyState || typeof bodyState !== "object" || bodyState.available === false) {
        return bodyState;
    }

    const position = scalePosition(bodyState.position, scale);
    const nextPosition = bodyState.nextPosition
        ? scalePosition(bodyState.nextPosition, scale)
        : position;
    const derivedVelocity = deriveVelocityFromPositions(position, nextPosition);

    return {
        ...bodyState,
        position,
        nextPosition,
        velocity: derivedVelocity || scaleVelocity(bodyState.velocity, scale),
        nextVelocity: scaleVelocity(bodyState.nextVelocity || bodyState.velocity, scale),
    };
}

function createComparisonDisplayState(sceneState, options = {}) {
    if (!sceneState || typeof sceneState !== "object") {
        return sceneState;
    }

    const referenceDistanceKm =
        asFiniteNumber(options.referenceDistanceKm) ||
        COMPARISON_REFERENCE_DISTANCE_KM;
    const scale = resolveComparisonNormalizationScaleFromSceneState(sceneState, {
        referenceDistanceKm,
    });
    const bodies = {};
    for (const [bodyId, bodyState] of Object.entries(sceneState.bodies || {})) {
        bodies[bodyId] = transformComparisonBodyState(bodyState, scale);
    }

    return {
        ...sceneState,
        bodies,
        comparisonNormalizationScale: scale,
        comparisonReferenceDistanceKm: referenceDistanceKm,
    };
}

function transformComparisonCurveVectors(vectors, resolveScaleForVector) {
    if (!Array.isArray(vectors) || vectors.length === 0) {
        return Array.isArray(vectors) ? vectors : [];
    }

    const transformedPoints = vectors.map((vector, index) => {
        const resolvedScale = asFiniteNumber(
            typeof resolveScaleForVector === "function"
                ? resolveScaleForVector(vector, index)
                : null,
        );
        const scale = resolvedScale ?? 1;
        const position = scalePosition(vector, scale);
        return {
            scale,
            vector,
            position,
        };
    });

    return transformedPoints.map(({ vector, position, scale }, index) => {
        const nextPoint = transformedPoints[index + 1] || null;
        let velocity = null;
        if (nextPoint) {
            const currentTimeMs = asFiniteNumber(vector?.timeMs);
            const nextTimeMs = asFiniteNumber(nextPoint.vector?.timeMs);
            const dtSeconds = (
                currentTimeMs === null || nextTimeMs === null
                    ? Number.NaN
                    : (nextTimeMs - currentTimeMs) / 1000
            );
            if (Number.isFinite(dtSeconds) && dtSeconds > 0) {
                const deltaVelocity = deriveVelocityFromPositions(
                    position,
                    nextPoint.position,
                );
                if (deltaVelocity) {
                    velocity = {
                        vx: deltaVelocity.vx / dtSeconds,
                        vy: deltaVelocity.vy / dtSeconds,
                        vz: deltaVelocity.vz / dtSeconds,
                    };
                }
            }
        }

        const scaledVelocity = velocity || scaleVelocity(vector, scale);
        return {
            ...vector,
            x: position.x,
            y: position.y,
            z: position.z,
            vx: scaledVelocity?.vx ?? vector.vx,
            vy: scaledVelocity?.vy ?? vector.vy,
            vz: scaledVelocity?.vz ?? vector.vz,
        };
    });
}

export {
    COMPARISON_REFERENCE_DISTANCE_KM,
    createComparisonDisplayState,
    resolveComparisonNormalizationBodyId,
    resolveComparisonNormalizationScaleFromDistance,
    resolveComparisonNormalizationScaleFromSceneState,
    transformComparisonBodyState,
    transformComparisonCurveVectors,
};
