import {
    planActiveEventUiState,
} from "../core/domain/active-event-ui-state.js";
import { resolveTimelineEventHighlightState } from "../core/domain/timeline-event-highlight-state.js";

function createSceneActiveEventUiActions(deps) {
    const {
        d3,
        updateEventInfo,
        clearEventInfo,
        setMobileText,
        documentRef = document,
        getNowWallTimeMs = () => Date.now(),
    } = deps;
    const ACTIVE_EVENT_BUTTON_CLASS = "burnbutton--active-event";
    const BOUNDARY_EVENT_BUTTON_CLASS = "burnbutton--time-boundary";
    let lastScrolledCurrentEventSignature = "";
    let activeEventVisible = false;

    function setBurnIndicatorVisible(isVisible) {
        if (activeEventVisible === isVisible) {
            return;
        }
        d3.select("#burng").style("visibility", isVisible ? "visible" : "hidden");
        activeEventVisible = isVisible;
    }

    function setElementClass(element, className, enabled) {
        if (!element?.classList) return;
        if (enabled) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    function resolveTimelineEventButtons() {
        const buttons = Array.from(documentRef.querySelectorAll("#burnbuttons button[data-event-key]"));
        return buttons.map((button) => ({
            button,
            eventKey: button?.dataset?.eventKey || "",
            timeMs: Number(button?.dataset?.eventTimeMs),
        }));
    }

    function updateTimelineEventButtonHighlights(currentTimeMs) {
        const descriptors = resolveTimelineEventButtons();
        if (descriptors.length === 0) {
            lastScrolledCurrentEventSignature = "";
            return;
        }

        const highlightState = resolveTimelineEventHighlightState({
            events: descriptors,
            currentTimeMs,
        });
        const currentIndexes = new Set(highlightState.currentIndexes);
        const boundaryIndexes = new Set(highlightState.boundaryIndexes);

        for (let index = 0; index < descriptors.length; index += 1) {
            const descriptor = descriptors[index];
            const isCurrent = currentIndexes.has(index);
            setElementClass(descriptor.button, ACTIVE_EVENT_BUTTON_CLASS, isCurrent);
            setElementClass(
                descriptor.button,
                BOUNDARY_EVENT_BUTTON_CLASS,
                !isCurrent && boundaryIndexes.has(index),
            );
        }

        const currentSignature = highlightState.currentIndexes
            .map((index) => descriptors[index]?.eventKey || String(index))
            .join("|");
        if (currentSignature && currentSignature !== lastScrolledCurrentEventSignature) {
            const firstCurrent = descriptors[highlightState.currentIndexes[0]]?.button;
            if (typeof firstCurrent?.scrollIntoView === "function") {
                firstCurrent.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "center",
                });
            }
        }
        lastScrolledCurrentEventSignature = currentSignature;
    }

    function clearActiveEventUi() {
        setBurnIndicatorVisible(false);
        clearEventInfo();
        setMobileText("mobile-mission-event", "No active event");
    }

    function updateActiveEvent(sceneState) {
        updateTimelineEventButtonHighlights(sceneState?.time);
        const activeEventUiState = planActiveEventUiState({
            activeEvent: sceneState?.activeEvent,
            currentTimeMs: sceneState?.time,
            nowWallTimeMs: getNowWallTimeMs(),
        });
        if (activeEventUiState.hasActiveEvent) {
            setBurnIndicatorVisible(activeEventUiState.showBurnIndicator);
            updateEventInfo(activeEventUiState.eventText);
            setMobileText("mobile-mission-event", activeEventUiState.mobileEventText);
            return;
        }

        clearActiveEventUi();
    }

    return {
        updateActiveEvent,
    };
}

export { createSceneActiveEventUiActions };
