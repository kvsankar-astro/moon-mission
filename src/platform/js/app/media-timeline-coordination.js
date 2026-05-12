import { normalizeMissionMediaManifest } from "../core/domain/media-manifest.js";
import {
    buildMediaFilterModel,
    filterMediaItems,
    MEDIA_KIND_FILTER_IDS,
    MEDIA_SUBJECT_FILTER_IDS,
} from "../core/domain/media-filter-state.js";
import {
    resolveMediaSelectionState,
    resolveNearestMediaIndex,
} from "../core/domain/media-selection-state.js";
import { buildMediaTimelineMarkers } from "../core/domain/media-timeline-state.js";
import { createRuntimeMediaState } from "../core/state/runtime-media-state.js";
import { getMissionDataPath } from "../data/mission-data.js";
import { loadMissionMediaManifest } from "../data/mission-media.js";
import {
    formatDateTimeLocal,
    formatDateTimeUTC,
    formatDuration,
} from "../utils/time-utils.js";
import {
    createMediaBrowserPanelActions,
    MEDIA_BROWSER_PANEL_ID,
} from "./media-browser-panel.js";
import { isMissionPanelEnabled } from "./panel-defaults.js";

const MAX_THUMBNAIL_RENDER_ITEMS = 64;
const THUMBNAIL_WINDOW_EDGE_MARGIN = 8;
const AUDIO_DEFAULT_DURATION_SECONDS = 300;
const MEDIA_CLOCK_OVERRIDE_TOLERANCE_MS = 5000;
const MEDIA_EXPLICIT_FOCUS_TOLERANCE_MS = 1000;
const MEDIA_TRANSPORT_MAX_SIM_SECONDS_PER_REAL_SECOND = 4;
const MEDIA_TIME_SYNC_EPSILON_SECONDS = 0.2;
const MEDIA_SCRUB_SYNC_INTERVAL_MS = 120;
const HLS_MIME_TYPES = [
    "application/vnd.apple.mpegurl",
    "application/x-mpegURL",
];

function formatSignedDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds === 0) return "0s";
    const sign = seconds > 0 ? "+" : "-";
    return `${sign}${formatDuration(Math.abs(seconds) * 1000, { compact: true })}`;
}

function buildStageBadge(item) {
    if (!item) return "";
    const parts = [];
    if (item.kind === "audioClip") {
        parts.push("Audio");
    }
    if (item.kind === "videoClip") {
        parts.push("Video");
    }
    if (item.crewCaptured === true) {
        parts.push("Crew capture");
    }
    if (item.external === true) {
        parts.push("Exterior");
    }
    if (Number.isFinite(item.effectiveTimeOffsetSeconds) && item.effectiveTimeOffsetSeconds !== 0) {
        parts.push(`Shift ${formatSignedDuration(item.effectiveTimeOffsetSeconds)}`);
    }
    return parts.join(" • ");
}

function resolvePreviewAssetUrl(item) {
    if (!item) return "";
    if (item.kind === "audioClip") {
        return "";
    }
    if (item.kind === "videoClip") {
        return item.posterAssetUrl || item.thumbnailAssetUrl || "";
    }
    return item.assetUrl || item.thumbnailAssetUrl || item.posterAssetUrl || "";
}

function resolveThumbnailAssetUrl(item) {
    if (!item) return "";
    return item.thumbnailAssetUrl || item.posterAssetUrl || (item.kind === "audioClip" ? "" : item.assetUrl) || "";
}

function resolveThumbnailFallbackAssetUrl(item) {
    if (!item || item.kind === "audioClip") return "";
    if (item.kind === "videoClip") {
        return item.posterAssetUrl || "";
    }
    return item.assetUrl || item.posterAssetUrl || "";
}

function resolvePlayableAssetUrl(item) {
    if (!item) return "";
    if (item.kind === "videoClip" || item.kind === "audioClip") {
        return item.assetUrl || "";
    }
    return "";
}

