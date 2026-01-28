import { loadChebyshevData } from "../chebyshev.js";

let missionConfigLoaded = false;
let missionConfigValue = null;
let missionConfigPromise = null;

const chebyshevValueCache = new Map(); // url -> data
const chebyshevPromiseCache = new Map(); // url -> Promise<data>

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
    if (!cfg?.orbits_file) return null;

    return {
        orbitsJson: `${dataPath}${cfg.orbits_file}.json`,
        orbitsCheb: `${dataPath}${cfg.orbits_file}-cheb.json`,
    };
}

export function resolveLandingChebyshevUrl(configData, cfgKey = null) {
    const dataPath = getMissionDataPath();
    if (!dataPath) return null;

    const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
    const overrideBase = configData?.landing?.orbits_file;
    const base = overrideBase || `landing-${spacecraftMnemonic}`;

    const suffix = cfgKey ? `-${cfgKey}` : "";
    const filename = `${base}${suffix}-cheb.json`;

    // Fall back to legacy (no suffix) name when cfgKey not provided or file missing;
    // the caller will handle fetch errors if the file does not exist.

    return `${dataPath}${filename}`;
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
