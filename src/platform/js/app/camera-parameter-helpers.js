export function computePreferredCameraDistance({ missionConfig, defaultCameraDistance }) {
    if (missionConfig === "geo") {
        const position = {
            x: (-11 * defaultCameraDistance) / 10,
            y: (3 * defaultCameraDistance) / 20,
            z: (3 * defaultCameraDistance) / 20,
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
