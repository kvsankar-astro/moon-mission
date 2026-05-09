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

function formatSignedDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds === 0) return "0s";
    const sign = seconds > 0 ? "+" : "-";
    return `${sign}${formatDuration(Math.abs(seconds) * 1000, { compact: true })}`;
}

function formatMediaEntryCount(count) {
    return `${count} media ${count === 1 ? "entry" : "entries"}`;
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

function resolvePlayableEndTimeMs(item, fallbackDurationSeconds = Number.NaN) {
    const startTimeMs = Number(item?.startTimeMs);
    if (!Number.isFinite(startTimeMs)) {
        return Number.NaN;
    }
    const explicitEndTimeMs = Number(item?.endTimeMs);
    if (Number.isFinite(explicitEndTimeMs) && explicitEndTimeMs > startTimeMs) {
        return explicitEndTimeMs;
    }
    const durationSeconds = resolvePlayableDurationSeconds(item, fallbackDurationSeconds);
    return Number.isFinite(durationSeconds) ? startTimeMs + durationSeconds * 1000 : Number.NaN;
}

function resolveAudioClipForTime(audioItems, timeMs) {
    if (!Array.isArray(audioItems) || !Number.isFinite(timeMs)) return null;
    let activeClip = null;
    for (const clip of audioItems) {
        if (clip?.enabled === false || !Number.isFinite(clip?.startTimeMs)) continue;
        const clipEndTimeMs = resolvePlayableEndTimeMs(clip, AUDIO_DEFAULT_DURATION_SECONDS);
        if (Number.isFinite(clipEndTimeMs) && timeMs >= clipEndTimeMs) continue;
        if (clip.startTimeMs <= timeMs && (!activeClip || clip.startTimeMs > activeClip.startTimeMs)) {
            activeClip = clip;
        }
    }
    return activeClip;
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

function buildExplicitMediaSelectionState({
    items,
    activeItemId,
    timeMs,
    nearbyRadius = 3,
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
            positionLabel: "No media selected",
        };
    }
    if (!Number.isInteger(activeIndex) || activeIndex < 0) {
        return {
            available: true,
            previousEnabled: false,
            nextEnabled: true,
            positionLabel: `${count} filtered - none selected`,
            previousTitle: "Select a filtered media item first",
            nextTitle: "Select nearest filtered media",
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
        badge: item.kind === "videoClip"
            ? "Video"
            : (item.kind === "audioClip" ? "Audio" : "Image"),
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

function createMediaTimelineCoordination({
    getStartTime = () => Number.NaN,
    getLatestEndTime = () => Number.NaN,
    getAnimationRunning = () => false,
    getIsCompareMode = () => false,
    playAnimation = () => {},
    pauseAnimation = () => {},
    setRealtimeSpeed = () => {},
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
    let audioEnabled = false;
    let currentAudio = null;
    let currentAudioClipId = "";
    let thumbnailWindowStartIndex = 0;
    let mediaPlaybackState = {
        itemId: "",
        kind: "",
        active: false,
        playing: false,
        startTimeMs: Number.NaN,
        syncedTimeMs: Number.NaN,
    };
    let suppressMediaEvents = false;

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
            startTimeMs: Number.NaN,
            syncedTimeMs: Number.NaN,
        };
    }

    function getVideoElement() {
        return globalThis.document?.getElementById?.("media-browser-video") || null;
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
    }

    function stopPlayableMedia({ pauseClock = false } = {}) {
        stopAudioPlayback();
        stopVideoPlayback();
        resetMediaPlaybackState();
        if (pauseClock) {
            pauseAnimation();
        }
    }

    function handlePlayableMediaStarted(itemId, kind) {
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId || normalizedId !== mediaPlaybackState.itemId) return;
        mediaPlaybackState = {
            ...mediaPlaybackState,
            kind: kind || mediaPlaybackState.kind,
            active: true,
            playing: true,
        };
        setRealtimeSpeed();
        playAnimation();
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
            stopPlayableMedia({ pauseClock: false });
            rerender();
            return;
        }
        seekMissionTimelineTime(nextTimeMs, false);
        mediaPlaybackState = {
            ...mediaPlaybackState,
            syncedTimeMs: nextTimeMs,
        };
    }

    function attachAudioPlaybackEvents(audio, item) {
        if (!audio || typeof audio.addEventListener !== "function" || !item) return;
        audio.addEventListener("playing", () => handlePlayableMediaStarted(item.id, "audioClip"));
        audio.addEventListener("pause", () => {
            if (audio.ended === true) return;
            handlePlayableMediaPaused(item.id);
        });
        audio.addEventListener("ended", () => handlePlayableMediaEnded(item.id));
        audio.addEventListener("timeupdate", () => {
            syncMissionTimeFromMedia(item.id, Number(audio.currentTime));
        });
        for (const eventName of ["abort", "error", "stalled"]) {
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

    function playMediaElement(mediaElement, itemId = "") {
        try {
            const playResult = mediaElement?.play?.();
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
        if (item.kind === "audioClip") {
            audioEnabled = true;
        }
        const currentAnimTime = Number(lastRenderContext?.animTime);
        const alignedCurrentTimeMs = Number.isFinite(currentAnimTime) && currentAnimTime >= item.startTimeMs
            ? currentAnimTime
            : item.startTimeMs;
        const offsetSeconds = fromBeginning
            ? 0
            : clampMediaCurrentTimeSeconds(item, (alignedCurrentTimeMs - item.startTimeMs) / 1000);
        const timelineTimeMs = fromBeginning
            ? item.startTimeMs
            : alignedCurrentTimeMs;

        stopPlayableMedia({ pauseClock: false });
        runtimeMediaState.setActiveItemId(item.id);
        mediaPlaybackState = {
            itemId: item.id,
            kind: item.kind,
            active: true,
            playing: true,
            startTimeMs: item.startTimeMs,
            syncedTimeMs: timelineTimeMs,
        };

        if (seekTimeline) {
            seekMissionTimelineTime(timelineTimeMs, true);
        }

        setRealtimeSpeed();
        playAnimation();
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
            playMediaElement(currentAudio, item.id);
            return true;
        }

        if (item.kind === "videoClip") {
            const video = getVideoElement();
            if (!video) {
                handlePlayableMediaStarted(item.id, "videoClip");
                return true;
            }
            if (video.getAttribute?.("src") !== item.assetUrl) {
                video.src = item.assetUrl;
                if (item.posterAssetUrl) {
                    video.poster = item.posterAssetUrl;
                }
                callMediaMethod(video, "load");
            }
            if (video.dataset) {
                video.dataset.mediaItemId = item.id;
            }
            setMediaElementCurrentTime(video, offsetSeconds);
            playMediaElement(video, item.id);
            return true;
        }

        return false;
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

    function releaseTimelineEventBinding() {
        if (timelineEventBound && onTimelineMarkerSelect && typeof document?.removeEventListener === "function") {
            document.removeEventListener("mission-media-marker-select", onTimelineMarkerSelect);
        }
        timelineEventBound = false;
        onTimelineMarkerSelect = null;
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

    function previewMediaItem(item, {
        seekTimeline = true,
    } = {}) {
        if (!item) return false;
        dispatchDocumentCustomEvent("mission-media-item-select", {
            item,
        });
        stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
        runtimeMediaState.setActiveItemId(item.id);
        if (!seekTimeline) {
            rerender();
            return true;
        }
        const seekSucceeded = seekMissionTimelineTime(item.startTimeMs, true);
        if (!seekSucceeded) {
            rerender();
        }
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
            if (!MEDIA_KIND_FILTER_IDS.includes(value)) return;
            const filters = runtimeMediaState.getFilters();
            const active = new Set(filters.mediaKinds || MEDIA_KIND_FILTER_IDS);
            if (active.has(value)) {
                active.delete(value);
            } else {
                active.add(value);
            }
            runtimeMediaState.patchFilters({
                quick: filters.quick === "videos" ? "all" : filters.quick,
                kind: "all",
                mediaKinds: MEDIA_KIND_FILTER_IDS.filter((kindId) => active.has(kindId)),
            });
            if (value === "audioClip" && active.has(value) === false && mediaPlaybackState.kind === "audioClip") {
                stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
            }
            rerender();
            return;
        }
        if (type === "toggleCameraFilter") {
            const value = String(intent.value || "").trim();
            if (!value) return;
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
        if (type === "toggleAudio") {
            if (audioEnabled === true) {
                audioEnabled = false;
                if (mediaPlaybackState.kind === "audioClip") {
                    stopPlayableMedia({ pauseClock: mediaPlaybackState.playing === true });
                } else {
                    stopAudioPlayback();
                }
                rerender();
                return;
            }
            audioEnabled = true;
            const manifest = runtimeMediaState.getManifest();
            const currentTimeMs = Number(lastRenderContext?.animTime);
            const activeAudioClip = resolveAudioClipForTime(manifest?.audioItems || [], currentTimeMs);
            if (activeAudioClip?.assetUrl) {
                startPlayableMediaItem(activeAudioClip, {
                    fromBeginning: false,
                    seekTimeline: true,
                });
                return;
            }
            rerender();
            return;
        }
        if (type === "selectItem") {
            const selectableItems = getFilteredSelectableItems();
            const selectedItem = selectableItems.find((item) => item.id === intent.value) || null;
            if (!selectedItem) return;
            if (isPlayableMediaItem(selectedItem)) {
                dispatchDocumentCustomEvent("mission-media-item-select", {
                    item: selectedItem,
                });
                startPlayableMediaItem(selectedItem, {
                    fromBeginning: true,
                    seekTimeline: true,
                });
                return;
            }
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
            const currentId = runtimeMediaState.getActiveItemId();
            const currentIndex = selectableItems.findIndex((item) => item?.id === currentId);
            const targetIndex = currentIndex >= 0
                ? clampIndex(currentIndex + direction, selectableItems.length - 1)
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
        if (type === "startActiveMedia" || type === "startActiveMediaFromBeginning") {
            const manifest = runtimeMediaState.getManifest();
            const activeItemId = mediaPlaybackState.itemId || runtimeMediaState.getActiveItemId();
            const activeItem = findManifestMediaItemById(manifest, activeItemId);
            if (!activeItem || !isPlayableMediaItem(activeItem)) return;
            startPlayableMediaItem(activeItem, {
                fromBeginning: type === "startActiveMediaFromBeginning",
                seekTimeline: true,
            });
            return;
        }
        if (type === "mediaPlaybackStarted") {
            handlePlayableMediaStarted(intent.value, intent.mediaKind);
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
        const audioClip = resolveAudioClipForTime(manifest.audioItems || [], timeMs);
        const navigationModel = buildMediaNavigationModel(selectionItems, selection);
        thumbnailWindowStartIndex = resolveThumbnailWindowStart(
            selectionItems,
            selection,
            timeMs,
            thumbnailWindowStartIndex,
        );
        const noSelectionStatusText = `Filtered to ${formatMediaEntryCount(selectionItems.length)}. Select one to preview.`;
        const statusText = items.length === 0
            ? "No media matches the current filters."
            : (activeItem
                ? `Selected ${navigationModel.positionLabel} filtered media entries.`
                : noSelectionStatusText);
        const activePlayable = isPlayableMediaItem(activeItem);
        const activePlaybackSelected = activeItem?.id === mediaPlaybackState.itemId;
        const activePlaybackPlaying = activePlaybackSelected && mediaPlaybackState.playing === true;
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
            audioModel: {
                available: Array.isArray(manifest.audioItems) && manifest.audioItems.length > 0,
                enabled: audioEnabled === true,
                nowLabel: audioClip?.title || audioClip?.description || "",
            },
            playbackModel: {
                playable: activePlayable,
                playing: activePlaybackPlaying,
                showStartOptions: activePlayable && !activePlaybackPlaying,
                startTitle: "Start this media from the current mission time",
                restartTitle: "Start this media from its beginning",
            },
            navigationModel,
            activeItem: activeItem
                ? {
                    id: activeItem.id,
                    kind: activeItem.kind,
                    title: activeItem.title,
                    description: activeItem.description,
                    assetUrl: resolvePreviewAssetUrl(activeItem),
                    videoAssetUrl: activeItem.kind === "videoClip" ? resolvePlayableAssetUrl(activeItem) : "",
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
            audioModel: {
                available: false,
                enabled: false,
                nowLabel: "",
            },
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
                audioModel: {
                    available: false,
                    enabled: audioEnabled === true,
                    nowLabel: "",
                },
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
        const requestedActiveItemId = mediaPlaybackState.itemId || runtimeMediaState.getActiveItemId();
        const selection = buildExplicitMediaSelectionState({
            items: selectableItems,
            activeItemId: requestedActiveItemId,
            timeMs,
            nearbyRadius: 3,
        });
        if (requestedActiveItemId && !selection.activeItem) {
            runtimeMediaState.setActiveItemId("");
        } else if (selection.activeItem) {
            runtimeMediaState.setActiveItemId(selection.activeItem.id);
        }

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
