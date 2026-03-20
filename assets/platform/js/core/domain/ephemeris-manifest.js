function normalizePathString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\\/g, "/");
}

function getManifestPhases(manifest) {
    const phases = manifest?.phases;
    return phases && typeof phases === "object" ? phases : {};
}

function getPhaseDefinition(manifest, phaseKey) {
    if (!phaseKey) return null;
    return getManifestPhases(manifest)?.[phaseKey] || null;
}

function getArtifactObject(phaseDef, artifactKey) {
    if (!phaseDef || !artifactKey) return null;

    const artifacts = phaseDef.artifacts && typeof phaseDef.artifacts === "object"
        ? phaseDef.artifacts
        : phaseDef;
    const artifact = artifacts?.[artifactKey];
    if (!artifact) return null;

    if (typeof artifact === "string") {
        return { runtime: artifact };
    }

    return typeof artifact === "object" ? artifact : null;
}

function resolveManifestRuntimeArtifact(manifest, phaseKey, artifactKey) {
    const artifact = getArtifactObject(getPhaseDefinition(manifest, phaseKey), artifactKey);
    const runtime = artifact?.runtime ?? artifact?.path ?? null;
    return normalizePathString(runtime);
}

function resolveManifestGeneratedArtifact(manifest, phaseKey, artifactKey) {
    const artifact = getArtifactObject(getPhaseDefinition(manifest, phaseKey), artifactKey);
    const generated = artifact?.generated ?? null;
    return normalizePathString(generated);
}

function toLandingPhaseKey(cfgKey) {
    if (!cfgKey) return "landing";
    if (cfgKey === "landing" || cfgKey.startsWith("landing-")) return cfgKey;
    return `landing-${cfgKey}`;
}

export {
    getPhaseDefinition,
    getManifestPhases,
    resolveManifestGeneratedArtifact,
    resolveManifestRuntimeArtifact,
    toLandingPhaseKey,
};
