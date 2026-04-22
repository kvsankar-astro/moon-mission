import { AnimationController } from "../animation/animation-controller.js";
import { createEventBus } from "../core/event-bus.js";
import {
    createAnimationControllerCallbacks,
    createMissionPlaybackUiShell,
} from "./mission-playback-coordination.js";

function bindMissionPlaybackStartup({
    windowRef,
    animationController,
    syncPlaybackStartup,
}) {
    if (!windowRef?.addEventListener || !animationController || !syncPlaybackStartup) {
        return;
    }

    windowRef.addEventListener("load", function () {
        syncPlaybackStartup({
            isRunning: animationController.getIsRunning(),
            speedMultiplier: animationController.getSpeedMultiplier(),
            isRealtimeSpeed: animationController.getIsRealtimeSpeed(),
            goToNow: () => {
                animationController.goToNow();
            },
        });
    });
}

function createMissionPlaybackRuntime({
    windowRef,
    documentRef,
    CustomEventClass,
    runtimeSessionState,
    bridgeActions,
    updateD3ElementText,
    getSetView,
    getAnimationScenes,
    getConfig,
    getGlobalConfig,
    getStartTime,
    getLatestEndTime,
    getAnimTime,
    getEventInfos,
    getTimelineEventInfos = getEventInfos,
    getIsCompareMode = () => false,
    syncTimelineEventButtons,
    defaultStepMs,
    maxTimelineStepMs,
    updateEventInfo,
    clearEventInfo,
    createEventBusImpl = createEventBus,
    createMissionPlaybackUiShellImpl = createMissionPlaybackUiShell,
    createAnimationControllerCallbacksImpl = createAnimationControllerCallbacks,
    AnimationControllerClass = AnimationController,
}) {
    const eventBus = createEventBusImpl();
    let animationController = null;

    const playbackUiShell = createMissionPlaybackUiShellImpl({
        documentRef,
        CustomEventClass,
        getAnimationController: () => animationController,
        getSetView,
        getAnimationScenes,
        getConfig,
        getGlobalConfig,
        getStartTime,
        getLatestEndTime,
        getAnimTime,
        getEventInfos,
        getTimelineEventInfos,
        getIsCompareMode,
        syncTimelineEventButtons,
        defaultStepMs,
        maxTimelineStepMs,
        updateEventInfo,
        clearEventInfo,
    });

    const animationControllerCallbacks = createAnimationControllerCallbacksImpl({
        runtimeSessionState,
        bridgeActions,
        syncTimelineDock: playbackUiShell.syncTimelineDock,
        syncActiveCraftControl: playbackUiShell.syncActiveCraftControl,
        updateD3ElementText,
        updateTransportControlsUI: playbackUiShell.updateTransportControlsUI,
        dispatchAnimationPlayStateUpdated: playbackUiShell.dispatchAnimationPlayStateUpdated,
        getSetView,
        updateSpeedControlsUI: playbackUiShell.updateSpeedControlsUI,
        eventBus,
    });

    animationController = new AnimationControllerClass(animationControllerCallbacks);

    bindMissionPlaybackStartup({
        windowRef,
        animationController,
        syncPlaybackStartup: playbackUiShell.syncPlaybackStartup,
    });

    return {
        eventBus,
        animationController,
        ...playbackUiShell,
    };
}

export {
    bindMissionPlaybackStartup,
    createMissionPlaybackRuntime,
};
