import { loadChebyshevData } from "../chebyshev.js";
import { loadNpzEphemeris } from "./npz-ephemeris.js";
import {
    formatMissionConfigDiagnostics,
    normalizeMissionConfig,
    parseMissionConfig,
    validateMissionConfig,
} from "../core/domain/mission-config.js";
import {
    extractEphemerisManifest,
    resolveLandingChebyshevAssetUrl,
    resolveLandingNpzAssetUrl,
    resolveMissionConfigUrl,
    resolveMissionManifestUrl,
    resolveOrbitMetaAssetUrl,
    resolveOrbitAssetUrls,
    resolveOrbitNpzAssetUrl,
    resolveOrbitSunChebyshevAssetUrl,
} from "../core/domain/mission-asset-resolver.js";

let missionConfigLoaded = false;
let missionConfigValue = null;
let missionConfigPromise = null;

const chebyshevValueCache = new Map(); // url -> data
const chebyshevPromiseCache = new Map(); // url -> Promise<data>
const npzValueCache = new Map(); // url -> body series map
const npzPromiseCache = new Map(); // url -> Promise<data>

export function getMissionDataPath() {
    const dataPath = window?.missionConfig?.dataPath;
    if (typeof dataPath !== "string" || dataPath.length === 0) return null;
    return dataPath;
}

export function getMissionConfigUrl() {
    return resolveMissionConfigUrl(getMissionDataPath());
}

export function getMissionManifestUrl() {
    return resolveMissionManifestUrl(getMissionDataPath());
}

export async function loadMissionConfig() {
    if (missionConfigLoaded) return missionConfigValue;
    if (missionConfigPromise) return missionConfigPromise;

    missionConfigPromise = (async () => {
        const configUrl = getMissionConfigUrl();
        if (!configUrl) {
            console.error("No mission configuration found. Please set window.missionConfig.dataPath in your HTML file.");
            return null;
        }

        try {
            const response = await fetch(configUrl);
            if (!response.ok) {
                console.warn("Could not load config.json, using defaults");
                return null;
            }

            const rawConfig = await response.json();
            const manifestUrl = getMissionManifestUrl();
            if (manifestUrl) {
                try {
                    const manifestResponse = await fetch(manifestUrl);
                    if (manifestResponse.ok) {
                        rawConfig.ephemeris_manifest = await manifestResponse.json();
                    }
                } catch (manifestError) {
                    console.debug("Could not load ephemeris-manifest.json:", manifestError);
                }
            }

            const parsedConfig = parseMissionConfig(rawConfig);
            const diagnostics = validateMissionConfig(parsedConfig);
            if (diagnostics.errors.length > 0) {
                throw new Error(formatMissionConfigDiagnostics(diagnostics));
            }

            if (diagnostics.warnings.length > 0) {
                for (let i = 0; i < diagnostics.warnings.length; i++) {
                    console.warn(diagnostics.warnings[i]);
                }
            }

            const config = normalizeMissionConfig(parsedConfig);
            console.debug("Config loaded successfully:", config);
            return config;
        } catch (error) {
            console.warn("Error loading config.json:", error);
            return null;
        }
    })();

    missionConfigValue = await missionConfigPromise;
    missionConfigLoaded = true;
    missionConfigPromise = null;
    return missionConfigValue;
}

export function resolveOrbitUrls(configData, mode) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveOrbitAssetUrls({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        phaseKey: mode,
        phaseConfig: configData?.[mode],
    });
}

export function resolveOrbitNpzUrl(configData, mode) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveOrbitNpzAssetUrl({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        phaseKey: mode,
        phaseConfig: configData?.[mode],
    });
}

export function resolveOrbitSunChebyshevUrl(configData, mode) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveOrbitSunChebyshevAssetUrl({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        phaseKey: mode,
        phaseConfig: configData?.[mode],
    });
}

export function resolveOrbitMetaUrl(configData, mode) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveOrbitMetaAssetUrl({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        phaseKey: mode,
        phaseConfig: configData?.[mode],
    });
}

export function resolveLandingChebyshevUrl(configData, cfgKey = null) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveLandingChebyshevAssetUrl({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        configData,
        cfgKey,
    });
}

export function resolveLandingNpzUrl(configData, cfgKey = null) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    return resolveLandingNpzAssetUrl({
        dataPath,
        manifest: extractEphemerisManifest(configData),
        configData,
        cfgKey,
    });
}

export async function loadChebyshev(url) {
    if (!url) throw new Error("loadChebyshev(url) requires a URL");

    const cachedValue = chebyshevValueCache.get(url);
    if (cachedValue) return cachedValue;

    const cachedPromise = chebyshevPromiseCache.get(url);
    if (cachedPromise) return cachedPromise;

    const promise = loadChebyshevData(url)
        .then((data) => {
            chebyshevValueCache.set(url, data);
            chebyshevPromiseCache.delete(url);
            return data;
        })
        .catch((error) => {
            chebyshevPromiseCache.delete(url);
            throw error;
        });

    chebyshevPromiseCache.set(url, promise);
    return promise;
}

export async function loadNpz(url) {
    if (!url) throw new Error("loadNpz(url) requires a URL");

    const cachedValue = npzValueCache.get(url);
    if (cachedValue) return cachedValue;

    const cachedPromise = npzPromiseCache.get(url);
    if (cachedPromise) return cachedPromise;

    const promise = loadNpzEphemeris(url)
        .then((data) => {
            npzValueCache.set(url, data);
            npzPromiseCache.delete(url);
            return data;
        })
        .catch((error) => {
            npzPromiseCache.delete(url);
            throw error;
        });

    npzPromiseCache.set(url, promise);
    return promise;
}

export function getEphemerisSource(configData) {
    const source =
        configData?.ephemeris_source ||
        configData?.ephemeris?.source ||
        "chebyshev";
    return typeof source === "string" ? source.toLowerCase() : "chebyshev";
}
