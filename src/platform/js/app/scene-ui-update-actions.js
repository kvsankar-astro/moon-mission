import { createSceneTelemetryUiActions } from "./scene-telemetry-ui-actions.js";
import {
    planActiveEventUiState,
    resolveActiveEventButtonMatchIndex,
} from "../core/domain/active-event-ui-state.js";
import { buildPhaseIndicatorModel } from "../core/domain/phase-indicator-state.js";

function createSceneUiUpdateActions(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
    } = deps;
    const ACTIVE_EVENT_BUTTON_CLASS = "burnbutton--active-event";
    let highlightedEventButton = null;
    let activeEventVisible = false;

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

    function clearActiveEventButtonHighlight() {
        if (highlightedEventButton) {
            highlightedEventButton.classList.remove(ACTIVE_EVENT_BUTTON_CLASS);
            highlightedEventButton = null;
        }
    }

    function resolveButtonForActiveEvent(activeEvent) {
        const buttons = Array.from(document.querySelectorAll("#burnbuttons button[data-event-key]"));
        if (!buttons.length) return null;
        const matchedIndex = resolveActiveEventButtonMatchIndex({
            activeEvent,
            buttonDescriptors: buttons.map((button) => ({
                eventKey: button?.dataset?.eventKey || "",
                label: button?.textContent || "",
                title: button?.getAttribute("title") || "",
            })),
        });
        return matchedIndex === null ? null : buttons[matchedIndex] || null;
    }

    function updateActiveEventButtonHighlight(activeEvent) {
        if (!activeEvent) {
            clearActiveEventButtonHighlight();
            return;
        }

        const button = resolveButtonForActiveEvent(activeEvent);
        if (!button) {
            clearActiveEventButtonHighlight();
            return;
        }

        if (button === highlightedEventButton) {
            return;
        }

        clearActiveEventButtonHighlight();
        button.classList.add(ACTIVE_EVENT_BUTTON_CLASS);
        highlightedEventButton = button;
        if (typeof button.scrollIntoView === "function") {
            button.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
    }

    function updateTelemetry(sceneState, primaryBody, config = null, animTime = null) {
        sceneTelemetryUiActions.updateTelemetry(sceneState, primaryBody, config, animTime);
    }

    function updatePhaseIndicator(sceneState, globalConfig) {
        const phaseIndicatorModel = buildPhaseIndicatorModel({
            phase: sceneState?.phase,
            isLunarMission: !!(globalConfig && globalConfig.is_lunar),
        });

        for (const phaseEntry of phaseIndicatorModel.desktopPhases) {
            d3.select(`#${phaseEntry.id}`).html(
                phaseEntry.isActive
                    ? `<b><u>${phaseEntry.label}</u></b>`
                    : phaseEntry.label,
            );
        }
        setMobileText("mobile-mission-phase", phaseIndicatorModel.mobilePhaseText);
    }

    function updateActiveEvent(sceneState) {
        const activeEventUiState = planActiveEventUiState({
            activeEvent: sceneState.activeEvent,
            currentTimeMs: sceneState?.time,
        });
        if (activeEventUiState.hasActiveEvent) {
            if (activeEventUiState.showBurnIndicator && !activeEventVisible) {
                d3.select("#burng").style("visibility", "visible");
                activeEventVisible = true;
            }
            if (!activeEventUiState.showBurnIndicator && activeEventVisible) {
                d3.select("#burng").style("visibility", "hidden");
                activeEventVisible = false;
            }
            updateEventInfo(activeEventUiState.eventText);
            setMobileText("mobile-mission-event", activeEventUiState.mobileEventText);
            updateActiveEventButtonHighlight(sceneState.activeEvent);
            return;
        }

        if (activeEventVisible) {
            d3.select("#burng").style("visibility", "hidden");
            activeEventVisible = false;
        }
        clearEventInfo();
        setMobileText("mobile-mission-event", "No active event");
        clearActiveEventButtonHighlight();
    }

    return {
        updateTelemetry,
        updatePhaseIndicator,
        updateActiveEvent,
    };
}

export { createSceneUiUpdateActions };
