import { computePreferredCameraDistance } from "./camera-parameter-helpers.js";
import { getPlaneCameraPose } from "./plane-camera-config.js";
import { resolveEffectivePlaneSelection } from "./plane-view-state.js";

export function computeSceneCameraParameters({
    planeSelection,
    missionConfig,
    globalConfig,
    isRelativeMode = false,
    relativeDefaultPlaneSelection = "DEFAULT",
    isInitialization,
    controllerDistance,
    defaultCameraDistance,
}) {
    const requestedPlaneSelection = planeSelection;
    const originKey = isRelativeMode ? "relative" : missionConfig;
    const preferredDistance = computePreferredCameraDistance({
        missionConfig,
        originKey,
        defaultCameraDistance,
        globalConfig,
    });
    const preferredDistanceConfig = /** @type {any} */ (preferredDistance);
    const effectivePlaneSelection = resolveEffectivePlaneSelection(planeSelection, {
        isRelativeMode,
        relativeDefaultPlaneSelection,
    });

    if (effectivePlaneSelection === "DEFAULT") {
        return {
            fov: 50.0,
            craftVisible: true,
            position: preferredDistanceConfig.position,
            up: preferredDistanceConfig.up || { x: 0, y: 0, z: 1 },
            lookTarget: preferredDistanceConfig.lookTarget || null,
            pinEarthBelowPanel: !!preferredDistanceConfig.pinEarthBelowPanel,
        };
    }

    const shouldResetRelativeDefaultDistance =
        isRelativeMode && requestedPlaneSelection === "DEFAULT";

    const cameraDistance = isInitialization || shouldResetRelativeDefaultDistance
        ? preferredDistanceConfig.magnitude
        : controllerDistance !== null && controllerDistance > 0
            ? controllerDistance
            : defaultCameraDistance;

    const pose = getPlaneCameraPose({
        planeSelection: effectivePlaneSelection,
        missionConfig,
        cameraDistance,
    });

    return {
        fov: 50.0,
        craftVisible: true,
        position: pose?.position ?? null,
        up: pose?.up ?? null,
        lookTarget: preferredDistanceConfig.lookTarget || null,
        pinEarthBelowPanel: !!preferredDistanceConfig.pinEarthBelowPanel,
    };
}
