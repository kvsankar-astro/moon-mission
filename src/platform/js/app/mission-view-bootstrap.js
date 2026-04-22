import { createRelativeModeActions } from "./relative-mode.js";

function initializeMissionViewState({
    isRelativeMode,
    isCompareMode,
    setChecked,
    readOriginMode,
    syncPlaneSelectionControls,
    planeSelection,
    readViewSettings,
    getToggleMode,
    getCurrentAnimTime,
}) {
    const {
        consumeOriginOverrideFromSession,
        consumeAnimTimeOverrideFromSession,
        applyRelativeModeOriginSelection,
        toggleRelativeMode,
        toggleModeGuarded,
        toggleCompareMode,
        changeCompareMission,
    } = createRelativeModeActions({
        isRelativeMode,
        isCompareMode,
        setChecked,
        readOriginMode,
        getToggleMode,
        getCurrentAnimTime,
    });

    consumeOriginOverrideFromSession();
    const startupAnimTimeOverride = consumeAnimTimeOverrideFromSession();
    applyRelativeModeOriginSelection();

    const config = readOriginMode();
    syncPlaneSelectionControls(planeSelection, setChecked);

    return {
        config,
        startupAnimTimeOverride,
        ...readViewSettings(),
        toggleRelativeMode,
        toggleModeGuarded,
        toggleCompareMode,
        changeCompareMission,
    };
}

export { initializeMissionViewState };
