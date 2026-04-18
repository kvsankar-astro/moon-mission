const DEFAULT_COMPOSE_FOV = 110;
const DEFAULT_MIN_FOV = 1;
const DEFAULT_MAX_FOV = 179;
const DEFAULT_AUTO_FOV_MARGIN_SCALE = 1.03;
const DEFAULT_AUTO_FOV_EPSILON_DEGREES = 1e-4;

function clampMobileViewFov(value, {
    fallback = DEFAULT_COMPOSE_FOV,
    min = DEFAULT_MIN_FOV,
    max = DEFAULT_MAX_FOV,
} = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function buildMobileViewFovDisplayState(fovDegrees, clampOptions = {}) {
    const nextFov = clampMobileViewFov(fovDegrees, clampOptions);
    const rounded = Math.round(nextFov);
    return {
        fov: nextFov,
        rounded,
        sliderValue: String(rounded),
        text: `${rounded}\u00b0`,
    };
}

function computeMobileAutoFovDegrees({
    distanceToTarget,
    targetRadius,
    aspect,
    marginScale = DEFAULT_AUTO_FOV_MARGIN_SCALE,
} = {}) {
    if (!Number.isFinite(distanceToTarget) || distanceToTarget <= 0) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 1;
    const fitRadius = radius * marginScale;
    const safeDistance = Math.max(distanceToTarget, fitRadius + 1e-9);
    const ratio = Math.min(fitRadius / safeDistance, 0.999999);
    const angularRadius = Math.asin(ratio);
    const safeAspect = Math.max(Number(aspect) || 1, 1e-3);
    const verticalFromHeight = 2 * angularRadius;
    const verticalFromWidth = 2 * Math.atan(Math.tan(angularRadius) / safeAspect);
    const requiredVerticalRadians = Math.max(verticalFromHeight, verticalFromWidth);
    return (requiredVerticalRadians * 180) / Math.PI;
}

function resolveMobileTouchDistance(touchA, touchB) {
    if (!touchA || !touchB) return null;
    const dx = Number(touchA.clientX) - Number(touchB.clientX);
    const dy = Number(touchA.clientY) - Number(touchB.clientY);
    const distance = Math.hypot(dx, dy);
    return Number.isFinite(distance) ? distance : null;
}

function shouldSkipMobileAutoFovUpdate({
    currentFov,
    nextFov,
    epsilonDegrees = DEFAULT_AUTO_FOV_EPSILON_DEGREES,
} = {}) {
    if (!Number.isFinite(currentFov) || !Number.isFinite(nextFov)) return false;
    return Math.abs(currentFov - nextFov) < epsilonDegrees;
}

export {
    DEFAULT_AUTO_FOV_EPSILON_DEGREES,
    DEFAULT_AUTO_FOV_MARGIN_SCALE,
    DEFAULT_COMPOSE_FOV,
    DEFAULT_MAX_FOV,
    DEFAULT_MIN_FOV,
    buildMobileViewFovDisplayState,
    clampMobileViewFov,
    computeMobileAutoFovDegrees,
    resolveMobileTouchDistance,
    shouldSkipMobileAutoFovUpdate,
};
