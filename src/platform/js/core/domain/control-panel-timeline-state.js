function normalizeNonNegativeHeight(value) {
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function computeControlPanelVisualHeight({ collapsed, panelHeight }) {
    return collapsed ? 0 : normalizeNonNegativeHeight(panelHeight);
}

function computeTimelineDockVisualHeight(dockHeight) {
    return normalizeNonNegativeHeight(dockHeight);
}

function resolveTimelineEventCarouselPresentation(expanded) {
    if (expanded) {
        return {
            expanded: true,
            ariaExpanded: "true",
            ariaLabel: "Pull down events carousel",
            title: "Pull down events carousel",
        };
    }
    return {
        expanded: false,
        ariaExpanded: "false",
        ariaLabel: "Pull up events carousel",
        title: "Pull up events carousel",
    };
}

function resolveUpcomingTimelineEventIndex(eventTimeMsList, currentTimeMs) {
    if (!Array.isArray(eventTimeMsList) || eventTimeMsList.length === 0) {
        return -1;
    }

    if (!Number.isFinite(currentTimeMs)) {
        return 0;
    }

    let bestFutureIndex = -1;
    let bestFutureDelta = Number.POSITIVE_INFINITY;
    let bestNearestIndex = -1;
    let bestNearestDelta = Number.POSITIVE_INFINITY;

    for (let index = 0; index < eventTimeMsList.length; index += 1) {
        const eventTimeMs = Number(eventTimeMsList[index]);
        if (!Number.isFinite(eventTimeMs)) continue;

        const absoluteDelta = Math.abs(eventTimeMs - currentTimeMs);
        if (absoluteDelta < bestNearestDelta) {
            bestNearestDelta = absoluteDelta;
            bestNearestIndex = index;
        }

        const futureDelta = eventTimeMs - currentTimeMs;
        if (futureDelta < 0) continue;
        if (futureDelta < bestFutureDelta) {
            bestFutureDelta = futureDelta;
            bestFutureIndex = index;
        }
    }

    return bestFutureIndex >= 0 ? bestFutureIndex : bestNearestIndex;
}

export {
    computeControlPanelVisualHeight,
    computeTimelineDockVisualHeight,
    resolveTimelineEventCarouselPresentation,
    resolveUpcomingTimelineEventIndex,
};
