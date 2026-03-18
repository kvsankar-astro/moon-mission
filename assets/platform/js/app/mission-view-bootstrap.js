import { createRelativeModeActions } from "./relative-mode.js";

function initializeMissionViewState({
    isRelativeMode,
    setChecked,
    readOriginMode,
    syncPlaneSelectionControls,
    planeSelection,
    readViewSettings,
    getToggleMode,
}) {
    const {
        consumeOriginOverrideFromSession,
        applyRelativeModeOriginSelection,
        toggleRelativeMode,
        toggleModeGuarded,
    } = createRelativeModeActions({
        isRelativeMode,
        setChecked,
        readOriginMode,
        getToggleMode,
    });

    consumeOriginOverrideFromSession();
    applyRelativeModeOriginSelection();

    const config = readOriginMode();
    syncPlaneSelectionControls(planeSelection, setChecked);

    return {
        config,
        configGeo: config === "geo",
        configLunar: config === "lunar",
        ...readViewSettings(),
        toggleRelativeMode,
        toggleModeGuarded,
    };
}

export { initializeMissionViewState };
