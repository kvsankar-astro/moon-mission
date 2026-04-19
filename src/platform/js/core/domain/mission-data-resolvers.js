function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMergeObjects(baseValue, patchValue) {
    if (!isPlainObject(baseValue)) return patchValue;
    if (!isPlainObject(patchValue)) return patchValue;

    const merged = { ...baseValue };
    for (const [key, patchChild] of Object.entries(patchValue)) {
        const baseChild = merged[key];
        if (isPlainObject(baseChild) && isPlainObject(patchChild)) {
            merged[key] = deepMergeObjects(baseChild, patchChild);
        } else {
            merged[key] = patchChild;
        }
    }
    return merged;
}

function getMissionConfigProfileUrl(dataPath, profileName) {
    const normalizedDataPath = asTrimmedString(dataPath);
    const normalizedProfileName = asTrimmedString(profileName);
    if (!normalizedDataPath || !normalizedProfileName) return null;

    const basePath = normalizedDataPath.endsWith("/")
        ? normalizedDataPath.slice(0, -1)
        : normalizedDataPath;
    return `${basePath}/config.${normalizedProfileName}.json`;
}

function getEphemerisSource(configData) {
    const source =
        configData?.ephemeris_source ||
        configData?.ephemeris?.source ||
        "chebyshev";
    return typeof source === "string" ? source.toLowerCase() : "chebyshev";
}

export {
    deepMergeObjects,
    getEphemerisSource,
    getMissionConfigProfileUrl,
};
