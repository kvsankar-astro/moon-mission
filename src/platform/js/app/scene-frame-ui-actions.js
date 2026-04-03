import { formatDateTimeLocal } from "../utils/time-utils.js";

function createSceneFrameUiActions(deps) {
    const { getAnimDate, sceneUiUpdateActions } = deps;

    function updateAnimationDate(animTime) {
        const animDate = getAnimDate();
        const text = formatDateTimeLocal(animTime);
        if (!animDate || typeof animDate.html !== "function") {
            const mobileDate = document.getElementById("mobile-mission-time");
            if (mobileDate) {
                mobileDate.textContent = text;
            }
            return;
        }
        if (typeof animDate.text === "function") {
            animDate.text(text);
        } else {
            animDate.html(text);
        }

        const mobileDate = document.getElementById("mobile-mission-time");
        if (mobileDate) {
            mobileDate.textContent = text;
        }
    }

    function updateSharedUi({ sceneState, primaryBody, globalConfig }) {
        sceneUiUpdateActions.updateTelemetry(sceneState, primaryBody);
        sceneUiUpdateActions.updatePhaseIndicator(sceneState, globalConfig);
        sceneUiUpdateActions.updateActiveEvent(sceneState);
    }

    function updateFrameUi({ animTime, sceneState, primaryBody, globalConfig }) {
        updateAnimationDate(animTime);
        updateSharedUi({ sceneState, primaryBody, globalConfig });
    }

    return {
        updateAnimationDate,
        updateSharedUi,
        updateFrameUi,
    };
}

export { createSceneFrameUiActions };
