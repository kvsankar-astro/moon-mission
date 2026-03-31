import {
    resolveManifestRuntimeArtifact,
    toLandingPhaseKey,
} from "./ephemeris-manifest.js";

function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function normalizePathString(value) {
    const trimmed = asTrimmedString(value);
    return trimmed ? trimmed.replace(/\\/g, "/") : "";
}

function resolveDataPathUrl(dataPath, relativePath) {
    const basePath = normalizePathString(dataPath);
    const normalized = normalizePathString(relativePath);
    if (!basePath || !normalized) return null;

    if (/^(https?:)?\/\//.test(normalized) || normalized.startsWith("/")) {
        return normalized;
    }

    const relative = normalized.replace(/^\.?\//, "");
    return basePath.endsWith("/") ? `${basePath}${relative}` : `${basePath}/${relative}`;
}

function resolveMissionConfigUrl(dataPath) {
    return resolveDataPathUrl(dataPath, "config.json");
}

function resolveMissionManifestUrl(dataPath) {
    return resolveDataPathUrl(dataPath, "ephemeris-manifest.json");
}

function extractEphemerisManifest(configData) {
    return configData?.ephemeris_manifest || configData?.ephemerisManifest || null;
}

function resolveManifestPhaseArtifactUrl({
    dataPath,
    manifest,
    phaseKey,
    artifactKey,
}) {
    const runtimePath = resolveManifestRuntimeArtifact(manifest, phaseKey, artifactKey);
    return resolveDataPathUrl(dataPath, runtimePath);
}

function resolveOrbitAssetUrls({
    dataPath,
    manifest,
    phaseKey,
    phaseConfig,
}) {
    const manifestJsonUrl = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey,
        artifactKey: "json",
    });
    const manifestChebUrl = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey,
        artifactKey: "chebyshev",
    });
    const legacyBase = asTrimmedString(phaseConfig?.orbits_file);

    const orbitsJson = manifestJsonUrl || resolveDataPathUrl(dataPath, legacyBase ? `${legacyBase}.json` : null);
    const orbitsCheb =
        manifestChebUrl ||
        resolveDataPathUrl(dataPath, legacyBase ? `${legacyBase}-cheb.json` : null);
    if (!orbitsJson && !orbitsCheb) return null;

    return { orbitsJson, orbitsCheb };
}

function resolveOrbitNpzAssetUrl({
    dataPath,
    manifest,
    phaseKey,
    phaseConfig,
}) {
    const manifestNpzUrl = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey,
        artifactKey: "npz",
    });
    if (manifestNpzUrl) return manifestNpzUrl;

    const legacyBase = asTrimmedString(phaseConfig?.orbits_file);
    if (!legacyBase) return null;
    return resolveDataPathUrl(dataPath, `${legacyBase}.npz`);
}

function resolveOrbitSunChebyshevAssetUrl({
    dataPath,
    manifest,
    phaseKey,
    phaseConfig,
}) {
    const manifestSunChebUrl = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey,
        artifactKey: "sun_chebyshev",
    });
    if (manifestSunChebUrl) return manifestSunChebUrl;

    const legacyBase = asTrimmedString(phaseConfig?.orbits_file);
    if (!legacyBase) return null;
    return resolveDataPathUrl(dataPath, `${legacyBase}-sun-cheb.json`);
}

function resolveOrbitMetaAssetUrl({
    dataPath,
    manifest,
    phaseKey,
    phaseConfig,
}) {
    const manifestMetaUrl = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey,
        artifactKey: "meta",
    });
    if (manifestMetaUrl) return manifestMetaUrl;

    const legacyBase = asTrimmedString(phaseConfig?.orbits_file);
    if (!legacyBase) return null;
    return resolveDataPathUrl(dataPath, `${legacyBase}-meta.json`);
}

function resolveLandingLegacyBase(configData) {
    const overrideBase = asTrimmedString(configData?.landing?.orbits_file);
    if (overrideBase) return overrideBase;

    const spacecraftMnemonic = asTrimmedString(configData?.spacecraft_mnemonic) || "SC";
    return `landing-${spacecraftMnemonic}`;
}

function resolveLandingChebyshevAssetUrl({
    dataPath,
    manifest,
    configData,
    cfgKey = null,
}) {
    const landingPhaseKey = toLandingPhaseKey(cfgKey);
    const manifestLandingSpecific = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey: landingPhaseKey,
        artifactKey: "chebyshev",
    });
    if (manifestLandingSpecific) return manifestLandingSpecific;

    const manifestLanding = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey: "landing",
        artifactKey: "chebyshev",
    });
    if (manifestLanding) return manifestLanding;

    const base = resolveLandingLegacyBase(configData);
    const suffix = cfgKey ? `-${cfgKey}` : "";
    return resolveDataPathUrl(dataPath, `${base}${suffix}-cheb.json`);
}

function resolveLandingNpzAssetUrl({
    dataPath,
    manifest,
    configData,
    cfgKey = null,
}) {
    const landingPhaseKey = toLandingPhaseKey(cfgKey);
    const manifestLandingSpecific = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey: landingPhaseKey,
        artifactKey: "npz",
    });
    if (manifestLandingSpecific) return manifestLandingSpecific;

    const manifestLanding = resolveManifestPhaseArtifactUrl({
        dataPath,
        manifest,
        phaseKey: "landing",
        artifactKey: "npz",
    });
    if (manifestLanding) return manifestLanding;

    const base = resolveLandingLegacyBase(configData);
    const suffix = cfgKey ? `-${cfgKey}` : "";
    return resolveDataPathUrl(dataPath, `${base}${suffix}.npz`);
}

export {
    extractEphemerisManifest,
    resolveDataPathUrl,
    resolveLandingChebyshevAssetUrl,
    resolveLandingNpzAssetUrl,
    resolveManifestPhaseArtifactUrl,
    resolveMissionConfigUrl,
    resolveMissionManifestUrl,
    resolveOrbitMetaAssetUrl,
    resolveOrbitAssetUrls,
    resolveOrbitNpzAssetUrl,
    resolveOrbitSunChebyshevAssetUrl,
};
