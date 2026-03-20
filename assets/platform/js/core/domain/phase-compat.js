const DEFAULT_PHASE_KEYS = Object.freeze(["geo", "lunar"]);
const DEFAULT_PRIMARY_PHASE_KEY = "geo";

const MODE_SWITCH_TARGET_BY_PHASE = Object.freeze({
    geo: "geo",
    lunar: "lunar",
    landing: "lunar",
});

function normalizePhaseKeys(phaseKeys) {
    if (!Array.isArray(phaseKeys)) return [];
    return phaseKeys.filter((phaseKey) => typeof phaseKey === "string" && phaseKey.length > 0);
}

function getConfiguredPhaseKeys(globalConfig, { fallbackPhaseKeys = DEFAULT_PHASE_KEYS } = {}) {
    const configured = normalizePhaseKeys(globalConfig?.phases);
    if (configured.length > 0) return configured;
    return normalizePhaseKeys(fallbackPhaseKeys);
}

function getDefaultPhaseKey(globalConfig = null) {
    const configured = getConfiguredPhaseKeys(globalConfig, {
        fallbackPhaseKeys: DEFAULT_PHASE_KEYS,
    });
    return configured[0] || DEFAULT_PRIMARY_PHASE_KEY;
}

function buildPhaseFlagMap(phaseKeys, initialValue = false) {
    const normalized = normalizePhaseKeys(phaseKeys);
    const keys = normalized.length > 0 ? normalized : [...DEFAULT_PHASE_KEYS];
    const map = {};
    for (const phaseKey of keys) {
        map[phaseKey] = initialValue;
    }
    return map;
}

function resolveModeSwitchTarget(phaseKey, globalConfig = null) {
    const explicit = globalConfig?.phase_mode_switch?.[phaseKey];
    if (typeof explicit === "string" && explicit.length > 0) {
        return explicit;
    }

    if (MODE_SWITCH_TARGET_BY_PHASE[phaseKey]) {
        return MODE_SWITCH_TARGET_BY_PHASE[phaseKey];
    }

    const center = globalConfig?.[phaseKey]?.center;
    if (center === "moon_center") return "lunar";
    if (center === "earth_center") return "geo";
    return "geo";
}

function resolvePhaseDescriptor(phaseKey, globalConfig = null) {
    const modeSwitchTarget = resolveModeSwitchTarget(phaseKey, globalConfig);
    const isLunarLike = modeSwitchTarget === "lunar";

    return {
        phaseKey,
        modeSwitchTarget,
        primaryBody: isLunarLike ? "MOON" : "EARTH",
        secondaryBody: isLunarLike ? "EARTH" : "MOON",
        moonScale: isLunarLike ? 0.997 : 1.0,
        orbitFileSizeBytes: isLunarLike ? 34800 * 1024 : 34793 * 1024,
        stepsPerHop: 4,
        allowRelativeOrbitOverride: !isLunarLike,
    };
}

function resolveLandingDataPhaseKeys(globalConfig, { fallbackPhaseKeys = DEFAULT_PHASE_KEYS } = {}) {
    const explicit = normalizePhaseKeys(globalConfig?.landing?.phase_sources);
    const explicitAlt = normalizePhaseKeys(globalConfig?.landing?.phaseSources);
    const explicitPhaseKeys = explicit.length > 0 ? explicit : explicitAlt;
    if (explicitPhaseKeys.length > 0) return explicitPhaseKeys;

    const configured = getConfiguredPhaseKeys(globalConfig, { fallbackPhaseKeys });
    const nonLanding = configured.filter((phaseKey) => phaseKey !== "landing");
    if (nonLanding.length > 0) return nonLanding;
    return [...DEFAULT_PHASE_KEYS];
}

function applyModeSwitchForPhase({
    phaseKey,
    globalConfig,
    switchToGeo,
    switchToLunar,
}) {
    const target = resolveModeSwitchTarget(phaseKey, globalConfig);
    if (target === "lunar") {
        switchToLunar?.();
        return;
    }
    switchToGeo?.();
}

export {
    DEFAULT_PHASE_KEYS,
    DEFAULT_PRIMARY_PHASE_KEY,
    applyModeSwitchForPhase,
    buildPhaseFlagMap,
    getConfiguredPhaseKeys,
    getDefaultPhaseKey,
    resolveLandingDataPhaseKeys,
    resolveModeSwitchTarget,
    resolvePhaseDescriptor,
};
