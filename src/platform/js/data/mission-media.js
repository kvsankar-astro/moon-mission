import { resolveMissionMediaManifestUrl } from "../core/domain/mission-asset-resolver.js";
import { getMissionDataPath, loadJson } from "./mission-data.js";

let mediaManifestLoaded = false;
let mediaManifestValue = null;
let mediaManifestPromise = null;
let mediaManifestUrl = "";

function isLocalDevHost(hostname) {
    const normalized = String(hostname || "").trim().toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function resolveLocalDevMediaManifestUrl(manifestUrl, windowRef = globalThis.window) {
    if (!manifestUrl || !isLocalDevHost(windowRef?.location?.hostname)) {
        return manifestUrl;
    }
    let parsed;
    try {
        parsed = new URL(manifestUrl, windowRef.location.href);
    } catch {
        return manifestUrl;
    }
    if (isLocalDevHost(parsed.hostname)) {
        return parsed.toString();
    }
    const match = parsed.pathname.match(/\/(?:moon-mission\/)?(assets\/[^?#]+\/data\/media-manifest\.json)$/i);
    if (!match) {
        return manifestUrl;
    }
    return new URL(`/${match[1]}`, windowRef.location.origin).toString();
}

function getMissionMediaManifestUrl() {
    return resolveLocalDevMediaManifestUrl(resolveMissionMediaManifestUrl(getMissionDataPath()));
}

function getMissionMediaDataPath() {
    const manifestUrl = getMissionMediaManifestUrl();
    if (!manifestUrl) return getMissionDataPath() || "";
    return manifestUrl.replace(/media-manifest\.json(?:[?#].*)?$/i, "");
}

async function loadMissionMediaManifest() {
    const nextUrl = getMissionMediaManifestUrl();
    if (!nextUrl) {
        mediaManifestLoaded = true;
        mediaManifestValue = null;
        mediaManifestPromise = null;
        mediaManifestUrl = "";
        return null;
    }

    if (mediaManifestLoaded && mediaManifestUrl === nextUrl) {
        return mediaManifestValue;
    }
    if (mediaManifestPromise && mediaManifestUrl === nextUrl) {
        return mediaManifestPromise;
    }

    mediaManifestUrl = nextUrl;
    mediaManifestPromise = loadJson(nextUrl)
        .catch((error) => {
            console.debug("Could not load media-manifest.json:", error);
            return null;
        })
        .then((manifestData) => {
            mediaManifestValue = manifestData;
            mediaManifestLoaded = true;
            mediaManifestPromise = null;
            return mediaManifestValue;
        });

    return mediaManifestPromise;
}

export {
    getMissionMediaDataPath,
    getMissionMediaManifestUrl,
    loadMissionMediaManifest,
    resolveLocalDevMediaManifestUrl,
};
