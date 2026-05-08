import { resolveMissionMediaManifestUrl } from "../core/domain/mission-asset-resolver.js";
import { getMissionDataPath, loadJson } from "./mission-data.js";

let mediaManifestLoaded = false;
let mediaManifestValue = null;
let mediaManifestPromise = null;
let mediaManifestUrl = "";

function getMissionMediaManifestUrl() {
    return resolveMissionMediaManifestUrl(getMissionDataPath());
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
    getMissionMediaManifestUrl,
    loadMissionMediaManifest,
};
