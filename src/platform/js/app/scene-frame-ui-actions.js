import { formatDateTimeLocal } from "../utils/time-utils.js";

function createSceneFrameUiActions(deps) {
    const { getAnimDate, sceneUiUpdateActions } = deps;

    function updateMobileMissionTime(text) {
        const mobileDate = document.getElementById("mobile-mission-time");
        if (!mobileDate) return;

        const match = text.match(/^(.*)\s(UTC[+-]\d{2}:\d{2})$/);
        if (!match) {
            mobileDate.textContent = text;
            return;
        }

        const dateTimeText = match[1].trim();
        const timezoneText = match[2].trim();

        const primaryLine = document.createElement("span");
        primaryLine.className = "mobile-shell__time-main";
        primaryLine.textContent = dateTimeText;

        const timezoneLine = document.createElement("span");
        timezoneLine.className = "mobile-shell__time-zone";
        timezoneLine.textContent = timezoneText;

        mobileDate.replaceChildren(primaryLine, timezoneLine);
    }

    function updateAnimationDate(animTime) {
        const animDate = getAnimDate();
        const bottomText = formatDateTimeLocal(animTime, { includeOffset: false });
        const mobileText = formatDateTimeLocal(animTime, { includeOffset: true });
        if (!animDate || typeof animDate.html !== "function") {
            updateMobileMissionTime(mobileText);
            return;
        }
        if (typeof animDate.text === "function") {
            animDate.text(bottomText);
        } else {
            animDate.html(bottomText);
        }
        updateMobileMissionTime(mobileText);
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
