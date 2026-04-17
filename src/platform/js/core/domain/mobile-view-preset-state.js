function resolveMobileViewPresetState({
    buttonPresetIds = [],
    presetById,
    activePresetId = "",
    positionMode = "",
    lookMode = "",
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
        (presetById.has(activePresetId) ? activePresetId : (buttonPresetIds[0] || ""));

    return {
        matchedPresetId,
        selectedPresetId,
        selectedPreset: selectedPresetId ? (presetById.get(selectedPresetId) || null) : null,
        buttonStates: buttonPresetIds.map((presetId) => ({
            presetId,
            isActive: presetId === selectedPresetId,
        })),
    };
}

function shouldEnforceMobileViewPreset({
    selectedPreset,
    enforceInProgress = false,
    isMobileViewport = false,
    activeTab = "",
    positionMode = "",
    lookMode = "",
}) {
    return (
        !enforceInProgress &&
        !!selectedPreset &&
        isMobileViewport &&
        activeTab === "views" &&
        (positionMode !== selectedPreset.positionMode || lookMode !== selectedPreset.lookMode)
    );
}

export {
    resolveMobileViewPresetState,
    shouldEnforceMobileViewPreset,
};
