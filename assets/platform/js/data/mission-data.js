import { loadChebyshevData } from "../chebyshev.js";
import { loadNpzEphemeris } from "./npz-ephemeris.js";
import {
    resolveManifestRuntimeArtifact,
    toLandingPhaseKey,
} from "../core/domain/ephemeris-manifest.js";

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
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;
    return `${dataPath}config.json`;
}

export function getMissionManifestUrl() {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;
    return `${dataPath}ephemeris-manifest.json`;
}

function normalizeRelativePath(pathValue) {
    if (typeof pathValue !== "string") return null;
    const trimmed = pathValue.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\\/g, "/");
}

function resolveDataUrl(dataPath, relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) return null;
    if (/^(https?:)?\/\//.test(normalized) || normalized.startsWith("/")) {
        return normalized;
    }
    const relative = normalized.replace(/^\.?\//, "");
    return dataPath.endsWith("/") ? `${dataPath}${relative}` : `${dataPath}/${relative}`;
}

function getEphemerisManifest(configData) {
    return configData?.ephemeris_manifest || configData?.ephemerisManifest || null;
}

function resolveManifestPhaseArtifactUrl(configData, phaseKey, artifactKey) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;
    const runtimePath = resolveManifestRuntimeArtifact(getEphemerisManifest(configData), phaseKey, artifactKey);
    return resolveDataUrl(dataPath, runtimePath);
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

            const config = await response.json();
            const manifestUrl = getMissionManifestUrl();
            if (manifestUrl) {
                try {
                    const manifestResponse = await fetch(manifestUrl);
                    if (manifestResponse.ok) {
                        config.ephemeris_manifest = await manifestResponse.json();
                    }
                } catch (manifestError) {
                    console.debug("Could not load ephemeris-manifest.json:", manifestError);
                }
            }
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

    const cfg = configData?.[mode];
    const manifestJsonUrl = resolveManifestPhaseArtifactUrl(configData, mode, "json");
    const manifestChebUrl = resolveManifestPhaseArtifactUrl(configData, mode, "chebyshev");
    const legacyBase = cfg?.orbits_file;

    const orbitsJson = manifestJsonUrl || resolveDataUrl(dataPath, legacyBase ? `${legacyBase}.json` : null);
    const orbitsCheb = manifestChebUrl || resolveDataUrl(dataPath, legacyBase ? `${legacyBase}-cheb.json` : null);
    if (!orbitsJson && !orbitsCheb) return null;

    return {
        orbitsJson,
        orbitsCheb,
    };
}

export function resolveOrbitNpzUrl(configData, mode) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    const cfg = configData?.[mode];
    const manifestNpzUrl = resolveManifestPhaseArtifactUrl(configData, mode, "npz");
    if (manifestNpzUrl) return manifestNpzUrl;
    if (!cfg?.orbits_file) return null;

    return resolveDataUrl(dataPath, `${cfg.orbits_file}.npz`);
}

export function resolveLandingChebyshevUrl(configData, cfgKey = null) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    const landingPhaseKey = toLandingPhaseKey(cfgKey);
    const manifestLandingSpecific = resolveManifestPhaseArtifactUrl(configData, landingPhaseKey, "chebyshev");
    if (manifestLandingSpecific) return manifestLandingSpecific;
    const manifestLanding = resolveManifestPhaseArtifactUrl(configData, "landing", "chebyshev");
    if (manifestLanding) return manifestLanding;

    const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
    const overrideBase = configData?.landing?.orbits_file;
    const base = overrideBase || `landing-${spacecraftMnemonic}`;

    const suffix = cfgKey ? `-${cfgKey}` : "";
    const filename = `${base}${suffix}-cheb.json`;

    // Fall back to legacy (no suffix) name when cfgKey not provided or file missing;
    // the caller will handle fetch errors if the file does not exist.

    return `${dataPath}${filename}`;
}

export function resolveLandingNpzUrl(configData, cfgKey = null) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    const landingPhaseKey = toLandingPhaseKey(cfgKey);
    const manifestLandingSpecific = resolveManifestPhaseArtifactUrl(configData, landingPhaseKey, "npz");
    if (manifestLandingSpecific) return manifestLandingSpecific;
    const manifestLanding = resolveManifestPhaseArtifactUrl(configData, "landing", "npz");
    if (manifestLanding) return manifestLanding;

    const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
    const overrideBase = configData?.landing?.orbits_file;
    const base = overrideBase || `landing-${spacecraftMnemonic}`;

    const suffix = cfgKey ? `-${cfgKey}` : "";
    return resolveDataUrl(dataPath, `${base}${suffix}.npz`);
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
