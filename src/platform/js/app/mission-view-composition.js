import { createMissionBridgeActions } from "./mission-bridge-actions.js";
import { createModeSwitchActions } from "./mode-switch.js";
import { createSceneViewStateActions } from "./scene-view-state.js";
import { initializeMissionViewState } from "./mission-view-bootstrap.js";

function createMissionViewComposition(ctx) {
    const {
        d3,
        d3SelectAll,
        windowRef,
        showElementById,
        computeMoonUiPatch,
        applyMoonUiPatch,
        computeLandingUiPatch,
        applyLandingUiPatch,
        setChecked,
        getGlobalConfig,
        getConfig,
        setConfig,
        getLandingFlag,
        setLandingFlag,
        getCraftScaleActions,
        getSceneFrameOrchestrationActions,
        render,
        adjustSceneCameraProjectionAndSky,
        getAnimationScenes,
        computeSVGDimensions,
        getSvgWidth,
        getSvgHeight,
        getSceneHandler,
        defaultViewState,
        getSceneForConfig,
        normalizePlaneSelection,
        getPlaneVariablesForSelection,
        syncPlaneSelectionControls,
        getLegacyPlaneSelection,
        setLegacyPlaneSelection,
        getLegacyPlaneVariables,
        setLegacyPlaneVariables,
        getLegacyZoomFactor,
        setLegacyZoomFactor,
        getLegacyPanX,
        setLegacyPanX,
        getLegacyPanY,
        setLegacyPanY,
        isRelativeMode,
        isCompareMode,
        readOriginMode,
        readViewSettings,
        getToggleMode,
        getCurrentAnimTime,
        planeSelection,
    } = ctx;

    const bridgeActions = createMissionBridgeActions({
        windowRef,
        showElementById,
        computeMoonUiPatch,
        applyMoonUiPatch,
        computeLandingUiPatch,
        applyLandingUiPatch,
        setChecked,
        getGlobalConfig,
        getConfig,
        setConfig,
        getLandingFlag,
        setLandingFlag,
        getCraftScaleActions,
        getSceneFrameOrchestrationActions,
        render,
        adjustSceneCameraProjectionAndSky,
        getAnimationScenes,
        computeSVGDimensions,
        getSvgWidth,
        getSvgHeight,
        getSceneHandler,
    });

    const sceneViewStateActions = createSceneViewStateActions({
        defaultViewState,
        getConfig,
        getGlobalConfig,
        getSceneForConfig,
        normalizePlaneSelection,
        getPlaneVariablesForSelection,
        syncPlaneSelectionControls,
        setChecked,
        getLegacyPlaneSelection,
        setLegacyPlaneSelection,
        getLegacyPlaneVariables,
        setLegacyPlaneVariables,
        getLegacyZoomFactor,
        setLegacyZoomFactor,
        getLegacyPanX,
        setLegacyPanX,
        getLegacyPanY,
        setLegacyPanY,
        isRelativeMode,
    });

    const modeSwitchActions = createModeSwitchActions({
        d3,
        d3SelectAll,
    });

    const initialMissionViewState = initializeMissionViewState({
        isRelativeMode,
        isCompareMode,
        setChecked,
        readOriginMode,
        syncPlaneSelectionControls,
        planeSelection,
        readViewSettings,
        getToggleMode,
        getCurrentAnimTime,
    });

    return {
        bridgeActions,
        sceneViewStateActions,
        modeSwitchActions,
        initialMissionViewState,
    };
}

export { createMissionViewComposition };
