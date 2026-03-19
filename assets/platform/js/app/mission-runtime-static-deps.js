import { Animation2DController, Animation3DController } from "../controllers/index.js";
import {
    CELESTIAL_BODIES as CB,
    FORMAT_CONSTANTS as FC,
    PHYSICS_CONSTANTS as PC,
    TIME_CONSTANTS as TC,
    UI_CONSTANTS as UC
} from "../core/constants.js";
import {
    clearEventInfo,
    clearProgressLabel,
    setFPSCounterVisibility,
    updateD3ElementText,
    updateEventInfo,
    updateMultipleElementsText,
    updateProgressLabel,
    updateSpacecraftMnemonic
} from "../core/dom.js";
import {
    loadChebyshev,
    loadMissionConfig,
    loadNpz,
    resolveLandingChebyshevUrl,
    resolveLandingNpzUrl,
    resolveOrbitNpzUrl,
    resolveOrbitUrls,
} from "../data/mission-data.js";
import { createUTCTimestamp } from "../utils/time-utils.js";
import { bindBurnButtons } from "../ui/event-handlers.js";
import {
    ensureIndeterminateProgressBar,
    hideElementById,
    showElementById,
} from "../ui/dom-helpers.js";
import {
    applyCameraFromTo,
    readCameraLookMode,
    readCameraPositionMode,
    readOriginMode,
    readViewSettings,
    setChecked,
} from "../ui/ui-state.js";
import { computeSunLongitude } from "../services/ephemeris.js";
import { computeSceneState } from "../scene-state.js";
import {
    generateBodyCurve,
    getBodyEphemerisRange,
    getBodyEphemerisState,
} from "../data/ephemeris-provider.js";
import { createBurnActions } from "./burn-actions.js";
import {
    applyEventsUpdate,
    computeEventsUpdate,
} from "./config-events.js";
import {
    applyLandingTimesUpdate,
    computeLandingTimesUpdate,
    computeMissionEventTimes,
} from "./config-times.js";
import { applyInitConfigAlreadyInitialized, shouldSkipInitConfig } from "./init-config.js";
import { initRepeatButtons } from "./init-repeat-buttons.js";
import { createCameraActions } from "./camera-actions.js";
import { createLockActions } from "./lock-actions.js";
import { applyMissionMetadata } from "./mission-metadata.js";
import { createModeActions } from "./mode-actions.js";
import {
    normalizePlaneSelection,
    syncPlaneSelectionControls,
} from "./plane-view-state.js";
import { createNavigationActions } from "./navigation-actions.js";
import { createRepeatMouseDownHandlers } from "./repeat-mousedown.js";
import { bindRepeatButtons } from "./repeat-button-bindings.js";

function buildMissionRuntimeStaticDeps(ctx) {
    const {
        d3,
        d3SelectAll,
        THREE,
        Astronomy,
        windowRef,
        documentRef,
        consoleRef,
        SwiperClass,
        formatMetric,
        animationScenes,
        animation3DControllers,
        animation2DControllers,
        orbitDataLoaded,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        ephemerisRecords,
        ephemerisStatuses,
        planetProperties,
        animationController,
        AnimationScene,
        SceneHandlerClass,
        bindInfoPanelControls,
        updateEphemerisPanel,
        PIXELS_PER_AU,
        render,
        processOrbitData,
    } = ctx;

    return {
        d3,
        d3SelectAll,
        THREE,
        Astronomy,
        windowRef,
        documentRef,
        consoleRef,
        SwiperClass,
        CB,
        FC,
        PC,
        TC,
        UC,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
        updateProgressLabel,
        ensureIndeterminateProgressBar,
        showElementById,
        hideElementById,
        loadChebyshev,
        loadNpz,
        processOrbitData,
        resolveLandingNpzUrl,
        resolveLandingChebyshevUrl,
        createUTCTimestamp,
        animationScenes,
        animation3DControllers,
        animation2DControllers,
        orbitDataLoaded,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        ephemerisRecords,
        ephemerisStatuses,
        planetProperties,
        animationController,
        AnimationScene,
        Animation3DController,
        Animation2DController,
        SceneHandlerClass,
        resolveOrbitUrls,
        resolveOrbitNpzUrl,
        loadMissionConfig,
        bindInfoPanelControls,
        updateEphemerisPanel,
        applyMissionMetadata,
        updateMultipleElementsText,
        updateSpacecraftMnemonic,
        applyLandingTimesUpdate,
        computeLandingTimesUpdate,
        applyEventsUpdate,
        computeEventsUpdate,
        computeMissionEventTimes,
        bindBurnButtons,
        shouldSkipInitConfig,
        applyInitConfigAlreadyInitialized,
        normalizePlaneSelection,
        syncPlaneSelectionControls,
        setChecked,
        readOriginMode,
        readViewSettings,
        setFPSCounterVisibility,
        computeSunLongitude,
        computeSceneState,
        getBodyEphemerisRange,
        getBodyEphemerisState,
        generateBodyCurve,
        PIXELS_PER_AU,
        render,
        clearProgressLabel,
        updateD3ElementText,
        createNavigationActions,
        createRepeatMouseDownHandlers,
        createLockActions,
        createCameraActions,
        createModeActions,
        createBurnActions,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        requestAnimationFrame,
        clearTimeoutFn: clearTimeout,
        bindRepeatButtons,
        initRepeatButtons,
    };
}

export { buildMissionRuntimeStaticDeps };
