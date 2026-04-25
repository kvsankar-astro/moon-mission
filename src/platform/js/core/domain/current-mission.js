function asTrimmedString(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim();
}

function normalizeMissionKey(value) {
    return asTrimmedString(value).toLowerCase();
}

function parseMissionFolderFromDataPath(dataPath) {
    const normalizedDataPath = asTrimmedString(dataPath).replace(/\\/g, "/");
    const match = normalizedDataPath.match(/assets\/([^/]+)\/data\/?$/i);
    return normalizeMissionKey(match?.[1]);
}

function parseMissionKeyFromPathname(pathname) {
    const normalizedPath = asTrimmedString(pathname).replace(/\\/g, "/");
    if (!normalizedPath) {
        return "";
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.length === 0) {
        return "";
    }

    let lastSegment = normalizeMissionKey(segments[segments.length - 1]);
    if (lastSegment === "index.html" && segments.length > 1) {
        lastSegment = normalizeMissionKey(segments[segments.length - 2]);
    }
    if (!lastSegment || lastSegment.includes(".")) {
        return "";
    }
    return lastSegment;
}

function resolveCurrentMissionKeys(windowRef = globalThis.window) {
    const folderMission = parseMissionFolderFromDataPath(windowRef?.missionConfig?.dataPath);
    const pathMission = parseMissionKeyFromPathname(windowRef?.location?.pathname || "");
    return new Set([
        folderMission,
        pathMission,
    ].filter(Boolean));
}

function resolveCurrentMissionKey(windowRef = globalThis.window) {
    const keys = resolveCurrentMissionKeys(windowRef);
    const iterator = keys.values().next();
    return iterator.done ? "" : iterator.value;
}

export {
    normalizeMissionKey,
    parseMissionFolderFromDataPath,
    parseMissionKeyFromPathname,
    resolveCurrentMissionKey,
    resolveCurrentMissionKeys,
};
