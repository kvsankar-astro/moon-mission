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
        readOriginMode,
        readViewSettings,
        getToggleMode,
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
    });

    const sceneViewStateActions = createSceneViewStateActions({
        defaultViewState,
        getConfig,
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
    });

    const modeSwitchActions = createModeSwitchActions({
        d3,
        d3SelectAll,
    });

    const initialMissionViewState = initializeMissionViewState({
        isRelativeMode,
        setChecked,
        readOriginMode,
        syncPlaneSelectionControls,
        planeSelection,
        readViewSettings,
        getToggleMode,
    });

    return {
        bridgeActions,
        sceneViewStateActions,
        modeSwitchActions,
        initialMissionViewState,
    };
}

export { createMissionViewComposition };
