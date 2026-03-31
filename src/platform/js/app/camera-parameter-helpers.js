function isFiniteNumber(value) {
    return Number.isFinite(value);
}

function resolveConfiguredCameraPosition({ globalConfig, missionConfig, defaultCameraDistance }) {
    const positionScale = globalConfig?.ui?.cameraDefaults?.[missionConfig]?.positionScale;
    if (
        positionScale &&
        typeof positionScale === "object" &&
        isFiniteNumber(positionScale.x) &&
        isFiniteNumber(positionScale.y) &&
        isFiniteNumber(positionScale.z)
    ) {
        return {
            x: positionScale.x * defaultCameraDistance,
            y: positionScale.y * defaultCameraDistance,
            z: positionScale.z * defaultCameraDistance,
        };
    }
    return null;
}

export function computePreferredCameraDistance({ missionConfig, defaultCameraDistance, globalConfig = null }) {
    const configuredPosition = resolveConfiguredCameraPosition({
        globalConfig,
        missionConfig,
        defaultCameraDistance,
    });
    if (configuredPosition) {
        return {
            position: configuredPosition,
            magnitude: Math.hypot(configuredPosition.x, configuredPosition.y, configuredPosition.z),
        };
    }

    if (missionConfig === "geo") {
        const position = {
            x: (-1 * defaultCameraDistance) / 6,
            y: (-1 * defaultCameraDistance) / 30,
            z: defaultCameraDistance / 24,
        };
        return { position, magnitude: Math.hypot(position.x, position.y, position.z) };
    }

    const position = {
        x: (-1 * defaultCameraDistance) / 96,
        y: (-1 * defaultCameraDistance) / 96,
        z: (-1 * defaultCameraDistance) / 96,
    };
    return { position, magnitude: Math.hypot(position.x, position.y, position.z) };
}
