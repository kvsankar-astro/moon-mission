function shouldShowSecondaryBodyHighlight({
    isLunarMission = false,
    configName = "",
    secondaryBody = "",
    frameMode = "geo",
    viewMoonHighlightRing = false,
    suppress = false,
    cameraPositionMode = "manual",
    cameraLookMode = "manual",
} = {}) {
    if (!isLunarMission || suppress || !viewMoonHighlightRing) {
        return false;
    }

    if (frameMode === "relative") {
        return false;
    }

    // Keep the secondary highlight ring only for GEO origin where the Moon is
    // the secondary body. Showing an Earth ring in LUNAR origin reads as a
    // stray artifact in practice and causes confusing duplicate-circle visuals.
    const isSupportedOrigin =
        (configName === "geo" && secondaryBody === "MOON");
    if (!isSupportedOrigin) {
        return false;
    }

    return cameraPositionMode === "manual" && cameraLookMode === "manual";
}

export { shouldShowSecondaryBodyHighlight };
