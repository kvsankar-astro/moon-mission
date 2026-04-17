function resolveMobileComposeLockState({
    buttonPresetIds = [],
    presetById,
    activePresetId = "free",
    positionMode = "",
    lookMode = "",
    fallbackPresetId = "free",
}) {
    let matchedPresetId = "";
    buttonPresetIds.forEach((presetId) => {
        if (matchedPresetId) return;
        const preset = presetById.get(presetId);
        if (!preset) return;
        if (preset.positionMode === positionMode && preset.lookMode === lookMode) {
            matchedPresetId = presetId;
        }
    });

    const selectedPresetId = matchedPresetId ||
        (presetById.has(activePresetId) ? activePresetId : fallbackPresetId);

    return {
        matchedPresetId,
        selectedPresetId,
        buttonStates: buttonPresetIds.map((presetId) => ({
            presetId,
            isActive: presetId === selectedPresetId,
        })),
    };
}

export { resolveMobileComposeLockState };
