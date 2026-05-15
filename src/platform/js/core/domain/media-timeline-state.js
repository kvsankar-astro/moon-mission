import { resolveNearestMediaIndex } from "./media-selection-state.js";
import { isBackgroundPlaybackMediaItem } from "./media-playback-policy.js";
import { resolveMediaThumbnailAssetUrl } from "./media-thumbnail-assets.js";

const DEFAULT_PLAYABLE_SEGMENT_DURATION_MS = 30000;

function formatDurationLabel(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return "";
    const seconds = Math.round(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function isPlayableMediaKind(kind) {
    return kind === "audioClip" || kind === "videoClip";
}

function resolveMediaSegmentTiming(item, startTimeMs) {
    const kind = item?.kind;
    if (!isPlayableMediaKind(kind) || !Number.isFinite(startTimeMs)) {
        return {
            displayMode: "point",
            endTimeMs: Number.NaN,
            durationEstimated: false,
        };
    }

    const explicitEndTimeMs = Number(item?.endTimeMs);
    if (Number.isFinite(explicitEndTimeMs) && explicitEndTimeMs > startTimeMs) {
        return {
            displayMode: "segment",
            endTimeMs: explicitEndTimeMs,
            durationEstimated: false,
        };
    }

    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return {
            displayMode: "segment",
            endTimeMs: startTimeMs + (durationSeconds * 1000),
            durationEstimated: false,
        };
    }

    return {
        displayMode: "segment",
        endTimeMs: startTimeMs + DEFAULT_PLAYABLE_SEGMENT_DURATION_MS,
        durationEstimated: true,
    };
}

function buildMarkerHoverText(item, {
    preEphemeris = false,
    postEphemeris = false,
    endTimeMs = Number.NaN,
    durationEstimated = false,
} = {}) {
    const parts = [
        item?.title || "Media item",
        item?.cameraLabel || item?.kind || "",
    ].filter(Boolean);

    const startTimeMs = Number(item?.startTimeMs);
    if (Number.isFinite(startTimeMs) && Number.isFinite(endTimeMs) && endTimeMs > startTimeMs) {
        const durationLabel = formatDurationLabel(endTimeMs - startTimeMs);
        if (durationLabel) {
            parts.push(durationEstimated ? `Approx. ${durationLabel}` : durationLabel);
        }
    }

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
        const segmentTiming = resolveMediaSegmentTiming(item, startTimeMs);
        const endTimeMs = Number(segmentTiming.endTimeMs);
        const rangeCheckEndTimeMs = Number.isFinite(endTimeMs) ? endTimeMs : startTimeMs;
        const preEphemeris = Number.isFinite(rangeStartMs) && rangeCheckEndTimeMs < rangeStartMs;
        const postEphemeris = Number.isFinite(rangeEndMs) && startTimeMs > rangeEndMs;
        const inTimelineRange = !preEphemeris && !postEphemeris;
        const backgroundPlayback = isBackgroundPlaybackMediaItem(item);

        return {
            id: item.id,
            label: item.title,
            hoverText: buildMarkerHoverText(item, {
                preEphemeris,
                postEphemeris,
                endTimeMs,
                durationEstimated: segmentTiming.durationEstimated,
            }),
            mediaKind: item.kind,
            mediaDisplayMode: segmentTiming.displayMode,
            thumbnailAssetUrl: resolveMediaThumbnailAssetUrl(item),
            startTime: new Date(startTimeMs),
            startTimeMs,
            endTimeMs,
            durationEstimated: segmentTiming.durationEstimated,
            selected: index === activeIndex,
            clickable: inTimelineRange && !backgroundPlayback,
            preEphemeris,
            postEphemeris,
        };
    });
}

export {
    buildMediaTimelineMarkers,
};
