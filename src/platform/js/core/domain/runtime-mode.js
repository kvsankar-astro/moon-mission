const DEFAULT_COMPARE_SUN_DIRECTION = Object.freeze({
    x: 0.82,
    y: -0.41,
    z: 0.39,
});

function normalizeRuntimeMode(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (normalized === "relative" || normalized === "compare") {
        return normalized;
    }
    return "standard";
}

function isRelativeFrameRuntimeMode(mode) {
    const normalized = normalizeRuntimeMode(mode);
    return normalized === "relative" || normalized === "compare";
}

function isCompareRuntimeMode(mode) {
    return normalizeRuntimeMode(mode) === "compare";
}

function resolveFrameModeForRuntimeMode(mode) {
    return isRelativeFrameRuntimeMode(mode) ? "relative" : "inertial";
}

function normalizeDirectionCandidate(candidate, fallback = DEFAULT_COMPARE_SUN_DIRECTION) {
    const rawCandidate = Array.isArray(candidate)
        ? {
            x: candidate[0],
            y: candidate[1],
            z: candidate[2],
        }
        : candidate;

    const fallbackX = Number(fallback?.x);
    const fallbackY = Number(fallback?.y);
    const fallbackZ = Number(fallback?.z);
    let x = Number(rawCandidate?.x);
    let y = Number(rawCandidate?.y);
    let z = Number(rawCandidate?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        x = fallbackX;
        y = fallbackY;
        z = fallbackZ;
    }

    const norm = Math.hypot(x, y, z);
    if (!Number.isFinite(norm) || norm <= 1e-12) {
        return {
            x: 1,
            y: 0,
            z: 0,
        };
    }

    return {
        x: x / norm,
        y: y / norm,
        z: z / norm,
    };
}

function resolveCompareDisplayProfile(globalConfig) {
    const compareConfig =
        globalConfig?.ui?.compareMode ||
        globalConfig?.compareMode ||
        globalConfig?.comparison?.display ||
        null;

    return {
        freezeEarthRotation: compareConfig?.freezeEarthRotation !== false,
        freezeMoonRotation: compareConfig?.freezeMoonRotation !== false,
        freezeSkyOrientation: compareConfig?.freezeSkyOrientation !== false,
        disableEarthshine: compareConfig?.disableEarthshine !== false,
        fixedSunDirection: normalizeDirectionCandidate(
            compareConfig?.fixedSunDirection || compareConfig?.sunDirection,
        ),
    };
}

export {
    DEFAULT_COMPARE_SUN_DIRECTION,
    isCompareRuntimeMode,
    isRelativeFrameRuntimeMode,
    normalizeRuntimeMode,
    resolveCompareDisplayProfile,
    resolveFrameModeForRuntimeMode,
};
