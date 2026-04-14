function normalizeOriginMode(originMode) {
    const normalized = String(originMode || "").trim().toLowerCase();
    if (normalized === "lunar" || normalized === "moon") {
        return "lunar";
    }
    if (normalized === "relative") {
        return "relative";
    }
    return "geo";
}

function resolveBodyOrbitCopy(originMode) {
    const mode = normalizeOriginMode(originMode);
    if (mode === "lunar") {
        return {
            label: "Earth Orbit",
            title: "Toggle Earth orbit track",
        };
    }
    return {
        label: "Moon Orbit",
        title: "Toggle Moon orbit track",
    };
}

function resolveCraftOrbitCopy() {
    return {
        label: "Craft Orbit",
        title: "Toggle visible craft orbit tracks",
    };
}

export {
    normalizeOriginMode,
    resolveBodyOrbitCopy,
    resolveCraftOrbitCopy,
};