function resolveVideoSourceType(item) {
    const explicitType = String(item?.streamSourceType || item?.settings || "")
        .trim()
        .toLowerCase();
    if (explicitType === "hls") return "hls";
    if (explicitType === "mp4") return "mp4";
    const assetUrl = String(item?.assetUrl || "").trim();
    if (/\.m3u8(?:$|[?#])/i.test(assetUrl)) return "hls";
    return "mp4";
}

function isHlsPlayableItem(item) {
    return item?.kind === "videoClip" && resolveVideoSourceType(item) === "hls";
}

function isPlayableMediaItem(item) {
    return !!resolvePlayableAssetUrl(item);
}

function resolvePlayableDurationSeconds(item, fallbackDurationSeconds = Number.NaN) {
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return durationSeconds;
    }
    const fallbackSeconds = Number(fallbackDurationSeconds);
    return Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : Number.NaN;
}

function buildSelectableMediaItems(mediaItems, audioItems) {
    return [
        ...(Array.isArray(mediaItems) ? mediaItems : []),
        ...(Array.isArray(audioItems) ? audioItems : []),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function buildTimelineMarkerItems(mediaItems, audioItems) {
    return buildSelectableMediaItems(mediaItems, audioItems);
}

function buildTimingNote(item, deltaMs) {
    if (!item) return "";
    const parts = [];
    if (item.timeSource === "captureTime+offset" && Number.isFinite(item.effectiveTimeOffsetSeconds)) {
        parts.push(`Timeline time uses the capture timestamp with a ${formatSignedDuration(item.effectiveTimeOffsetSeconds)} camera correction.`);
    }
    if (item.timeOffsetNote) {
        parts.push(item.timeOffsetNote);
    }
    if (Number.isFinite(deltaMs) && Math.abs(deltaMs) >= 60000) {
        const relation = deltaMs > 0 ? "after" : "before";
        parts.push(`Current mission time is ${formatDuration(Math.abs(deltaMs), { compact: true, includeSeconds: false })} ${relation} this item.`);
    }
    return parts.join(" ");
}

function formatSyncRateLabel(rateContext = {}) {
    if (rateContext?.realtime === true) return "1x";
    const rate = Number(rateContext?.simSecondsPerRealSecond);
    if (!Number.isFinite(rate) || rate <= 0) return "--";
    return `${rate.toFixed(rate >= 10 ? 0 : 1).replace(/\.0$/, "")}x`;
}

function findManifestMediaItemById(manifest, itemId) {
    const normalizedId = String(itemId || "").trim();
    if (!manifest || !normalizedId) return null;
    return [
        ...(manifest.mediaItems || []),
        ...(manifest.audioItems || []),
    ].find((item) => item?.id === normalizedId) || null;
}

function findMediaItemById(items, itemId) {
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId) return null;
    return (Array.isArray(items) ? items : []).find((item) => item?.id === normalizedId) || null;
}

function buildNearbyMediaItems(items, activeIndex, nearbyRadius = 3) {
    const normalizedItems = Array.isArray(items) ? items : [];
    if (activeIndex < 0 || activeIndex >= normalizedItems.length) return [];
    const radius = Math.max(0, nearbyRadius);
    const startIndex = Math.max(0, activeIndex - radius);
    const endIndex = Math.min(normalizedItems.length, activeIndex + radius + 1);
    return normalizedItems.slice(startIndex, endIndex);
}

function buildExplicitMediaFocusState({
    items,
    activeItemId,
    timeMs,
    nearbyRadius = 3,
    focusSource = "user-selection",
} = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const activeItem = findMediaItemById(normalizedItems, activeItemId);
    const activeIndex = activeItem
        ? normalizedItems.findIndex((item) => item?.id === activeItem.id)
        : -1;

    if (!activeItem || activeIndex < 0) {
        const nearestSelection = resolveMediaSelectionState({
            items: normalizedItems,
            timeMs,
            nearbyRadius,
        });
        return {
            hasItems: normalizedItems.length > 0,
            activeIndex: -1,
            activeItem: null,
            previousItem: null,
            nextItem: null,
            nearbyItems: nearestSelection.nearbyItems,
            activeDeltaMs: Number.NaN,
            focusSource: "none",
            explicit: false,
        };
    }

    return {
        hasItems: normalizedItems.length > 0,
        activeIndex,
        activeItem,
        previousItem: activeIndex > 0 ? normalizedItems[activeIndex - 1] : null,
        nextItem: activeIndex < (normalizedItems.length - 1) ? normalizedItems[activeIndex + 1] : null,
        nearbyItems: buildNearbyMediaItems(normalizedItems, activeIndex, nearbyRadius),
        activeDeltaMs: Number.isFinite(timeMs) ? timeMs - activeItem.startTimeMs : Number.NaN,
        focusSource,
        explicit: focusSource !== "time-proximity",
    };
}

function buildTimeProximityMediaFocusState({
    items,
    timeMs,
    nearbyRadius = 3,
} = {}) {
    const focusState = resolveMediaSelectionState({
        items,
        timeMs,
        nearbyRadius,
    });
    return {
        ...focusState,
        focusSource: focusState.activeItem ? "time-proximity" : "none",
        explicit: false,
    };
}

function clampIndex(index, maxIndex) {
    return Math.max(0, Math.min(maxIndex, index));
}

function buildMediaNavigationModel(items, selection = {}) {
    const count = Array.isArray(items) ? items.length : 0;
    const activeIndex = Number(selection.activeIndex);
    if (count <= 0) {
        return {
            available: false,
            previousEnabled: false,
            nextEnabled: false,
            positionLabel: "No media focused",
        };
    }
    if (!Number.isInteger(activeIndex) || activeIndex < 0) {
        return {
            available: true,
            previousEnabled: false,
            nextEnabled: true,
            positionLabel: `${count} filtered - none focused`,
            previousTitle: "Focus a filtered media item first",
            nextTitle: "Focus nearest filtered media",
        };
    }
    return {
        available: true,
        previousEnabled: activeIndex > 0,
        nextEnabled: activeIndex < (count - 1),
        positionLabel: `${activeIndex + 1} of ${count}`,
        previousTitle: "Previous filtered media",
        nextTitle: "Next filtered media",
    };
}

function buildThumbnailViewItem(item, activeItem) {
    return {
        id: item.id,
        kind: item.kind,
        active: item.id === activeItem?.id,
        title: item.title,
        thumbnailAssetUrl: resolveThumbnailAssetUrl(item),
        fallbackAssetUrl: resolveThumbnailFallbackAssetUrl(item),
        meta: [
            formatDateTimeLocal(item.startTimeMs, { includeOffset: false }),
            item.cameraLabel || (item.kind === "audioClip" ? "Audio" : ""),
        ].filter(Boolean).join(" • "),
    };
}

function resolveThumbnailWindowStart(items, selection = {}, timeMs = Number.NaN, previousStartIndex = 0) {
    const normalizedItems = Array.isArray(items) ? items : [];
    if (normalizedItems.length <= MAX_THUMBNAIL_RENDER_ITEMS) {
        return 0;
    }

    const activeIndex = Number(selection.activeIndex);
    const targetIndex = Number.isInteger(activeIndex) && activeIndex >= 0
        ? activeIndex
        : resolveNearestMediaIndex(normalizedItems, Number(timeMs));
    const clampedTargetIndex = clampIndex(
        Number.isInteger(targetIndex) ? targetIndex : 0,
        normalizedItems.length - 1,
    );
    const maxStartIndex = normalizedItems.length - MAX_THUMBNAIL_RENDER_ITEMS;
    const currentStartIndex = clampIndex(Number(previousStartIndex) || 0, maxStartIndex);
    const safeStartIndex = currentStartIndex + THUMBNAIL_WINDOW_EDGE_MARGIN;
    const safeEndIndex = currentStartIndex + MAX_THUMBNAIL_RENDER_ITEMS - THUMBNAIL_WINDOW_EDGE_MARGIN - 1;
    if (clampedTargetIndex >= safeStartIndex && clampedTargetIndex <= safeEndIndex) {
        return currentStartIndex;
    }

    const halfWindow = Math.floor(MAX_THUMBNAIL_RENDER_ITEMS / 2);
    return clampIndex(clampedTargetIndex - halfWindow, maxStartIndex);
}

function buildThumbnailViewItems(items, selection = {}, startIndex = 0) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const clampedStartIndex = normalizedItems.length > MAX_THUMBNAIL_RENDER_ITEMS
        ? clampIndex(Number(startIndex) || 0, normalizedItems.length - MAX_THUMBNAIL_RENDER_ITEMS)
        : 0;
    const windowItems = normalizedItems.slice(
        clampedStartIndex,
        clampedStartIndex + MAX_THUMBNAIL_RENDER_ITEMS,
    );
    return windowItems.map((item) => buildThumbnailViewItem(item, selection.activeItem));
}

function clampMediaCurrentTimeSeconds(item, currentTimeSeconds) {
    const nextTime = Number(currentTimeSeconds);
    if (!Number.isFinite(nextTime) || nextTime < 0) return 0;
    const fallbackDurationSeconds = item?.kind === "audioClip" ? AUDIO_DEFAULT_DURATION_SECONDS : Number.NaN;
    const durationSeconds = resolvePlayableDurationSeconds(item, fallbackDurationSeconds);
    if (Number.isFinite(durationSeconds)) {
        return Math.min(nextTime, durationSeconds);
    }
    return nextTime;
}

function dispatchDocumentCustomEvent(type, detail) {
    if (typeof document === "undefined" || typeof document.dispatchEvent !== "function") {
        return;
    }
    if (typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent(type, { detail }));
        return;
    }
    document.dispatchEvent({ type, detail });
}

function seekMainTimelineTime(timeMs, finalize = false, {
    startTimeMs = Number.NaN,
    endTimeMs = Number.NaN,
} = {}) {
    const slider = document.getElementById("timeline-slider");
    if (!(slider instanceof HTMLInputElement)) return false;
    const viewMin = Math.min(Number(slider.min), Number(slider.max));
    const viewMax = Math.max(Number(slider.min), Number(slider.max));
    if (!Number.isFinite(viewMin) || !Number.isFinite(viewMax) || !Number.isFinite(timeMs)) {
        return false;
    }
    const rangeStart = Number(startTimeMs);
    const rangeEnd = Number(endTimeMs);
    const hasFullRange = Number.isFinite(rangeStart) && Number.isFinite(rangeEnd);
    const min = hasFullRange ? Math.min(rangeStart, rangeEnd) : viewMin;
    const max = hasFullRange ? Math.max(rangeStart, rangeEnd) : viewMax;
    const clamped = Math.max(min, Math.min(max, timeMs));
    slider.value = String(Math.max(viewMin, Math.min(viewMax, clamped)));
    const dataset = slider.dataset || (slider.dataset = {});
    dataset.currentTimeMs = String(clamped);
    dataset.programmaticSeekTimeMs = String(clamped);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    if (finalize) {
        dataset.programmaticSeekTimeMs = String(clamped);
        slider.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return clamped === timeMs;
}

function readMainTimelineTimeMs() {
    const slider = document.getElementById("timeline-slider");
    const datasetTimeMs = Number(slider?.dataset?.currentTimeMs);
    if (Number.isFinite(datasetTimeMs)) {
        return datasetTimeMs;
    }
    const sliderValueMs = slider?.value === "" || slider?.value == null ? Number.NaN : Number(slider.value);
    if (Number.isFinite(sliderValueMs)) {
        return sliderValueMs;
    }
    return Number.NaN;
}

function resolvePlaybackOffsetSeconds(item, currentTimeMs, fromBeginning = false) {
    if (fromBeginning) {
        return 0;
    }
    const startTimeMs = Number(item?.startTimeMs);
    const missionTimeMs = Number(currentTimeMs);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(missionTimeMs) || missionTimeMs < startTimeMs) {
        return 0;
    }
    return clampMediaCurrentTimeSeconds(item, (missionTimeMs - startTimeMs) / 1000);
}

function createMediaTimelineCoordination({
    getStartTime = () => Number.NaN,
    getLatestEndTime = () => Number.NaN,
    getAnimationRunning = () => false,
    getIsCompareMode = () => false,
    playAnimation = () => {},
    pauseAnimation = () => {},
    getAnimationSpeedMultiplier = () => Number.NaN,
    getAnimationRealtime = () => false,
    setTimelineMediaMarkers = () => {},
} = {}) {
    const runtimeMediaState = createRuntimeMediaState();
    const panelActions = createMediaBrowserPanelActions({
        onIntent: handlePanelIntent,
    });
    let manifestPromise = null;
    let lastRenderContext = null;
    let timelineEventBound = false;
    let onTimelineMarkerSelect = null;
    let animationPlayStateEventBound = false;
    let onAnimationPlayStateUpdated = null;
    let currentAudio = null;
    let currentAudioClipId = "";
    let thumbnailWindowStartIndex = 0;
    let mediaPlaybackState = {
        itemId: "",
        kind: "",
        active: false,
        playing: false,
        buffering: false,
        startTimeMs: Number.NaN,
        syncedTimeMs: Number.NaN,
    };
    let suppressMediaEvents = false;
    let handlingAnimationPlayStateEvent = false;
    let mediaPlayRequestPending = false;
    let activeVideoHls = null;
    let activeVideoHlsItemId = "";
    let activeVideoSourceUrl = "";
    let activeVideoHlsReadyHandler = null;
    let scrubSyncState = {
        itemId: "",
        lastAppliedAtMs: 0,
    };

    function seekMissionTimelineTime(timeMs, finalize = false) {
        return seekMainTimelineTime(timeMs, finalize, {
            startTimeMs: getStartTime(),
            endTimeMs: getLatestEndTime(),
        });
    }

    function resetMediaPlaybackState() {
        mediaPlaybackState = {
            itemId: "",
            kind: "",
            active: false,
            playing: false,
            buffering: false,
            startTimeMs: Number.NaN,
            syncedTimeMs: Number.NaN,
        };
        scrubSyncState = {
            itemId: "",
            lastAppliedAtMs: 0,
        };
        mediaPlayRequestPending = false;
    }

    function destroyActiveVideoHls() {
        if (
            activeVideoHls
            && activeVideoHlsReadyHandler
            && typeof activeVideoHls.off === "function"
            && typeof globalThis.Hls?.Events?.MANIFEST_PARSED === "string"
        ) {
            try {
                activeVideoHls.off(globalThis.Hls.Events.MANIFEST_PARSED, activeVideoHlsReadyHandler);
            } catch {
                // Best-effort cleanup.
            }
        }
        if (activeVideoHls && typeof activeVideoHls.destroy === "function") {
            try {
                activeVideoHls.destroy();
            } catch {
                // Best-effort cleanup.
            }
        }
        activeVideoHls = null;
        activeVideoHlsItemId = "";
        activeVideoSourceUrl = "";
        activeVideoHlsReadyHandler = null;
    }

    function getVideoElement() {
        return globalThis.document?.getElementById?.("media-browser-video") || null;
    }

    function findCurrentManifestItemById(itemId) {
        return findManifestMediaItemById(runtimeMediaState.getManifest(), itemId);
    }

    function readCurrentMissionTimeMs() {
        const timelineTimeMs = readMainTimelineTimeMs();
        if (Number.isFinite(timelineTimeMs)) {
            return timelineTimeMs;
        }
        const renderTimeMs = Number(lastRenderContext?.animTime);
        return Number.isFinite(renderTimeMs) ? renderTimeMs : Number.NaN;
    }

    function callMediaMethod(mediaElement, methodName) {
        try {
            return mediaElement?.[methodName]?.();
        } catch {
            return null;
        }
    }

    function stopAudioPlayback() {
        if (currentAudio && typeof currentAudio.pause === "function") {
            suppressMediaEvents = true;
            callMediaMethod(currentAudio, "pause");
            suppressMediaEvents = false;
        }
        currentAudio = null;
        currentAudioClipId = "";
    }

    function stopVideoPlayback() {
        const video = getVideoElement();
        if (!video || typeof video.pause !== "function") return;
        suppressMediaEvents = true;
        callMediaMethod(video, "pause");
        suppressMediaEvents = false;
        destroyActiveVideoHls();
    }

    function stopPlayableMedia({ pauseClock = false } = {}) {
        stopAudioPlayback();
        stopVideoPlayback();
        resetMediaPlaybackState();
        if (pauseClock) {
            pauseAnimation();
        }
    }

    function pausePlayableMediaForAnimationPause() {
        if (mediaPlaybackState.playing !== true) return false;
        suppressMediaEvents = true;
        if (mediaPlaybackState.kind === "audioClip") {
            callMediaMethod(currentAudio, "pause");
        } else if (mediaPlaybackState.kind === "videoClip") {
            callMediaMethod(getVideoElement(), "pause");
        }
        suppressMediaEvents = false;
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: true,
            playing: false,
            buffering: false,
        };
        rerender();
        return true;
    }

    function pauseActivePlayableMedia() {
        if (mediaPlaybackState.playing !== true && mediaPlaybackState.buffering !== true) return false;
        suppressMediaEvents = true;
        if (mediaPlaybackState.kind === "audioClip") {
            callMediaMethod(currentAudio, "pause");
        } else if (mediaPlaybackState.kind === "videoClip") {
            callMediaMethod(getVideoElement(), "pause");
        }
        suppressMediaEvents = false;
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: true,
            playing: false,
            buffering: false,
        };
        pauseAnimation();
        rerender();
        return true;
    }

    function syncMissionTimeToMediaOffset(item, currentTimeSeconds = 0, finalize = false) {
        if (!item || !Number.isFinite(item.startTimeMs)) return Number.NaN;
        const offsetSeconds = clampMediaCurrentTimeSeconds(item, currentTimeSeconds);
        const timelineTimeMs = item.startTimeMs + offsetSeconds * 1000;
        seekMissionTimelineTime(timelineTimeMs, finalize);
        return timelineTimeMs;
    }

    function primePlayableMediaState(item, {
        playing = false,
        syncedTimeMs = Number.NaN,
    } = {}) {
        if (!item || !isPlayableMediaItem(item)) return false;
        runtimeMediaState.setActiveItemId(item.id, {
            anchorTimeMs: item.startTimeMs,
        });
        mediaPlaybackState = {
            itemId: item.id,
            kind: item.kind,
            active: true,
            playing: playing === true,
            buffering: playing !== true,
            startTimeMs: item.startTimeMs,
            syncedTimeMs: Number.isFinite(syncedTimeMs) ? syncedTimeMs : item.startTimeMs,
        };
        return true;
    }

    function handlePlayableMediaStarted(itemId, kind, currentTimeSeconds = 0) {
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId) return;
        mediaPlayRequestPending = false;
        const item = findCurrentManifestItemById(normalizedId);
        if (!item || !isPlayableMediaItem(item)) return;
        const timelineTimeMs = syncMissionTimeToMediaOffset(item, Number(currentTimeSeconds) || 0, false);
        runtimeMediaState.setActiveItemId(item.id, {
            anchorTimeMs: item.startTimeMs,
        });
        mediaPlaybackState = {
            itemId: item.id,
            kind: kind || item.kind,
            active: true,
            playing: true,
            buffering: false,
            startTimeMs: item.startTimeMs,
            syncedTimeMs: Number.isFinite(timelineTimeMs) ? timelineTimeMs : item.startTimeMs,
        };
        if (getAnimationRunning() !== true) {
            playAnimation();
        }
        rerender();
    }

    function handlePlayableMediaPaused(itemId) {
        if (suppressMediaEvents) return;
        if (mediaPlayRequestPending === true) return;
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId || normalizedId !== mediaPlaybackState.itemId) return;
        if (mediaPlaybackState.buffering === true) return;
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: true,
            playing: false,
            buffering: false,
        };
        pauseAnimation();
        rerender();
    }

    function handlePlayableMediaEnded(itemId) {
        if (suppressMediaEvents) return;
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId || normalizedId !== mediaPlaybackState.itemId) return;
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: false,
            playing: false,
            buffering: false,
        };
        pauseAnimation();
        rerender();
    }

    function handlePlayableMediaFailed(itemId, mediaElement = null) {
        if (suppressMediaEvents) return;
        const normalizedId = String(itemId || "").trim();
        if (normalizedId && normalizedId !== mediaPlaybackState.itemId) return;
        if (mediaElement && mediaElement === currentAudio) {
            currentAudio = null;
            currentAudioClipId = "";
        }
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: false,
            playing: false,
            buffering: false,
        };
        pauseAnimation();
        rerender();
    }

    function handlePlayableMediaBuffering(itemId, currentTimeSeconds = 0) {
        if (suppressMediaEvents) return;
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId || normalizedId !== mediaPlaybackState.itemId) return;
        const mediaItem = findCurrentManifestItemById(normalizedId) || mediaPlaybackState;
        const syncedTimeMs = syncMissionTimeToMediaOffset(mediaItem, Number(currentTimeSeconds) || 0, false);
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: true,
            playing: false,
            buffering: true,
            syncedTimeMs: Number.isFinite(syncedTimeMs) ? syncedTimeMs : mediaPlaybackState.syncedTimeMs,
        };
        if (!isHlsPlayableItem(mediaItem)) {
            pauseAnimation();
        }
        rerender();
    }

    function syncMissionTimeFromMedia(itemId, currentTimeSeconds) {
        const normalizedId = String(itemId || "").trim();
        if (
            !normalizedId
            || normalizedId !== mediaPlaybackState.itemId
            || mediaPlaybackState.playing !== true
            || !Number.isFinite(mediaPlaybackState.startTimeMs)
        ) {
            return;
        }
        const mediaSeconds = Number(currentTimeSeconds);
        if (!Number.isFinite(mediaSeconds) || mediaSeconds < 0) return;
        const nextTimeMs = mediaPlaybackState.startTimeMs + (mediaSeconds * 1000);
        const currentTimelineTimeMs = readMainTimelineTimeMs();
        const previousSyncedTimeMs = Number(mediaPlaybackState.syncedTimeMs);
        const mediaItem = findCurrentManifestItemById(mediaPlaybackState.itemId) || mediaPlaybackState;
        if (
            Number.isFinite(currentTimelineTimeMs)
            && Number.isFinite(previousSyncedTimeMs)
            && Math.abs(currentTimelineTimeMs - previousSyncedTimeMs) > MEDIA_CLOCK_OVERRIDE_TOLERANCE_MS
        ) {
            // Timeline jumps (e.g. frame-and-shoot +/- step controls) should
            // force media to follow mission time instead of dropping playback state.
            syncActivePlayableMediaToMissionTime(mediaItem, currentTimelineTimeMs);
            mediaPlaybackState = {
                ...mediaPlaybackState,
                active: true,
                buffering: false,
                syncedTimeMs: currentTimelineTimeMs,
            };
            rerender();
            return;
        }
        const syncedTimeMs = syncMissionTimeToMediaOffset(mediaItem, mediaSeconds, false);
        mediaPlaybackState = {
            ...mediaPlaybackState,
            syncedTimeMs: Number.isFinite(syncedTimeMs) ? syncedTimeMs : nextTimeMs,
        };
    }

    function attachAudioPlaybackEvents(audio, item) {
        if (!audio || typeof audio.addEventListener !== "function" || !item) return;
        audio.addEventListener("playing", () => handlePlayableMediaStarted(item.id, "audioClip", Number(audio.currentTime)));
        audio.addEventListener("pause", () => {
            if (audio.ended === true) return;
            handlePlayableMediaPaused(item.id);
        });
        audio.addEventListener("ended", () => handlePlayableMediaEnded(item.id));
        audio.addEventListener("timeupdate", () => {
            syncMissionTimeFromMedia(item.id, Number(audio.currentTime));
        });
        for (const eventName of ["waiting", "stalled"]) {
            audio.addEventListener(eventName, () => {
                handlePlayableMediaBuffering(item.id, Number(audio.currentTime));
            });
        }
        for (const eventName of ["abort", "error"]) {
            audio.addEventListener(eventName, () => {
                handlePlayableMediaFailed(item.id, audio);
            });
        }
    }

    function setMediaElementCurrentTime(mediaElement, seconds) {
        if (!mediaElement || !Number.isFinite(seconds)) return;
        try {
            mediaElement.currentTime = Math.max(0, seconds);
        } catch {
            // Media metadata may not be loaded yet; the play event will still align from the start.
        }
    }

    function isAbortLikeMediaPlayError(error) {
        const name = String(error?.name || "").toLowerCase();
        if (name === "aborterror") return true;
        const message = String(error?.message || "").toLowerCase();
        return message.includes("aborted");
    }

    function canVideoElementPlayHls(video) {
        if (!video || typeof video.canPlayType !== "function") return false;
        return HLS_MIME_TYPES.some((mimeType) => {
            const verdict = String(video.canPlayType(mimeType) || "").toLowerCase();
            return verdict === "probably" || verdict === "maybe";
        });
    }

    function ensureVideoPlaybackSource(video, item) {
        if (!video || !item || item.kind !== "videoClip") {
            return {
                readyForImmediatePlay: true,
            };
        }
        const sourceType = resolveVideoSourceType(item);
        const sourceUrl = resolvePlayableAssetUrl(item);
        if (!sourceUrl) {
            return {
                readyForImmediatePlay: true,
            };
        }

        if (sourceType !== "hls") {
            destroyActiveVideoHls();
            if (video.getAttribute?.("src") !== sourceUrl) {
                video.src = sourceUrl;
                callMediaMethod(video, "load");
            }
            return {
                readyForImmediatePlay: true,
            };
        }

        const HlsCtor = globalThis.Hls;
        if (canVideoElementPlayHls(video) || !HlsCtor || typeof HlsCtor.isSupported !== "function" || HlsCtor.isSupported() !== true) {
            destroyActiveVideoHls();
            if (video.getAttribute?.("src") !== sourceUrl) {
                video.src = sourceUrl;
                callMediaMethod(video, "load");
            }
            return {
                readyForImmediatePlay: true,
            };
        }

        const needsHlsInit = (
            !activeVideoHls
            || activeVideoHlsItemId !== item.id
            || activeVideoSourceUrl !== sourceUrl
        );
        if (!needsHlsInit) {
            return {
                readyForImmediatePlay: true,
            };
        }

        destroyActiveVideoHls();
        const hls = new HlsCtor({
            autoStartLoad: true,
        });
        const manifestParsedEventName = HlsCtor?.Events?.MANIFEST_PARSED;
        if (manifestParsedEventName && typeof hls.on === "function") {
            activeVideoHlsReadyHandler = () => {
                if (mediaPlaybackState.itemId !== item.id || mediaPlaybackState.active !== true) return;
                if (video.paused !== true || mediaPlayRequestPending === true) return;
                playMediaElement(video, item.id, "videoClip");
            };
            hls.on(manifestParsedEventName, activeVideoHlsReadyHandler);
        }
        hls.attachMedia(video);
        hls.loadSource(sourceUrl);
        activeVideoHls = hls;
        activeVideoHlsItemId = item.id;
        activeVideoSourceUrl = sourceUrl;
        return {
            readyForImmediatePlay: false,
        };
    }

    function getAnimationRateContext() {
        const realtime = getAnimationRealtime() === true;
        const configuredMultiplier = Number(getAnimationSpeedMultiplier());
        const simSecondsPerRealSecond = realtime
            ? 1
            : (Number.isFinite(configuredMultiplier) && configuredMultiplier > 0
                ? configuredMultiplier
                : Number.NaN);
        return {
            realtime,
            simSecondsPerRealSecond,
        };
    }

    function shouldUseTransportPlayback() {
        const rateContext = getAnimationRateContext();
        if (rateContext.realtime) return true;
        return Number.isFinite(rateContext.simSecondsPerRealSecond)
            && rateContext.simSecondsPerRealSecond <= MEDIA_TRANSPORT_MAX_SIM_SECONDS_PER_REAL_SECOND;
    }

    function playMediaElement(mediaElement, itemId = "", kind = "") {
        mediaPlayRequestPending = true;
        try {
            const playResult = mediaElement?.play?.();
            if (playResult && typeof playResult.then === "function") {
                Promise.resolve(playResult).then(() => {
                    mediaPlayRequestPending = false;
                    if (mediaPlaybackState.itemId !== itemId || mediaPlaybackState.playing === true) return;
                    if (mediaElement?.paused === true) return;
                    handlePlayableMediaStarted(itemId, kind, Number(mediaElement?.currentTime) || 0);
                }).catch((error) => {
                    mediaPlayRequestPending = false;
                    if (isAbortLikeMediaPlayError(error)) {
                        return;
                    }
                    handlePlayableMediaFailed(itemId, mediaElement);
                });
                return;
            }
            mediaPlayRequestPending = false;
        } catch {
            mediaPlayRequestPending = false;
            handlePlayableMediaFailed(itemId, mediaElement);
        }
    }

    function startPlayableMediaItem(item, {
        fromBeginning = true,
        seekTimeline = true,
        keepAnimationRunning = false,
    } = {}) {
        if (!isPlayableMediaItem(item)) return false;
        const offsetSeconds = resolvePlaybackOffsetSeconds(item, readCurrentMissionTimeMs(), fromBeginning);
        const timelineTimeMs = item.startTimeMs + offsetSeconds * 1000;

        stopPlayableMedia({ pauseClock: false });
        primePlayableMediaState(item, {
            playing: false,
            syncedTimeMs: timelineTimeMs,
        });

        if (seekTimeline) {
            seekMissionTimelineTime(timelineTimeMs, true);
        }

        if (keepAnimationRunning !== true) {
            pauseAnimation();
        }
        rerender();

        if (item.kind === "audioClip") {
            if (typeof globalThis.Audio !== "function") {
                handlePlayableMediaStarted(item.id, "audioClip");
                return true;
            }
            currentAudio = new globalThis.Audio(item.assetUrl);
            currentAudio.volume = 0.7;
            currentAudioClipId = item.id;
            attachAudioPlaybackEvents(currentAudio, item);
            setMediaElementCurrentTime(currentAudio, offsetSeconds);
            playMediaElement(currentAudio, item.id, "audioClip");
            return true;
        }

        if (item.kind === "videoClip") {
            const video = getVideoElement();
            if (!video) {
                handlePlayableMediaStarted(item.id, "videoClip");
                return true;
            }
            if (item.posterAssetUrl) {
                video.poster = item.posterAssetUrl;
            }
            const sourceSetup = ensureVideoPlaybackSource(video, item);
            if (video.dataset) {
                video.dataset.mediaItemId = item.id;
            }
            setMediaElementCurrentTime(video, offsetSeconds);
            if (sourceSetup?.readyForImmediatePlay !== false) {
                playMediaElement(video, item.id, "videoClip");
            }
            return true;
        }

        return false;
    }

    function startFocusedPlayableMediaFromMissionTime() {
        if (mediaPlaybackState.playing === true) return false;
        const activeItem = getCurrentFocusedMediaItem();
        if (!activeItem || !isPlayableMediaItem(activeItem)) return false;
        return startPlayableMediaItem(activeItem, {
            fromBeginning: false,
            seekTimeline: true,
        });
    }

    function getActivePlayableMediaElement() {
        if (mediaPlaybackState.kind === "videoClip") {
            return getVideoElement();
        }
        if (mediaPlaybackState.kind === "audioClip") {
            return currentAudio;
        }
        return null;
    }

    function pauseMediaElementSilently(mediaElement) {
        if (!mediaElement || typeof mediaElement.pause !== "function") return;
        suppressMediaEvents = true;
        callMediaMethod(mediaElement, "pause");
        suppressMediaEvents = false;
    }

    function syncActivePlayableMediaToMissionTime(item, missionTimeMs) {
        if (!item || !isPlayableMediaItem(item) || !Number.isFinite(missionTimeMs)) return;
        if (mediaPlaybackState.itemId !== item.id || mediaPlaybackState.active !== true) return;
        if (mediaPlaybackState.buffering === true && isHlsPlayableItem(item)) {
            return;
        }
        const mediaElement = getActivePlayableMediaElement();
        if (!mediaElement) return;

        const targetSeconds = resolvePlaybackOffsetSeconds(item, missionTimeMs, false);
        const currentSeconds = Number(mediaElement.currentTime);
        const nowMs = Date.now();
        const transportMode = shouldUseTransportPlayback();
        const animationRunning = getAnimationRunning() === true;

        if (transportMode && animationRunning) {
            scrubSyncState.itemId = item.id;
            scrubSyncState.lastAppliedAtMs = nowMs;

            if (Number.isFinite(currentSeconds) && Math.abs(currentSeconds - targetSeconds) > 1.5) {
                setMediaElementCurrentTime(mediaElement, targetSeconds);
            }
            if (mediaElement.paused === true && mediaPlayRequestPending !== true) {
                playMediaElement(mediaElement, item.id, item.kind);
            }
            return;
        }

        pauseMediaElementSilently(mediaElement);
        if (
            scrubSyncState.itemId !== item.id
            || !Number.isFinite(scrubSyncState.lastAppliedAtMs)
            || (nowMs - scrubSyncState.lastAppliedAtMs) >= MEDIA_SCRUB_SYNC_INTERVAL_MS
            || !Number.isFinite(currentSeconds)
            || Math.abs(currentSeconds - targetSeconds) >= MEDIA_TIME_SYNC_EPSILON_SECONDS
        ) {
            setMediaElementCurrentTime(mediaElement, targetSeconds);
            scrubSyncState = {
                itemId: item.id,
                lastAppliedAtMs: nowMs,
            };
        }
        mediaPlaybackState = {
            ...mediaPlaybackState,
            active: true,
            playing: false,
            buffering: false,
            syncedTimeMs: item.startTimeMs + targetSeconds * 1000,
        };
    }

    function forceResyncActiveMedia() {
        const activePlaybackItem = findCurrentManifestItemById(mediaPlaybackState.itemId);
        const focusedItem = getCurrentFocusedMediaItem();
        const targetItem = (activePlaybackItem && isPlayableMediaItem(activePlaybackItem))
            ? activePlaybackItem
            : ((focusedItem && isPlayableMediaItem(focusedItem)) ? focusedItem : null);
        if (!targetItem) return false;

        const missionTimeMs = readCurrentMissionTimeMs();
        const animationRunning = getAnimationRunning() === true;
        const hasActiveTarget = mediaPlaybackState.itemId === targetItem.id && mediaPlaybackState.active === true;

        if (!hasActiveTarget) {
            startPlayableMediaItem(targetItem, {
                fromBeginning: false,
                seekTimeline: false,
                keepAnimationRunning: true,
            });
        }

        syncActivePlayableMediaToMissionTime(targetItem, missionTimeMs);

        if (!animationRunning) {
            const mediaElement = getActivePlayableMediaElement();
            const targetSeconds = resolvePlaybackOffsetSeconds(targetItem, missionTimeMs, false);
            pauseMediaElementSilently(mediaElement);
            setMediaElementCurrentTime(mediaElement, targetSeconds);
            mediaPlaybackState = {
                itemId: targetItem.id,
                kind: targetItem.kind,
                active: true,
                playing: false,
                buffering: false,
                startTimeMs: targetItem.startTimeMs,
                syncedTimeMs: targetItem.startTimeMs + targetSeconds * 1000,
            };
        }

        rerender();
        return true;
    }

    function isMediaBrowserEnabled(globalConfig) {
        return isMissionPanelEnabled(globalConfig, MEDIA_BROWSER_PANEL_ID, {
            fallbackEnabled: false,
        });
    }

    function ensureTimelineEventBinding() {
        if (timelineEventBound) return;
        if (typeof document?.addEventListener !== "function") return;
        timelineEventBound = true;
        onTimelineMarkerSelect = (event) => {
            panelActions.setPanelState?.("open");
            handlePanelIntent({
                type: "selectItem",
                value: event?.detail?.marker?.id || "",
            });
        };
        document.addEventListener("mission-media-marker-select", onTimelineMarkerSelect);
    }

    function ensureAnimationPlayStateBinding() {
        if (animationPlayStateEventBound) return;
        if (typeof document?.addEventListener !== "function") return;
        animationPlayStateEventBound = true;
        onAnimationPlayStateUpdated = (event) => {
            if (handlingAnimationPlayStateEvent) return;
            handlingAnimationPlayStateEvent = true;
            try {
                const isPlaying = event?.detail?.isPlaying === true;
                if (isPlaying) {
                    if (mediaPlaybackState.active === true) {
                        const activePlaybackItem = findCurrentManifestItemById(mediaPlaybackState.itemId);
                        const missionTimeMs = readCurrentMissionTimeMs();
                        syncActivePlayableMediaToMissionTime(activePlaybackItem, missionTimeMs);
                        return;
                    }
                    const selectableItems = getFilteredSelectableItems();
                    const focusState = buildCurrentMediaFocusState(
                        selectableItems,
                        readCurrentMissionTimeMs(),
                    );
                    const activeItem = focusState?.activeItem;
                    const explicitSelection = focusState?.focusSource === "user-selection";
                    if (!explicitSelection || !activeItem || !isPlayableMediaItem(activeItem)) {
                        return;
                    }
                    startPlayableMediaItem(activeItem, {
                        fromBeginning: false,
                        seekTimeline: true,
                        keepAnimationRunning: true,
                    });
                    return;
                }
                pausePlayableMediaForAnimationPause();
            } finally {
                handlingAnimationPlayStateEvent = false;
            }
        };
        document.addEventListener("animation-play-state-updated", onAnimationPlayStateUpdated);
    }

    function releaseTimelineEventBinding() {
        if (timelineEventBound && onTimelineMarkerSelect && typeof document?.removeEventListener === "function") {
            document.removeEventListener("mission-media-marker-select", onTimelineMarkerSelect);
        }
        timelineEventBound = false;
        onTimelineMarkerSelect = null;
    }

    function releaseAnimationPlayStateBinding() {
        if (
            animationPlayStateEventBound
            && onAnimationPlayStateUpdated
            && typeof document?.removeEventListener === "function"
        ) {
            document.removeEventListener("animation-play-state-updated", onAnimationPlayStateUpdated);
        }
        animationPlayStateEventBound = false;
        onAnimationPlayStateUpdated = null;
    }

    async function ensureManifestLoaded() {
        const loadState = runtimeMediaState.getLoadState();
        if (loadState === "ready" || loadState === "unavailable") {
            return runtimeMediaState.getManifest();
        }
        if (manifestPromise) {
            return manifestPromise;
        }

        runtimeMediaState.setLoadState("loading");
        manifestPromise = loadMissionMediaManifest()
            .then((manifestData) => {
                if (!manifestData) {
                    runtimeMediaState.setManifest(null);
                    runtimeMediaState.setLoadState("unavailable");
                    return null;
                }
                const normalizedManifest = normalizeMissionMediaManifest(manifestData, {
                    dataPath: getMissionDataPath() || "",
                });
                runtimeMediaState.setManifest(normalizedManifest);
                runtimeMediaState.setLoadState("ready");
                return normalizedManifest;
            })
            .catch(() => {
                runtimeMediaState.setManifest(null);
                runtimeMediaState.setLoadState("unavailable");
                return null;
            })
            .finally(() => {
                manifestPromise = null;
            });

        return manifestPromise;
    }

    function rerender() {
        if (!lastRenderContext) return;
        update(lastRenderContext);
    }

    function getFilteredSelectableItems() {
        const manifest = runtimeMediaState.getManifest();
        if (!manifest) return [];
        const filters = runtimeMediaState.getFilters();
        return buildSelectableMediaItems(
            filterMediaItems(manifest.mediaItems || [], filters),
            filterMediaItems(manifest.audioItems || [], filters),
        );
    }

    function getPlaybackFocusItemId() {
        return mediaPlaybackState.active === true || mediaPlaybackState.playing === true || mediaPlaybackState.buffering === true
            ? mediaPlaybackState.itemId
            : "";
    }

    function isExplicitFocusCurrent(timeMs) {
        const anchorTimeMs = Number(runtimeMediaState.getActiveItemAnchorTimeMs?.());
        if (!Number.isFinite(anchorTimeMs) || !Number.isFinite(Number(timeMs))) return true;
        return Math.abs(Number(timeMs) - anchorTimeMs) <= MEDIA_EXPLICIT_FOCUS_TOLERANCE_MS;
    }

    function buildCurrentMediaFocusState(items, timeMs) {
        const selectableItems = Array.isArray(items) ? items : getFilteredSelectableItems();
        const playbackItemId = getPlaybackFocusItemId();
        if (playbackItemId) {
            const playbackFocus = buildExplicitMediaFocusState({
                items: selectableItems,
                activeItemId: playbackItemId,
                timeMs,
                nearbyRadius: 3,
                focusSource: "media-playback",
            });
            if (playbackFocus.activeItem) {
                return playbackFocus;
            }
        }

        const activeItemId = runtimeMediaState.getActiveItemId();
        if (activeItemId && isExplicitFocusCurrent(timeMs)) {
            const explicitFocus = buildExplicitMediaFocusState({
                items: selectableItems,
                activeItemId,
                timeMs,
                nearbyRadius: 3,
                focusSource: "user-selection",
            });
            if (explicitFocus.activeItem) {
                return explicitFocus;
            }
        }

        if (activeItemId) {
            runtimeMediaState.setActiveItemId("");
        }
        return buildTimeProximityMediaFocusState({
            items: selectableItems,
            timeMs,
            nearbyRadius: 3,
        });
    }

    function getCurrentFocusedMediaItem() {
        return buildCurrentMediaFocusState(
            getFilteredSelectableItems(),
            Number(lastRenderContext?.animTime),
        ).activeItem;
    }

    function previewMediaItem(item, {
        seekTimeline = true,
    } = {}) {
        if (!item) return false;
        dispatchDocumentCustomEvent("mission-media-item-select", {
            item,
        });
        stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
        if (!seekTimeline) {
            runtimeMediaState.setActiveItemId(item.id, {
                anchorTimeMs: readCurrentMissionTimeMs(),
            });
            rerender();
            return true;
        }
        seekMissionTimelineTime(item.startTimeMs, true);
        const anchorTimeMs = readCurrentMissionTimeMs();
        runtimeMediaState.setActiveItemId(item.id, {
            anchorTimeMs: Number.isFinite(anchorTimeMs) ? anchorTimeMs : item.startTimeMs,
        });
        if (Number.isFinite(anchorTimeMs) && lastRenderContext) {
            lastRenderContext = {
                ...lastRenderContext,
                animTime: anchorTimeMs,
            };
        }
        rerender();
        return true;
    }

    function handlePanelIntent(intent) {
        const type = String(intent?.type || "").trim();
        if (!type) return;

        if (type === "setAudienceFilter") {
            const value = String(intent.value || "").trim();
            runtimeMediaState.patchFilters({
                quick: "all",
                subjects: value === "crew"
                    ? ["crew"]
                    : (value === "external" ? ["space"] : []),
                cameraIds: [],
                cameraId: "all",
            });
            rerender();
            return;
        }
        if (type === "setCameraFilter") {
            const value = String(intent.value || "").trim();
            runtimeMediaState.patchFilters({
                quick: "all",
                cameraIds: value && value !== "all" ? [value] : [],
                cameraId: value || "all",
            });
            rerender();
            return;
        }
        if (type === "setQuickFilter") {
            const value = String(intent.value || "").trim();
            const mediaKinds = value === "videos"
                ? ["videoClip"]
                : (value === "all" ? [...MEDIA_KIND_FILTER_IDS] : undefined);
            const subject = value === "crew" || value === "new"
                ? "crew"
                : (value === "exterior" || value === "external" || value === "space" ? "space" : "");
            const subjectPatch = subject
                ? { subjects: [subject] }
                : (value === "all" ? { subjects: [] } : {});
            runtimeMediaState.patchFilters({
                quick: value === "space" || subject ? value : "all",
                cameraIds: [],
                cameraId: "all",
                ...(mediaKinds ? { mediaKinds } : {}),
                ...subjectPatch,
            });
            rerender();
            return;
        }
        if (type === "toggleSubject") {
            const value = String(intent.value || "").trim();
            if (value === "all") {
                runtimeMediaState.patchFilters({
                    quick: "all",
                    subjects: [],
                });
                rerender();
                return;
            }
            if (!MEDIA_SUBJECT_FILTER_IDS.includes(value)) return;
            const filters = runtimeMediaState.getFilters();
            const active = new Set(filters.subjects || []);
            if (active.has(value)) {
                active.delete(value);
            } else {
                active.add(value);
            }
            runtimeMediaState.patchFilters({
                quick: "all",
                subjects: MEDIA_SUBJECT_FILTER_IDS.filter((subjectId) => active.has(subjectId)),
            });
            rerender();
            return;
        }
        if (type === "toggleMediaKind") {
            const value = String(intent.value || "").trim();
            const filters = runtimeMediaState.getFilters();
            if (value === "all") {
                runtimeMediaState.patchFilters({
                    quick: "all",
                    kind: "all",
                    mediaKinds: [...MEDIA_KIND_FILTER_IDS],
                });
                rerender();
                return;
            }
            if (!MEDIA_KIND_FILTER_IDS.includes(value)) return;
            const active = new Set(filters.mediaKinds || MEDIA_KIND_FILTER_IDS);
            const currentlyUnrestricted = MEDIA_KIND_FILTER_IDS.every((kindId) => active.has(kindId));
            if (currentlyUnrestricted) {
                active.clear();
                active.add(value);
            } else if (active.has(value)) {
                active.delete(value);
            } else {
                active.add(value);
            }
            const selectedKinds = MEDIA_KIND_FILTER_IDS.filter((kindId) => active.has(kindId));
            const mediaKinds = selectedKinds.length === 0 || selectedKinds.length === MEDIA_KIND_FILTER_IDS.length
                ? [...MEDIA_KIND_FILTER_IDS]
                : selectedKinds;
            runtimeMediaState.patchFilters({
                quick: filters.quick === "videos" ? "all" : filters.quick,
                kind: "all",
                mediaKinds,
            });
            if (!mediaKinds.includes("audioClip") && mediaPlaybackState.kind === "audioClip") {
                stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
            }
            rerender();
            return;
        }
        if (type === "toggleCameraFilter") {
            const value = String(intent.value || "").trim();
            if (!value) return;
            if (value === "all") {
                runtimeMediaState.patchFilters({
                    quick: "all",
                    cameraIds: [],
                    cameraId: "all",
                });
                rerender();
                return;
            }
            const filters = runtimeMediaState.getFilters();
            const active = new Set(filters.cameraIds || []);
            if (active.has(value)) {
                active.delete(value);
            } else {
                active.add(value);
            }
            const cameraIds = [...active];
            runtimeMediaState.patchFilters({
                quick: "all",
                cameraIds,
                cameraId: cameraIds.length === 1 ? cameraIds[0] : "all",
            });
            rerender();
            return;
        }
        if (type === "selectItem") {
            const selectableItems = getFilteredSelectableItems();
            const selectedItem = selectableItems.find((item) => item.id === intent.value) || null;
            if (!selectedItem) return;
            previewMediaItem(selectedItem);
            return;
        }
        if (type === "selectAdjacentItem") {
            const direction = String(intent.value || "").trim() === "previous" ? -1 : 1;
            const selectableItems = getFilteredSelectableItems();
            if (selectableItems.length === 0) {
                runtimeMediaState.setActiveItemId("");
                rerender();
                return;
            }
            const currentFocus = buildCurrentMediaFocusState(
                selectableItems,
                Number(lastRenderContext?.animTime),
            );
            const focusedIndex = Number(currentFocus.activeIndex);
            const targetIndex = Number.isInteger(focusedIndex) && focusedIndex >= 0
                ? clampIndex(focusedIndex + direction, selectableItems.length - 1)
                : resolveNearestMediaIndex(selectableItems, Number(lastRenderContext?.animTime));
            previewMediaItem(selectableItems[targetIndex] || selectableItems[0]);
            return;
        }
        if (type === "previewItem") {
            const selectableItems = getFilteredSelectableItems();
            const selectedItem = selectableItems.find((item) => item.id === intent.value) || null;
            previewMediaItem(selectedItem);
            return;
        }
        if (type === "toggleActiveMediaPlayback") {
            if (mediaPlaybackState.playing === true || mediaPlaybackState.buffering === true) {
                pauseActivePlayableMedia();
                return;
            }
            startFocusedPlayableMediaFromMissionTime();
            return;
        }
        if (type === "startActiveMedia" || type === "startActiveMediaFromBeginning") {
            const activeItem = getCurrentFocusedMediaItem();
            if (!activeItem || !isPlayableMediaItem(activeItem)) return;
            startPlayableMediaItem(activeItem, {
                fromBeginning: type === "startActiveMediaFromBeginning",
                seekTimeline: true,
            });
            return;
        }
        if (type === "forceResyncActiveMedia") {
            forceResyncActiveMedia();
            return;
        }
        if (type === "mediaPlaybackStarted") {
            handlePlayableMediaStarted(intent.value, intent.mediaKind, intent.currentTime);
            return;
        }
        if (type === "mediaPlaybackBuffering") {
            handlePlayableMediaBuffering(intent.value, intent.currentTime);
            return;
        }
        if (type === "mediaPlaybackPaused") {
            handlePlayableMediaPaused(intent.value);
            return;
        }
        if (type === "mediaPlaybackEnded") {
            handlePlayableMediaEnded(intent.value);
            return;
        }
        if (type === "mediaPlaybackTimeUpdate") {
            syncMissionTimeFromMedia(intent.value, intent.currentTime);
        }
    }

    function buildPanelViewModel({
        manifest,
        items,
        selectionItems,
        selection,
        timeMs,
    }) {
        const activeItem = selection.activeItem;
        const filterModel = buildMediaFilterModel(
            buildSelectableMediaItems(manifest.mediaItems, manifest.audioItems || []),
            runtimeMediaState.getFilters(),
        );
        const seedNote = String(manifest?.ui?.seedNote || "").trim();
        const navigationModel = buildMediaNavigationModel(selectionItems, selection);
        thumbnailWindowStartIndex = resolveThumbnailWindowStart(
            selectionItems,
            selection,
            timeMs,
            thumbnailWindowStartIndex,
        );
        const statusText = items.length === 0
            ? "No media matches the current filters."
            : "";
        const activePlayable = isPlayableMediaItem(activeItem);
        const activePlaybackSelected = activeItem?.id === mediaPlaybackState.itemId;
        const activePlaybackPlaying = activePlaybackSelected && mediaPlaybackState.playing === true;
        const activePlaybackBuffering = activePlaybackSelected && mediaPlaybackState.buffering === true;
        const activeMediaKindLabel = activeItem?.kind === "videoClip"
            ? "Video"
            : (activeItem?.kind === "audioClip" ? "Audio" : "Media");
        const animationRunning = getAnimationRunning() === true;
        const rateContext = getAnimationRateContext();
        const syncRateLabel = formatSyncRateLabel(rateContext);
        const transportMode = shouldUseTransportPlayback();
        const syncModeLabel = transportMode ? "transport" : "timeline";
        const activeMediaStatus = activePlaybackBuffering
            ? `${activeMediaKindLabel} buffering`
            : (!animationRunning
                ? `${activeMediaKindLabel} paused (${syncRateLabel})`
                : (transportMode
                    ? (activePlaybackPlaying
                        ? `${activeMediaKindLabel} playing (${syncRateLabel})`
                        : `${activeMediaKindLabel} ready (${syncRateLabel})`)
                    : `${activeMediaKindLabel} ${syncModeLabel}-synced (${syncRateLabel})`));
        const stageEmptyText = items.length === 0
            ? "No media matches the current filters."
            : (activeItem
                ? "No preview available for this media item."
                : "Select a filtered media item to preview.");

        return {
            panelTitle: String(manifest?.ui?.panelTitle || manifest?.title || "Mission Media").trim(),
            mediaCountLabel: String(items.length),
            descriptionEmptyText: items.length === 0
                ? "No media matches the current filters."
                : "--",
            stageEmptyText,
            seedNote,
            statusText,
            filterModel,
            playbackModel: {
                playable: activePlayable,
                playing: activePlaybackPlaying,
                buffering: activePlaybackBuffering,
                showControls: activePlayable,
                playTitle: activePlaybackPlaying || activePlaybackBuffering
                    ? "Pause media playback"
                    : "Play focused media from the current mission time",
                restartTitle: "Restart media from beginning",
                resyncTitle: "Force resync media with animation",
                statusLabel: activePlayable ? activeMediaStatus : "",
            },
            navigationModel,
            focusSource: selection.focusSource || "none",
            activeItem: activeItem
                ? {
                    id: activeItem.id,
                    kind: activeItem.kind,
                    focusSource: selection.focusSource || "none",
                    explicit: selection.explicit === true,
                    title: activeItem.title,
                    description: activeItem.description,
                    assetUrl: resolvePreviewAssetUrl(activeItem),
                    videoAssetUrl: activeItem.kind === "videoClip" ? resolvePlayableAssetUrl(activeItem) : "",
                    videoSourceType: activeItem.kind === "videoClip" ? resolveVideoSourceType(activeItem) : "",
                    posterAssetUrl: activeItem.posterAssetUrl || "",
                    playable: activePlayable,
                    timeLabel: `${formatDateTimeLocal(activeItem.startTimeMs, { includeOffset: false })} • ${formatDateTimeUTC(activeItem.startTimeMs)}`,
                    cameraLabel: activeItem.cameraLabel || (activeItem.kind === "audioClip" ? "Audio" : ""),
                    photographer: activeItem.photographer,
                    location: activeItem.location,
                    sourceLabel: activeItem.sourceLabel || activeItem.fileName,
                    stageBadge: buildStageBadge(activeItem),
                    timingNote: buildTimingNote(activeItem, selection.activeDeltaMs),
                }
                : null,
            thumbnailItems: buildThumbnailViewItems(selectionItems, selection, thumbnailWindowStartIndex),
            currentTimeMs: timeMs,
        };
    }

    function clearUi(globalConfig, {
        statusText = "No media manifest is available for this mission yet.",
    } = {}) {
        thumbnailWindowStartIndex = 0;
        releaseTimelineEventBinding();
        releaseAnimationPlayStateBinding();
        stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
        setTimelineMediaMarkers([]);
        panelActions.setMissionContext({
            configData: globalConfig,
            available: false,
            title: "Mission Media",
            nextMissionLabel: String(globalConfig?.mission_name_short || globalConfig?.mission_name || "Current mission").trim(),
            mediaCount: 0,
        });
        panelActions.render({
            panelTitle: "Mission Media",
            mediaCountLabel: "0",
            statusText,
            descriptionEmptyText: "No media available.",
            stageEmptyText: "No media available.",
            filterModel: buildMediaFilterModel([], runtimeMediaState.getFilters()),
            thumbnailItems: [],
        });
    }

    function update(context = {}) {
        lastRenderContext = context;

        const globalConfig = context.globalConfig || null;
        const missionName = String(
            globalConfig?.mission_name_short ||
            globalConfig?.mission_name ||
            "Current mission",
        ).trim();
        const compareMode = getIsCompareMode() === true;

        if (compareMode) {
            clearUi(globalConfig, {
                statusText: "Mission media is disabled in compare mode.",
            });
            return;
        }

        if (!isMediaBrowserEnabled(globalConfig)) {
            clearUi(globalConfig, {
                statusText: "Mission media is disabled for this mission.",
            });
            return;
        }

        ensureTimelineEventBinding();
        ensureAnimationPlayStateBinding();
        const loadState = runtimeMediaState.getLoadState();
        if (loadState === "idle") {
            ensureManifestLoaded().then(() => rerender());
        }

        const manifest = runtimeMediaState.getManifest();
        const available = globalConfig != null;
        panelActions.setMissionContext({
            configData: globalConfig,
            available,
            title: String(manifest?.ui?.panelTitle || manifest?.title || "Mission Media").trim(),
            nextMissionLabel: missionName,
            mediaCount: (Array.isArray(manifest?.mediaItems) ? manifest.mediaItems.length : 0)
                + (Array.isArray(manifest?.audioItems) ? manifest.audioItems.length : 0),
        });

        if (loadState === "loading" || (loadState === "idle" && !manifest)) {
            setTimelineMediaMarkers([]);
            panelActions.render({
                panelTitle: "Mission Media",
                mediaCountLabel: "--",
                statusText: "Loading mission media manifest...",
                descriptionEmptyText: "Loading mission media manifest...",
                stageEmptyText: "Loading mission media manifest...",
                filterModel: buildMediaFilterModel([], runtimeMediaState.getFilters()),
                thumbnailItems: [],
            });
            return;
        }

        if (!manifest) {
            clearUi(globalConfig);
            return;
        }

        const timeMs = Number.isFinite(context.animTime) ? context.animTime : Date.now();
        const timelineStartMs = Number.isFinite(getStartTime()) ? getStartTime() : Number.NaN;
        const timelineEndMs = Number.isFinite(getLatestEndTime()) ? getLatestEndTime() : Number.NaN;
        const filters = runtimeMediaState.getFilters();
        const filteredItems = filterMediaItems(manifest.mediaItems, filters);
        const filteredAudioItems = filterMediaItems(manifest.audioItems || [], filters);
        const filteredSelectableItems = buildSelectableMediaItems(filteredItems, filteredAudioItems);
        const selectableItems = buildTimelineMarkerItems(
            filteredItems,
            filteredAudioItems,
        );
        const selection = buildCurrentMediaFocusState(selectableItems, timeMs);
        const activePlaybackItem = findCurrentManifestItemById(mediaPlaybackState.itemId);
        syncActivePlayableMediaToMissionTime(activePlaybackItem, timeMs);

        setTimelineMediaMarkers(buildMediaTimelineMarkers({
            items: selectableItems,
            timeMs,
            rangeStartMs: timelineStartMs,
            rangeEndMs: timelineEndMs,
        }));

        panelActions.render(buildPanelViewModel({
            manifest,
            items: filteredSelectableItems,
            selectionItems: selectableItems,
            selection,
            timeMs,
        }));
    }

    function dispose() {
        releaseTimelineEventBinding();
        releaseAnimationPlayStateBinding();
        stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
        setTimelineMediaMarkers([]);
    }

    return {
        update,
        dispose,
    };
}

export {
    createMediaTimelineCoordination,
};
