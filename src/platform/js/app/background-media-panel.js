import {
    registerMissionPanel,
    updateMissionPanel,
} from "./panel-registry.js";
import {
    readMissionPanelState,
    writeMissionPanelState,
} from "./panel-layout-store.js";
import {
    getMissionPanelDefaultState,
    isMissionPanelEnabled,
} from "./panel-defaults.js";
import { bringPanelElementToFront } from "./panel-z-order.js";
import {
    formatDateTimeLocal,
    formatDateTimeUTC,
    formatDuration,
} from "../utils/time-utils.js";
import { buildMediaStreamSyncPlan } from "../core/domain/media-stream-sync.js";

const BACKGROUND_MEDIA_PANEL_ID = "workflow:background-media";
const BACKGROUND_MEDIA_LAYOUT_PRESET_VERSION = "background-media-v7-stacked-169";
const PANEL_EDGE_MARGIN_PX = 8;
const PANEL_STACK_LEFT_PX = 32;
const PANEL_STACK_TOP_FALLBACK_PX = 36;
const PANEL_STACK_GAP_PX = 8;
const DEFAULT_PANEL_WIDTH_PX = 546;
const DEFAULT_PANEL_HEADER_HEIGHT_PX = 31;
const DEFAULT_MEDIA_PANEL_HEIGHT_RESERVE_PX = 260;
const MIN_PANEL_WIDTH_PX = 300;
const MIN_PANEL_HEIGHT_PX = 220;
const MAX_PLAYBACK_RATE = 4;
const SEEK_SYNC_EPSILON_SECONDS = 0.35;
const TRANSPORT_SEEK_SYNC_EPSILON_SECONDS = 3;
const STREAM_HARD_SEEK_THRESHOLD_SECONDS = 6;
const STREAM_SOFT_CORRECTION_THRESHOLD_SECONDS = 0.75;
const BACKGROUND_STATUS_TOAST_DURATION_MS = 3200;

let hlsLibraryPromise = null;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getDocumentRef() {
    return globalThis.document || null;
}

function getWindowRef() {
    return globalThis.window || null;
}

function getNode(id) {
    return getDocumentRef()?.getElementById?.(id) || null;
}

function callMediaMethod(mediaElement, methodName) {
    try {
        return mediaElement?.[methodName]?.();
    } catch {
        return null;
    }
}

function setText(id, text) {
    const node = getNode(id);
    if (node) node.textContent = text;
}

function setHidden(id, hidden) {
    const node = getNode(id);
    if (node) node.hidden = hidden === true;
}

function syncTimeOverlay(seconds = Number.NaN, hidden = false) {
    const overlay = getNode("background-media-time-overlay");
    if (!overlay) return;
    const safeSeconds = Number(seconds);
    const hasTime = Number.isFinite(safeSeconds) && safeSeconds >= 0;
    overlay.hidden = hidden === true || !hasTime;
    if (!hasTime) return;
    const label = formatStatusTime(safeSeconds);
    overlay.textContent = label;
    overlay.title = `Broadcast time ${label}`;
}

function isLikelyHlsSource(url = "", sourceType = "") {
    const normalizedSourceType = String(sourceType || "").trim().toLowerCase();
    const normalizedUrl = String(url || "").trim().toLowerCase();
    return normalizedSourceType === "hls" || normalizedUrl.includes(".m3u8");
}

function canPlayHlsNatively(video) {
    if (typeof video?.canPlayType !== "function") return false;
    return Boolean(
        video.canPlayType("application/vnd.apple.mpegurl")
            || video.canPlayType("application/x-mpegURL"),
    );
}

function loadHlsLibrary() {
    if (!hlsLibraryPromise) {
        hlsLibraryPromise = import("hls.js")
            .then((module) => module.default || module.Hls || module)
            .catch(() => null);
    }
    return hlsLibraryPromise;
}

function isBackgroundVideoItem(item) {
    if (!item || item.kind !== "videoClip" || item.enabled === false) return false;
    if (!item.assetUrl) return false;
    const roles = Array.isArray(item.playbackRoles) ? item.playbackRoles : [];
    return roles.includes("background") || item.backgroundPlayback?.enabled === true;
}

function resolveVideoSourceType(item) {
    const sourceType = String(item?.sourceType || item?.streamSourceType || "").trim().toLowerCase();
    if (sourceType === "hls") return "hls";
    const assetUrl = String(item?.assetUrl || "").trim();
    return /\.m3u8(?:$|[?#])/i.test(assetUrl) ? "hls" : "mp4";
}

function resolveBackgroundCandidates(items = []) {
    return (Array.isArray(items) ? items : [])
        .filter(isBackgroundVideoItem)
        .sort((a, b) => {
            const priorityA = Number(a.backgroundPlayback?.priority) || 0;
            const priorityB = Number(b.backgroundPlayback?.priority) || 0;
            if (priorityA !== priorityB) return priorityB - priorityA;
            return Number(a.startTimeMs) - Number(b.startTimeMs);
        });
}

function isItemActiveAtTime(item, timeMs) {
    const startTimeMs = Number(item?.startTimeMs);
    const endTimeMs = Number(item?.endTimeMs);
    const missionTimeMs = Number(timeMs);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(missionTimeMs)) return false;
    if (missionTimeMs < startTimeMs) return false;
    if (Number.isFinite(endTimeMs) && endTimeMs >= startTimeMs) {
        return missionTimeMs <= endTimeMs;
    }
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return missionTimeMs <= startTimeMs + durationSeconds * 1000;
    }
    return true;
}

function resolveActiveBackgroundItem(items, timeMs) {
    const candidates = resolveBackgroundCandidates(items)
        .filter((item) => isItemActiveAtTime(item, timeMs));
    return candidates[0] || null;
}

function resolveBackgroundPlaybackMode({
    panelState = "closed",
    playbackEnabled = false,
    animationRunning = false,
    foregroundMediaActive = false,
    foregroundMediaKind = "",
} = {}) {
    if (panelState !== "open" || playbackEnabled !== true) {
        return "ready";
    }
    if (animationRunning !== true) {
        return "ready";
    }
    if (foregroundMediaActive === true) {
        if (foregroundMediaKind === "videoClip") {
            return "paused-for-foreground-video";
        }
        return "muted-for-foreground";
    }
    return "playing";
}

function shouldUseBackgroundTransportPlayback({
    animationRealtime = true,
    animationSpeedMultiplier = 1,
} = {}) {
    if (animationRealtime === true) return true;
    const multiplier = Number(animationSpeedMultiplier);
    return Number.isFinite(multiplier) && multiplier > 0 && multiplier <= MAX_PLAYBACK_RATE;
}

