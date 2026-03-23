import { createRelativeModeActions } from "./relative-mode.js";

function initializeMissionViewState({
    isRelativeMode,
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
    } = createRelativeModeActions({
        isRelativeMode,
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
    };
}

export { initializeMissionViewState };
