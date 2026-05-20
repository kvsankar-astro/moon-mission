const COMPOSER_LOCK_TARGETS = new Set(["earth", "moon", "none"]);
const COMPOSER_ORIENTATION_REFERENCES = new Set(["world", "moon-north", "earth-north"]);

function asLowerString(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeComposerLockTarget(target) {
    const normalized = asLowerString(target);
    return COMPOSER_LOCK_TARGETS.has(normalized) ? normalized : "none";
}

function normalizeComposerOrientationReference(reference, fallback = "world") {
    const normalizedFallback = COMPOSER_ORIENTATION_REFERENCES.has(asLowerString(fallback))
        ? asLowerString(fallback)
        : "world";
    const normalized = asLowerString(reference);
    return COMPOSER_ORIENTATION_REFERENCES.has(normalized) ? normalized : normalizedFallback;
}

function toPositiveFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : Number.NaN;
}

function normalizeComposerViewState(state = {}) {
    const lockTarget = normalizeComposerLockTarget(state.lockTarget);
    return {
        lockTarget,
        autoFovEnabled: lockTarget === "none" ? false : state.autoFovEnabled === true,
        orientationReference: normalizeComposerOrientationReference(state.orientationReference),
        surfaceTarget: state.surfaceTarget || null,
        mediaDriven: state.mediaDriven === true,
        manualFovDegrees: toPositiveFiniteNumber(state.manualFovDegrees),
    };
}

function guidedComposerViewState(currentState = {}) {
    const current = normalizeComposerViewState(currentState);
    return {
        ...current,
        lockTarget: "moon",
        autoFovEnabled: true,
        orientationReference: "world",
        surfaceTarget: null,
        mediaDriven: false,
        manualFovDegrees: Number.NaN,
    };
}

function mediaShotComposerViewState(currentState = {}, hint = {}) {
    const lockTarget = normalizeComposerLockTarget(hint?.lockTarget);
    if (lockTarget === "none") {
        return {
            applied: false,
            state: normalizeComposerViewState(currentState),
        };
    }

    const manualFovDegrees = toPositiveFiniteNumber(hint?.verticalFovDegrees);
    return {
        applied: true,
        state: {
            ...normalizeComposerViewState(currentState),
            lockTarget,
            autoFovEnabled: !Number.isFinite(manualFovDegrees),
            orientationReference: normalizeComposerOrientationReference(
                hint?.orientationReference,
                lockTarget === "earth" ? "moon-north" : "world",
            ),
            surfaceTarget: hint?.surfaceTarget || null,
            mediaDriven: true,
            manualFovDegrees,
        },
    };
}

function lockTargetComposerViewState(currentState = {}, {
    target,
    forceAuto = false,
} = {}) {
    const current = normalizeComposerViewState(currentState);
    const lockTarget = normalizeComposerLockTarget(target);
    const targetChanged = lockTarget !== current.lockTarget;
    const autoFovEnabled = lockTarget === "none"
        ? false
        : (targetChanged || forceAuto === true ? true : current.autoFovEnabled);
    return {
        ...current,
        lockTarget,
        autoFovEnabled,
        surfaceTarget: null,
        mediaDriven: false,
        manualFovDegrees: Number.NaN,
    };
}

function persistedComposerViewState(currentState = {}, persisted = {}) {
    const current = normalizeComposerViewState(currentState);
    const lockTarget = normalizeComposerLockTarget(current.lockTarget);
    return {
        ...current,
        lockTarget,
        autoFovEnabled: lockTarget === "none" ? false : current.autoFovEnabled === true,
        manualFovDegrees: toPositiveFiniteNumber(persisted?.fov),
    };
}

function resolveComposerViewIntent(currentState = {}, intent = {}) {
    switch (intent?.type) {
        case "guided":
            return {
                applied: true,
                state: guidedComposerViewState(currentState),
            };
        case "media-shot":
            return mediaShotComposerViewState(currentState, intent.hint);
        case "lock-target":
            return {
                applied: true,
                state: lockTargetComposerViewState(currentState, intent),
            };
        case "persisted":
            return {
                applied: true,
                state: persistedComposerViewState(currentState, intent.persisted),
            };
        default:
            return {
                applied: false,
                state: normalizeComposerViewState(currentState),
            };
    }
}

export {
    normalizeComposerLockTarget,
    normalizeComposerOrientationReference,
    normalizeComposerViewState,
    resolveComposerViewIntent,
};
