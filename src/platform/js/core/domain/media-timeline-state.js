import { resolveNearestMediaIndex } from "./media-selection-state.js";

function buildMarkerHoverText(item, {
    preEphemeris = false,
    postEphemeris = false,
} = {}) {
    const parts = [
        item?.title || "Media item",
        item?.cameraLabel || item?.kind || "",
    ].filter(Boolean);

    if (preEphemeris) {
        parts.push("Before sampled trajectory");
    } else if (postEphemeris) {
        parts.push("After sampled trajectory");
    }

    return parts.join(" • ");
}

function buildMediaTimelineMarkers({
    items,
    timeMs,
    rangeStartMs,
    rangeEndMs,
} = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const activeIndex = resolveNearestMediaIndex(normalizedItems, timeMs);

    return normalizedItems.map((item, index) => {
        const startTimeMs = Number(item?.startTimeMs);
        const preEphemeris = Number.isFinite(rangeStartMs) && startTimeMs < rangeStartMs;
        const postEphemeris = Number.isFinite(rangeEndMs) && startTimeMs > rangeEndMs;
        const inTimelineRange = !preEphemeris && !postEphemeris;

        return {
            id: item.id,
            label: item.title,
            hoverText: buildMarkerHoverText(item, { preEphemeris, postEphemeris }),
            mediaKind: item.kind,
            startTime: new Date(startTimeMs),
            startTimeMs,
            selected: index === activeIndex,
            clickable: inTimelineRange,
            preEphemeris,
            postEphemeris,
        };
    });
}

export {
    buildMediaTimelineMarkers,
};
