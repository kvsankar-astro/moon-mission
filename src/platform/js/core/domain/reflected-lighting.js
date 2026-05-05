import { PHYSICS_CONSTANTS as PC } from "../constants.js";

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function mix(minValue, maxValue, t) {
    return minValue + ((maxValue - minValue) * t);
}

function normalizeDirection(candidate) {
    const x = Number(candidate?.x);
    const y = Number(candidate?.y);
    const z = Number(candidate?.z);
    const norm = Math.hypot(x, y, z);
    if (!Number.isFinite(norm) || norm <= 1e-12) {
        return null;
    }
    return {
        x: x / norm,
        y: y / norm,
        z: z / norm,
    };
}

function normalizeBodyVector(fromPosition, toPosition) {
    return normalizeDirection({
        x: Number(toPosition?.x) - Number(fromPosition?.x),
        y: Number(toPosition?.y) - Number(fromPosition?.y),
        z: Number(toPosition?.z) - Number(fromPosition?.z),
    });
}

function resolveDistanceScale(distance, {
    referenceDistance = PC.EARTH_MOON_DISTANCE_MEAN_AU,
    distanceWeight = 0,
    minDistanceScale = 0.72,
    maxDistanceScale = 1.35,
} = {}) {
    if (!Number.isFinite(distance) || distance <= 1e-12) {
        return 1;
    }
    const boundedReferenceDistance = Number.isFinite(referenceDistance) && referenceDistance > 1e-12
        ? referenceDistance
        : PC.EARTH_MOON_DISTANCE_MEAN_AU;
    const inverseSquareScale = clamp01(
        (boundedReferenceDistance * boundedReferenceDistance) / Math.max(distance * distance, 1e-12),
    );
    const normalizedDistanceScale =
        minDistanceScale +
        ((maxDistanceScale - minDistanceScale) * inverseSquareScale);
    const boundedDistanceWeight = clamp01(distanceWeight);
    return (1 - boundedDistanceWeight) + (boundedDistanceWeight * normalizedDistanceScale);
}

export function computeEarthshineLightState({
    earthPosition,
    moonPosition,
    moonSunDirection,
    minIntensity = 0,
    maxIntensity = 0.02,
    phaseExponent = 1.8,
} = {}) {
    const direction = normalizeBodyVector(moonPosition, earthPosition);
    if (!direction) {
        return null;
    }

    const sunDirection = normalizeDirection(moonSunDirection);
    if (!sunDirection) {
        return {
            direction,
            intensity: Number.isFinite(minIntensity) ? Math.max(0, minIntensity) : 0,
        };
    }

    const phaseAlignment = clamp01(
        (1 + ((sunDirection.x * direction.x) + (sunDirection.y * direction.y) + (sunDirection.z * direction.z))) * 0.5,
    );
    const phasedIntensity = Math.pow(phaseAlignment, Math.max(0.1, Number(phaseExponent) || 1));

    return {
        direction,
        intensity: mix(
            Number.isFinite(minIntensity) ? Math.max(0, minIntensity) : 0,
            Number.isFinite(maxIntensity) ? Math.max(0, maxIntensity) : 0,
            phasedIntensity,
        ),
    };
}

export function computeMoonshineLightState({
    earthPosition,
    moonPosition,
    earthSunDirection,
    minIntensity = 0,
    maxIntensity = 0.0004,
    phaseExponent = 1.45,
    distanceWeight = 0.24,
    referenceDistance = PC.EARTH_MOON_DISTANCE_MEAN_AU,
    minDistanceScale = 0.72,
    maxDistanceScale = 1.35,
} = {}) {
    const direction = normalizeBodyVector(earthPosition, moonPosition);
    if (!direction) {
        return null;
    }

    const sunDirection = normalizeDirection(earthSunDirection);
    if (!sunDirection) {
        return {
            direction,
            intensity: Number.isFinite(minIntensity) ? Math.max(0, minIntensity) : 0,
        };
    }

    const illuminationFraction = clamp01(
        (1 - ((sunDirection.x * direction.x) + (sunDirection.y * direction.y) + (sunDirection.z * direction.z))) * 0.5,
    );
    const phasedIntensity = Math.pow(illuminationFraction, Math.max(0.1, Number(phaseExponent) || 1));
    const dx = Number(moonPosition?.x) - Number(earthPosition?.x);
    const dy = Number(moonPosition?.y) - Number(earthPosition?.y);
    const dz = Number(moonPosition?.z) - Number(earthPosition?.z);
    const earthMoonDistance = Math.hypot(dx, dy, dz);
    const distanceScale = resolveDistanceScale(earthMoonDistance, {
        referenceDistance,
        distanceWeight,
        minDistanceScale,
        maxDistanceScale,
    });

    return {
        direction,
        intensity: mix(
            Number.isFinite(minIntensity) ? Math.max(0, minIntensity) : 0,
            Number.isFinite(maxIntensity) ? Math.max(0, maxIntensity) : 0,
            phasedIntensity,
        ) * distanceScale,
    };
}
