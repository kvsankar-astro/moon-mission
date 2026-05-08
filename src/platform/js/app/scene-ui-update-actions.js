import { createSceneTelemetryUiActions } from "./scene-telemetry-ui-actions.js";
import { createScenePhaseUiActions } from "./scene-phase-ui-actions.js";
import { createSceneActiveEventUiActions } from "./scene-active-event-ui-actions.js";

function createSceneUiUpdateActions(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
    } = deps;

    function setMobileText(id, text) {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = text;
    }

    const sceneTelemetryUiActions = createSceneTelemetryUiActions({
        d3,
        formatMetric,
        setMobileText,
    });

    const scenePhaseUiActions = createScenePhaseUiActions({
        d3,
        setMobileText,
    });

    const sceneActiveEventUiActions = createSceneActiveEventUiActions({
        d3,
        updateEventInfo,
        clearEventInfo,
        setMobileText,
    });

    function updateTelemetry(sceneState, primaryBody, globalConfig = null, config = null, animTime = null) {
        sceneTelemetryUiActions.updateTelemetry(sceneState, primaryBody, globalConfig, config, animTime);
    }

    function updatePhaseIndicator(sceneState, globalConfig) {
        scenePhaseUiActions.updatePhaseIndicator(sceneState, globalConfig);
    }

    function updateActiveEvent(sceneState) {
        sceneActiveEventUiActions.updateActiveEvent(sceneState);
    }

    function dispose() {
        sceneTelemetryUiActions.dispose?.();
    }

    return {
        updateTelemetry,
        updatePhaseIndicator,
        updateActiveEvent,
        dispose,
    };
}

export { createSceneUiUpdateActions };
