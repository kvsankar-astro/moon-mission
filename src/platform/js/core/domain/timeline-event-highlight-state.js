function resolveDescriptorTimeMs(descriptor) {
    if (!descriptor) return Number.NaN;
    const rawTime = descriptor.timeMs ?? descriptor.eventTimeMs ?? descriptor.startTime;
    if (rawTime instanceof Date) {
        return rawTime.getTime();
    }
    if (Number.isFinite(rawTime)) {
        return rawTime;
    }
    const parsed = new Date(rawTime).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isSameTimelineMillisecond(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return false;
    }
    return Math.round(a) === Math.round(b);
}

function resolveTimelineEventHighlightState({
    events,
    currentTimeMs,
} = {}) {
    const currentIndexes = new Set();
    const boundaryIndexes = new Set();
    const descriptors = Array.isArray(events)
        ? events
            .map((event, index) => ({
                index,
                timeMs: resolveDescriptorTimeMs(event),
            }))
            .filter((event) => Number.isFinite(event.timeMs))
            .sort((a, b) => a.timeMs - b.timeMs || a.index - b.index)
        : [];

    if (!Number.isFinite(currentTimeMs) || descriptors.length === 0) {
        return {
            currentIndexes: [],
            boundaryIndexes: [],
        };
    }

    for (const descriptor of descriptors) {
        if (isSameTimelineMillisecond(currentTimeMs, descriptor.timeMs)) {
            currentIndexes.add(descriptor.index);
        }
    }

    if (currentIndexes.size === 0) {
        let previousTimeMs = Number.NaN;
        let nextTimeMs = Number.NaN;
        for (const descriptor of descriptors) {
            if (descriptor.timeMs < currentTimeMs) {
                previousTimeMs = descriptor.timeMs;
                continue;
            }
            if (descriptor.timeMs > currentTimeMs) {
                nextTimeMs = descriptor.timeMs;
                break;
            }
        }
        if (Number.isFinite(previousTimeMs) && Number.isFinite(nextTimeMs)) {
            for (const descriptor of descriptors) {
                if (
                    isSameTimelineMillisecond(descriptor.timeMs, previousTimeMs) ||
                    isSameTimelineMillisecond(descriptor.timeMs, nextTimeMs)
                ) {
                    boundaryIndexes.add(descriptor.index);
                }
            }
        }
    }

    return {
        currentIndexes: Array.from(currentIndexes).sort((a, b) => a - b),
        boundaryIndexes: Array.from(boundaryIndexes).sort((a, b) => a - b),
    };
}

export {
    isSameTimelineMillisecond,
    resolveTimelineEventHighlightState,
};
