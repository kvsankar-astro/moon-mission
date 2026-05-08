import { normalizeMissionMediaManifest } from "../core/domain/media-manifest.js";
import {
    buildMediaFilterModel,
    filterMediaItems,
} from "../core/domain/media-filter-state.js";
import { resolveMediaSelectionState } from "../core/domain/media-selection-state.js";
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

function formatSignedDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds === 0) return "0s";
    const sign = seconds > 0 ? "+" : "-";
    return `${sign}${formatDuration(Math.abs(seconds) * 1000, { compact: true })}`;
}

function buildStageBadge(item) {
    if (!item) return "";
    const parts = [];
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
    if (item.kind === "videoClip") {
        return item.posterAssetUrl || item.thumbnailAssetUrl || "";
    }
    return item.assetUrl || item.thumbnailAssetUrl || item.posterAssetUrl || "";
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

function seekMainTimelineTime(timeMs, finalize = false) {
    const slider = document.getElementById("timeline-slider");
    if (!(slider instanceof HTMLInputElement)) return false;
    const min = Math.min(Number(slider.min), Number(slider.max));
    const max = Math.max(Number(slider.min), Number(slider.max));
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(timeMs)) {
        return false;
    }
    const clamped = Math.max(min, Math.min(max, timeMs));
    slider.value = String(clamped);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    if (finalize) {
        slider.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return clamped === timeMs;
}

function createMediaTimelineCoordination({
    getStartTime = () => Number.NaN,
    getLatestEndTime = () => Number.NaN,
    getAnimationRunning = () => false,
    getIsCompareMode = () => false,
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

    function handlePanelIntent(intent) {
        const type = String(intent?.type || "").trim();
        if (!type) return;

        if (type === "setAudienceFilter") {
            runtimeMediaState.patchFilters({ audience: intent.value });
            rerender();
            return;
        }
        if (type === "setCameraFilter") {
            runtimeMediaState.patchFilters({ cameraId: intent.value });
            rerender();
            return;
        }
        if (type === "selectItem") {
            const manifest = runtimeMediaState.getManifest();
            const filteredItems = filterMediaItems(manifest?.mediaItems || [], runtimeMediaState.getFilters());
            const selectedItem = filteredItems.find((item) => item.id === intent.value) || null;
            if (!selectedItem) return;
            const seekSucceeded = seekMainTimelineTime(selectedItem.startTimeMs, true);
            if (!seekSucceeded) {
                runtimeMediaState.setActiveItemId(selectedItem.id);
                rerender();
            }
        }
    }

    function buildPanelViewModel({
        manifest,
        items,
        selection,
        timeMs,
    }) {
        const activeItem = selection.activeItem;
        const filterModel = buildMediaFilterModel(manifest.mediaItems, runtimeMediaState.getFilters());
        const seedNote = String(manifest?.ui?.seedNote || "").trim();
        const statusText = items.length === 0
            ? "No media matches the current filters."
            : (getAnimationRunning() === true
                ? `Following mission time through ${items.length} media items.`
                : `Paused on the nearest item within ${items.length} filtered media entries.`);

        return {
            panelTitle: String(manifest?.ui?.panelTitle || manifest?.title || "Mission Media").trim(),
            mediaCountLabel: String(items.length),
            descriptionEmptyText: items.length === 0
                ? "No media matches the current filters."
                : "--",
            stageEmptyText: items.length === 0
                ? "No media matches the current filters."
                : "No preview available for this media item.",
            seedNote,
            statusText,
            filterModel,
            activeItem: activeItem
                ? {
                    id: activeItem.id,
                    kind: activeItem.kind,
                    title: activeItem.title,
                    description: activeItem.description,
                    assetUrl: resolvePreviewAssetUrl(activeItem),
                    timeLabel: `${formatDateTimeLocal(activeItem.startTimeMs, { includeOffset: false })} • ${formatDateTimeUTC(activeItem.startTimeMs)}`,
                    cameraLabel: activeItem.cameraLabel,
                    photographer: activeItem.photographer,
                    location: activeItem.location,
                    sourceLabel: activeItem.sourceLabel || activeItem.fileName,
                    stageBadge: buildStageBadge(activeItem),
                    timingNote: buildTimingNote(activeItem, selection.activeDeltaMs),
                }
                : null,
            nearbyItems: (selection.nearbyItems || []).map((item) => ({
                id: item.id,
                active: item.id === activeItem?.id,
                title: item.title,
                meta: [
                    formatDateTimeLocal(item.startTimeMs, { includeOffset: false }),
                    item.cameraLabel,
                ].filter(Boolean).join(" • "),
            })),
            currentTimeMs: timeMs,
        };
    }

    function clearUi(globalConfig, {
        statusText = "No media manifest is available for this mission yet.",
    } = {}) {
        releaseTimelineEventBinding();
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
            nearbyItems: [],
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
            mediaCount: Array.isArray(manifest?.mediaItems) ? manifest.mediaItems.length : 0,
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
                nearbyItems: [],
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
        const filteredItems = filterMediaItems(manifest.mediaItems, runtimeMediaState.getFilters());
        const selection = resolveMediaSelectionState({
            items: filteredItems,
            timeMs,
            nearbyRadius: 3,
        });
        runtimeMediaState.setActiveItemId(selection.activeItem?.id || "");

        setTimelineMediaMarkers(buildMediaTimelineMarkers({
            items: filteredItems,
            timeMs,
            rangeStartMs: timelineStartMs,
            rangeEndMs: timelineEndMs,
        }));

        panelActions.render(buildPanelViewModel({
            manifest,
            items: filteredItems,
            selection,
            timeMs,
        }));
    }

    function dispose() {
        releaseTimelineEventBinding();
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
