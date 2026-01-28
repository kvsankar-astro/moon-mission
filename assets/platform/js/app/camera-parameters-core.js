import { computePreferredCameraDistance } from "./camera-parameter-helpers.js";
import { getPlaneCameraPose } from "./plane-camera-config.js";

export function computeSceneCameraParameters({
    planeSelection,
    missionConfig,
    isInitialization,
    controllerDistance,
    defaultCameraDistance,
}) {
    const preferredDistance = computePreferredCameraDistance({
        missionConfig,
        defaultCameraDistance,
    });

    if (planeSelection === "DEFAULT") {
        return {
            fov: 50.0,
            craftVisible: true,
            position: preferredDistance.position,
            up: { x: 0, y: 0, z: 1 },
        };
    }

    const cameraDistance = isInitialization
        ? preferredDistance.magnitude
        : controllerDistance !== null && controllerDistance > 0
            ? controllerDistance
            : defaultCameraDistance;

    const pose = getPlaneCameraPose({
        planeSelection,
        missionConfig,
        cameraDistance,
    });

    return {
        fov: 50.0,
        craftVisible: true,
        position: pose?.position ?? null,
        up: pose?.up ?? null,
    };
}
