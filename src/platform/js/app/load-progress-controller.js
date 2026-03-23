import {
    completeAllLoadProgressStages,
    completeLoadProgressStage,
    computeLoadProgressPercent,
    createLoadProgressState,
    setLoadProgressStage,
} from "../core/domain/load-progress.js";

function createNoopController() {
    return {
        beginSession: () => {},
        beginSessionIfNeeded: () => {},
        setStage: () => {},
        completeStage: () => {},
        completeSession: () => {},
        abortSession: () => {},
        isActive: () => false,
    };
}

function createLoadProgressController({
    ensureDeterminateProgressBar,
    setProgressBarValue,
    showElementById,
    hideElementById,
    updateProgressLabel,
    clearProgressLabel,
}) {
    if (
        typeof ensureDeterminateProgressBar !== "function" ||
        typeof setProgressBarValue !== "function" ||
        typeof showElementById !== "function" ||
        typeof hideElementById !== "function" ||
        typeof updateProgressLabel !== "function"
    ) {
        return createNoopController();
    }

    let state = null;
    let active = false;

    function renderProgress(label = "") {
        if (!active || !state) return 0;
        const percent = computeLoadProgressPercent(state);
        ensureDeterminateProgressBar("progressbar", percent);
        setProgressBarValue("progressbar", percent);

        if (label) {
            updateProgressLabel(`${label} (${Math.round(percent)}%)`);
        }
        return percent;
    }

    function beginSession({
        includeLanding = true,
        label = "Loading mission data...",
    } = {}) {
        state = createLoadProgressState({ includeLanding });
        active = true;
        showElementById("progressbar");
        renderProgress(label);
    }

    function beginSessionIfNeeded(options) {
        if (active) return;
        beginSession(options);
    }

    function setStage(stage, fraction, label = "") {
        if (!active || !state) return;
        state = setLoadProgressStage(state, stage, fraction);
        renderProgress(label);
    }

    function completeStage(stage, label = "") {
        if (!active || !state) return;
        state = completeLoadProgressStage(state, stage);
        renderProgress(label);
    }

    function completeSession(label = "") {
        if (!active || !state) return;
        state = completeAllLoadProgressStages(state);
        renderProgress(label || "Ready");
        hideElementById("progressbar");
        if (typeof clearProgressLabel === "function") {
            clearProgressLabel();
        } else {
            updateProgressLabel("");
        }
        active = false;
        state = null;
    }

    function abortSession() {
        if (!active) return;
        hideElementById("progressbar");
        if (typeof clearProgressLabel === "function") {
            clearProgressLabel();
        } else {
            updateProgressLabel("");
        }
        active = false;
        state = null;
    }

    function isActive() {
        return active;
    }

    return {
        beginSession,
        beginSessionIfNeeded,
        setStage,
        completeStage,
        completeSession,
        abortSession,
        isActive,
    };
}

export { createLoadProgressController };
