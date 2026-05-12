import { createDimensionActions } from "./dimension-actions.js";
import { createSettingsActions } from "./settings-actions.js";

function createViewSettingsWiringActions(deps) {
    const {
        d3,
        getConfig,
        animationScenes,
        getCurrentDimension,
        setCurrentDimension,
        getPreviousDimension,
        setPreviousDimension,
        setDimensionChanged,
        getDimensionChanged,
        setSvgContainer,
        initSVG,
        loadOrbitDataIfNeededAndProcess,
        handleDimensionSwitch,
        handlePlaneChange,
        setLocation,
        adjustLabelLocations,
        getStartLandingFlag,
        clearStartLandingFlag,
        toggleLanding,
        updateProgressLabel,
        loadProgress,
        setConfig,
        AnimationScene,
        initAnimation,
        readOriginMode,
        readViewSettings,
        setFPSCounterVisibility,
        render,
        getGlobalConfig,
        getAnimationRunning,
        setViewFlags,
        onConfigChanged,
        syncViewIdentity,
        applyViewForCurrentIdentity,
    } = deps;

    const dimensionActions = createDimensionActions({
        d3,
        getConfig,
        animationScenes,
        getCurrentDimension,
        setCurrentDimension,
        getPreviousDimension,
        setPreviousDimension,
        setDimensionChanged,
        getDimensionChanged,
        setSvgContainer,
        initSVG,
        loadOrbitDataIfNeededAndProcess,
        handleDimensionSwitch,
        handlePlaneChange,
        setLocation,
        adjustLabelLocations,
        getStartLandingFlag,
        clearStartLandingFlag,
        toggleLanding,
        updateProgressLabel,
        loadProgress,
        applyViewForCurrentIdentity,
    });

    const { toggleMode, setDimensionTop, setView } = createSettingsActions({
        getConfig,
        setConfig,
        animationScenes,
        AnimationScene,
        initAnimation,
        readOriginMode,
        readViewSettings,
        setFPSCounterVisibility,
        render,
        getGlobalConfig,
        getAnimationRunning,
        setViewFlags,
        setDimension: dimensionActions.setDimension,
        onConfigChanged,
        syncViewIdentity,
    });

    return {
        dimensionActions,
        toggleMode,
        setDimensionTop,
        setView,
    };
}

export { createViewSettingsWiringActions };
