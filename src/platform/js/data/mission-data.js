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

const jsonValueCache = new Map(); // url -> data
const jsonPromiseCache = new Map(); // url -> Promise<data>
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

function getMissionConfigProfileName() {
    try {
        const value = new URLSearchParams(window?.location?.search || "").get("testProfile");
        if (typeof value !== "string") return null;
        const profile = value.trim().toLowerCase();
        if (!profile) return null;
        return /^[a-z0-9_-]+$/.test(profile) ? profile : null;
    } catch (_error) {
        return null;
    }
}

function getMissionConfigProfileUrl(profileName) {
    const dataPath = getMissionDataPath();
    if (!dataPath || !profileName) return null;
    const basePath = dataPath.endsWith("/") ? dataPath.slice(0, -1) : dataPath;
    return `${basePath}/config.${profileName}.json`;
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

            let rawConfig = await response.json();
            const configProfile = getMissionConfigProfileName();
            if (configProfile) {
                const profileUrl = getMissionConfigProfileUrl(configProfile);
                if (profileUrl) {
                    try {
                        const profileResponse = await fetch(profileUrl);
                        if (profileResponse.ok) {
                            const profilePatch = await profileResponse.json();
                            rawConfig = deepMergeObjects(rawConfig, profilePatch);
                            console.debug(`Applied mission config test profile '${configProfile}'`);
                        } else {
                            console.debug(
                                `Mission config test profile '${configProfile}' not found (${profileResponse.status}), using base config`,
                            );
                        }
                    } catch (profileError) {
                        console.debug(`Could not load mission config test profile '${configProfile}':`, profileError);
                    }
                }
            }

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

export async function loadJson(url) {
    if (!url) throw new Error("loadJson(url) requires a URL");

    const cachedValue = jsonValueCache.get(url);
    if (cachedValue) return cachedValue;

    const cachedPromise = jsonPromiseCache.get(url);
    if (cachedPromise) return cachedPromise;

    const promise = fetch(url)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Failed to load JSON from ${url}: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            jsonValueCache.set(url, data);
            jsonPromiseCache.delete(url);
            return data;
        })
        .catch((error) => {
            jsonPromiseCache.delete(url);
            throw error;
        });

    jsonPromiseCache.set(url, promise);
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
