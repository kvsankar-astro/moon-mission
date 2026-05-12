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
const MEDIA_PLAYBACK_RATE_MAX = 4;
const MEDIA_FRAME_SCRUB_INTERVAL_MS = 180;

function formatSignedDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds === 0) return "0s";
    const sign = seconds > 0 ? "+" : "-";
    return `${sign}${formatDuration(Math.abs(seconds) * 1000, { compact: true })}`;
}

function formatPlaybackRateLabel(rate) {
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) return "1x";
    if (Math.abs(numericRate - Math.round(numericRate)) < 1e-6) {
        return `${Math.round(numericRate)}x`;
    }
    return `${numericRate.toFixed(2)}x`;
}

function buildStageBadge(item) {
    if (!item) return "";
    const parts = [];
    if (item.kind === "audioClip") {
        parts.push("Audio");
    }
    if (item.mediaStream === true) {
        parts.push("Stream");
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

function isPlayableMediaItem(item) {
    return !!resolvePlayableAssetUrl(item);
}

function isHlsMediaItem(item) {
    const sourceType = String(item?.sourceType || "").trim().toLowerCase();
    const sourceUrl = String(resolvePlayableAssetUrl(item) || "").trim().toLowerCase();
    return sourceType === "hls" || sourceUrl.includes(".m3u8");
}

function resolvePlayableDurationSeconds(item, fallbackDurationSeconds = Number.NaN) {
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return durationSeconds;
    }
    const fallbackSeconds = Number(fallbackDurationSeconds);
    return Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : Number.NaN;
}

function buildMediaStreamItems(mediaStreams) {
    return (Array.isArray(mediaStreams) ? mediaStreams : [])
        .map((stream) => {
            const sourceUrl = String(stream?.sourceUrl || "").trim();
            if (!stream || !sourceUrl || stream.streamKind === "audio") return null;
            const startTimeMs = Number(stream.startTimeMs);
            const explicitEndTimeMs = Number(stream.endTimeMs);
            const durationSeconds = Number(stream.durationSeconds);
            const endTimeMs = Number.isFinite(explicitEndTimeMs)
                ? explicitEndTimeMs
                : (Number.isFinite(startTimeMs) && Number.isFinite(durationSeconds)
                    ? startTimeMs + durationSeconds * 1000
                    : Number.NaN);

            return {
                ...stream,
                kind: "videoClip",
                mediaStream: true,
                assetUrl: sourceUrl,
                thumbnailAssetUrl: stream.thumbnailAssetUrl || stream.posterAssetUrl || "",
                posterAssetUrl: stream.posterAssetUrl || stream.thumbnailAssetUrl || "",
                startTimeMs,
                endTimeMs,
                durationSeconds,
                external: stream.external !== false,
                cameraId: stream.cameraId || "mission-stream",
                cameraLabel: stream.cameraLabel || "Mission stream",
                sourceLabel: stream.sourceLabel || stream.sourceCredit || "Mission stream",
                fileName: sourceUrl,
                timeOffsetNote: stream.syncStatus
                    ? `Stream sync status: ${stream.syncStatus}.`
                    : stream.timeOffsetNote,
            };
        })
        .filter(Boolean);
}

function buildSelectableMediaItems(mediaItems, audioItems, mediaStreams) {
    return [
        ...(Array.isArray(mediaItems) ? mediaItems : []),
        ...(Array.isArray(audioItems) ? audioItems : []),
        ...buildMediaStreamItems(mediaStreams),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function buildTimelineMarkerItems(mediaItems, audioItems, mediaStreams) {
    return buildSelectableMediaItems(mediaItems, audioItems, mediaStreams);
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

function findManifestMediaItemById(manifest, itemId) {
    const normalizedId = String(itemId || "").trim();
    if (!manifest || !normalizedId) return null;
    return [
        ...(manifest.mediaItems || []),
        ...(manifest.audioItems || []),
        ...buildMediaStreamItems(manifest.mediaStreams || []),
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
    dataset.programmaticSeekSource = "media-sync";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    if (finalize) {
        dataset.programmaticSeekTimeMs = String(clamped);
        dataset.programmaticSeekSource = "media-sync";
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
    getAnimationSpeedMultiplier = () => 1,
    getAnimationRealtime = () => true,
    getIsCompareMode = () => false,
    playAnimation = () => {},
    pauseAnimation = () => {},
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
    let onTimelineUserSeek = null;
    let onMediaPanelStateChanged = null;
    let animationPlayStateEventBound = false;
    let onAnimationPlayStateUpdated = null;
    let handlingAnimationPlayStateEvent = false;
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
        currentTimeSeconds: 0,
    };
    let suppressMediaEvents = false;
    let lastFrameScrubRealtimeMs = 0;
    let lastFrameScrubMode = null;
    let timelineUserSeekState = {
        active: false,
        animationWasRunning: false,
        stoppedForOutOfRange: false,
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
            currentTimeSeconds: 0,
        };
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

    function getRequestedAnimationRate() {
        if (getAnimationRealtime() === true) return 1;
        const multiplier = Number(getAnimationSpeedMultiplier());
        if (!Number.isFinite(multiplier) || multiplier <= 0) return 1;
        return multiplier;
    }

    function isFrameScrubMode() {
        return getRequestedAnimationRate() > MEDIA_PLAYBACK_RATE_MAX;
    }

    function getMediaPlaybackRate() {
        return Math.max(0.1, Math.min(MEDIA_PLAYBACK_RATE_MAX, getRequestedAnimationRate()));
    }

    function callMediaMethod(mediaElement, methodName) {
        try {
            return mediaElement?.[methodName]?.();
        } catch {
            return null;
        }
    }

    function setMediaPlaybackRate(mediaElement, rate = 1) {
        if (!mediaElement) return;
        const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
        try {
            mediaElement.playbackRate = safeRate;
        } catch {
            // Some engines can reject unsupported playback rates.
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
    }

    function stopPlayableMedia({ pauseClock = false } = {}) {
        stopAudioPlayback();
        stopVideoPlayback();
        resetMediaPlaybackState();
        lastFrameScrubRealtimeMs = 0;
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

    function seekActivePlayableMediaToMissionTime(timeMs) {
        if (!Number.isFinite(timeMs) || !mediaPlaybackState.itemId) return false;
        const mediaItem = findCurrentManifestItemById(mediaPlaybackState.itemId) || mediaPlaybackState;
        if (!mediaItem || !isPlayableMediaItem(mediaItem) || !Number.isFinite(mediaItem.startTimeMs)) {
            return false;
        }
        const offsetSeconds = clampMediaCurrentTimeSeconds(
            mediaItem,
            (timeMs - mediaItem.startTimeMs) / 1000,
        );
        if (!Number.isFinite(offsetSeconds)) return false;
        if (mediaPlaybackState.kind === "audioClip") {
            if (!currentAudio) return false;
            setMediaElementCurrentTime(currentAudio, offsetSeconds);
        } else if (mediaPlaybackState.kind === "videoClip") {
            const video = getVideoElement();
            if (!video) return false;
            setMediaElementCurrentTime(video, offsetSeconds);
        } else {
            return false;
        }
        mediaPlaybackState = {
            ...mediaPlaybackState,
            syncedTimeMs: mediaItem.startTimeMs + (offsetSeconds * 1000),
            currentTimeSeconds: offsetSeconds,
        };
        return true;
    }

    function seekPlayableMediaToSeconds(item, seconds, finalize = false) {
        if (!item || !isPlayableMediaItem(item) || !Number.isFinite(item.startTimeMs)) return false;
        const clampedSeconds = clampMediaCurrentTimeSeconds(item, seconds);
        if (item.kind === "audioClip") {
            setMediaElementCurrentTime(currentAudio, clampedSeconds);
        } else if (item.kind === "videoClip") {
            setMediaElementCurrentTime(getVideoElement(), clampedSeconds);
        } else {
            return false;
        }
        const timelineTimeMs = syncMissionTimeToMediaOffset(item, clampedSeconds, finalize === true);
        mediaPlaybackState = {
            ...mediaPlaybackState,
            itemId: item.id,
            kind: item.kind,
            active: true,
            syncedTimeMs: Number.isFinite(timelineTimeMs)
                ? timelineTimeMs
                : (item.startTimeMs + clampedSeconds * 1000),
            currentTimeSeconds: clampedSeconds,
        };
        rerender();
        return true;
    }

    function syncFrameScrubPreview(activeItem, timeMs) {
        if (!activeItem || activeItem.kind !== "videoClip" || !isPlayableMediaItem(activeItem)) return;
        if (isFrameScrubMode() !== true || getAnimationRunning() !== true) return;
        const nowMs = Date.now();
        if ((nowMs - lastFrameScrubRealtimeMs) < MEDIA_FRAME_SCRUB_INTERVAL_MS) return;
        lastFrameScrubRealtimeMs = nowMs;
        const offsetSeconds = resolvePlaybackOffsetSeconds(activeItem, timeMs, false);
        const video = getVideoElement();
        if (video) {
            if (mediaPlaybackState.itemId === activeItem.id && mediaPlaybackState.playing === true) {
                suppressMediaEvents = true;
                callMediaMethod(video, "pause");
                suppressMediaEvents = false;
            }
            callMediaMethod(video, "pause");
            setMediaElementCurrentTime(video, offsetSeconds);
        }
        if (mediaPlaybackState.itemId === activeItem.id) {
            mediaPlaybackState = {
                ...mediaPlaybackState,
                active: true,
                playing: false,
                buffering: false,
                currentTimeSeconds: offsetSeconds,
                syncedTimeMs: activeItem.startTimeMs + offsetSeconds * 1000,
            };
        }
    }

    function syncActivePlayingMediaRate() {
        if (mediaPlaybackState.playing !== true) return;
        if (isFrameScrubMode() === true) return;
        const rate = getMediaPlaybackRate();
        if (mediaPlaybackState.kind === "audioClip") {
            setMediaPlaybackRate(currentAudio, rate);
            return;
        }
        if (mediaPlaybackState.kind === "videoClip") {
            setMediaPlaybackRate(getVideoElement(), rate);
        }
    }

    function syncPlaybackModeTransition(activeItem, timeMs) {
        if (!activeItem || !isPlayableMediaItem(activeItem)) return;
        const nextFrameScrubMode = isFrameScrubMode() === true;
        if (lastFrameScrubMode == null) {
            lastFrameScrubMode = nextFrameScrubMode;
            return;
        }
        if (lastFrameScrubMode === nextFrameScrubMode) {
            return;
        }
        lastFrameScrubMode = nextFrameScrubMode;

        const offsetSeconds = resolvePlaybackOffsetSeconds(activeItem, timeMs, false);
        const syncedTimeMs = activeItem.startTimeMs + offsetSeconds * 1000;

        if (nextFrameScrubMode) {
            suppressMediaEvents = true;
            callMediaMethod(currentAudio, "pause");
            callMediaMethod(getVideoElement(), "pause");
            suppressMediaEvents = false;
            seekPlayableMediaToSeconds(activeItem, offsetSeconds, false);
            mediaPlaybackState = {
                ...mediaPlaybackState,
                itemId: activeItem.id,
                kind: activeItem.kind,
                active: true,
                playing: false,
                buffering: false,
                startTimeMs: activeItem.startTimeMs,
                syncedTimeMs,
                currentTimeSeconds: offsetSeconds,
            };
            return;
        }

        if (getAnimationRunning() !== true) return;

        if (activeItem.kind === "audioClip") {
            if (typeof globalThis.Audio !== "function") return;
            if (!currentAudio || currentAudioClipId !== activeItem.id) {
                currentAudio = new globalThis.Audio(activeItem.assetUrl);
                currentAudio.volume = 0.7;
                currentAudioClipId = activeItem.id;
                attachAudioPlaybackEvents(currentAudio, activeItem);
            }
            setMediaPlaybackRate(currentAudio, getMediaPlaybackRate());
            setMediaElementCurrentTime(currentAudio, offsetSeconds);
            primePlayableMediaState(activeItem, {
                playing: false,
                syncedTimeMs,
                currentTimeSeconds: offsetSeconds,
            });
            playMediaElement(currentAudio, activeItem.id, "audioClip");
            rerender();
            return;
        }

        if (activeItem.kind === "videoClip") {
            const video = getVideoElement();
            if (!video) return;
            if (!isHlsMediaItem(activeItem) && video.getAttribute?.("src") !== activeItem.assetUrl) {
                video.src = activeItem.assetUrl;
                if (activeItem.posterAssetUrl) {
                    video.poster = activeItem.posterAssetUrl;
                }
                callMediaMethod(video, "load");
            }
            if (video.dataset) {
                video.dataset.mediaItemId = activeItem.id;
                video.dataset.mediaSourceUrl = activeItem.assetUrl;
                video.dataset.sourceType = activeItem.sourceType || "";
            }
            setMediaPlaybackRate(video, getMediaPlaybackRate());
            setMediaElementCurrentTime(video, offsetSeconds);
            primePlayableMediaState(activeItem, {
                playing: false,
                syncedTimeMs,
                currentTimeSeconds: offsetSeconds,
            });
            playMediaElement(video, activeItem.id, "videoClip");
            rerender();
        }
    }

    function primePlayableMediaState(item, {
        playing = false,
        syncedTimeMs = Number.NaN,
        currentTimeSeconds = 0,
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
            currentTimeSeconds: Number.isFinite(currentTimeSeconds) ? Math.max(0, currentTimeSeconds) : 0,
        };
        return true;
    }

    function handlePlayableMediaStarted(itemId, kind, currentTimeSeconds = 0) {
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId) return;
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
            currentTimeSeconds: Math.max(0, Number(currentTimeSeconds) || 0),
        };
        if (mediaPlaybackState.kind === "audioClip") {
            setMediaPlaybackRate(currentAudio, getMediaPlaybackRate());
        } else if (mediaPlaybackState.kind === "videoClip") {
            setMediaPlaybackRate(getVideoElement(), getMediaPlaybackRate());
        }
        if (getAnimationRunning() !== true) {
            playAnimation();
        }
        rerender();
    }

    function handlePlayableMediaPaused(itemId) {
        if (suppressMediaEvents) return;
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId || normalizedId !== mediaPlaybackState.itemId) return;
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
            currentTimeSeconds: Math.max(0, Number(currentTimeSeconds) || 0),
        };
        pauseAnimation();
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
        if (
            Number.isFinite(currentTimelineTimeMs)
            && Number.isFinite(previousSyncedTimeMs)
            && Math.abs(currentTimelineTimeMs - previousSyncedTimeMs) > MEDIA_CLOCK_OVERRIDE_TOLERANCE_MS
        ) {
            if (seekActivePlayableMediaToMissionTime(currentTimelineTimeMs)) {
                return;
            }
            stopPlayableMedia({ pauseClock: false });
            return;
        }
        const mediaItem = findCurrentManifestItemById(mediaPlaybackState.itemId) || mediaPlaybackState;
        const syncedTimeMs = syncMissionTimeToMediaOffset(mediaItem, mediaSeconds, false);
        mediaPlaybackState = {
            ...mediaPlaybackState,
            syncedTimeMs: Number.isFinite(syncedTimeMs) ? syncedTimeMs : nextTimeMs,
            currentTimeSeconds: mediaSeconds,
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

    function playMediaElement(mediaElement, itemId = "", kind = "") {
        try {
            const playResult = mediaElement?.play?.();
            if (playResult && typeof playResult.then === "function") {
                playResult.then(() => {
                    if (mediaPlaybackState.itemId !== itemId || mediaPlaybackState.playing === true) return;
                    if (mediaElement?.paused === true) return;
                    handlePlayableMediaStarted(itemId, kind, Number(mediaElement?.currentTime) || 0);
                });
            }
            if (playResult && typeof playResult.catch === "function") {
                playResult.catch(() => {
                    handlePlayableMediaFailed(itemId, mediaElement);
                });
            }
        } catch {
            handlePlayableMediaFailed(itemId, mediaElement);
        }
    }

    function startPlayableMediaItem(item, {
        fromBeginning = true,
        seekTimeline = true,
    } = {}) {
        if (!isPlayableMediaItem(item)) return false;
        const offsetSeconds = resolvePlaybackOffsetSeconds(item, readCurrentMissionTimeMs(), fromBeginning);
        const timelineTimeMs = item.startTimeMs + offsetSeconds * 1000;
        const frameScrubMode = isFrameScrubMode();

        stopPlayableMedia({ pauseClock: false });
        primePlayableMediaState(item, {
            playing: false,
            syncedTimeMs: timelineTimeMs,
            currentTimeSeconds: offsetSeconds,
        });

        if (seekTimeline) {
            seekMissionTimelineTime(timelineTimeMs, true);
        }

        if (item.kind === "audioClip") {
            if (frameScrubMode) {
                mediaPlaybackState = {
                    ...mediaPlaybackState,
                    active: true,
                    playing: false,
                    buffering: false,
                };
                rerender();
                if (getAnimationRunning() !== true) {
                    playAnimation();
                }
                return true;
            }
            pauseAnimation();
            rerender();
            if (typeof globalThis.Audio !== "function") {
                handlePlayableMediaStarted(item.id, "audioClip");
                return true;
            }
            currentAudio = new globalThis.Audio(item.assetUrl);
            currentAudio.volume = 0.7;
            currentAudioClipId = item.id;
            attachAudioPlaybackEvents(currentAudio, item);
            setMediaPlaybackRate(currentAudio, getMediaPlaybackRate());
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
            if (!isHlsMediaItem(item) && video.getAttribute?.("src") !== item.assetUrl) {
                video.src = item.assetUrl;
                if (item.posterAssetUrl) {
                    video.poster = item.posterAssetUrl;
                }
                callMediaMethod(video, "load");
            }
            if (video.dataset) {
                video.dataset.mediaItemId = item.id;
                video.dataset.mediaSourceUrl = item.assetUrl;
                video.dataset.sourceType = item.sourceType || "";
            }
            if (frameScrubMode) {
                callMediaMethod(video, "pause");
                setMediaElementCurrentTime(video, offsetSeconds);
                mediaPlaybackState = {
                    ...mediaPlaybackState,
                    active: true,
                    playing: false,
                    buffering: false,
                };
                rerender();
                if (getAnimationRunning() !== true) {
                    playAnimation();
                }
                return true;
            }
            pauseAnimation();
            rerender();
            setMediaPlaybackRate(video, getMediaPlaybackRate());
            setMediaElementCurrentTime(video, offsetSeconds);
            playMediaElement(video, item.id, "videoClip");
            return true;
        }

        return false;
    }

    function startFocusedPlayableMediaFromMissionTime({
        seekTimeline = true,
    } = {}) {
        if (mediaPlaybackState.playing === true) return false;
        const activeItem = getCurrentFocusedMediaItem();
        if (!activeItem || !isPlayableMediaItem(activeItem)) return false;
        return startPlayableMediaItem(activeItem, {
            fromBeginning: false,
            seekTimeline,
        });
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
        onTimelineUserSeek = (event) => {
            handleTimelineUserSeek(event?.detail || {});
        };
        onMediaPanelStateChanged = (event) => {
            const panelState = String(event?.detail?.state || "").trim().toLowerCase();
            if (panelState !== "closed") return;
            stopPlayableMedia({ pauseClock: false });
            rerender();
        };
        document.addEventListener("mission-media-marker-select", onTimelineMarkerSelect);
        document.addEventListener("mission-timeline-user-seek", onTimelineUserSeek);
        document.addEventListener("mission-media-panel-state", onMediaPanelStateChanged);
    }

    function ensureAnimationPlayStateBinding() {
        if (animationPlayStateEventBound) return;
        if (typeof document?.addEventListener !== "function") return;
        animationPlayStateEventBound = true;
        onAnimationPlayStateUpdated = (event) => {
            if (handlingAnimationPlayStateEvent) return;
            if (event?.detail?.isPlaying === true) {
                if (mediaPlaybackState.active !== true && mediaPlaybackState.playing !== true) {
                    handlingAnimationPlayStateEvent = true;
                    try {
                        startFocusedPlayableMediaFromMissionTime({
                            seekTimeline: false,
                        });
                    } finally {
                        handlingAnimationPlayStateEvent = false;
                    }
                }
                return;
            }
            pausePlayableMediaForAnimationPause();
        };
        document.addEventListener("animation-play-state-updated", onAnimationPlayStateUpdated);
    }

    function releaseTimelineEventBinding() {
        if (timelineEventBound && onTimelineMarkerSelect && typeof document?.removeEventListener === "function") {
            document.removeEventListener("mission-media-marker-select", onTimelineMarkerSelect);
        }
        if (timelineEventBound && onTimelineUserSeek && typeof document?.removeEventListener === "function") {
            document.removeEventListener("mission-timeline-user-seek", onTimelineUserSeek);
        }
        if (timelineEventBound && onMediaPanelStateChanged && typeof document?.removeEventListener === "function") {
            document.removeEventListener("mission-media-panel-state", onMediaPanelStateChanged);
        }
        timelineEventBound = false;
        onTimelineMarkerSelect = null;
        onTimelineUserSeek = null;
        onMediaPanelStateChanged = null;
        timelineUserSeekState = {
            active: false,
            animationWasRunning: false,
            stoppedForOutOfRange: false,
        };
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
            filterMediaItems(buildMediaStreamItems(manifest.mediaStreams || []), filters),
        );
    }

    function resolveMediaItemEndTimeMs(item) {
        if (!item || !Number.isFinite(item.startTimeMs)) {
            return Number.NaN;
        }
        const explicitEndTimeMs = Number(item.endTimeMs);
        if (Number.isFinite(explicitEndTimeMs) && explicitEndTimeMs > item.startTimeMs) {
            return explicitEndTimeMs;
        }
        const fallbackDurationSeconds = item.kind === "audioClip"
            ? AUDIO_DEFAULT_DURATION_SECONDS
            : Number.NaN;
        const durationSeconds = resolvePlayableDurationSeconds(item, fallbackDurationSeconds);
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
            return item.startTimeMs + (durationSeconds * 1000);
        }
        return Number.NaN;
    }

    function isMediaItemActiveAtTime(item, timeMs) {
        if (!item || !Number.isFinite(item.startTimeMs) || !Number.isFinite(timeMs)) {
            return false;
        }
        const endTimeMs = resolveMediaItemEndTimeMs(item);
        if (Number.isFinite(endTimeMs) && endTimeMs >= item.startTimeMs) {
            return timeMs >= item.startTimeMs && timeMs <= endTimeMs;
        }
        return timeMs === item.startTimeMs;
    }

    function resolvePlayableItemAtTime(timeMs) {
        if (!Number.isFinite(timeMs)) return null;
        const selectableItems = getFilteredSelectableItems();
        const candidates = selectableItems
            .filter((item) => isPlayableMediaItem(item) && isMediaItemActiveAtTime(item, timeMs));
        if (candidates.length === 0) return null;

        const preferredIds = [
            String(mediaPlaybackState.itemId || "").trim(),
            String(runtimeMediaState.getActiveItemId() || "").trim(),
        ].filter(Boolean);
        for (const preferredId of preferredIds) {
            const preferred = candidates.find((item) => item.id === preferredId);
            if (preferred) return preferred;
        }

        let bestItem = candidates[0];
        let bestDelta = Math.abs(timeMs - bestItem.startTimeMs);
        for (let index = 1; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const delta = Math.abs(timeMs - candidate.startTimeMs);
            if (delta < bestDelta) {
                bestItem = candidate;
                bestDelta = delta;
            }
        }
        return bestItem;
    }

    function handleTimelineUserSeek(eventDetail = {}) {
        const phase = String(eventDetail.phase || "").trim().toLowerCase();
        const source = String(eventDetail.source || "").trim();
        const timeMs = Number(eventDetail.timeMs);
        const commit = eventDetail.commit === true;
        if (!Number.isFinite(timeMs)) return;

        if (phase === "start") {
            timelineUserSeekState = {
                active: true,
                animationWasRunning: getAnimationRunning() === true,
                stoppedForOutOfRange: false,
            };
        } else if (!timelineUserSeekState.active) {
            timelineUserSeekState = {
                active: true,
                animationWasRunning: getAnimationRunning() === true,
                stoppedForOutOfRange: false,
            };
        }

        const currentPlayableItem = findCurrentManifestItemById(mediaPlaybackState.itemId);
        const currentPlayableActive = !!currentPlayableItem
            && isPlayableMediaItem(currentPlayableItem)
            && isMediaItemActiveAtTime(currentPlayableItem, timeMs);
        if (
            (mediaPlaybackState.active === true || mediaPlaybackState.playing === true || mediaPlaybackState.buffering === true)
            && !currentPlayableActive
        ) {
            stopPlayableMedia({ pauseClock: false });
            timelineUserSeekState.stoppedForOutOfRange = true;
        }

        const shouldFinalize = phase === "commit" || phase === "end" || commit;
        if (
            shouldFinalize
            && timelineUserSeekState.animationWasRunning
            && timelineUserSeekState.stoppedForOutOfRange
        ) {
            const nextPlayableItem = resolvePlayableItemAtTime(timeMs);
            if (nextPlayableItem) {
                runtimeMediaState.setActiveItemId(nextPlayableItem.id, {
                    anchorTimeMs: timeMs,
                });
                startPlayableMediaItem(nextPlayableItem, {
                    fromBeginning: false,
                    seekTimeline: false,
                });
            }
        }

        if (phase === "end" || phase === "cancel" || phase === "commit") {
            timelineUserSeekState = {
                active: false,
                animationWasRunning: false,
                stoppedForOutOfRange: false,
            };
            return;
        }

        if (source === "timeline-slider" && phase === "update") {
            // Leave the session open while the user drags/keys through the slider.
            return;
        }
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
        preserveCurrentPlayableOffset = false,
    } = {}) {
        if (!item) return false;
        const currentMissionTimeMs = readCurrentMissionTimeMs();
        const shouldPreserveCurrentMissionTime = preserveCurrentPlayableOffset
            && seekTimeline
            && isPlayableMediaItem(item)
            && isFrameScrubMode() !== true
            && isMediaItemActiveAtTime(item, currentMissionTimeMs);

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
        const targetTimeMs = shouldPreserveCurrentMissionTime
            ? currentMissionTimeMs
            : item.startTimeMs;
        seekMissionTimelineTime(targetTimeMs, true);
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
            previewMediaItem(selectedItem, {
                preserveCurrentPlayableOffset: true,
            });
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
        if (type === "mediaSeekTime") {
            const activeItem = getCurrentFocusedMediaItem();
            if (!activeItem || !isPlayableMediaItem(activeItem)) return;
            seekPlayableMediaToSeconds(
                activeItem,
                Number(intent.value),
                intent.finalize === true,
            );
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
        if (type === "mediaPlaybackFailed") {
            handlePlayableMediaFailed(intent.value);
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
            buildSelectableMediaItems(manifest.mediaItems, manifest.audioItems || [], manifest.mediaStreams || []),
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
        const activeDurationSeconds = resolvePlayableDurationSeconds(
            activeItem,
            activeItem?.kind === "audioClip" ? AUDIO_DEFAULT_DURATION_SECONDS : Number.NaN,
        );
        const activeElapsedSeconds = activePlaybackSelected
            ? clampMediaCurrentTimeSeconds(activeItem, Number(mediaPlaybackState.currentTimeSeconds) || 0)
            : resolvePlaybackOffsetSeconds(activeItem, timeMs, false);
        const activeRequestedRate = getRequestedAnimationRate();
        const frameScrubActive = activePlayable
            && activeItem?.kind === "videoClip"
            && isFrameScrubMode() === true
            && getAnimationRunning() === true;
        const activeMediaKindLabel = activeItem?.kind === "videoClip"
            ? "Video"
            : (activeItem?.kind === "audioClip" ? "Audio" : "Media");
        const activeMediaStatus = activePlaybackBuffering
            ? `${activeMediaKindLabel} buffering`
            : (frameScrubActive
                ? `${activeMediaKindLabel} frame preview (${formatPlaybackRateLabel(activeRequestedRate)} animation)`
                : (activePlaybackPlaying
                    ? `${activeMediaKindLabel} playing (${formatPlaybackRateLabel(getMediaPlaybackRate())})`
                    : `${activeMediaKindLabel} ready`));
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
                statusLabel: activePlayable ? activeMediaStatus : "",
                elapsedSeconds: activePlayable ? activeElapsedSeconds : 0,
                durationSeconds: activePlayable ? activeDurationSeconds : Number.NaN,
                seekEnabled: activePlayable && Number.isFinite(activeDurationSeconds) && activeDurationSeconds > 0,
                sliderTitle: frameScrubActive
                    ? "Scrub media while animation is running in high-speed preview mode"
                    : "Seek selected media",
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
                    sourceType: activeItem.sourceType || "",
                    mediaStream: activeItem.mediaStream === true,
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
        lastFrameScrubMode = null;
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
                + (Array.isArray(manifest?.audioItems) ? manifest.audioItems.length : 0)
                + (Array.isArray(manifest?.mediaStreams) ? buildMediaStreamItems(manifest.mediaStreams).length : 0),
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
        const filteredStreamItems = filterMediaItems(buildMediaStreamItems(manifest.mediaStreams || []), filters);
        const filteredSelectableItems = buildSelectableMediaItems(filteredItems, filteredAudioItems, filteredStreamItems);
        const selectableItems = buildTimelineMarkerItems(
            filteredItems,
            filteredAudioItems,
            filteredStreamItems,
        );
        const selection = buildCurrentMediaFocusState(selectableItems, timeMs);
        syncPlaybackModeTransition(selection.activeItem, timeMs);
        syncFrameScrubPreview(selection.activeItem, timeMs);
        syncActivePlayingMediaRate();

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
