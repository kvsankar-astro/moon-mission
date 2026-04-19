import { deepMergeObjects } from "./mission-data-resolvers.js";
import {
    formatMissionConfigDiagnostics,
    normalizeMissionConfig,
    parseMissionConfig,
    validateMissionConfig,
} from "./mission-config.js";

function applyMissionConfigProfile(baseConfig, profilePatch) {
    if (profilePatch === undefined) {
        return baseConfig;
    }
    return deepMergeObjects(baseConfig, profilePatch);
}

function attachMissionConfigManifest(rawConfig, manifestData) {
    if (manifestData === undefined) {
        return rawConfig;
    }
    return {
        ...rawConfig,
        ephemeris_manifest: manifestData,
    };
}

function assembleMissionConfig({ baseConfig, profilePatch, manifestData } = {}) {
    const withProfile = applyMissionConfigProfile(baseConfig, profilePatch);
    const assembledConfig = attachMissionConfigManifest(withProfile, manifestData);
    const parsedConfig = parseMissionConfig(assembledConfig);
    const diagnostics = validateMissionConfig(parsedConfig);
    if (diagnostics.errors.length > 0) {
        throw new Error(formatMissionConfigDiagnostics(diagnostics));
    }

    return {
        config: normalizeMissionConfig(parsedConfig),
        warnings: [...diagnostics.warnings],
    };
}

export {
    applyMissionConfigProfile,
    assembleMissionConfig,
    attachMissionConfigManifest,
};
