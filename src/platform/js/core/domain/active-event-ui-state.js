import { buildEventInfoText, isBurnIndicatorVisibleAtTime } from "../../app/burn-event-metadata.js";

function normalizeText(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveActiveEventButtonMatchIndex({
    activeEvent,
    buttonDescriptors,
}) {
    const descriptors = Array.isArray(buttonDescriptors) ? buttonDescriptors : [];
    if (!activeEvent || descriptors.length === 0) {
        return null;
    }

    const eventKey = typeof activeEvent.key === "string" ? activeEvent.key : "";
    if (eventKey) {
        const matchedByKey = descriptors.findIndex(
            (descriptor) => descriptor?.eventKey === eventKey,
        );
        if (matchedByKey >= 0) {
            return matchedByKey;
        }
    }

    const eventLabel = normalizeText(activeEvent.label);
    const eventHoverText = normalizeText(activeEvent.hoverText || activeEvent.infoText);
    const matchedByText = descriptors.findIndex((descriptor) => {
        const buttonLabel = normalizeText(descriptor?.label);
        const buttonTitle = normalizeText(descriptor?.title);
        if (eventLabel && buttonLabel === eventLabel) {
            return true;
        }
        return Boolean(eventHoverText && buttonTitle && buttonTitle === eventHoverText);
    });
    return matchedByText >= 0 ? matchedByText : null;
}

function planActiveEventUiState({
    activeEvent,
    currentTimeMs,
    nowWallTimeMs = Date.now(),
}) {
    if (!activeEvent) {
        return {
            hasActiveEvent: false,
            showBurnIndicator: false,
            eventText: "",
            mobileEventText: "No active event",
        };
    }

    const eventText = buildEventInfoText(activeEvent);
    return {
        hasActiveEvent: true,
        showBurnIndicator: isBurnIndicatorVisibleAtTime(
            activeEvent,
            currentTimeMs,
            { nowWallTimeMs },
        ),
        eventText,
        mobileEventText: eventText || "No active event",
    };
}

export {
    planActiveEventUiState,
    resolveActiveEventButtonMatchIndex,
};
