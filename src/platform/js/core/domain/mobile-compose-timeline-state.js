function resolveComposeTimelineRange({
    timelineState,
    flybyWindow,
    flybyTimeMs,
    windowMs,
}) {
    if (!timelineState) {
        return null;
    }

    if (
        Number.isFinite(flybyWindow?.startMs) &&
        Number.isFinite(flybyWindow?.endMs) &&
        flybyWindow.endMs > flybyWindow.startMs
    ) {
        let startMs = Math.min(Math.max(flybyWindow.startMs, timelineState.min), timelineState.max);
        let endMs = Math.min(Math.max(flybyWindow.endMs, timelineState.min), timelineState.max);
        if (endMs <= startMs) {
            endMs = Math.min(timelineState.max, startMs + 1);
        }
        return { startMs, endMs };
    }

    const anchorMs = Number.isFinite(flybyTimeMs) ? flybyTimeMs : timelineState.value;
    const fullSpan = Math.max(0, timelineState.max - timelineState.min);
    const windowSpan = Math.min(fullSpan, windowMs);
    const halfSpan = windowSpan * 0.5;
    let startMs = anchorMs - halfSpan;
    let endMs = anchorMs + halfSpan;
    if (startMs < timelineState.min) {
        endMs += timelineState.min - startMs;
        startMs = timelineState.min;
    }
    if (endMs > timelineState.max) {
        startMs -= endMs - timelineState.max;
        endMs = timelineState.max;
    }
    startMs = Math.max(timelineState.min, startMs);
    endMs = Math.min(timelineState.max, endMs);
    if (endMs <= startMs) {
        endMs = Math.min(timelineState.max, startMs + 1);
    }
    return { startMs, endMs };
}

function resolveComposeTimelineTime({
    sliderValue,
    range,
    resolution,
}) {
    if (!range || !Number.isFinite(range.startMs) || !Number.isFinite(range.endMs) || range.endMs <= range.startMs) {
        return Number.NaN;
    }
    const ratio = Math.min(1, Math.max(0, Number(sliderValue) / resolution));
    return range.startMs + (range.endMs - range.startMs) * ratio;
}

function resolveComposeTimelineSliderValue({
    timelineState,
    range,
    resolution,
}) {
    if (!timelineState || !range || !Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) {
        return "";
    }
    const ratio = Math.min(
        1,
        Math.max(0, (timelineState.value - range.startMs) / Math.max(range.endMs - range.startMs, 1)),
    );
    return String(Math.round(ratio * resolution));
}

function buildComposeTimelineDisplay({
    timelineState,
    formatLocalDateTimeShort,
}) {
    if (!timelineState) {
        return {
            utcText: "--",
            localText: "Local: --",
        };
    }
    const utcText = new Date(timelineState.value).toUTCString();
    return {
        utcText,
        localText: `Local: ${formatLocalDateTimeShort(timelineState.value)}`,
    };
}

export {
    buildComposeTimelineDisplay,
    resolveComposeTimelineRange,
    resolveComposeTimelineSliderValue,
    resolveComposeTimelineTime,
};
