export function computePreferredCameraDistance({ missionConfig, defaultCameraDistance }) {
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

