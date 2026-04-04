function isFiniteNumber(value) {
    return Number.isFinite(value);
}

function isMobileViewport() {
    if (typeof window === "undefined") return false;
    return Number(window.innerWidth) <= 600;
}

function isArtemis2Mission(globalConfig = null) {
    const missionName = String(
        globalConfig?.mission_name_short ||
        globalConfig?.mission_name ||
        "",
    ).toLowerCase();
    if (missionName.includes("artemis 2") || missionName.includes("artemis ii")) {
        return true;
    }

    const dataPath = typeof window === "undefined"
        ? ""
        : String(window?.missionConfig?.dataPath || "").toLowerCase();
    return dataPath.includes("/artemis2/") || dataPath.includes("\\artemis2\\");
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
    if (
        missionConfig === "geo" &&
        isMobileViewport() &&
        isArtemis2Mission(globalConfig)
    ) {
        const legacyMagnitude = Math.hypot(
            (-1 * defaultCameraDistance) / 6,
            (-1 * defaultCameraDistance) / 30,
            defaultCameraDistance / 24,
        );
        const magnitude = legacyMagnitude * 7.4;
        return {
            position: { x: 0, y: 0, z: magnitude },
            magnitude,
            up: { x: 0, y: 1, z: 0 },
        };
    }

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
