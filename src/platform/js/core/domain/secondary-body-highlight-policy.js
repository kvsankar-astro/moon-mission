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

    const isSupportedOrigin =
        (configName === "geo" && secondaryBody === "MOON") ||
        (configName === "lunar" && secondaryBody === "EARTH");
    if (!isSupportedOrigin) {
        return false;
    }

    return cameraPositionMode === "manual" && cameraLookMode === "manual";
}

export { shouldShowSecondaryBodyHighlight };
