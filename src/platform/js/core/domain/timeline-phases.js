function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function resolveEventStartTimeMs(eventInfo) {
    const startTime = eventInfo?.startTime;
    if (startTime instanceof Date) {
        const timeMs = startTime.getTime();
        return Number.isFinite(timeMs) ? timeMs : Number.NaN;
    }
    if (typeof startTime === "string") {
        const parsed = Date.parse(startTime);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    const numeric = Number(startTime);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function normalizePhaseItems(phaseConfig) {
    if (Array.isArray(phaseConfig)) return phaseConfig;
    if (Array.isArray(phaseConfig?.items)) return phaseConfig.items;
    return [];
}

function normalizeTimelineEvents(eventInfos) {
    if (!Array.isArray(eventInfos)) return [];
    return eventInfos
        .map((eventInfo, index) => {
            const timeMs = resolveEventStartTimeMs(eventInfo);
            if (!Number.isFinite(timeMs)) return null;
            const key = asTrimmedString(eventInfo?.key);
            const label = asTrimmedString(
                eventInfo?.timelineLabel ||
                eventInfo?.label ||
                eventInfo?.generatedLabel ||
                key,
                "Event",
            );
            return {
                ...eventInfo,
                key,
                label,
                timeMs,
                phaseSortIndex: index,
            };
        })
        .filter(Boolean)
        .sort((a, b) => (a.timeMs - b.timeMs) || (a.phaseSortIndex - b.phaseSortIndex));
}

function buildFallbackPhase(events) {
    if (events.length === 0) return [];
    return [{
        id: "mission",
        label: "Mission",
        startEvent: events[0].key || "",
        endEvent: events[events.length - 1].key || "",
        startMs: events[0].timeMs,
        endMs: events[events.length - 1].timeMs,
        includeStart: true,
        includeEnd: true,
        events,
    }];
}

function buildTimelinePhases({ phaseConfig, eventInfos }) {
    const events = normalizeTimelineEvents(eventInfos);
    const phaseItems = normalizePhaseItems(phaseConfig);
    if (events.length === 0) return [];
    if (phaseItems.length === 0) return buildFallbackPhase(events);

    const eventsByKey = new Map();
    for (const eventInfo of events) {
        if (eventInfo.key && !eventsByKey.has(eventInfo.key)) {
            eventsByKey.set(eventInfo.key, eventInfo);
        }
    }

    const phases = [];
    for (let i = 0; i < phaseItems.length; i += 1) {
        const item = phaseItems[i];
        const startEvent = asTrimmedString(item?.startEvent);
        const endEvent = asTrimmedString(item?.endEvent);
        const startInfo = eventsByKey.get(startEvent);
        const endInfo = eventsByKey.get(endEvent);
        if (!startInfo || !endInfo) continue;
        const startMs = startInfo.timeMs;
        const endMs = endInfo.timeMs;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;

        const includeEnd = item?.includeEnd === true || i === phaseItems.length - 1;
        const phaseEvents = events.filter((eventInfo) => (
            eventInfo.timeMs >= startMs &&
            (eventInfo.timeMs < endMs || (includeEnd && eventInfo.timeMs <= endMs))
        ));
        phases.push({
            id: asTrimmedString(item?.id, `phase-${i + 1}`),
            label: asTrimmedString(item?.label, `Phase ${i + 1}`),
            startEvent,
            endEvent,
            startMs,
            endMs,
            includeStart: true,
            includeEnd,
            events: phaseEvents,
        });
    }

    return phases.length > 0 ? phases : buildFallbackPhase(events);
}

function resolveActiveTimelinePhaseIndex(phases, currentTimeMs) {
    const normalizedPhases = Array.isArray(phases) ? phases : [];
    if (normalizedPhases.length === 0) return -1;
    if (!Number.isFinite(currentTimeMs)) return 0;
    for (let i = 0; i < normalizedPhases.length; i += 1) {
        const phase = normalizedPhases[i];
        const startMs = Number(phase?.startMs);
        const endMs = Number(phase?.endMs);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
        const includeEnd = phase?.includeEnd === true;
        if (currentTimeMs >= startMs && (currentTimeMs < endMs || (includeEnd && currentTimeMs <= endMs))) {
            return i;
        }
    }
    if (currentTimeMs < normalizedPhases[0].startMs) return 0;
    return normalizedPhases.length - 1;
}

function resolveTimelinePhaseSeekTimeMs({
    phase,
    timelineMinMs,
    timelineMaxMs,
    stepMs = 1,
}) {
    const startMs = Number(phase?.startMs);
    const endMs = Number(phase?.endMs);
    const minMs = Number(timelineMinMs);
    const maxMs = Number(timelineMaxMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Number.NaN;
    if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs < minMs) return startMs;

    const clampedStart = Math.min(Math.max(startMs, minMs), maxMs);
    const clampedEnd = Math.min(Math.max(endMs, minMs), maxMs);
    if (clampedEnd <= clampedStart) {
        return clampedStart;
    }

    // A selected phase should not land on the previous phase after range-input
    // quantization. Seek a tiny, bounded amount inside the selected interval.
    const safeStepMs = Number.isFinite(Number(stepMs)) && Number(stepMs) > 0
        ? Number(stepMs)
        : 1;
    const inwardMs = Math.max(1, Math.min(1000, safeStepMs * 0.5));
    return Math.min(clampedEnd - 1, clampedStart + inwardMs);
}

export {
    buildTimelinePhases,
    resolveActiveTimelinePhaseIndex,
    resolveEventStartTimeMs,
    resolveTimelinePhaseSeekTimeMs,
};
