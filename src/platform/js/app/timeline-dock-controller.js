import {
    formatDateOnlyLocal,
    formatDateTimeLocal,
    formatDuration,
    formatTimeOnlyLocal,
} from "../utils/time-utils.js";
import {
    resolveTimelineEventHoverText,
    resolveTimelineEventLabel,
} from "./comparison-timeline.js";
import { resolveTimelineEventHighlightState } from "../core/domain/timeline-event-highlight-state.js";
import { buildTimelineTimeLabels } from "../core/domain/timeline-time-labels.js";

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function computePercent(value, min, max) {
    const span = max - min;
    if (!Number.isFinite(span) || span <= 0) return 0;
    return ((value - min) / span) * 100;
}

function normalizeWheelDelta(delta, deltaMode, pixelFallback = 720) {
    if (!Number.isFinite(delta)) return 0;
    if (deltaMode === 1) return delta * 16;
    if (deltaMode === 2) return delta * pixelFallback;
    return delta;
}

function resolveWheelZoomFactor(deltaY) {
    if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
    const magnitude = clamp(Math.abs(deltaY), 12, 240);
    const direction = deltaY > 0 ? 1 : -1;
    return Math.exp(direction * magnitude * 0.0028);
}

function buildEventSignature(eventInfos) {
    if (!Array.isArray(eventInfos) || eventInfos.length === 0) return "";
    return eventInfos
        .map((eventInfo) => {
            const timeMs = eventInfo?.startTime instanceof Date
                ? eventInfo.startTime.getTime()
                : Number.NaN;
            return [
                eventInfo?.key || "",
                Number.isFinite(timeMs) ? String(timeMs) : "NaN",
                eventInfo?.label || "",
                eventInfo?.burnFlag ? "1" : "0",
                eventInfo?.clickable === false ? "0" : "1",
                eventInfo?.generated ? "1" : "0",
                eventInfo?.generatedLabel || "",
                eventInfo?.burnDirection || "",
                eventInfo?.burnTypeLabel || "",
                String(eventInfo?.durationSeconds ?? ""),
                eventInfo?.hoverText || "",
                eventInfo?.timelineLabel || "",
                eventInfo?.timelineHoverText || "",
                eventInfo?.timelineRole || "",
            ].join("|");
        })
        .join(";");
}

function buildMediaSignature(mediaMarkers) {
    if (!Array.isArray(mediaMarkers) || mediaMarkers.length === 0) return "";
    return mediaMarkers
        .map((marker) => {
            const timeMs = marker?.startTime instanceof Date
                ? marker.startTime.getTime()
                : Number(marker?.startTimeMs);
            return [
                marker?.id || "",
                Number.isFinite(timeMs) ? String(timeMs) : "NaN",
                marker?.label || "",
                marker?.hoverText || "",
                marker?.mediaKind || "",
                marker?.mediaDisplayMode || "",
                String(marker?.endTimeMs ?? ""),
                marker?.durationEstimated ? "1" : "0",
                marker?.selected ? "1" : "0",
                marker?.clickable === false ? "0" : "1",
                marker?.preEphemeris ? "1" : "0",
                marker?.postEphemeris ? "1" : "0",
            ].join("|");
        })
        .join(";");
}

function dispatchDocumentCustomEvent(type, detail) {
    if (typeof document === "undefined" || typeof document.dispatchEvent !== "function") {
        return;
    }
    if (typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent(type, { detail }));
        return;
    }
    const event = { type, detail };
    document.dispatchEvent(event);
}

function formatComparisonElapsedLabel(timeMs, rangeStartMs) {
    const elapsedMs = Math.max(0, Number(timeMs) - Number(rangeStartMs || 0));
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        return "T+0";
    }
    if (elapsedMs < 60000) {
        return "T+<1m";
    }
    return `T+${formatDuration(elapsedMs, {
        compact: true,
        includeSeconds: false,
    })}`;
}

