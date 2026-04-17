import {
    planActiveEventUiState,
    resolveActiveEventButtonMatchIndex,
} from "../core/domain/active-event-ui-state.js";

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
    let highlightedEventButton = null;
    let activeEventVisible = false;

    function setBurnIndicatorVisible(isVisible) {
        if (activeEventVisible === isVisible) {
            return;
        }
        d3.select("#burng").style("visibility", isVisible ? "visible" : "hidden");
        activeEventVisible = isVisible;
    }

    function clearActiveEventButtonHighlight() {
        if (highlightedEventButton) {
            highlightedEventButton.classList.remove(ACTIVE_EVENT_BUTTON_CLASS);
            highlightedEventButton = null;
        }
    }

    function resolveButtonForActiveEvent(activeEvent) {
        const buttons = Array.from(documentRef.querySelectorAll("#burnbuttons button[data-event-key]"));
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

    function clearActiveEventUi() {
        setBurnIndicatorVisible(false);
        clearEventInfo();
        setMobileText("mobile-mission-event", "No active event");
        clearActiveEventButtonHighlight();
    }

    function updateActiveEvent(sceneState) {
        const activeEventUiState = planActiveEventUiState({
            activeEvent: sceneState?.activeEvent,
            currentTimeMs: sceneState?.time,
            nowWallTimeMs: getNowWallTimeMs(),
        });
        if (activeEventUiState.hasActiveEvent) {
            setBurnIndicatorVisible(activeEventUiState.showBurnIndicator);
            updateEventInfo(activeEventUiState.eventText);
            setMobileText("mobile-mission-event", activeEventUiState.mobileEventText);
            updateActiveEventButtonHighlight(sceneState.activeEvent);
            return;
        }

        clearActiveEventUi();
    }

    return {
        updateActiveEvent,
    };
}

export { createSceneActiveEventUiActions };
