const DEFAULT_RUNTIME_ASSET_BASE_URL = "https://assets.sankara.net/moon-mission/";

function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function normalizePathString(value) {
    return asTrimmedString(value).replace(/\\/g, "/");
}

function isAbsoluteOrSpecialUrl(value) {
    const normalized = normalizePathString(value);
    return (
        /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(normalized) ||
        /^(?:data|blob|mailto|tel):/i.test(normalized) ||
        normalized.startsWith("#")
    );
}

function ensureTrailingSlash(value) {
    const normalized = normalizePathString(value);
    if (!normalized) return "";
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function resolveRuntimeAssetBaseUrl({
    globalObject = typeof window !== "undefined" ? window : globalThis,
    fallbackBaseUrl = DEFAULT_RUNTIME_ASSET_BASE_URL,
} = {}) {
    const explicitBase =
        asTrimmedString(globalObject?.MOON_MISSION_ASSET_BASE_URL) ||
        asTrimmedString(globalObject?.missionConfig?.assetBaseUrl) ||
        asTrimmedString(fallbackBaseUrl);
    return ensureTrailingSlash(explicitBase);
}

function resolveRuntimeAssetUrl(
    pathValue,
    {
        baseUrl = null,
        globalObject = typeof window !== "undefined" ? window : globalThis,
    } = {},
) {
    const normalizedPath = normalizePathString(pathValue);
    if (!normalizedPath) return "";
    if (isAbsoluteOrSpecialUrl(normalizedPath)) return normalizedPath;

    const resolvedBaseUrl = ensureTrailingSlash(baseUrl || resolveRuntimeAssetBaseUrl({ globalObject }));
    if (!resolvedBaseUrl) return normalizedPath;

    const relativePath = normalizedPath.replace(/^\/+/, "");
    try {
        return new URL(relativePath, resolvedBaseUrl).toString();
    } catch {
        return `${resolvedBaseUrl}${relativePath}`;
    }
}

export {
    DEFAULT_RUNTIME_ASSET_BASE_URL,
    resolveRuntimeAssetBaseUrl,
    resolveRuntimeAssetUrl,
};
