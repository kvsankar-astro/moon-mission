import { PHYSICS_CONSTANTS as PC } from "../core/constants.js";

function isFiniteNumber(value) {
    return Number.isFinite(value);
}

const DEFAULT_ORBIT_DIAMETER_KM = 800000;
const DEFAULT_ORBIT_VIEW_MARGIN_BY_ORIGIN = Object.freeze({
    geo: 0.6,
    lunar: 1.3,
    relative: 0.6,
});
const DEFAULT_CAMERA_FOV_DEG = 50;
const RELATIVE_MIDPOINT_X_KM = 200000;

function isMobileViewport() {
    if (typeof window === "undefined") return false;
    return Number(window.innerWidth) <= 600;
}

function normalizeVector3(input) {
    if (
        !input ||
        typeof input !== "object" ||
        !isFiniteNumber(input.x) ||
        !isFiniteNumber(input.y) ||
        !isFiniteNumber(input.z)
    ) {
        return null;
    }
    return { x: input.x, y: input.y, z: input.z };
}

function resolveCameraProfile({ globalConfig, originKey, clientKey }) {
    const byOrigin = globalConfig?.ui?.cameraDefaults?.[originKey] || null;
    if (!byOrigin || typeof byOrigin !== "object") return null;

    // New schema: cameraDefaults[origin][desktop|mobile]
    const clientProfile = byOrigin?.[clientKey];
    if (clientProfile && typeof clientProfile === "object") {
        return clientProfile;
    }

    // Backward-compatible schema: cameraDefaults[origin].positionScale / position / ...
    return byOrigin;
}

function resolveConfiguredCameraDefaults({
    globalConfig,
    originKey,
    clientKey,
    defaultCameraDistance,
}) {
    const profile = resolveCameraProfile({ globalConfig, originKey, clientKey });
    if (!profile || typeof profile !== "object") return null;

    const absolutePosition = normalizeVector3(profile.position);
    const positionScale = normalizeVector3(profile.positionScale);
    const up = normalizeVector3(profile.up);
    const lookTarget = normalizeVector3(profile.lookTarget);
    const pinEarthBelowPanel = profile.pinEarthBelowPanel === true;

    let position = null;
    if (absolutePosition) {
        position = absolutePosition;
    } else if (positionScale) {
        position = {
            x: positionScale.x * defaultCameraDistance,
            y: positionScale.y * defaultCameraDistance,
            z: positionScale.z * defaultCameraDistance,
        };
    }

    if (!position) return null;

    return {
        position,
        magnitude: Math.hypot(position.x, position.y, position.z),
        ...(up ? { up } : {}),
        ...(lookTarget ? { lookTarget } : {}),
        ...(pinEarthBelowPanel ? { pinEarthBelowPanel: true } : {}),
    };
}

function resolveViewportAspect() {
    if (
        typeof window !== "undefined" &&
        Number.isFinite(window.innerWidth) &&
        Number.isFinite(window.innerHeight) &&
        window.innerWidth > 0 &&
        window.innerHeight > 0
    ) {
        return window.innerWidth / window.innerHeight;
    }
    return 16 / 9;
}

function resolveSceneUnitsPerKm(defaultCameraDistance) {
    const referenceSpanKm = 2 * PC.EARTH_MOON_DISTANCE_MEAN_AU * PC.KM_PER_AU;
    if (!isFiniteNumber(defaultCameraDistance) || defaultCameraDistance <= 0 || referenceSpanKm <= 0) {
        return 1;
    }
    return defaultCameraDistance / referenceSpanKm;
}

function resolveOrbitViewMargin(originKey) {
    return DEFAULT_ORBIT_VIEW_MARGIN_BY_ORIGIN[originKey] ?? DEFAULT_ORBIT_VIEW_MARGIN_BY_ORIGIN.geo;
}

function computeFittedZDistanceSceneUnits(originKey, defaultCameraDistance) {
    const sceneUnitsPerKm = resolveSceneUnitsPerKm(defaultCameraDistance);
    const orbitViewMargin = resolveOrbitViewMargin(originKey);
    const targetSpanSceneUnits =
        DEFAULT_ORBIT_DIAMETER_KM * orbitViewMargin * sceneUnitsPerKm;
    const aspect = Math.max(resolveViewportAspect(), 1e-6);
    const minViewScale = Math.min(1, aspect);
    const halfFovRad = (DEFAULT_CAMERA_FOV_DEG * Math.PI / 180) * 0.5;
    const tanHalfFov = Math.max(Math.tan(halfFovRad), 1e-6);
    return targetSpanSceneUnits / (2 * tanHalfFov * minViewScale);
}

function resolveOrbitSizedFallback(originKey, defaultCameraDistance) {
    const sceneUnitsPerKm = resolveSceneUnitsPerKm(defaultCameraDistance);
    const zDistanceSceneUnits = computeFittedZDistanceSceneUnits(originKey, defaultCameraDistance);
    const isRelative = originKey === "relative";
    const lookTarget = isRelative
        ? { x: RELATIVE_MIDPOINT_X_KM * sceneUnitsPerKm, y: 0, z: 0 }
        : { x: 0, y: 0, z: 0 };
    const position = {
        x: lookTarget.x,
        y: lookTarget.y,
        z: zDistanceSceneUnits,
    };
    return {
        position,
        magnitude: Math.hypot(position.x, position.y, position.z),
        up: { x: 0, y: 1, z: 0 },
        lookTarget,
    };
}

export function computePreferredCameraDistance({
    missionConfig,
    defaultCameraDistance,
    globalConfig = null,
    originKey = missionConfig,
    clientKey = isMobileViewport() ? "mobile" : "desktop",
}) {
    const configured = resolveConfiguredCameraDefaults({
        globalConfig,
        originKey,
        clientKey,
        defaultCameraDistance,
    });
    if (configured) {
        return configured;
    }

    return resolveOrbitSizedFallback(originKey, defaultCameraDistance);
}
