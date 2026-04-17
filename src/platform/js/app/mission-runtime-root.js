import { createMissionRuntimeHandlersEntry } from "./mission-runtime-handlers-entry.js";
import { createMissionRuntimeWireupEntry } from "./mission-runtime-wireup-entry.js";

function createSyncedRuntimeViewActions({
    missionRuntimeWireup,
    syncTimelineDock,
    syncActiveCraftControl,
}) {
    const syncPlaybackUi = () => {
        syncTimelineDock();
        syncActiveCraftControl();
    };

    return {
        toggleMode(...args) {
            missionRuntimeWireup.toggleMode.apply(missionRuntimeWireup, args);
            syncPlaybackUi();
        },
        setDimensionTop(...args) {
            missionRuntimeWireup.setDimensionTop.apply(missionRuntimeWireup, args);
            syncPlaybackUi();
        },
        setView(...args) {
            missionRuntimeWireup.setView.apply(missionRuntimeWireup, args);
            syncPlaybackUi();
        },
    };
}

function publishMissionRuntimeGlobals({
    windowRef,
    animationScenes,
    AnimationScene,
    main,
}) {
    if (!windowRef) return;
    windowRef.animationScenes = animationScenes;
    windowRef.AnimationScene = AnimationScene;
    windowRef.addEventListener("load", main);
}

function createMissionRuntimeRoot({
    createMissionRuntimeHandlersEntryImpl = createMissionRuntimeHandlersEntry,
    createMissionRuntimeWireupEntryImpl = createMissionRuntimeWireupEntry,
    handlersEntryContext,
    wireupEntryContext,
    syncTimelineDock,
    syncActiveCraftControl,
}) {
    let missionRuntimeWireup = null;
    let runtimeViewActions = {
        toggleMode: null,
        setDimensionTop: null,
        setView: null,
    };

    const runtimeHandlers = createMissionRuntimeHandlersEntryImpl({
        ...handlersEntryContext,
        getSetView: () => runtimeViewActions.setView,
        getSetDimensionTop: () => runtimeViewActions.setDimensionTop,
        getMissionRuntimeWireup: () => missionRuntimeWireup,
    });

    ({ missionRuntimeWireup } = createMissionRuntimeWireupEntryImpl({
        ...wireupEntryContext,
        processOrbitData: runtimeHandlers.processOrbitData,
        animateLoop: runtimeHandlers.animateLoop,
        initAnimation: runtimeHandlers.initAnimation,
    }));

    runtimeViewActions = createSyncedRuntimeViewActions({
        missionRuntimeWireup,
        syncTimelineDock,
        syncActiveCraftControl,
    });

    return {
        ...runtimeHandlers,
        missionRuntimeWireup,
        ...runtimeViewActions,
    };
}

export {
    createMissionRuntimeRoot,
    createSyncedRuntimeViewActions,
    publishMissionRuntimeGlobals,
};