function resolveBackgroundPlaybackButtonState({
    playbackEnabled = false,
    animationRunning = false,
} = {}) {
    if (playbackEnabled === true && animationRunning === true) {
        return {
            label: "Pause broadcast",
            title: "Pause the broadcast video",
            pressed: true,
        };
    }
    if (playbackEnabled === true) {
        return {
            label: "Resume broadcast",
            title: "Resume the broadcast video at the current mission time",
            pressed: true,
        };
    }
    return {
        label: "Play broadcast",
        title: "Play the broadcast video at the current mission time",
        pressed: false,
    };
}

function resolveNearestInactiveBackgroundItem(items, timeMs) {
    const missionTimeMs = Number(timeMs);
    if (!Number.isFinite(missionTimeMs)) return null;
    const candidates = resolveBackgroundCandidates(items);
    const nextItems = candidates
        .filter((item) => Number(item.startTimeMs) > missionTimeMs)
        .sort((a, b) => Number(a.startTimeMs) - Number(b.startTimeMs));
    if (nextItems.length > 0) {
        return {
            item: nextItems[0],
            relation: "before",
            deltaMs: Number(nextItems[0].startTimeMs) - missionTimeMs,
        };
    }
    const previousItems = candidates
        .filter((item) => {
            const endTimeMs = resolveItemEndTimeMs(item);
            return Number.isFinite(endTimeMs) && endTimeMs < missionTimeMs;
        })
        .sort((a, b) => Number(resolveItemEndTimeMs(b)) - Number(resolveItemEndTimeMs(a)));
    if (previousItems.length > 0) {
        const item = previousItems[0];
        return {
            item,
            relation: "after",
            deltaMs: missionTimeMs - resolveItemEndTimeMs(item),
        };
    }
    return null;
}

function resolveItemEndTimeMs(item) {
    const startTimeMs = Number(item?.startTimeMs);
    const endTimeMs = Number(item?.endTimeMs);
    if (Number.isFinite(endTimeMs) && endTimeMs >= startTimeMs) return endTimeMs;
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(startTimeMs) && Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return startTimeMs + durationSeconds * 1000;
    }
    return Number.NaN;
}

function resolvePlaybackOffsetSeconds(item, timeMs) {
    const startTimeMs = Number(item?.startTimeMs);
    const missionTimeMs = Number(timeMs);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(missionTimeMs)) return 0;
    const timeOffsetSeconds = Number(item?.timeOffsetSeconds);
    const rawSeconds = Math.max(
        0,
        ((missionTimeMs - startTimeMs) / 1000)
            + (Number.isFinite(timeOffsetSeconds) ? timeOffsetSeconds : 0),
    );
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return clamp(rawSeconds, 0, durationSeconds);
    }
    return rawSeconds;
}

function pad(value, length = 2) {
    return String(Math.max(0, Math.floor(value))).padStart(length, "0");
}

