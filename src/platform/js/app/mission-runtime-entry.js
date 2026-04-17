import { buildMissionRuntimeWireupConfig } from "./mission-runtime-wireup-config.js";
import { createMissionRuntimeWireup } from "./mission-runtime-wireup.js";
import { createMissionStatePorts } from "../core/state/mission-state-store.js";
import { createMissionUiEffects } from "../shell/ui/mission-ui-effects.js";
import { createClockEffects } from "../shell/time/clock-effects.js";

function createMissionRuntimeEntry(ctx) {
    const {
        d3,
        missionStateCells,
        runtimeFlags,
        animationScenes,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        planetProperties,
        ephemerisStatuses,
        resolveBodySource,
        getActiveEphemerisSource,
        sceneViewStateActions,
        AnimationScene,
        bridgeActions,
        modeSwitchActions,
        staticWireupDeps,
        readPlaneSelection,
        toggleStatsVisibility,
        animateLoop,
        initAnimation,
        isRelativeMode,
        isTestMode,
    } = ctx;

    let missionRuntimeWireup = null;

    const missionStatePorts = createMissionStatePorts({
        state: missionStateCells,
        runtimeFlags,
        animationScenes,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        planetProperties,
        ephemerisStatuses,
        resolveBodySource,
        getActiveEphemerisSource,
        ...sceneViewStateActions,
        getRuntimeBootstrapActions: () => missionRuntimeWireup?.runtimeBootstrapActions,
        getAnimationSceneInitDone: () => AnimationScene.SCENE_STATE_INIT_DONE,
    });

    const missionUiEffects = createMissionUiEffects({ d3 });
    const missionClockEffects = createClockEffects({
        clearTimeoutFn: clearTimeout,
        getLegacyTimeoutHandle: missionStatePorts.interaction.getLegacyTimeoutHandle,
    });

    const modeSwitchWireupActions = {
        handleDimensionSwitch: modeSwitchActions.switchDimension,
        handleModeSwitchToGeo: modeSwitchActions.switchToGeo,
        handleModeSwitchToLunar: modeSwitchActions.switchToLunar,
    };

    missionRuntimeWireup = createMissionRuntimeWireup(buildMissionRuntimeWireupConfig({
        ...staticWireupDeps,
        ...bridgeActions,
        ...sceneViewStateActions,
        ...modeSwitchWireupActions,
        isRelativeMode,
        initAnimation,
        animateLoop,
        isTestMode,
        statePorts: missionStatePorts,
        uiEffects: missionUiEffects,
        clockEffects: missionClockEffects,
        readPlaneSelection,
        toggleStatsVisibility,
    }));

    return {
        missionRuntimeWireup,
        missionStatePorts,
    };
}

export { createMissionRuntimeEntry };
