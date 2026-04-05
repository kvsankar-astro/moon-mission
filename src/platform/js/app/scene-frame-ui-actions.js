import { formatDateTimeLocal } from "../utils/time-utils.js";

function createSceneFrameUiActions(deps) {
    const { getAnimDate, sceneUiUpdateActions } = deps;

    function updateAnimationDate(animTime) {
        const animDate = getAnimDate();
        const bottomText = formatDateTimeLocal(animTime, { includeOffset: false });
        if (!animDate || typeof animDate.html !== "function") {
            return;
        }
        if (typeof animDate.text === "function") {
            animDate.text(bottomText);
        } else {
            animDate.html(bottomText);
        }
    }

    function updateSharedUi({ sceneState, primaryBody, globalConfig, config }) {
        sceneUiUpdateActions.updateTelemetry(sceneState, primaryBody, config);
        sceneUiUpdateActions.updatePhaseIndicator(sceneState, globalConfig);
        sceneUiUpdateActions.updateActiveEvent(sceneState);
    }

    function updateFrameUi({ animTime, sceneState, primaryBody, globalConfig, config }) {
        updateAnimationDate(animTime);
        updateSharedUi({ sceneState, primaryBody, globalConfig, config });
    }

    return {
        updateAnimationDate,
        updateSharedUi,
        updateFrameUi,
    };
}

export { createSceneFrameUiActions };