function formatMissionElapsedTime(timeMs, missionStartTimeMs) {
    const targetMs = Number(timeMs);
    const startMs = Number(missionStartTimeMs);
    if (!Number.isFinite(targetMs) || !Number.isFinite(startMs)) return "MET --";
    const elapsedMs = targetMs - startMs;
    const sign = elapsedMs < 0 ? "-" : "+";
    const absoluteSeconds = Math.floor(Math.abs(elapsedMs) / 1000);
    const days = Math.floor(absoluteSeconds / 86400);
    const hours = Math.floor((absoluteSeconds % 86400) / 3600);
    const minutes = Math.floor((absoluteSeconds % 3600) / 60);
    const seconds = absoluteSeconds % 60;
    return `MET ${sign}${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatVideoRangeInfo(item, missionStartTimeMs) {
    const startTimeMs = Number(item?.startTimeMs);
    const endTimeMs = resolveItemEndTimeMs(item);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
        return [];
    }
    return [
        `Local: ${formatDateTimeLocal(startTimeMs)} to ${formatDateTimeLocal(endTimeMs)}`,
        `MET: ${formatMissionElapsedTime(startTimeMs, missionStartTimeMs)} to ${formatMissionElapsedTime(endTimeMs, missionStartTimeMs)}`,
        `UTC: ${formatDateTimeUTC(startTimeMs)} to ${formatDateTimeUTC(endTimeMs)}`,
    ];
}

function formatCompactLocalTime(timeMs) {
    const date = new Date(Number(timeMs));
    return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function formatCompactUtcTime(timeMs) {
    const date = new Date(Number(timeMs));
    return date.toLocaleString("en-GB", {
        timeZone: "UTC",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function formatShortMissionElapsedTime(timeMs, missionStartTimeMs) {
    const targetMs = Number(timeMs);
    const startMs = Number(missionStartTimeMs);
    if (!Number.isFinite(targetMs) || !Number.isFinite(startMs)) return "MET --";
    const elapsedMs = targetMs - startMs;
    const sign = elapsedMs < 0 ? "-" : "+";
    const absoluteMinutes = Math.floor(Math.abs(elapsedMs) / 60000);
    const days = Math.floor(absoluteMinutes / 1440);
    const hours = Math.floor((absoluteMinutes % 1440) / 60);
    const minutes = absoluteMinutes % 60;
    return `MET ${sign}${days}d ${pad(hours)}h ${pad(minutes)}m`;
}

function formatBroadcastTimingNotes(item, missionStartTimeMs) {
    const startTimeMs = Number(item?.startTimeMs);
    const endTimeMs = resolveItemEndTimeMs(item);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
        return [];
    }
    return [
        `Runs ${formatCompactLocalTime(startTimeMs)} to ${formatCompactLocalTime(endTimeMs)} local.`,
        `${formatShortMissionElapsedTime(startTimeMs, missionStartTimeMs)} to ${formatShortMissionElapsedTime(endTimeMs, missionStartTimeMs)}; UTC ${formatCompactUtcTime(startTimeMs)} to ${formatCompactUtcTime(endTimeMs)}.`,
    ];
}

function formatRangeDelta(deltaMs) {
    return formatDuration(deltaMs, {
        compact: true,
        includeSeconds: true,
    });
}

function formatStatusTime(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getDefaultPanelRect() {
    const stackTop = getWorkflowPanelStackTopPx();
    const maxWidth = Math.max(
        MIN_PANEL_WIDTH_PX,
        (getWindowRef()?.innerWidth || 1024) - PANEL_STACK_LEFT_PX - PANEL_EDGE_MARGIN_PX,
    );
    const width = Math.min(DEFAULT_PANEL_WIDTH_PX, maxWidth);
    const timelineSafeBottom = getTimelineSafeBottomPx();
    const availableHeight = Math.max(
        MIN_PANEL_HEIGHT_PX,
        timelineSafeBottom
            - stackTop
            - PANEL_STACK_GAP_PX
            - DEFAULT_MEDIA_PANEL_HEIGHT_RESERVE_PX,
    );
    const idealHeight = getDefaultPanelHeightForWidth(width);
    const height = Math.min(idealHeight, availableHeight);
    return {
        left: PANEL_STACK_LEFT_PX,
        top: stackTop,
        width,
        height,
    };
}

function getDefaultPanelHeightForWidth(width) {
    const stageHeight = Math.round((Number(width) || DEFAULT_PANEL_WIDTH_PX) * 9 / 16);
    return Math.max(MIN_PANEL_HEIGHT_PX, DEFAULT_PANEL_HEADER_HEIGHT_PX + stageHeight);
}

function getVisibleElementBottomPx(selector) {
    const node = getDocumentRef()?.querySelector?.(selector) || null;
    if (!node || node.hidden === true) return Number.NaN;
    const style = getWindowRef()?.getComputedStyle?.(node) || null;
    if (style?.display === "none" || style?.visibility === "hidden") return Number.NaN;
    const rect = node.getBoundingClientRect?.() || null;
    const bottom = Number(rect?.bottom);
    return Number.isFinite(bottom) && bottom > 0 ? bottom : Number.NaN;
}

function getWorkflowPanelStackTopPx() {
    const headerBottom = [
        getVisibleElementBottomPx(".mission-breadcrumb"),
        getVisibleElementBottomPx(".mission-floating-collapse-btn"),
    ].filter(Number.isFinite).reduce((max, value) => Math.max(max, value), 0);
    if (Number.isFinite(headerBottom) && headerBottom > 0) {
        return Math.max(
            PANEL_EDGE_MARGIN_PX,
            Math.round(headerBottom + PANEL_EDGE_MARGIN_PX - getPanelWrapperTopPx("background-media-panel-wrapper")),
        );
    }
    return PANEL_STACK_TOP_FALLBACK_PX;
}

function getPanelWrapperTopPx(id) {
    const rect = getDocumentRef()?.getElementById?.(id)?.getBoundingClientRect?.() || null;
    const top = Number(rect?.top);
    return Number.isFinite(top) && top > 0 ? top : 0;
}

function getTimelineSafeBottomPx() {
    const timelineRect = getDocumentRef()?.querySelector?.(".timeline-dock")?.getBoundingClientRect?.() || null;
    const timelineTop = Number(timelineRect?.top);
    if (Number.isFinite(timelineTop) && timelineTop > PANEL_EDGE_MARGIN_PX) {
        return Math.round(timelineTop - PANEL_EDGE_MARGIN_PX - getPanelWrapperTopPx("background-media-panel-wrapper"));
    }
    return (Number(getWindowRef()?.innerHeight) || 768) - PANEL_EDGE_MARGIN_PX;
}

function clampPanelRect(rect = {}) {
    const windowRef = getWindowRef();
    const viewportWidth = Number(windowRef?.innerWidth) || 1024;
    const viewportHeight = Number(windowRef?.innerHeight) || 768;
    const width = clamp(
        Number(rect.width) || DEFAULT_PANEL_WIDTH_PX,
        MIN_PANEL_WIDTH_PX,
        Math.max(MIN_PANEL_WIDTH_PX, viewportWidth - PANEL_EDGE_MARGIN_PX * 2),
    );
    const height = clamp(
        Number(rect.height) || getDefaultPanelHeightForWidth(width),
        MIN_PANEL_HEIGHT_PX,
        Math.max(MIN_PANEL_HEIGHT_PX, viewportHeight - PANEL_EDGE_MARGIN_PX * 2),
    );
    return {
        left: clamp(Number(rect.left) || PANEL_EDGE_MARGIN_PX, PANEL_EDGE_MARGIN_PX, viewportWidth - width - PANEL_EDGE_MARGIN_PX),
        top: clamp(Number(rect.top) || PANEL_EDGE_MARGIN_PX, PANEL_EDGE_MARGIN_PX, viewportHeight - height - PANEL_EDGE_MARGIN_PX),
        width,
        height,
    };
}

function applyPanelRect(panel, rect) {
    const nextRect = clampPanelRect(rect);
    panel.style.left = `${Math.round(nextRect.left)}px`;
    panel.style.top = `${Math.round(nextRect.top)}px`;
    panel.style.width = `${Math.round(nextRect.width)}px`;
    panel.style.height = `${Math.round(nextRect.height)}px`;
    return nextRect;
}

function createBackgroundMediaPanelActions({
    getAnimationRunning = () => false,
    getAnimationSpeedMultiplier = () => 1,
    getAnimationRealtime = () => true,
    getMissionStartTime = () => Number.NaN,
    onJumpToTime = () => {},
    onRequestPlay = () => {},
    onRequestPause = () => {},
    loadHlsLibraryFn = loadHlsLibrary,
} = {}) {
    let missionConfigData = null;
    let panelAvailable = false;
    let panelState = "closed";
    let panelEventsBound = false;
    let playbackEnabled = false;
    let muted = true;
    let hasStoredMutedPreference = false;
    let expanded = false;
    let activeItemId = "";
    let videoSourceUrl = "";
    let hlsInstance = null;
    let hlsSourceUrl = "";
    let hlsReadySourceUrl = "";
    let hlsAttachToken = 0;
    let hlsUnsupportedSourceUrl = "";
    let animationPlayStateEventBound = false;
    let backgroundStatusToastTimerId = null;
    let lastForegroundEffect = "";
    let playRequestPending = false;
    let storedLayoutMatchesPreset = false;
    let panelLayoutApplied = false;
    let dragState = null;
    let effectiveAudioMuted = true;
    let mutedForForegroundMedia = false;
    let playbackTimelineRunning = false;
    let lastPlaybackMode = "";
    let lastAppliedPlaybackRate = Number.NaN;
    let lastRenderModel = {
        items: [],
        timeMs: Number.NaN,
        animationRunning: false,
    };

    function requestWorkflowStackLayout() {
        const documentRef = getDocumentRef();
        if (!documentRef?.dispatchEvent || typeof CustomEvent !== "function") return;
        documentRef.dispatchEvent(new CustomEvent("moon-mission:workflow-panel-stack-layout"));
    }

    function getPanel() {
        return getNode("background-media-panel");
    }

    function getWrapper() {
        return getNode("background-media-panel-wrapper");
    }

    function getVideo() {
        return getNode("background-media-video");
    }

    function persistState(patch = {}) {
        writeMissionPanelState(BACKGROUND_MEDIA_PANEL_ID, {
            state: panelState,
            playbackEnabled,
            muted,
            mutedPreferenceSet: hasStoredMutedPreference === true,
            expanded,
            layoutPresetVersion: BACKGROUND_MEDIA_LAYOUT_PRESET_VERSION,
            ...patch,
        });
    }

    function showBackgroundStatusToast(message) {
        const status = getNode("background-video-status");
        const text = getNode("background-video-status-text");
        if (!status || !text) return;
        text.textContent = String(message || "").trim() || "Background video updated";
        status.hidden = false;
        status.dataset.status = "done";
        status.classList?.toggle?.("background-video-status--hidden", false);
        if (backgroundStatusToastTimerId != null) {
            getWindowRef()?.clearTimeout?.(backgroundStatusToastTimerId);
            backgroundStatusToastTimerId = null;
        }
        backgroundStatusToastTimerId = getWindowRef()?.setTimeout?.(() => {
            status.classList?.toggle?.("background-video-status--hidden", true);
            status.hidden = true;
            backgroundStatusToastTimerId = null;
        }, BACKGROUND_STATUS_TOAST_DURATION_MS) ?? null;
    }

    function getPanelRegistryState() {
        if (!panelAvailable) return "closed";
        return panelState;
    }

    function syncPanelRegistry() {
        updateMissionPanel(BACKGROUND_MEDIA_PANEL_ID, {
            available: panelAvailable,
            state: getPanelRegistryState(),
            actions: {
                open: panelAvailable ? openPanel : null,
                restore: panelAvailable ? openPanel : null,
                focus: panelAvailable ? focusPanel : null,
                close: panelAvailable ? closePanel : null,
            },
        });
    }

    function destroyHlsInstance() {
        if (!hlsInstance) return;
        try {
            hlsInstance.destroy?.();
        } catch {
            // hls.js can throw while tearing down a partial stream attachment.
        }
        hlsInstance = null;
        hlsSourceUrl = "";
        hlsReadySourceUrl = "";
    }

    function clearVideoSource() {
        const video = getVideo();
        const hadSource = Boolean(
            activeItemId
            || videoSourceUrl
            || hlsInstance
            || video?.getAttribute?.("src")
            || video?.currentSrc,
        );
        if (!hadSource) {
            playRequestPending = false;
            return;
        }
        hlsAttachToken += 1;
        destroyHlsInstance();
        hlsUnsupportedSourceUrl = "";
        activeItemId = "";
        videoSourceUrl = "";
        if (video) {
            callMediaMethod(video, "pause");
            video.removeAttribute?.("src");
            video.removeAttribute?.("poster");
            callMediaMethod(video, "load");
            if (video.dataset) {
                video.dataset.mediaItemId = "";
                video.dataset.mediaSourceUrl = "";
                video.dataset.sourceType = "";
            }
        }
        playRequestPending = false;
        lastAppliedPlaybackRate = Number.NaN;
    }

    function setNativeVideoSource(video, item, sourceUrl) {
        destroyHlsInstance();
        hlsUnsupportedSourceUrl = "";
        hlsReadySourceUrl = isLikelyHlsSource(sourceUrl, resolveVideoSourceType(item)) ? sourceUrl : "";
        if (videoSourceUrl !== sourceUrl || video.getAttribute?.("src") !== sourceUrl) {
            videoSourceUrl = sourceUrl;
            video.src = sourceUrl;
            callMediaMethod(video, "load");
        }
        if (item.posterAssetUrl) {
            video.poster = item.posterAssetUrl;
        }
    }

    function attachHlsVideoSource(video, item, sourceUrl) {
        if (hlsUnsupportedSourceUrl === sourceUrl) return;
        if (hlsInstance && hlsSourceUrl === sourceUrl && videoSourceUrl === sourceUrl) return;
        hlsAttachToken += 1;
        const attachToken = hlsAttachToken;
        destroyHlsInstance();
        videoSourceUrl = sourceUrl;
        hlsReadySourceUrl = "";
        video.removeAttribute?.("src");
        if (item.posterAssetUrl) {
            video.poster = item.posterAssetUrl;
        }
        callMediaMethod(video, "load");

        loadHlsLibraryFn().then((Hls) => {
            if (attachToken !== hlsAttachToken || videoSourceUrl !== sourceUrl) return;
            if (!Hls || typeof Hls.isSupported !== "function" || !Hls.isSupported()) {
                if (canPlayHlsNatively(video)) {
                    setNativeVideoSource(video, item, sourceUrl);
                    return;
                }
                hlsUnsupportedSourceUrl = sourceUrl;
                setText("background-media-status", "HLS unavailable");
                return;
            }

            const instance = new Hls({
                autoStartLoad: false,
                enableWorker: true,
                lowLatencyMode: false,
            });
            hlsInstance = instance;
            hlsSourceUrl = sourceUrl;
            if (getWindowRef()?.__moonMissionDebugHls === true) {
                Object.values(Hls.Events || {}).forEach((eventName) => {
                    instance.on(eventName, (_event, data) => {
                        getWindowRef()?.console?.debug?.("background-hls", eventName, data || {});
                    });
                });
            }
            instance.on(Hls.Events.MEDIA_ATTACHED, () => {
                if (attachToken !== hlsAttachToken || hlsInstance !== instance) return;
                instance.loadSource(sourceUrl);
            });
            const retryRender = () => {
                if (attachToken !== hlsAttachToken || hlsInstance !== instance) return;
                hlsReadySourceUrl = sourceUrl;
                playRequestPending = false;
                render(lastRenderModel);
            };
            instance.on(Hls.Events.MANIFEST_PARSED, retryRender);
            instance.on(Hls.Events.LEVEL_LOADED, retryRender);
            instance.on(Hls.Events.ERROR, (_event, data = {}) => {
                if (hlsInstance !== instance || data.fatal !== true) return;
                if (data.details === "manifestIncompatibleCodecsError") {
                    destroyHlsInstance();
                    setText("background-media-status", "Video codec unsupported");
                    return;
                }
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    instance.startLoad();
                    return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    instance.recoverMediaError();
                    return;
                }
                destroyHlsInstance();
                setText("background-media-status", "Playback error");
            });
            instance.attachMedia(video);
        });
    }

    function configureVideoSource(item) {
        const video = getVideo();
        if (!video || !item) return;
        const sourceUrl = item.assetUrl || "";
        if (!sourceUrl) {
            clearVideoSource();
            return;
        }
        activeItemId = item.id;
        video.muted = muted;
        video.loop = false;
        video.removeAttribute?.("loop");
        video.classList.toggle("background-media-panel__video--cover", item.backgroundPlayback?.fit === "cover");
        if (video.dataset) {
            video.dataset.mediaItemId = item.id || "";
            video.dataset.mediaSourceUrl = sourceUrl;
            video.dataset.sourceType = resolveVideoSourceType(item);
        }
        if (isLikelyHlsSource(sourceUrl, resolveVideoSourceType(item))) {
            attachHlsVideoSource(video, item, sourceUrl);
            return;
        }
        setNativeVideoSource(video, item, sourceUrl);
    }

    function pauseVideo({
        stopHlsLoad = true,
    } = {}) {
        const video = getVideo();
        const alreadyPaused = video?.paused === true && playRequestPending !== true;
        if (stopHlsLoad === true) {
            try {
                hlsInstance?.stopLoad?.();
            } catch {
                // Ignore HLS loader state races during media transitions.
            }
        }
        if (alreadyPaused) return;
        callMediaMethod(video, "pause");
        playRequestPending = false;
    }

    function keepHlsLoadingForFramePreview(offsetSeconds) {
        const video = getVideo();
        if (!isLikelyHlsSource(videoSourceUrl, video?.dataset?.sourceType)) return;
        try {
            hlsInstance?.startLoad?.(Number.isFinite(offsetSeconds)
                ? Math.max(0, offsetSeconds)
                : (Number(video?.currentTime) || 0));
        } catch {
            // hls.js can reject loader restarts while it is attaching media.
        }
    }

    function playVideo() {
        const video = getVideo();
        if (!video) return false;
        if (video.paused === false) return true;
        if (playRequestPending === true) return false;
        if (isLikelyHlsSource(videoSourceUrl, video?.dataset?.sourceType) && hlsReadySourceUrl !== videoSourceUrl) {
            setText("background-media-status", "Loading broadcast");
            return false;
        }
        try {
            hlsInstance?.startLoad?.(Number(video.currentTime) || 0);
        } catch {
            // hls.js can reject loader restarts while it is attaching media.
        }
        playRequestPending = true;
        const result = callMediaMethod(video, "play");
        if (result && typeof result.catch === "function") {
            Promise.resolve(result).then(() => {
                playRequestPending = false;
            }).catch(() => {
                playRequestPending = false;
                setText("background-media-status", muted ? "Tap play to start" : "Autoplay blocked");
            });
            return true;
        }
        playRequestPending = false;
        return true;
    }

    function setVideoCurrentTime(seconds, {
        transportPlayback = false,
        force = false,
    } = {}) {
        const video = getVideo();
        if (!video || !Number.isFinite(seconds)) return;
        const currentSeconds = Number(video.currentTime);
        const toleranceSeconds = transportPlayback
            ? TRANSPORT_SEEK_SYNC_EPSILON_SECONDS
            : SEEK_SYNC_EPSILON_SECONDS;
        if (
            force !== true
            && Number.isFinite(currentSeconds)
            && Math.abs(currentSeconds - seconds) < toleranceSeconds
        ) {
            return;
        }
        try {
            video.currentTime = Math.max(0, seconds);
        } catch {
            // Metadata may not be loaded yet; the next update will retry.
        }
    }

    function setVideoPlaybackRate(rate = Number.NaN) {
        const video = getVideo();
        if (!video) return;
        const requestedRate = Number(rate);
        const multiplier = Number.isFinite(requestedRate) && requestedRate > 0
            ? requestedRate
            : (getAnimationRealtime() === true ? 1 : Number(getAnimationSpeedMultiplier()));
        const safeRate = Number.isFinite(multiplier) && multiplier > 0
            ? clamp(multiplier, 0.1, MAX_PLAYBACK_RATE)
            : 1;
        if (Number.isFinite(lastAppliedPlaybackRate) && Math.abs(lastAppliedPlaybackRate - safeRate) < 0.001) {
            return;
        }
        try {
            video.playbackRate = safeRate;
            lastAppliedPlaybackRate = safeRate;
        } catch {
            // Some browsers reject rates for particular media types.
        }
    }

    function syncButtons() {
        const enableButton = getNode("background-media-enable");
        if (enableButton) {
            const buttonState = resolveBackgroundPlaybackButtonState({
                playbackEnabled,
                animationRunning: playbackTimelineRunning,
            });
            enableButton.classList.toggle("is-active", playbackEnabled);
            enableButton.setAttribute("aria-pressed", buttonState.pressed ? "true" : "false");
            enableButton.textContent = buttonState.label;
            enableButton.title = buttonState.title;
            enableButton.setAttribute("aria-label", enableButton.title);
        }
        const muteButton = getNode("background-media-mute");
        if (muteButton) {
            const buttonMuted = effectiveAudioMuted === true;
            const audioStatus = mutedForForegroundMedia === true
                ? "foreground-muted"
                : (buttonMuted ? "muted" : "audible");
            muteButton.textContent = "";
            muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
            muteButton.dataset.icon = buttonMuted ? "speaker-muted" : "speaker";
            muteButton.dataset.audioStatus = audioStatus;
            muteButton.title = mutedForForegroundMedia === true
                ? "Muted for foreground media"
                : (muted ? "Unmute background video" : "Mute background video");
            muteButton.setAttribute("aria-label", muteButton.title);
        }
        const expandButton = getNode("background-media-panel-expand");
        if (expandButton) {
            expandButton.setAttribute("aria-pressed", expanded ? "true" : "false");
            expandButton.dataset.icon = expanded ? "restore" : "expand";
            expandButton.title = expanded ? "Restore" : "Expand";
        }
    }

    function syncPanelVisibility({
        forceLayout = false,
    } = {}) {
        const wrapper = getWrapper();
        const panel = getPanel();
        if (!wrapper || !panel) return;
        const visible = panelAvailable && panelState === "open";
        wrapper.hidden = !visible;
        panel.classList.toggle("background-media-panel--hidden", !visible);
        panel.classList.toggle("is-maximized", expanded);
        if (!visible) {
            panelLayoutApplied = false;
        }
        if (visible) {
            if (expanded) {
                panel.style.left = `${PANEL_EDGE_MARGIN_PX}px`;
                panel.style.top = `${PANEL_EDGE_MARGIN_PX}px`;
                panel.style.width = `calc(100vw - ${PANEL_EDGE_MARGIN_PX * 2}px)`;
                panel.style.height = `calc(100vh - ${PANEL_EDGE_MARGIN_PX * 2}px)`;
            } else if (dragState == null && (forceLayout === true || panelLayoutApplied !== true)) {
                const saved = readMissionPanelState(BACKGROUND_MEDIA_PANEL_ID);
                const useSavedRect = storedLayoutMatchesPreset === true && saved?.rect;
                const appliedRect = applyPanelRect(
                    panel,
                    useSavedRect ? saved.rect : getDefaultPanelRect(),
                );
                panelLayoutApplied = true;
                if (!useSavedRect) {
                    persistState({ rect: appliedRect });
                    storedLayoutMatchesPreset = true;
                }
                requestWorkflowStackLayout();
            }
        }
        syncButtons();
        syncPanelRegistry();
    }

    function bringPanelToFront() {
        bringPanelElementToFront(getWrapper());
    }

    function capturePanelRect(panel = getPanel()) {
        if (!panel) return null;
        const rect = panel.getBoundingClientRect?.() || null;
        return {
            left: Math.round(Number(rect?.left) || panel.offsetLeft || PANEL_EDGE_MARGIN_PX),
            top: Math.round(Number(rect?.top) || panel.offsetTop || PANEL_EDGE_MARGIN_PX),
            width: Math.round(Number(rect?.width) || panel.offsetWidth || DEFAULT_PANEL_WIDTH_PX),
            height: Math.round(Number(rect?.height) || panel.offsetHeight || getDefaultPanelHeightForWidth(DEFAULT_PANEL_WIDTH_PX)),
        };
    }

    function persistPanelRect(panel = getPanel()) {
        const rect = capturePanelRect(panel);
        if (rect) persistState({ rect });
    }

    function shouldStartPanelDrag(event) {
        if (event.button !== 0 || expanded === true) return false;
        const target = event?.target;
        if (!target || typeof target.closest !== "function") return true;
        return !target.closest("button, input, select, option, label, output, a");
    }

    function bindPanelDragging() {
        const panel = getPanel();
        const header = panel?.querySelector?.(".background-media-panel__header");
        if (!panel || !header) return;

        header.addEventListener?.("pointerdown", (event) => {
            if (!shouldStartPanelDrag(event)) return;
            const rect = capturePanelRect(panel);
            if (!rect) return;
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                rect,
            };
            header.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        const handlePointerMove = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            applyPanelRect(panel, {
                ...dragState.rect,
                left: dragState.rect.left + dx,
                top: dragState.rect.top + dy,
            });
            event.preventDefault();
        };

        const releaseDrag = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            if (typeof header.hasPointerCapture !== "function" || header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture?.(event.pointerId);
            }
            dragState = null;
            persistPanelRect(panel);
            event.preventDefault();
        };

        const documentRef = getDocumentRef();
        documentRef?.addEventListener?.("pointermove", handlePointerMove, true);
        documentRef?.addEventListener?.("pointerup", releaseDrag, true);
        documentRef?.addEventListener?.("pointercancel", releaseDrag, true);
        header.addEventListener?.("pointermove", handlePointerMove);
        header.addEventListener?.("pointerup", releaseDrag);
        header.addEventListener?.("pointercancel", releaseDrag);
        header.addEventListener?.("lostpointercapture", releaseDrag);
    }

    function setControlsHidden(hidden) {
        const controls = getNode("background-media-controls");
        if (controls) controls.hidden = hidden === true;
    }

    function openPanel() {
        if (!panelAvailable) return;
        panelState = "open";
        panelLayoutApplied = false;
        persistState();
        syncPanelVisibility();
        bringPanelToFront();
        focusPanel();
    }

    function closePanel() {
        panelState = "closed";
        panelLayoutApplied = false;
        persistState();
        clearVideoSource();
        syncPanelVisibility();
    }

    function focusPanel() {
        const panel = getPanel();
        if (!panel || panel.classList.contains("background-media-panel--hidden")) return;
        panel.focus?.();
    }

    function toggleExpanded() {
        const wasExpanded = expanded === true;
        expanded = !expanded;
        persistState();
        syncPanelVisibility({ forceLayout: wasExpanded && expanded !== true });
    }

    function togglePlaybackEnabled() {
        if (playbackEnabled === true && getAnimationRunning() !== true) {
            onRequestPlay();
            syncButtons();
            render(lastRenderModel);
            return;
        }
        playbackEnabled = !playbackEnabled;
        persistState();
        if (!playbackEnabled) {
            pauseVideo();
            setText("background-media-status", "Paused");
            onRequestPause();
        } else {
            onRequestPlay();
        }
        syncButtons();
        render(lastRenderModel);
    }

    function toggleMuted() {
        muted = !muted;
        hasStoredMutedPreference = true;
        effectiveAudioMuted = muted;
        mutedForForegroundMedia = false;
        const video = getVideo();
        if (video) video.muted = muted;
        persistState();
        syncButtons();
        render(lastRenderModel);
    }

    function renderEmptyState(lines = []) {
        const empty = getNode("background-media-empty");
        if (!empty) return;
        empty.replaceChildren();
        const normalizedLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
        if (normalizedLines.length === 0) {
            empty.textContent = "No background video at this mission time.";
            return;
        }
        normalizedLines.forEach((line, index) => {
            const row = getDocumentRef()?.createElement?.(index === 0 ? "strong" : "span");
            if (!row) return;
            row.textContent = line;
            empty.appendChild(row);
        });
    }

    function appendEmptyStateText(parent, tagName, className, text) {
        const node = getDocumentRef()?.createElement?.(tagName);
        if (!node) return null;
        if (className) node.className = className;
        node.textContent = text;
        parent.appendChild(node);
        return node;
    }

    function jumpToBackgroundItemStart(item) {
        const startTimeMs = Number(item?.startTimeMs);
        if (!Number.isFinite(startTimeMs)) return;
        playbackEnabled = true;
        persistState();
        syncButtons();
        onJumpToTime(startTimeMs, item);
        onRequestPlay();
    }

    function renderBroadcastAvailabilityState(nearest) {
        const empty = getNode("background-media-empty");
        if (!empty || !nearest?.item) return false;
        empty.replaceChildren();
        const item = nearest.item;
        const deltaLabel = formatRangeDelta(nearest.deltaMs);
        const isBefore = nearest.relation === "before";
        appendEmptyStateText(
            empty,
            "span",
            "background-media-panel__empty-kicker",
            "Lunar flyby broadcast",
        );
        appendEmptyStateText(
            empty,
            "strong",
            "background-media-panel__empty-headline",
            "Broadcast video is available for the flyby.",
        );
        appendEmptyStateText(
            empty,
            "span",
            "background-media-panel__empty-copy",
            isBefore
                ? `It starts in ${deltaLabel}.`
                : `This point is after the broadcast; it ended ${deltaLabel} ago.`,
        );
        const button = getDocumentRef()?.createElement?.("button");
        if (button) {
            button.type = "button";
            button.className = "background-media-panel__jump-button";
            button.textContent = "Jump to broadcast start";
            button.addEventListener?.("click", () => jumpToBackgroundItemStart(item));
            empty.appendChild(button);
        }
        formatBroadcastTimingNotes(item, getMissionStartTime()).forEach((line) => {
            appendEmptyStateText(empty, "span", "background-media-panel__empty-note", line);
        });
        return true;
    }

    function renderOutOfRangeState(candidates, timeMs) {
        const nearest = resolveNearestInactiveBackgroundItem(candidates, timeMs);
        if (!nearest?.item) {
            renderEmptyState(["No background video at this mission time."]);
            setText("background-media-title", candidates.length > 0 ? "No background video in range" : "No background videos configured");
            setText("background-media-status", "Not in range");
            return;
        }
        const title = nearest.item.title || "Background video";
        const deltaLabel = formatRangeDelta(nearest.deltaMs);
        if (!renderBroadcastAvailabilityState(nearest)) {
            renderEmptyState([
                "Broadcast video is available for the flyby.",
                ...formatVideoRangeInfo(nearest.item, getMissionStartTime()),
            ]);
        }
        setText("background-media-title", title);
        setText(
            "background-media-status",
            nearest.relation === "before" ? `Available in ${deltaLabel}` : "Available at flyby",
        );
    }

    function ensurePanelEventsBound() {
        if (panelEventsBound) return;
        const panel = getPanel();
        if (!panel) return;
        panelEventsBound = true;
        getNode("background-media-panel-close")?.addEventListener?.("click", closePanel);
        getNode("background-media-panel-expand")?.addEventListener?.("click", toggleExpanded);
        getNode("background-media-enable")?.addEventListener?.("click", togglePlaybackEnabled);
        getNode("background-media-mute")?.addEventListener?.("click", toggleMuted);
        panel.addEventListener?.("pointerdown", bringPanelToFront, true);
        bindPanelDragging();
        const video = getVideo();
        ["loadedmetadata", "canplay"].forEach((eventName) => {
            video?.addEventListener?.(eventName, () => render(lastRenderModel));
        });
        getWindowRef()?.addEventListener?.("resize", () => {
            if (panelState === "open") syncPanelVisibility({ forceLayout: true });
        }, { passive: true });
    }

    function ensureAnimationPlayStateEventBound() {
        if (!animationPlayStateEventBound && typeof getDocumentRef()?.addEventListener === "function") {
            animationPlayStateEventBound = true;
            getDocumentRef().addEventListener("animation-play-state-updated", (event) => {
                render({
                    ...lastRenderModel,
                    animationRunning: event?.detail?.isPlaying === true,
                });
            });
        }
    }

    function restoreStoredState() {
        const stored = readMissionPanelState(BACKGROUND_MEDIA_PANEL_ID);
        storedLayoutMatchesPreset = String(stored?.layoutPresetVersion || "").trim()
            === BACKGROUND_MEDIA_LAYOUT_PRESET_VERSION;
        const useStoredState = storedLayoutMatchesPreset === true;
        if (useStoredState && typeof stored?.playbackEnabled === "boolean") {
            playbackEnabled = stored.playbackEnabled;
        }
        if (
            useStoredState
            && stored?.mutedPreferenceSet === true
            && typeof stored?.muted === "boolean"
        ) {
            muted = stored.muted;
            hasStoredMutedPreference = true;
        } else {
            hasStoredMutedPreference = false;
        }
        if (useStoredState && typeof stored?.expanded === "boolean") {
            expanded = stored.expanded;
        }
        panelState = (useStoredState ? stored?.state : "") || getMissionPanelDefaultState(
            missionConfigData,
            BACKGROUND_MEDIA_PANEL_ID,
            { fallbackState: "closed" },
        );
    }

    function setMissionContext({
        configData,
        available,
    } = {}) {
        missionConfigData = configData || missionConfigData;
        const enabledByMission = missionConfigData
            ? isMissionPanelEnabled(missionConfigData, BACKGROUND_MEDIA_PANEL_ID, { fallbackEnabled: false })
            : false;
        panelAvailable = available === true && enabledByMission;
        ensurePanelEventsBound();
        if (panelAvailable) {
            ensureAnimationPlayStateEventBound();
        }
        restoreStoredState();
        if (!panelAvailable) {
            clearVideoSource();
        }
        syncPanelVisibility();
    }

    function render({
        items = [],
        timeMs = Number.NaN,
        animationRunning = false,
        foregroundMediaState = null,
    } = {}) {
        ensurePanelEventsBound();
        lastRenderModel = {
            items,
            timeMs,
            animationRunning,
            foregroundMediaState,
        };
        const candidates = resolveBackgroundCandidates(items);
        const activeItem = resolveActiveBackgroundItem(candidates, timeMs);
        const available = panelAvailable && candidates.length > 0;
        playbackTimelineRunning = playbackEnabled === true && animationRunning === true;
        if (!available || !activeItem) {
            lastPlaybackMode = "";
            lastForegroundEffect = "";
            setControlsHidden(true);
            syncTimeOverlay(Number.NaN, true);
            setHidden("background-media-empty", false);
            setHidden("background-media-live", true);
            if (available) {
                renderOutOfRangeState(candidates, timeMs);
            } else {
                renderEmptyState(["No background videos configured."]);
                setText("background-media-title", "No background videos configured");
                setText("background-media-status", "Unavailable");
            }
            clearVideoSource();
            return;
        }

        setControlsHidden(true);
        setHidden("background-media-empty", true);
        setText("background-media-title", activeItem.title || "Background video");
        const video = getVideo();
        const foregroundMediaActive = foregroundMediaState?.active === true;
        const foregroundMediaKind = String(foregroundMediaState?.kind || "").trim();
        const playbackMode = resolveBackgroundPlaybackMode({
            panelState,
            playbackEnabled,
            animationRunning,
            foregroundMediaActive,
            foregroundMediaKind,
        });
        const sourceChanged = activeItem.id !== activeItemId || activeItem.assetUrl !== videoSourceUrl;
        const offsetSeconds = resolvePlaybackOffsetSeconds(activeItem, timeMs);
        syncTimeOverlay(offsetSeconds, false);

        if (playbackMode === "ready") {
            const keepPausedSource = panelState === "open" && playbackEnabled === true;
            if (keepPausedSource) {
                if (sourceChanged) {
                    configureVideoSource(activeItem);
                }
                setVideoCurrentTime(offsetSeconds, { force: sourceChanged });
                if (!hasStoredMutedPreference) {
                    muted = activeItem.backgroundPlayback?.muted !== false;
                }
                effectiveAudioMuted = muted;
                mutedForForegroundMedia = false;
                if (video) video.muted = muted;
                pauseVideo();
                lastPlaybackMode = playbackMode;
                setHidden("background-media-live", true);
                setText("background-media-status", `Paused ${formatStatusTime(offsetSeconds)}`);
                syncButtons();
                return;
            }
            if (lastPlaybackMode !== "ready") {
                pauseVideo();
            }
            clearVideoSource();
            lastPlaybackMode = playbackMode;
            setHidden("background-media-live", true);
            setText(
                "background-media-status",
                playbackEnabled ? `Paused ${formatStatusTime(offsetSeconds)}` : "Paused",
            );
            syncButtons();
            return;
        }

        if (sourceChanged) {
            configureVideoSource(activeItem);
        }

        const streamSyncPlan = buildMediaStreamSyncPlan({
            stream: activeItem,
            missionTimeMs: timeMs,
            isMissionPlaying: playbackMode === "playing" || playbackMode === "muted-for-foreground",
            currentPlaybackTimeSeconds: Number(video?.currentTime),
            hardSeekThresholdSeconds: STREAM_HARD_SEEK_THRESHOLD_SECONDS,
            softCorrectionThresholdSeconds: STREAM_SOFT_CORRECTION_THRESHOLD_SECONDS,
        });
        const resumingAfterForegroundMedia = playbackMode === "playing"
            && (lastPlaybackMode === "muted-for-foreground" || lastPlaybackMode === "paused-for-foreground-video");
        if (
            sourceChanged
            || streamSyncPlan.mode === "hard-seek"
            || playbackMode === "paused-for-foreground-video"
            || resumingAfterForegroundMedia
        ) {
            setVideoCurrentTime(offsetSeconds, {
                force: sourceChanged || resumingAfterForegroundMedia,
                transportPlayback: playbackMode === "playing" || playbackMode === "muted-for-foreground",
            });
        }
        const basePlaybackRate = getAnimationRealtime() === true ? 1 : Number(getAnimationSpeedMultiplier());
        const correctionPlaybackRate = Number(streamSyncPlan.playbackRate);
        const useTransportPlayback = shouldUseBackgroundTransportPlayback({
            animationRealtime: getAnimationRealtime() === true,
            animationSpeedMultiplier: basePlaybackRate,
        });
        setVideoPlaybackRate(useTransportPlayback
            ? (Number.isFinite(basePlaybackRate) && basePlaybackRate > 0 ? basePlaybackRate : 1)
                * (Number.isFinite(correctionPlaybackRate) && correctionPlaybackRate > 0 ? correctionPlaybackRate : 1)
            : 1);
        if (!hasStoredMutedPreference) {
            muted = activeItem.backgroundPlayback?.muted !== false;
        }
        const effectiveMuted = muted || playbackMode === "muted-for-foreground";
        effectiveAudioMuted = effectiveMuted;
        mutedForForegroundMedia = playbackMode === "muted-for-foreground";
        if (video) video.muted = effectiveMuted;

        if (!useTransportPlayback && (playbackMode === "playing" || playbackMode === "muted-for-foreground")) {
            pauseVideo({ stopHlsLoad: false });
            keepHlsLoadingForFramePreview(offsetSeconds);
            setVideoCurrentTime(offsetSeconds, { force: sourceChanged });
            setHidden("background-media-live", true);
            setText("background-media-status", playbackMode === "muted-for-foreground"
                ? "Muted for Foreground Media"
                : `Frame preview ${formatStatusTime(offsetSeconds)}`);
            lastForegroundEffect = playbackMode === "muted-for-foreground" ? "muted" : "";
        } else if (playbackMode === "playing") {
            const playStarted = playVideo();
            setHidden("background-media-live", !playStarted);
            setText("background-media-status", playStarted
                ? `Playing ${formatStatusTime(offsetSeconds)}`
                : "Loading broadcast");
            if (lastForegroundEffect === "muted") {
                showBackgroundStatusToast(muted ? "Foreground media ended; background video remains muted" : "Background video audio restored");
            } else if (lastForegroundEffect === "paused") {
                showBackgroundStatusToast("Foreground video ended; broadcast resumed");
            }
            lastForegroundEffect = "";
        } else if (playbackMode === "muted-for-foreground") {
            const playStarted = playVideo();
            setHidden("background-media-live", !playStarted);
            setText("background-media-status", playStarted ? "Muted for Foreground Media" : "Loading broadcast");
            lastForegroundEffect = "muted";
        } else if (playbackMode === "paused-for-foreground-video") {
            if (lastPlaybackMode !== playbackMode) {
                pauseVideo();
            }
            setHidden("background-media-live", true);
            setText("background-media-status", "Paused for Foreground Media");
            lastForegroundEffect = "paused";
        } else {
            if (lastPlaybackMode !== playbackMode) {
                pauseVideo();
            }
            setHidden("background-media-live", true);
            setText(
                "background-media-status",
                playbackEnabled ? `Paused ${formatStatusTime(offsetSeconds)}` : "Paused",
            );
        }
        lastPlaybackMode = playbackMode;
        syncButtons();
    }

    registerMissionPanel({
        id: BACKGROUND_MEDIA_PANEL_ID,
        title: "Flyby Broadcast",
        kind: "workflow",
        panelType: "background-media",
        builtIn: true,
        available: panelAvailable,
        state: getPanelRegistryState(),
        sortOrder: 44,
        actions: {},
    });
    syncPanelRegistry();

    return {
        render,
        setMissionContext,
        setPanelState(nextState) {
            const wasOpen = panelState === "open";
            panelState = nextState || "closed";
            if (panelState !== "open" || wasOpen !== true) {
                panelLayoutApplied = false;
            }
            persistState();
            syncPanelVisibility();
            if (panelState === "open") {
                bringPanelToFront();
            }
        },
    };
}

export {
    BACKGROUND_MEDIA_PANEL_ID,
    createBackgroundMediaPanelActions,
    isBackgroundVideoItem,
    resolveActiveBackgroundItem,
    resolveBackgroundCandidates,
    resolveBackgroundPlaybackButtonState,
    resolveBackgroundPlaybackMode,
    resolveNearestInactiveBackgroundItem,
    shouldUseBackgroundTransportPlayback,
};
