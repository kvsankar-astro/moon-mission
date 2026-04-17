import { createDataflowWiringActions } from "./dataflow-wiring-actions.js";
import { createInitConfigWiringActions } from "./init-config-wiring-actions.js";
import { createInitConfigFlowActions } from "./init-config-flow-actions.js";
import { createViewSettingsWiringActions } from "./view-settings-wiring-actions.js";
import { createSceneFrameWiringActions } from "./scene-frame-wiring-actions.js";
import { createStartEndTimesResolver } from "./start-end-times.js";
import { createLoadProgressController } from "./load-progress-controller.js";
import {
    createDataflowWiringDeps,
    createInitConfigFlowDeps,
    createInitConfigWiringDeps,
    createMissionWiringContext,
    createSceneFrameWiringDeps,
    createViewSettingsWiringDeps,
} from "./mission-wiring-deps.js";

function createMissionWiringComposition(ports) {
    const ctx = createMissionWiringContext(ports);

    const getStartAndEndTimes = createStartEndTimesResolver({
        getGlobalConfig: ctx.getGlobalConfig,
        getConfig: ctx.getConfig,
        createUTCTimestamp: ctx.createUTCTimestamp,
        oneMinuteMs: ctx.TC.ONE_MINUTE_MS,
    });
    const loadProgress = createLoadProgressController({
        ensureDeterminateProgressBar: ctx.ensureDeterminateProgressBar,
        setProgressBarValue: ctx.setProgressBarValue,
        showElementById: ctx.showElementById,
        hideElementById: ctx.hideElementById,
        updateProgressLabel: ctx.updateProgressLabel,
        clearProgressLabel: ctx.clearProgressLabel,
    });

    const dataflow = createDataflowWiringActions(
        createDataflowWiringDeps(ctx, { getStartAndEndTimes, loadProgress }),
    );

    const initConfigWiring = createInitConfigWiringActions(
        createInitConfigWiringDeps(
            {
                ...ctx,
                computeSVGDimensions: () => dataflow.svgActions.computeSVGDimensions(),
            },
            { getStartAndEndTimes, loadProgress },
        ),
    );

    const { initConfig } = createInitConfigFlowActions(
        createInitConfigFlowDeps(ctx, { initConfigWiring }),
    );

    const viewSettings = createViewSettingsWiringActions(
        createViewSettingsWiringDeps(ctx, { dataflow, loadProgress }),
    );

    const sceneFrame = createSceneFrameWiringActions(
        createSceneFrameWiringDeps(ctx, { dataflow }),
    );

    return {
        ...dataflow,
        ...initConfigWiring,
        initConfig,
        ...viewSettings,
        ...sceneFrame,
        getStartAndEndTimes,
    };
}

export { createMissionWiringComposition };
