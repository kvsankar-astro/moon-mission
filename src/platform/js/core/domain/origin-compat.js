const DEFAULT_ORIGIN_KEYS = Object.freeze(["geo", "lunar"]);
const DEFAULT_PRIMARY_ORIGIN_KEY = "geo";

const MODE_SWITCH_TARGET_BY_ORIGIN = Object.freeze({
    geo: "geo",
    lunar: "lunar",
});

function normalizeOriginKeys(originKeys) {
    if (!Array.isArray(originKeys)) return [];
    return originKeys.filter(
        (originKey) =>
            typeof originKey === "string" &&
            originKey.length > 0 &&
            originKey !== "landing",
    );
}

function getConfiguredOriginKeys(
    globalConfig,
    { fallbackOriginKeys = DEFAULT_ORIGIN_KEYS } = {},
) {
    const configuredOrigins = normalizeOriginKeys(globalConfig?.origins);
    if (configuredOrigins.length > 0) return configuredOrigins;

    return normalizeOriginKeys(fallbackOriginKeys);
}

function getDefaultOriginKey(globalConfig = null) {
    const configured = getConfiguredOriginKeys(globalConfig, {
        fallbackOriginKeys: DEFAULT_ORIGIN_KEYS,
    });
    return configured[0] || DEFAULT_PRIMARY_ORIGIN_KEY;
}

function buildOriginFlagMap(originKeys, initialValue = false) {
    const normalized = normalizeOriginKeys(originKeys);
    const keys = normalized.length > 0 ? normalized : [...DEFAULT_ORIGIN_KEYS];
    const map = {};
    for (const originKey of keys) {
        map[originKey] = initialValue;
    }
    return map;
}

function resolveOriginModeTarget(originKey, globalConfig = null) {
    const explicitOriginSwitch = globalConfig?.origin_mode_switch?.[originKey];
    if (
        typeof explicitOriginSwitch === "string" &&
        explicitOriginSwitch.length > 0
    ) {
        return explicitOriginSwitch;
    }

    if (MODE_SWITCH_TARGET_BY_ORIGIN[originKey]) {
        return MODE_SWITCH_TARGET_BY_ORIGIN[originKey];
    }

    const center = globalConfig?.[originKey]?.center;
    if (center === "moon_center") return "lunar";
    if (center === "earth_center") return "geo";
    return "geo";
}

function resolveOriginDescriptor(originKey, globalConfig = null) {
    const modeSwitchTarget = resolveOriginModeTarget(originKey, globalConfig);
    const isLunarLike = modeSwitchTarget === "lunar";

    return {
        originKey,
        modeSwitchTarget,
        primaryBody: isLunarLike ? "MOON" : "EARTH",
        secondaryBody: isLunarLike ? "EARTH" : "MOON",
        moonScale: isLunarLike ? 0.997 : 1.0,
        orbitFileSizeBytes: isLunarLike ? 34800 * 1024 : 34793 * 1024,
        stepsPerHop: 4,
        allowRelativeOrbitOverride: !isLunarLike,
    };
}

function resolveLandingDataOriginKeys(
    globalConfig,
    { fallbackOriginKeys = DEFAULT_ORIGIN_KEYS } = {},
) {
    const explicit = normalizeOriginKeys(globalConfig?.landing?.origin_sources);
    const explicitAlt = normalizeOriginKeys(globalConfig?.landing?.originSources);
    const explicitOriginKeys =
        explicit.length > 0
            ? explicit
            : explicitAlt.length > 0
              ? explicitAlt
              : [];

    if (explicitOriginKeys.length > 0) return explicitOriginKeys;

    const configured = getConfiguredOriginKeys(globalConfig, { fallbackOriginKeys });
    if (configured.length > 0) return configured;
    return [...DEFAULT_ORIGIN_KEYS];
}

function applyModeSwitchForOrigin({
    originKey,
    globalConfig,
    switchToGeo,
    switchToLunar,
}) {
    const target = resolveOriginModeTarget(originKey, globalConfig);
    if (target === "lunar") {
        switchToLunar?.();
        return;
    }
    switchToGeo?.();
}

export {
    DEFAULT_ORIGIN_KEYS,
    DEFAULT_PRIMARY_ORIGIN_KEY,
    applyModeSwitchForOrigin,
    buildOriginFlagMap,
    getConfiguredOriginKeys,
    getDefaultOriginKey,
    normalizeOriginKeys,
    resolveLandingDataOriginKeys,
    resolveOriginDescriptor,
    resolveOriginModeTarget,
};