function formatMissionElapsedLabel(timeMs, rangeStartMs) {
    const elapsedMs = Number(timeMs) - Number(rangeStartMs);
    if (!Number.isFinite(elapsedMs)) return "";
    const sign = elapsedMs < 0 ? "-" : "+";
    const absoluteMs = Math.abs(elapsedMs);
    const totalSeconds = Math.floor(absoluteMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return `MET ${sign}${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatUtcYearElapsedLabel(timeMs) {
    if (!Number.isFinite(timeMs)) return "";
    const date = new Date(timeMs);
    const yearStartMs = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
    const elapsedMs = timeMs - yearStartMs;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "";
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value, length = 2) => String(value).padStart(length, "0");
    return `UTC ${pad(days, 3)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function createTimelineDockController({
    onSeekTime,
    onMarkerSelect,
    onMarkerHover,
    onMarkerLeave,
    onCraftSelect,
}) {
    const dockRoot = document.getElementById("timeline-dock");
    const slider = document.getElementById("timeline-slider");
    const markers = document.getElementById("timeline-markers");
    const mediaMarkers = document.getElementById("timeline-media-markers");
    const playhead = document.getElementById("timeline-playhead");
    const timeLabels = document.getElementById("timeline-time-labels");
    const timeClickLane = document.getElementById("timeline-time-click-lane");
    const scrubLane = document.getElementById("timeline-scrub-lane");
    const eventVisibleRange = document.getElementById("timeline-event-visible-range");
    const overview = document.getElementById("timeline-overview");
    const overviewWindow = overview?.querySelector?.(".timeline-dock__overview-window") || null;
    const overviewCurrent = overview?.querySelector?.(".timeline-dock__overview-current") || null;
    const panLeftButton = document.getElementById("timeline-pan-left");
    const scaleContractButton = document.getElementById("timeline-scale-contract");
    const scaleResetButton = document.getElementById("timeline-scale-reset");
    const scaleExpandButton = document.getElementById("timeline-scale-expand");
    const panRightButton = document.getElementById("timeline-pan-right");
    const startLabel = document.getElementById("timeline-start-label");
    const endLabel = document.getElementById("timeline-end-label");
    const modeLabel = document.getElementById("timeline-mode-label");
    const currentLabel = document.getElementById("timeline-current-label");
    const utcYearElapsedLabel = document.getElementById("timeline-utc-year-elapsed-label");
    const missionElapsedLabel = document.getElementById("timeline-mission-elapsed-label");
    const craftStrip = document.getElementById("timeline-craft-strip");
    const EVENT_MARKER_HOVERED_CLASS = "timeline-dock__marker--hovered";

    if (!slider || !markers || !startLabel || !endLabel || !currentLabel || !craftStrip) {
        return {
            bind: () => {},
            setMode: () => {},
            setRange: () => {},
            setCurrentTime: () => {},
            setEvents: () => {},
            setMediaMarkers: () => {},
            setCrafts: () => {},
        };
    }

    let rangeMin = 0;
    let rangeMax = 0;
    let viewMin = 0;
    let viewMax = 0;
    let lastRangeSignature = "";
    let lastEventSignature = "";
    let lastEventInfos = [];
    let currentTimeMs = Number.NaN;
    let lastMediaSignature = "";
    let lastMediaMarkersData = [];
    let hoveredEventMarker = null;
    let hoveredVisibleEventRange = null;
    let isBound = false;
    let timelineDragState = null;
    let mediaPreviewElement = null;
    let mediaPreviewImage = null;
    let mediaPreviewTitle = null;
    let activeMediaPreviewMarker = null;
    let pendingMediaPreviewSource = "";
    const failedMediaPreviewSources = new Set();
    const timelineDragThresholdPx = 3;
    let currentMode = {
        compareMode: false,
        label: "",
        detail: "",
        title: "",
    };

    function updateCurrentLabel(timeMs) {
        if (currentMode.compareMode) {
            const elapsedLabel = formatComparisonElapsedLabel(timeMs, rangeMin);
            const label = `Comparison Elapsed • ${elapsedLabel}`;
            currentLabel.textContent = label;
            if (missionElapsedLabel) {
                missionElapsedLabel.textContent = "";
                missionElapsedLabel.title = "";
                missionElapsedLabel.hidden = true;
            }
            if (utcYearElapsedLabel) {
                utcYearElapsedLabel.textContent = "";
                utcYearElapsedLabel.title = "";
                utcYearElapsedLabel.hidden = true;
            }
            slider.setAttribute(
                "aria-valuetext",
                `Comparison elapsed time ${elapsedLabel}`,
            );
            return;
        }

        const label = formatDateTimeLocal(timeMs, { includeOffset: false });
        currentLabel.textContent = label;
        const utcYearElapsedText = formatUtcYearElapsedLabel(timeMs);
        if (utcYearElapsedLabel) {
            utcYearElapsedLabel.textContent = utcYearElapsedText;
            utcYearElapsedLabel.title = utcYearElapsedText
                ? "UTC year elapsed time"
                : "";
            utcYearElapsedLabel.hidden = utcYearElapsedText.length === 0;
        }
        const missionElapsedText = formatMissionElapsedLabel(timeMs, rangeMin);
        if (missionElapsedLabel) {
            missionElapsedLabel.textContent = missionElapsedText;
            missionElapsedLabel.title = missionElapsedText
                ? "Mission elapsed time"
                : "";
            missionElapsedLabel.hidden = missionElapsedText.length === 0;
        }
        slider.setAttribute(
            "aria-valuetext",
            [
                label,
                utcYearElapsedText ? `UTC year elapsed time ${utcYearElapsedText}` : "",
                missionElapsedText ? `mission elapsed time ${missionElapsedText}` : "",
            ].filter(Boolean).join(", "),
        );
    }

    function getTrackWidthPx() {
        const measuredWidth =
            timeLabels?.parentElement?.getBoundingClientRect?.()?.width ||
            timeClickLane?.getBoundingClientRect?.()?.width ||
            slider?.parentElement?.getBoundingClientRect?.()?.width ||
            slider?.getBoundingClientRect?.()?.width ||
            0;
        return Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : 720;
    }

    function getTimelineInteractionSurface() {
        return scrubLane || slider.parentElement || slider;
    }

    function getTimelinePointerSurface() {
        const interactionSurface = getTimelineInteractionSurface();
        return interactionSurface?.parentElement || interactionSurface;
    }

    function isNodeWithin(root, node) {
        if (!root || !node) return false;
        let current = node;
        while (current) {
            if (current === root) return true;
            current = current.parentElement;
        }
        return false;
    }

    function isPointInsideElement(element, clientX, clientY) {
        if (!element || element.hidden === true) return false;
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || rect.width <= 0) {
            return false;
        }
        const top = Number.isFinite(rect.top) ? rect.top : 0;
        const height = Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 0;
        if (height <= 0) return false;
        return clientX >= rect.left &&
            clientX <= rect.left + rect.width &&
            clientY >= top &&
            clientY <= top + height;
    }

    function resolvePointerZone(event, clientX, clientY) {
        if (isPlayheadPointerTarget(event?.target)) return "playhead";

        if (Number.isFinite(clientY)) {
            if (isPointInsideElement(scrubLane, clientX, clientY)) return "scrub";
            if (isPointInsideElement(mediaMarkers, clientX, clientY)) return "media-click-lane";
            if (isPointInsideElement(timeClickLane, clientX, clientY)) return "click-lane";
            if (isPointInsideElement(markers, clientX, clientY)) return "click-lane";
            return "";
        }

        if (isNodeWithin(scrubLane, event.target)) return "scrub";
        if (isNodeWithin(mediaMarkers, event.target)) return "media-click-lane";
        if (isNodeWithin(timeClickLane, event.target)) return "click-lane";
        if (isNodeWithin(markers, event.target)) return "click-lane";
        return "";
    }

    function getTimelineRect() {
        const rect = getTimelineInteractionSurface()?.getBoundingClientRect?.() ||
            timeClickLane?.getBoundingClientRect?.() ||
            slider?.getBoundingClientRect?.();
        if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) {
            return {
                left: 0,
                width: getTrackWidthPx(),
            };
        }
        return rect;
    }

    function getFullSpanMs() {
        syncRangeStateFromSliderIfNeeded();
        const spanMs = rangeMax - rangeMin;
        return Number.isFinite(spanMs) && spanMs > 0 ? spanMs : 0;
    }

    function getViewSpanMs() {
        const spanMs = viewMax - viewMin;
        return Number.isFinite(spanMs) && spanMs > 0 ? spanMs : getFullSpanMs();
    }

    function getMinViewSpanMs() {
        const fullSpanMs = getFullSpanMs();
        const stepMs = Number(slider.step);
        return Math.max(
            Number.isFinite(stepMs) && stepMs > 0 ? stepMs * 8 : 1,
            fullSpanMs / 96,
        );
    }

    function isTimelineZoomed() {
        return viewMin > rangeMin || viewMax < rangeMax;
    }

    function syncRangeStateFromSliderIfNeeded() {
        if (rangeMax > rangeMin && viewMax > viewMin) return;
        const sliderMin = Number(slider.min);
        const sliderMax = Number(slider.max);
        if (!Number.isFinite(sliderMin) || !Number.isFinite(sliderMax) || sliderMax <= sliderMin) return;
        if (!(rangeMax > rangeMin)) {
            rangeMin = sliderMin;
            rangeMax = sliderMax;
        }
        if (!(viewMax > viewMin)) {
            viewMin = sliderMin;
            viewMax = sliderMax;
        }
        if (!Number.isFinite(currentTimeMs)) {
            const sliderValue = Number(slider.value);
            currentTimeMs = Number.isFinite(sliderValue)
                ? clamp(sliderValue, rangeMin, rangeMax)
                : rangeMin;
        }
    }

    function clampViewWindow(nextMin, nextMax) {
        const fullSpanMs = getFullSpanMs();
        if (fullSpanMs <= 0) {
            return { min: rangeMin, max: rangeMax };
        }

        const minSpanMs = getMinViewSpanMs();
        const rawSpanMs = Math.max(minSpanMs, Math.min(fullSpanMs, nextMax - nextMin));
        let min = Number.isFinite(nextMin) ? nextMin : rangeMin;
        let max = min + rawSpanMs;

        if (min < rangeMin) {
            min = rangeMin;
            max = min + rawSpanMs;
        }
        if (max > rangeMax) {
            max = rangeMax;
            min = max - rawSpanMs;
        }

        return {
            min: clamp(min, rangeMin, rangeMax),
            max: clamp(max, rangeMin, rangeMax),
        };
    }

    function setScaleButtonDisabled(button, disabled) {
        if (!button) return;
        const isDisabled = disabled === true;
        button.disabled = isDisabled;
        if (isDisabled) {
            button.setAttribute?.("disabled", "");
        } else {
            button.removeAttribute?.("disabled");
        }
        button.setAttribute?.("aria-disabled", isDisabled ? "true" : "false");
    }

    function syncScaleButtons() {
        const fullSpanMs = getFullSpanMs();
        const viewSpanMs = getViewSpanMs();
        const minSpanMs = getMinViewSpanMs();
        const zoomed = isTimelineZoomed();
        setScaleButtonDisabled(panLeftButton, !zoomed || viewMin <= rangeMin);
        setScaleButtonDisabled(scaleContractButton, !zoomed);
        setScaleButtonDisabled(scaleResetButton, !zoomed);
        setScaleButtonDisabled(scaleExpandButton, fullSpanMs <= 0 || viewSpanMs <= minSpanMs * 1.01);
        setScaleButtonDisabled(panRightButton, !zoomed || viewMax >= rangeMax);
    }

    function syncTimelineOverview() {
        if (!overview || !overviewWindow) return;
        const fullSpanMs = getFullSpanMs();
        const zoomed = isTimelineZoomed() && fullSpanMs > 0;
        overview.hidden = !zoomed;
        if (!zoomed) return;

        const leftPercent = clamp(computePercent(viewMin, rangeMin, rangeMax), 0, 100);
        const rightPercent = clamp(computePercent(viewMax, rangeMin, rangeMax), 0, 100);
        overviewWindow.style.left = `${leftPercent}%`;
        overviewWindow.style.width = `${Math.max(0, rightPercent - leftPercent)}%`;

        if (!overviewCurrent) return;
        const currentPercent = clamp(computePercent(currentTimeMs, rangeMin, rangeMax), 0, 100);
        const showCurrent = Number.isFinite(currentTimeMs)
            && currentTimeMs >= rangeMin
            && currentTimeMs <= rangeMax;
        overviewCurrent.hidden = !showCurrent;
        if (showCurrent) {
            overviewCurrent.style.left = `${currentPercent}%`;
        }
    }

    function syncHoveredVisibleEventRange() {
        if (!eventVisibleRange) return;
        if (!hoveredVisibleEventRange) {
            eventVisibleRange.hidden = true;
            return;
        }
        const { startTimeMs, endTimeMs } = hoveredVisibleEventRange;
        if (
            !Number.isFinite(startTimeMs) ||
            !Number.isFinite(endTimeMs) ||
            !(viewMax > viewMin)
        ) {
            eventVisibleRange.hidden = true;
            return;
        }
        if (Math.max(startTimeMs, endTimeMs) < viewMin || Math.min(startTimeMs, endTimeMs) > viewMax) {
            eventVisibleRange.hidden = true;
            return;
        }
        const visibleStartTimeMs = clamp(Math.min(startTimeMs, endTimeMs), viewMin, viewMax);
        const visibleEndTimeMs = clamp(Math.max(startTimeMs, endTimeMs), viewMin, viewMax);
        const leftPercent = clamp(computePercent(visibleStartTimeMs, viewMin, viewMax), 0, 100);
        const rightPercent = clamp(computePercent(visibleEndTimeMs, viewMin, viewMax), 0, 100);
        eventVisibleRange.style.left = `${leftPercent}%`;
        eventVisibleRange.style.width = `${Math.max(0.25, rightPercent - leftPercent)}%`;
        eventVisibleRange.hidden = false;
    }

    function renderTimeLabels() {
        if (!timeLabels) {
            syncScaleButtons();
            syncTimelineOverview();
            syncHoveredVisibleEventRange();
            return;
        }
        const labels = buildTimelineTimeLabels({
            startTimeMs: viewMin,
            endTimeMs: viewMax,
            widthPx: getTrackWidthPx(),
            compareMode: currentMode.compareMode,
        });

        timeLabels.innerHTML = "";
        for (const labelInfo of labels) {
            const label = document.createElement("span");
            label.className = "timeline-dock__time-label";
            label.style.left = `${labelInfo.percent}%`;
            label.textContent = labelInfo.label;
            label.title = labelInfo.label;
            label.dataset.timeMs = String(labelInfo.timeMs);
            timeLabels.appendChild(label);
        }
        syncScaleButtons();
        syncTimelineOverview();
        syncHoveredVisibleEventRange();
    }

    function updateEdgeLabels() {
        startLabel.innerHTML = formatEdgeLabel(viewMin, "start");
        endLabel.innerHTML = formatEdgeLabel(viewMax, "end");
    }

    function syncSliderRangeToView() {
        slider.min = String(viewMin);
        slider.max = String(viewMax);
        const valueMs = Number.isFinite(currentTimeMs)
            ? currentTimeMs
            : Number(slider.value);
        slider.value = String(clamp(valueMs, viewMin, viewMax));
        syncSliderTimelineDataset();
        syncPlayhead();
    }

    function syncSliderTimelineDataset() {
        if (!slider?.dataset) return;
        slider.dataset.rangeMinMs = String(rangeMin);
        slider.dataset.rangeMaxMs = String(rangeMax);
        slider.dataset.viewMinMs = String(viewMin);
        slider.dataset.viewMaxMs = String(viewMax);
        if (Number.isFinite(currentTimeMs)) {
            slider.dataset.currentTimeMs = String(currentTimeMs);
        }
    }

    function syncPlayhead() {
        if (!playhead) return;
        const inView = Number.isFinite(currentTimeMs)
            && Number.isFinite(viewMin)
            && Number.isFinite(viewMax)
            && viewMax > viewMin
            && currentTimeMs >= viewMin
            && currentTimeMs <= viewMax;
        playhead.hidden = !inView;
        if (!inView) return;
        const leftPercent = clamp(computePercent(currentTimeMs, viewMin, viewMax), 0, 100);
        playhead.style.left = `${leftPercent}%`;
    }

    function dispatchTimelineUserSeek(phase, timeMs, {
        commit = false,
        source = "timeline",
    } = {}) {
        if (!Number.isFinite(timeMs)) return;
        dispatchDocumentCustomEvent("mission-timeline-user-seek", {
            phase,
            source,
            commit: commit === true,
            timeMs,
        });
    }

    function renderEventMarkersFromCache() {
        clearHoveredEventMarker();
        markers.innerHTML = "";
        for (let i = 0; i < lastEventInfos.length; i += 1) {
            const marker = renderMarker(lastEventInfos[i], i);
            if (marker) markers.appendChild(marker);
        }
        syncMarkerHighlights();
    }

    function renderMediaMarkersFromCache() {
        if (!mediaMarkers) return;
        mediaMarkers.innerHTML = "";
        mediaPreviewElement = null;
        mediaPreviewImage = null;
        mediaPreviewTitle = null;
        activeMediaPreviewMarker = null;
        pendingMediaPreviewSource = "";
        for (let i = 0; i < lastMediaMarkersData.length; i += 1) {
            const marker = renderMediaMarker(lastMediaMarkersData[i], i);
            if (marker) mediaMarkers.appendChild(marker);
        }
    }

    function renderVisualTimeline() {
        updateEdgeLabels();
        syncSliderRangeToView();
        renderTimeLabels();
        renderEventMarkersFromCache();
        renderMediaMarkersFromCache();
        dockRoot?.classList?.toggle?.("timeline-dock--zoomed", isTimelineZoomed());
        syncPlayhead();
        syncTimelineOverview();
        syncHoveredVisibleEventRange();
    }

    function setViewWindow(nextMin, nextMax) {
        const nextView = clampViewWindow(nextMin, nextMax);
        const changed = nextView.min !== viewMin || nextView.max !== viewMax;
        viewMin = nextView.min;
        viewMax = nextView.max;
        if (changed) {
            renderVisualTimeline();
        } else {
            syncScaleButtons();
        }
    }

    function resetViewWindow() {
        setViewWindow(rangeMin, rangeMax);
    }

    function resolveZoomAnchor() {
        if (Number.isFinite(currentTimeMs) && currentTimeMs >= viewMin && currentTimeMs <= viewMax) {
            return currentTimeMs;
        }
        return viewMin + getViewSpanMs() / 2;
    }

    function zoomView(factor, anchorMs = resolveZoomAnchor()) {
        const spanMs = getViewSpanMs();
        if (spanMs <= 0) return;
        const nextSpanMs = spanMs * factor;
        const anchorRatio = spanMs > 0
            ? clamp((anchorMs - viewMin) / spanMs, 0, 1)
            : 0.5;
        const nextMin = anchorMs - nextSpanMs * anchorRatio;
        setViewWindow(nextMin, nextMin + nextSpanMs);
    }

    function panView(deltaMs) {
        if (!isTimelineZoomed() || !Number.isFinite(deltaMs) || deltaMs === 0) return;
        setViewWindow(viewMin + deltaMs, viewMax + deltaMs);
    }

    function panViewFromDrag(startViewMin, startViewMax, startClientX, clientX) {
        if (!isTimelineZoomed()) return;
        const deltaMs = getDragDeltaTimeMs(startClientX, clientX);
        if (!Number.isFinite(deltaMs) || deltaMs === 0) return;
        setViewWindow(startViewMin - deltaMs, startViewMax - deltaMs);
    }

    function getTimeAtClientX(clientX) {
        const rect = getTimelineRect();
        if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) {
            return resolveZoomAnchor();
        }
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        return viewMin + getViewSpanMs() * ratio;
    }

    function getDragDeltaTimeMs(startClientX, clientX) {
        const rect = getTimelineRect();
        if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) return 0;
        const deltaRatio = (clientX - startClientX) / rect.width;
        return getViewSpanMs() * deltaRatio;
    }

    function getThumbClientX() {
        const rect = getTimelineRect();
        const spanMs = getViewSpanMs();
        if (!rect || !Number.isFinite(rect.width) || rect.width <= 0 || spanMs <= 0) {
            return Number.NaN;
        }
        const valueMs = clamp(Number(slider.value), viewMin, viewMax);
        const ratio = clamp((valueMs - viewMin) / spanMs, 0, 1);
        return rect.left + rect.width * ratio;
    }

    function getClientXAtTime(timeMs) {
        const rect = getTimelineRect();
        const spanMs = getViewSpanMs();
        if (!Number.isFinite(timeMs) || !rect || !Number.isFinite(rect.width) || rect.width <= 0 || spanMs <= 0) {
            return Number.NaN;
        }
        const clampedTimeMs = clamp(timeMs, viewMin, viewMax);
        const ratio = clamp((clampedTimeMs - viewMin) / spanMs, 0, 1);
        return rect.left + rect.width * ratio;
    }

    function isNearSliderThumb(clientX) {
        const thumbClientX = getThumbClientX();
        return Number.isFinite(thumbClientX) && Math.abs(clientX - thumbClientX) <= 24;
    }

    function isPlayheadPointerTarget(target) {
        if (!playhead || playhead.hidden === true) return false;
        return isNodeWithin(playhead, target);
    }

    function resolveTimelinePointTarget(target) {
        const surface = getTimelinePointerSurface();
        let node = target;
        while (node && node !== surface) {
            const className = typeof node.className === "string" ? node.className : "";
            if (
                className.split(/\s+/).some((name) => (
                    name === "timeline-dock__marker" ||
                    name === "timeline-dock__media-marker"
                ))
            ) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function isNearTimelinePointGlyph(pointTarget, clientX) {
        if (!pointTarget || !Number.isFinite(clientX)) {
            return false;
        }

        const className = typeof pointTarget.className === "string" ? pointTarget.className : "";
        const classSet = new Set(className.split(/\s+/).filter(Boolean));
        const isMediaMarker = classSet.has("timeline-dock__media-marker");
        const isSegmentMarker = classSet.has("timeline-dock__media-marker--segment");
        if (isSegmentMarker) {
            const startTimeMs = Number(pointTarget?.dataset?.mediaStartTimeMs);
            const endTimeMs = Number(pointTarget?.dataset?.mediaEndTimeMs);
            const startClientX = getClientXAtTime(startTimeMs);
            const endClientX = getClientXAtTime(endTimeMs);
            if (Number.isFinite(startClientX) && Number.isFinite(endClientX) && endClientX > startClientX) {
                const insetPx = Math.min(8, (endClientX - startClientX) * 0.2);
                return clientX >= (startClientX + insetPx) && clientX <= (endClientX - insetPx);
            }
        }

        const centerTimeMs = Number.isFinite(Number(pointTarget?.dataset?.eventTimeMs))
            ? Number(pointTarget.dataset.eventTimeMs)
            : Number(pointTarget?.dataset?.mediaStartTimeMs);
        const markerCenterClientX = getClientXAtTime(centerTimeMs);
        if (Number.isFinite(markerCenterClientX)) {
            const glyphRadiusPx = isMediaMarker ? 6 : 5;
            return Math.abs(clientX - markerCenterClientX) <= glyphRadiusPx;
        }

        return true;
    }

    function isMediaSegmentPointTarget(pointTarget) {
        if (!pointTarget) return false;
        const className = typeof pointTarget.className === "string" ? pointTarget.className : "";
        const classSet = new Set(className.split(/\s+/).filter(Boolean));
        return classSet.has("timeline-dock__media-marker") &&
            classSet.has("timeline-dock__media-marker--segment");
    }

    function isMediaMarkerPointTarget(pointTarget) {
        if (!pointTarget) return false;
        const className = typeof pointTarget.className === "string" ? pointTarget.className : "";
        return className.split(/\s+/).includes("timeline-dock__media-marker");
    }

    function seekToTime(timeMs, commit) {
        if (!Number.isFinite(timeMs)) return;
        currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
        slider.value = String(clamp(currentTimeMs, viewMin, viewMax));
        syncSliderTimelineDataset();
        updateCurrentLabel(currentTimeMs);
        syncMarkerHighlights();
        syncPlayhead();
        syncTimelineOverview();
        onSeekTime?.(currentTimeMs, commit === true);
    }

    function endTimelineDrag(event, cancelled = false) {
        if (!timelineDragState) return;
        const state = timelineDragState;
        timelineDragState = null;
        dockRoot?.classList?.remove?.("timeline-dock--timeline-dragging");
        if (Number.isFinite(state.pointerId)) {
            state.captureTarget?.releasePointerCapture?.(state.pointerId);
        }

        if (cancelled) {
            dispatchTimelineUserSeek("cancel", state.lastTimeMs, {
                commit: false,
                source: "timeline-drag",
            });
            return;
        }

        if ((state.mode === "click-lane" || state.mode === "media-click-lane") && state.moved) {
            dispatchTimelineUserSeek("cancel", state.lastTimeMs, {
                commit: false,
                source: "timeline-click",
            });
            return;
        }

        if (state.mode === "scrub") {
            return;
        }

        const finalTimeMs = Number.isFinite(event?.clientX)
            ? getTimeAtClientX(event.clientX)
            : state.lastTimeMs;
        if (state.mode === "playhead") {
            seekToTime(finalTimeMs, true);
            dispatchTimelineUserSeek(state.moved ? "end" : "commit", finalTimeMs, {
                commit: true,
                source: "timeline-playhead",
            });
            return;
        }
        if (state.mode === "media-click-lane" && selectMediaMarkerByIndex(Number(state.mediaMarkerIndex), finalTimeMs)) {
            return;
        }
        if (state.mode === "media-click-lane" && selectMediaMarkerAtTime(finalTimeMs, event)) {
            return;
        }
        seekToTime(finalTimeMs, true);
        dispatchTimelineUserSeek(state.moved ? "end" : "commit", finalTimeMs, {
            commit: true,
            source: "timeline-click",
        });
    }

    function beginTimelineDrag(event) {
        if (!event || event.isPrimary === false) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const clientX = Number(event.clientX);
        const clientY = Number(event.clientY);
        if (!Number.isFinite(clientX) || getFullSpanMs() <= 0) return;
        const pointTarget = resolveTimelinePointTarget(event.target);
        if (
            pointTarget &&
            !isMediaMarkerPointTarget(pointTarget) &&
            isNearTimelinePointGlyph(pointTarget, clientX)
        ) {
            return;
        }
        const pointerSurface = getTimelinePointerSurface();
        const pointerZone = resolvePointerZone(event, clientX, clientY);
        if (!pointerZone) return;

        event.preventDefault?.();
        pointerSurface?.setPointerCapture?.(event.pointerId);
        const initialTimeMs = getTimeAtClientX(clientX);
        timelineDragState = {
            pointerId: event.pointerId,
            startClientX: clientX,
            startTimeMs: Number.isFinite(currentTimeMs)
                ? currentTimeMs
                : clamp(Number(slider.value), viewMin, viewMax),
            startViewMin: viewMin,
            startViewMax: viewMax,
            moved: false,
            lastTimeMs: initialTimeMs,
            mode: pointerZone,
            captureTarget: pointerSurface,
            mediaMarkerIndex: pointerZone === "media-click-lane"
                ? getDirectMediaMarkerTargetIndex(event)
                : -1,
        };
        if (pointerZone === "scrub" || pointerZone === "playhead") {
            dockRoot?.classList?.add?.("timeline-dock--timeline-dragging");
        }
    }

    function updateTimelineDrag(event) {
        if (!timelineDragState) return;
        if (
            Number.isFinite(timelineDragState.pointerId) &&
            Number.isFinite(event?.pointerId) &&
            event.pointerId !== timelineDragState.pointerId
        ) {
            return;
        }

        const clientX = Number(event?.clientX);
        if (!Number.isFinite(clientX)) return;
        const moveDeltaPx = Math.abs(clientX - Number(timelineDragState.startClientX));
        if (!timelineDragState.moved && moveDeltaPx < timelineDragThresholdPx) {
            return;
        }
        event.preventDefault?.();
        timelineDragState.moved = true;
        if (timelineDragState.mode === "playhead") {
            const nextTimeMs = getTimeAtClientX(clientX);
            timelineDragState.lastTimeMs = nextTimeMs;
            seekToTime(nextTimeMs, false);
            dispatchTimelineUserSeek("update", nextTimeMs, {
                commit: false,
                source: "timeline-playhead",
            });
            return;
        }
        if (timelineDragState.mode !== "scrub") {
            timelineDragState.lastTimeMs = getTimeAtClientX(clientX);
            return;
        }
        panViewFromDrag(
            Number(timelineDragState.startViewMin),
            Number(timelineDragState.startViewMax),
            Number(timelineDragState.startClientX),
            clientX,
        );
        timelineDragState.lastTimeMs = currentTimeMs;
    }

    function handleTimelineWheel(event) {
        if (getFullSpanMs() <= 0) return;
        const widthPx = getTrackWidthPx();
        const deltaMode = Number(event.deltaMode || 0);
        const deltaX = normalizeWheelDelta(Number(event.deltaX || 0), deltaMode, widthPx);
        const deltaY = normalizeWheelDelta(Number(event.deltaY || 0), deltaMode, widthPx);
        const horizontalDelta = Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX
            : (event.shiftKey ? deltaY : 0);

        if (horizontalDelta !== 0 && isTimelineZoomed()) {
            event.preventDefault?.();
            panView(getViewSpanMs() * horizontalDelta * 0.0012);
            return;
        }

        if (deltaY === 0) return;
        event.preventDefault?.();
        zoomView(resolveWheelZoomFactor(deltaY), getTimeAtClientX(event.clientX));
    }

    function handleTimelineDoubleClick(event) {
        if (!event || getFullSpanMs() <= 0) return;
        const clientX = Number(event.clientX);
        const pointTarget = resolveTimelinePointTarget(event.target);
        if (pointTarget && isNearTimelinePointGlyph(pointTarget, clientX)) return;
        event.preventDefault?.();
        zoomView(0.5, getTimeAtClientX(event.clientX));
    }

    function isScaleButtonDisabled(button) {
        return button?.disabled === true || button?.getAttribute?.("aria-disabled") === "true";
    }

    function formatEdgeLabel(timeMs, edge) {
        if (currentMode.compareMode) {
            const edgeLabel = edge === "end" ? "End" : "Start";
            const edgeElapsed = formatComparisonElapsedLabel(timeMs, rangeMin);
            return `<span class="timeline-dock__edge-date">${edgeLabel}</span><span class="timeline-dock__edge-time">${edgeElapsed}</span>`;
        }
        const includeOffset = typeof window === "undefined" ? true : window.innerWidth > 600;
        return `<span class="timeline-dock__edge-date">${formatDateOnlyLocal(timeMs)}</span><span class="timeline-dock__edge-time">${formatTimeOnlyLocal(timeMs, { includeOffset })}</span>`;
    }

    function setMode(modeState = {}) {
        currentMode = {
            compareMode: modeState.compareMode === true,
            label: modeState.label || "",
            detail: modeState.detail || "",
            title: modeState.title || "",
        };

        dockRoot?.classList?.toggle?.("timeline-dock--compare", currentMode.compareMode);

        if (modeLabel) {
            const hidden = !currentMode.compareMode;
            modeLabel.textContent = hidden
                ? ""
                : [currentMode.label, currentMode.detail].filter(Boolean).join(" • ");
            modeLabel.title = hidden ? "" : currentMode.title;
            modeLabel.hidden = hidden;
            modeLabel.classList?.toggle?.("timeline-dock__mode--hidden", hidden);
        }

        if (lastRangeSignature) {
            renderVisualTimeline();
        }
        const labelTimeMs = Number.isFinite(currentTimeMs)
            ? currentTimeMs
            : Number(slider.dataset?.currentTimeMs);
        updateCurrentLabel(Number.isFinite(labelTimeMs) ? labelTimeMs : Number(slider.value));
    }

    function setRange({ startTimeMs, endTimeMs, stepMs }) {
        const safeStart = Number.isFinite(startTimeMs) ? startTimeMs : 0;
        const safeEnd = Number.isFinite(endTimeMs) ? endTimeMs : safeStart;
        const normalizedMin = Math.min(safeStart, safeEnd);
        const normalizedMax = Math.max(safeStart, safeEnd);
        const safeStep = Math.max(1, Math.round(Number.isFinite(stepMs) ? stepMs : 1));
        const rangeSignature = `${normalizedMin}:${normalizedMax}:${safeStep}`;

        rangeMin = normalizedMin;
        rangeMax = normalizedMax;

        if (rangeSignature === lastRangeSignature) {
            return;
        }

        lastRangeSignature = rangeSignature;
        slider.min = String(normalizedMin);
        slider.max = String(normalizedMax);
        slider.step = String(safeStep);
        viewMin = normalizedMin;
        viewMax = normalizedMax;
        slider.value = String(clamp(Number(slider.value), normalizedMin, normalizedMax));
        renderVisualTimeline();
    }

    function setCurrentTime(timeMs) {
        if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) return;
        const clamped = clamp(timeMs, rangeMin, rangeMax);
        currentTimeMs = clamped;
        slider.value = String(clamp(clamped, viewMin, viewMax));
        syncSliderTimelineDataset();
        updateCurrentLabel(clamped);
        syncMarkerHighlights();
        syncPlayhead();
        syncTimelineOverview();
    }

    function setElementClass(element, className, enabled) {
        if (!element?.classList) return;
        if (enabled) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    function clearHoveredEventMarker() {
        if (hoveredEventMarker?.classList) {
            hoveredEventMarker.classList.remove(EVENT_MARKER_HOVERED_CLASS);
        }
        hoveredEventMarker = null;
    }

    function markerMatchesHoverDetail(marker, detail = {}) {
        if (!marker?.dataset) return false;
        const eventKey = String(detail.eventKey || "");
        const eventSourceKey = String(detail.eventSourceKey || "");
        if (eventKey && marker.dataset.eventKey === eventKey) return true;
        if (eventSourceKey && marker.dataset.eventSourceKey === eventSourceKey) return true;
        const eventTimeMs = Number(detail.eventTimeMs);
        const markerTimeMs = Number(marker.dataset.eventTimeMs);
        return Number.isFinite(eventTimeMs) &&
            Number.isFinite(markerTimeMs) &&
            Math.abs(eventTimeMs - markerTimeMs) <= 1;
    }

    function setHoveredEventMarker(detail = {}, hovered = true) {
        clearHoveredEventMarker();
        if (!hovered) return;
        const marker = Array.from(markers.children || [])
            .find((candidate) => markerMatchesHoverDetail(candidate, detail));
        if (!marker?.classList) return;
        marker.classList.add(EVENT_MARKER_HOVERED_CLASS);
        hoveredEventMarker = marker;
    }

    function setHoveredVisibleEventRange(detail = {}) {
        if (detail?.active !== true) {
            hoveredVisibleEventRange = null;
            syncHoveredVisibleEventRange();
            return;
        }
        const startTimeMs = Number(detail.startTimeMs);
        const endTimeMs = Number(detail.endTimeMs);
        if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
            hoveredVisibleEventRange = null;
            syncHoveredVisibleEventRange();
            return;
        }
        hoveredVisibleEventRange = { startTimeMs, endTimeMs };
        syncHoveredVisibleEventRange();
    }

    function syncMarkerHighlights() {
        const markerNodes = Array.from(markers.children || []);
        if (markerNodes.length === 0) return;

        const highlightState = resolveTimelineEventHighlightState({
            events: markerNodes.map((marker) => ({
                timeMs: Number(marker?.dataset?.eventTimeMs),
            })),
            currentTimeMs,
        });
        const currentIndexes = new Set(highlightState.currentIndexes);
        const boundaryIndexes = new Set(highlightState.boundaryIndexes);
        for (let index = 0; index < markerNodes.length; index += 1) {
            const marker = markerNodes[index];
            const isCurrent = currentIndexes.has(index);
            setElementClass(marker, "timeline-dock__marker--current-event", isCurrent);
            setElementClass(
                marker,
                "timeline-dock__marker--time-boundary",
                !isCurrent && boundaryIndexes.has(index),
            );
        }
    }

    function renderMarker(eventInfo, index) {
        const eventTimeMs = eventInfo?.startTime instanceof Date
            ? eventInfo.startTime.getTime()
            : Number.NaN;
        if (!Number.isFinite(eventTimeMs)) return null;
        if (eventTimeMs < viewMin || eventTimeMs > viewMax) return null;

        const marker = document.createElement("button");
        marker.type = "button";
        const markerClasses = ["timeline-dock__marker"];
        if (eventInfo?.comparisonEvent || eventInfo?.timelineRole === "comparison") {
            markerClasses.push("timeline-dock__marker--comparison");
        }
        if (eventInfo?.burnFlag) {
            markerClasses.push("timeline-dock__marker--burn");
        }
        if (eventInfo?.generated) {
            markerClasses.push("timeline-dock__marker--generated");
        }
        if (eventInfo?.clickable === false) {
            markerClasses.push("timeline-dock__marker--inactive");
            marker.setAttribute("aria-disabled", "true");
        }
        marker.className = markerClasses.join(" ");
        marker.dataset.eventKey = eventInfo?.key || "";
        marker.dataset.eventSourceKey = eventInfo?.timelineSourceKey || eventInfo?.key || "";
        marker.dataset.eventIndex = String(index);
        marker.dataset.eventTimeMs = String(eventTimeMs);
        marker.style.left = `${computePercent(eventTimeMs, viewMin, viewMax)}%`;
        const markerLabel = resolveTimelineEventLabel(eventInfo);
        const hoverText = resolveTimelineEventHoverText(eventInfo) || "Event";
        const generatedSuffix = eventInfo?.generatedLabel
            ? `\n${eventInfo.generatedLabel}`
            : "";
        marker.title = currentMode.compareMode
            ? `${markerLabel}\n${hoverText}${generatedSuffix}`
            : `${markerLabel} - ${formatDateTimeLocal(eventTimeMs)}\n${hoverText}${generatedSuffix}`;
        marker.setAttribute("aria-label", marker.title);
        marker.addEventListener("mouseenter", () => {
            setHoveredEventMarker({
                eventKey: eventInfo?.key || "",
                eventSourceKey: eventInfo?.timelineSourceKey || eventInfo?.key || "",
                eventTimeMs,
            }, true);
            onMarkerHover?.(eventInfo, index);
        });
        marker.addEventListener("focus", () => {
            setHoveredEventMarker({
                eventKey: eventInfo?.key || "",
                eventSourceKey: eventInfo?.timelineSourceKey || eventInfo?.key || "",
                eventTimeMs,
            }, true);
            onMarkerHover?.(eventInfo, index);
        });
        marker.addEventListener("mouseleave", () => {
            setHoveredEventMarker({}, false);
            onMarkerLeave?.(eventInfo, index);
        });
        marker.addEventListener("blur", () => {
            setHoveredEventMarker({}, false);
            onMarkerLeave?.(eventInfo, index);
        });
        if (eventInfo?.clickable !== false) {
            marker.addEventListener("click", () => {
                seekToTime(eventTimeMs, true);
                dispatchTimelineUserSeek("commit", eventTimeMs, {
                    commit: true,
                    source: "timeline-event-marker",
                });
                onMarkerSelect?.(eventInfo, index);
            });
        }
        return marker;
    }

    function resolveMediaMarkerTargetTime(markerInfo, timeMs) {
        const markerTimeMs = markerInfo?.startTime instanceof Date
            ? markerInfo.startTime.getTime()
            : Number(markerInfo?.startTimeMs);
        if (!Number.isFinite(markerTimeMs)) return Number.NaN;
        const markerEndTimeMs = Number(markerInfo?.endTimeMs);
        const isSegment = markerInfo?.mediaDisplayMode === "segment"
            && Number.isFinite(markerEndTimeMs)
            && markerEndTimeMs > markerTimeMs;
        if (!isSegment) return markerTimeMs;
        return clamp(Number.isFinite(timeMs) ? timeMs : markerTimeMs, markerTimeMs, markerEndTimeMs);
    }

    function dispatchMediaMarkerSelection(markerInfo, index, targetTimeMs) {
        if (!markerInfo || markerInfo.clickable === false || !Number.isFinite(targetTimeMs)) return false;
        seekToTime(targetTimeMs, true);
        dispatchTimelineUserSeek("commit", targetTimeMs, {
            commit: true,
            source: "timeline-media-marker",
        });
        dispatchDocumentCustomEvent("mission-media-marker-select", {
            marker: markerInfo,
            index,
            timeMs: targetTimeMs,
        });
        return true;
    }

    function getMediaMarkerElementIndex(element) {
        const index = Number(element?.dataset?.mediaIndex);
        return Number.isInteger(index) && index >= 0 ? index : -1;
    }

    function findMediaMarkerElementTarget(target) {
        let node = target;
        while (node && node !== mediaMarkers) {
            const className = typeof node.className === "string" ? node.className : "";
            if (className.split(/\s+/).includes("timeline-dock__media-marker")) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function resolveMediaMarkerClickRank(markerInfo) {
        const mediaKind = String(markerInfo?.mediaKind || "").trim();
        if (mediaKind === "videoClip") return 0;
        if (mediaKind === "audioClip") return 1;
        return 2;
    }

    function resolveRenderedMediaMarkerIndexAtPointer(clientX, clientY, timeMs) {
        if (!mediaMarkers || !Number.isFinite(clientX)) return -1;
        const laneRect = mediaMarkers.getBoundingClientRect?.();
        if (Number.isFinite(clientY) && laneRect) {
            const laneTop = Number(laneRect.top);
            const laneHeight = Number(laneRect.height);
            if (
                Number.isFinite(laneTop) &&
                Number.isFinite(laneHeight) &&
                laneHeight > 0 &&
                (clientY < laneTop || clientY > laneTop + laneHeight)
            ) {
                return -1;
            }
        }

        const children = Array.from(mediaMarkers.children || []);
        let bestCandidate = null;
        for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
            const child = children[childIndex];
            if (child?.hidden === true) continue;
            const className = typeof child.className === "string" ? child.className : "";
            if (!className.split(/\s+/).includes("timeline-dock__media-marker")) continue;
            const rect = child.getBoundingClientRect?.();
            if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || rect.width <= 0) continue;
            if (clientX >= rect.left && clientX <= rect.left + rect.width) {
                const index = getMediaMarkerElementIndex(child);
                const markerInfo = lastMediaMarkersData[index];
                if (!markerInfo || markerInfo.clickable === false) continue;
                const centerDistancePx = Math.abs(clientX - (rect.left + rect.width / 2));
                const startTimeMs = Number(markerInfo.startTimeMs);
                const timeDistanceMs = Number.isFinite(timeMs) && Number.isFinite(startTimeMs)
                    ? Math.abs(timeMs - startTimeMs)
                    : Number.POSITIVE_INFINITY;
                const candidate = {
                    index,
                    rank: resolveMediaMarkerClickRank(markerInfo),
                    centerDistancePx,
                    timeDistanceMs,
                    childIndex,
                };
                if (
                    !bestCandidate ||
                    candidate.rank < bestCandidate.rank ||
                    (candidate.rank === bestCandidate.rank && candidate.centerDistancePx < bestCandidate.centerDistancePx) ||
                    (
                        candidate.rank === bestCandidate.rank &&
                        candidate.centerDistancePx === bestCandidate.centerDistancePx &&
                        candidate.timeDistanceMs < bestCandidate.timeDistanceMs
                    ) ||
                    (
                        candidate.rank === bestCandidate.rank &&
                        candidate.centerDistancePx === bestCandidate.centerDistancePx &&
                        candidate.timeDistanceMs === bestCandidate.timeDistanceMs &&
                        candidate.childIndex > bestCandidate.childIndex
                    )
                ) {
                    bestCandidate = candidate;
                }
            }
        }
        return bestCandidate?.index ?? -1;
    }

    function selectMediaMarkerByIndex(index, timeMs) {
        if (!Array.isArray(lastMediaMarkersData) || index < 0 || index >= lastMediaMarkersData.length) return false;
        const markerInfo = lastMediaMarkersData[index];
        const targetTimeMs = resolveMediaMarkerTargetTime(markerInfo, timeMs);
        return dispatchMediaMarkerSelection(markerInfo, index, targetTimeMs);
    }

    function selectMediaMarkerAtTime(timeMs, event = null) {
        if (!Array.isArray(lastMediaMarkersData) || !Number.isFinite(timeMs)) return false;
        const renderedIndex = resolveRenderedMediaMarkerIndexAtPointer(
            Number(event?.clientX),
            Number(event?.clientY),
            timeMs,
        );
        if (selectMediaMarkerByIndex(renderedIndex, timeMs)) {
            return true;
        }
        const targetMarkerElement = findMediaMarkerElementTarget(event?.target);
        if (targetMarkerElement && selectMediaMarkerByIndex(getMediaMarkerElementIndex(targetMarkerElement), timeMs)) {
            return true;
        }
        for (let index = 0; index < lastMediaMarkersData.length; index += 1) {
            const markerInfo = lastMediaMarkersData[index];
            if (!markerInfo || markerInfo.clickable === false) continue;
            const markerTimeMs = markerInfo?.startTime instanceof Date
                ? markerInfo.startTime.getTime()
                : Number(markerInfo?.startTimeMs);
            if (!Number.isFinite(markerTimeMs)) continue;
            const markerEndTimeMs = Number(markerInfo?.endTimeMs);
            const isSegment = markerInfo?.mediaDisplayMode === "segment"
                && Number.isFinite(markerEndTimeMs)
                && markerEndTimeMs > markerTimeMs;
            if (isSegment) {
                if (timeMs >= markerTimeMs && timeMs <= markerEndTimeMs) {
                    return dispatchMediaMarkerSelection(markerInfo, index, timeMs);
                }
                continue;
            }
            const markerClientX = getClientXAtTime(markerTimeMs);
            const targetClientX = getClientXAtTime(timeMs);
            if (Number.isFinite(markerClientX) && Number.isFinite(targetClientX) && Math.abs(markerClientX - targetClientX) <= 8) {
                return dispatchMediaMarkerSelection(markerInfo, index, markerTimeMs);
            }
        }
        return false;
    }

    function ensureMediaMarkerPreview() {
        if (mediaPreviewElement) return mediaPreviewElement;
        if (!mediaMarkers) return null;

        mediaPreviewElement = document.createElement("span");
        mediaPreviewElement.className = "timeline-dock__media-preview";
        mediaPreviewElement.hidden = true;

        mediaPreviewImage = document.createElement("img");
        mediaPreviewImage.className = "timeline-dock__media-preview-image";
        mediaPreviewImage.alt = "";
        mediaPreviewImage.decoding = "async";
        mediaPreviewImage.addEventListener?.("load", () => {
            if (!mediaPreviewElement || !mediaPreviewImage) return;
            const imageSource = mediaPreviewImage.getAttribute?.("src") || mediaPreviewImage.src || "";
            if (!imageSource || imageSource !== pendingMediaPreviewSource || !activeMediaPreviewMarker) return;
            mediaPreviewImage.hidden = false;
            mediaPreviewElement.hidden = false;
            mediaPreviewElement.classList?.add?.("is-visible");
        });
        mediaPreviewImage.addEventListener?.("error", () => {
            const imageSource = mediaPreviewImage?.getAttribute?.("src") || mediaPreviewImage?.src || pendingMediaPreviewSource;
            if (imageSource) failedMediaPreviewSources.add(imageSource);
            if (mediaPreviewImage) {
                mediaPreviewImage.hidden = true;
                mediaPreviewImage.removeAttribute?.("src");
            }
            hideMediaMarkerPreview(activeMediaPreviewMarker);
        });
        mediaPreviewElement.appendChild(mediaPreviewImage);

        mediaPreviewTitle = document.createElement("span");
        mediaPreviewTitle.className = "timeline-dock__media-preview-title";
        mediaPreviewElement.appendChild(mediaPreviewTitle);
        mediaMarkers.appendChild(mediaPreviewElement);
        return mediaPreviewElement;
    }

    function setMediaPreviewEdgeClass(anchorPercent) {
        if (!mediaPreviewElement) return;
        mediaPreviewElement.classList?.toggle?.("timeline-dock__media-preview--start", anchorPercent < 8);
        mediaPreviewElement.classList?.toggle?.("timeline-dock__media-preview--end", anchorPercent > 92);
    }

    function showMediaMarkerPreview(marker, markerInfo, anchorPercent) {
        const thumbnailAssetUrl = String(markerInfo?.thumbnailAssetUrl || "").trim();
        if (!thumbnailAssetUrl || failedMediaPreviewSources.has(thumbnailAssetUrl)) {
            hideMediaMarkerPreview(marker);
            return;
        }
        const preview = ensureMediaMarkerPreview();
        if (!preview) return;
        activeMediaPreviewMarker = marker;
        pendingMediaPreviewSource = thumbnailAssetUrl;
        preview.hidden = false;
        preview.classList?.remove?.("is-visible");
        preview.style.left = `${clamp(Number(anchorPercent), 0, 100)}%`;
        setMediaPreviewEdgeClass(Number(anchorPercent));
        if (mediaPreviewTitle) {
            const previewTitle = String(markerInfo?.label || markerInfo?.hoverText || "Media item").trim();
            mediaPreviewTitle.textContent = previewTitle || "Media item";
        }
        if (mediaPreviewImage) {
            mediaPreviewImage.hidden = false;
            if (mediaPreviewImage.getAttribute?.("src") !== thumbnailAssetUrl) {
                mediaPreviewImage.src = thumbnailAssetUrl;
            }
            if (mediaPreviewImage.complete === true && Number(mediaPreviewImage.naturalWidth || 0) > 0) {
                preview.hidden = false;
                preview.classList?.add?.("is-visible");
            }
        }
    }

    function hideMediaMarkerPreview(marker) {
        if (marker && activeMediaPreviewMarker && marker !== activeMediaPreviewMarker) return;
        activeMediaPreviewMarker = null;
        pendingMediaPreviewSource = "";
        mediaPreviewElement?.classList?.remove?.("is-visible");
        if (mediaPreviewElement) {
            mediaPreviewElement.hidden = true;
        }
    }

    function bindMediaMarkerPreviewEvents(marker, markerInfo, anchorPercent) {
        if (!marker) return;
        marker.addEventListener("pointerenter", () => showMediaMarkerPreview(marker, markerInfo, anchorPercent));
        marker.addEventListener("pointerleave", () => hideMediaMarkerPreview(marker));
        marker.addEventListener("focus", () => showMediaMarkerPreview(marker, markerInfo, anchorPercent));
        marker.addEventListener("blur", () => hideMediaMarkerPreview(marker));
    }

    function handleDirectMediaMarkerClick(event, markerInfo, index, isSegment, markerTimeMs) {
        event?.stopPropagation?.();
        const clickTimeMs = isSegment && Number.isFinite(event?.clientX)
            ? getTimeAtClientX(event.clientX)
            : markerTimeMs;
        dispatchMediaMarkerSelection(
            markerInfo,
            index,
            resolveMediaMarkerTargetTime(markerInfo, clickTimeMs),
        );
    }

    function getDirectMediaMarkerTargetIndex(event) {
        const targetMarkerElement = findMediaMarkerElementTarget(event?.target);
        if (!targetMarkerElement) return -1;
        return getMediaMarkerElementIndex(targetMarkerElement);
    }

    function renderMediaMarker(markerInfo, index) {
        const markerTimeMs = markerInfo?.startTime instanceof Date
            ? markerInfo.startTime.getTime()
            : Number(markerInfo?.startTimeMs);
        if (!Number.isFinite(markerTimeMs)) return null;
        const markerEndTimeMs = Number(markerInfo?.endTimeMs);
        const isSegment = markerInfo?.mediaDisplayMode === "segment"
            && Number.isFinite(markerEndTimeMs)
            && markerEndTimeMs > markerTimeMs;
        if (isSegment) {
            if (markerEndTimeMs < viewMin || markerTimeMs > viewMax) return null;
        } else if (markerTimeMs < viewMin || markerTimeMs > viewMax) {
            return null;
        }

        const marker = document.createElement("button");
        marker.type = "button";
        const markerClasses = ["timeline-dock__media-marker"];
        let anchorPercent = computePercent(markerTimeMs, viewMin, viewMax);
        if (isSegment) {
            markerClasses.push("timeline-dock__media-marker--segment");
            if (markerTimeMs < viewMin) {
                markerClasses.push("timeline-dock__media-marker--segment-clipped-start");
            }
            if (markerEndTimeMs > viewMax) {
                markerClasses.push("timeline-dock__media-marker--segment-clipped-end");
            }
            const visibleStartTimeMs = Math.max(markerTimeMs, viewMin);
            const visibleEndTimeMs = Math.min(markerEndTimeMs, viewMax);
            anchorPercent = computePercent((visibleStartTimeMs + visibleEndTimeMs) / 2, viewMin, viewMax);
        }
        if (anchorPercent < 8) {
            markerClasses.push("timeline-dock__media-marker--preview-start");
        } else if (anchorPercent > 92) {
            markerClasses.push("timeline-dock__media-marker--preview-end");
        }
        if (markerInfo?.durationEstimated) {
            markerClasses.push("timeline-dock__media-marker--estimated");
        }
        if (markerInfo?.selected) {
            markerClasses.push("timeline-dock__media-marker--selected");
        }
        const mediaKind = String(markerInfo?.mediaKind || "").trim();
        if (mediaKind) {
            markerClasses.push(`timeline-dock__media-marker--${mediaKind}`);
        }
        if (markerInfo?.preEphemeris || markerInfo?.postEphemeris) {
            markerClasses.push("timeline-dock__media-marker--out-of-range");
        }
        if (markerInfo?.clickable === false) {
            markerClasses.push("timeline-dock__media-marker--inactive");
            marker.setAttribute("aria-disabled", "true");
        }
        marker.className = markerClasses.join(" ");
        marker.dataset.mediaIndex = String(index);
        if (markerInfo?.id) {
            marker.dataset.mediaId = String(markerInfo.id);
        }
        marker.dataset.mediaStartTimeMs = String(markerTimeMs);
        if (isSegment) {
            marker.dataset.mediaEndTimeMs = String(markerEndTimeMs);
            const visibleStartTimeMs = Math.max(markerTimeMs, viewMin);
            const visibleEndTimeMs = Math.min(markerEndTimeMs, viewMax);
            const leftPercent = computePercent(visibleStartTimeMs, viewMin, viewMax);
            const rightPercent = computePercent(visibleEndTimeMs, viewMin, viewMax);
            marker.style.left = `${leftPercent}%`;
            marker.style.width = `${Math.max(0, rightPercent - leftPercent)}%`;
        } else {
            marker.style.left = `${computePercent(markerTimeMs, viewMin, viewMax)}%`;
        }
        const markerTitle = markerInfo?.hoverText || markerInfo?.label || "Media item";
        marker.title = markerTitle;
        marker.setAttribute("aria-label", markerTitle);
        bindMediaMarkerPreviewEvents(marker, markerInfo, anchorPercent);
        if (markerInfo?.clickable !== false) {
            marker.addEventListener("click", (event) => {
                handleDirectMediaMarkerClick(event, markerInfo, index, isSegment, markerTimeMs);
            });
        }
        return marker;
    }

    function setEvents(eventInfos) {
        const normalizedEvents = Array.isArray(eventInfos) ? eventInfos : [];
        const signature = buildEventSignature(normalizedEvents);
        lastEventInfos = normalizedEvents;
        if (signature === lastEventSignature) {
            return;
        }

        lastEventSignature = signature;
        renderEventMarkersFromCache();
    }

    function setMediaMarkersFn(nextMediaMarkers) {
        if (!mediaMarkers) return;
        const normalizedMediaMarkers = Array.isArray(nextMediaMarkers) ? nextMediaMarkers : [];
        const signature = buildMediaSignature(normalizedMediaMarkers);
        lastMediaMarkersData = normalizedMediaMarkers;
        if (signature === lastMediaSignature) {
            return;
        }

        lastMediaSignature = signature;
        renderMediaMarkersFromCache();
    }

    function setCrafts(craftInfos) {
        const normalizedCraftInfos = Array.isArray(craftInfos)
            ? craftInfos.filter((craftInfo) => craftInfo && craftInfo.id && craftInfo.label)
            : [];
        if (normalizedCraftInfos.length <= 1) {
            craftStrip.innerHTML = "";
            craftStrip.classList.add("timeline-dock__craft-strip--hidden");
            return;
        }

        craftStrip.classList.remove("timeline-dock__craft-strip--hidden");
        craftStrip.innerHTML = "";
        for (const craftInfo of normalizedCraftInfos) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = craftInfo.active
                ? "timeline-dock__craft-chip timeline-dock__craft-chip--active"
                : "timeline-dock__craft-chip";
            if (craftInfo.color) {
                const swatch = document.createElement("span");
                swatch.className = "timeline-dock__craft-swatch";
                swatch.style.backgroundColor = craftInfo.color;
                chip.appendChild(swatch);
            }
            const label = document.createElement("span");
            label.className = "timeline-dock__craft-chip-label";
            label.textContent = craftInfo.label;
            chip.appendChild(label);
            if (craftInfo.roleLabel) {
                const role = document.createElement("span");
                role.className = "timeline-dock__craft-chip-role";
                role.textContent = craftInfo.roleLabel;
                chip.appendChild(role);
            }
            chip.title = craftInfo.label;
            chip.setAttribute("aria-label", `Track ${craftInfo.label}`);
            chip.addEventListener("click", () => {
                onCraftSelect?.(craftInfo.id);
            });
            craftStrip.appendChild(chip);
        }
    }

    function bind() {
        if (isBound) return;
        isBound = true;

        const readSliderEventPayload = () => {
            const programmaticTimeMs = Number(slider.dataset.programmaticSeekTimeMs);
            const programmaticSource = String(slider.dataset.programmaticSeekSource || "").trim();
            delete slider.dataset.programmaticSeekTimeMs;
            delete slider.dataset.programmaticSeekSource;
            if (Number.isFinite(programmaticTimeMs)) {
                return {
                    timeMs: programmaticTimeMs,
                    programmatic: true,
                    source: programmaticSource || "programmatic",
                };
            }
            return {
                timeMs: Number(slider.value),
                programmatic: false,
                source: "timeline-slider",
            };
        };

        slider.addEventListener("input", () => {
            const payload = readSliderEventPayload();
            const timeMs = payload.timeMs;
            if (!Number.isFinite(timeMs)) return;
            currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
            syncSliderTimelineDataset();
            updateCurrentLabel(currentTimeMs);
            syncMarkerHighlights();
            syncPlayhead();
            onSeekTime?.(currentTimeMs, false);
            dispatchTimelineUserSeek("update", currentTimeMs, {
                commit: false,
                source: payload.source,
            });
        });

        slider.addEventListener("change", () => {
            const payload = readSliderEventPayload();
            const timeMs = payload.timeMs;
            if (!Number.isFinite(timeMs)) return;
            currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
            syncSliderTimelineDataset();
            updateCurrentLabel(currentTimeMs);
            syncMarkerHighlights();
            syncPlayhead();
            onSeekTime?.(currentTimeMs, true);
            dispatchTimelineUserSeek("commit", currentTimeMs, {
                commit: true,
                source: payload.source,
            });
        });

        document.addEventListener?.("mission-timeline-event-hover", (event) => {
            setHoveredEventMarker(event?.detail || {}, event?.detail?.active === true);
        });
        document.addEventListener?.("mission-timeline-visible-event-range-hover", (event) => {
            setHoveredVisibleEventRange(event?.detail || {});
        });

        panLeftButton?.addEventListener?.("click", () => {
            if (isScaleButtonDisabled(panLeftButton)) return;
            panView(getViewSpanMs() * -0.4);
        });
        scaleContractButton?.addEventListener?.("click", () => {
            if (isScaleButtonDisabled(scaleContractButton)) return;
            zoomView(2);
        });
        scaleResetButton?.addEventListener?.("click", () => {
            if (isScaleButtonDisabled(scaleResetButton)) return;
            resetViewWindow();
        });
        scaleExpandButton?.addEventListener?.("click", () => {
            if (isScaleButtonDisabled(scaleExpandButton)) return;
            zoomView(0.5);
        });
        panRightButton?.addEventListener?.("click", () => {
            if (isScaleButtonDisabled(panRightButton)) return;
            panView(getViewSpanMs() * 0.4);
        });

        const interactionSurface = getTimelineInteractionSurface();
        const pointerSurface = getTimelinePointerSurface();
        pointerSurface?.addEventListener?.("wheel", handleTimelineWheel, { passive: false });
        pointerSurface?.addEventListener?.("pointerdown", beginTimelineDrag, { passive: false, capture: true });
        pointerSurface?.addEventListener?.("pointermove", updateTimelineDrag);
        pointerSurface?.addEventListener?.("pointerup", (event) => {
            endTimelineDrag(event, false);
        });
        pointerSurface?.addEventListener?.("pointercancel", (event) => {
            endTimelineDrag(event, true);
        });
        pointerSurface?.addEventListener?.("lostpointercapture", (event) => {
            endTimelineDrag(event, true);
        });
        pointerSurface?.addEventListener?.("dblclick", handleTimelineDoubleClick);

        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("resize", renderVisualTimeline);
        }
        syncScaleButtons();
    }

    return {
        bind,
        setMode,
        setRange,
        setCurrentTime,
        setEvents,
        setMediaMarkers: setMediaMarkersFn,
        setCrafts,
    };
}

export { createTimelineDockController };
