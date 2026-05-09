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
    const timeLabels = document.getElementById("timeline-time-labels");
    const panLeftButton = document.getElementById("timeline-pan-left");
    const scaleContractButton = document.getElementById("timeline-scale-contract");
    const scaleResetButton = document.getElementById("timeline-scale-reset");
    const scaleExpandButton = document.getElementById("timeline-scale-expand");
    const panRightButton = document.getElementById("timeline-pan-right");
    const startLabel = document.getElementById("timeline-start-label");
    const endLabel = document.getElementById("timeline-end-label");
    const modeLabel = document.getElementById("timeline-mode-label");
    const currentLabel = document.getElementById("timeline-current-label");
    const craftStrip = document.getElementById("timeline-craft-strip");

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
    let isBound = false;
    let timelineDragState = null;
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
            slider.setAttribute(
                "aria-valuetext",
                `Comparison elapsed time ${elapsedLabel}`,
            );
            return;
        }

        const label = formatDateTimeLocal(timeMs, { includeOffset: false });
        currentLabel.textContent = label;
        slider.setAttribute("aria-valuetext", label);
    }

    function getTrackWidthPx() {
        const measuredWidth =
            timeLabels?.parentElement?.getBoundingClientRect?.()?.width ||
            slider?.parentElement?.getBoundingClientRect?.()?.width ||
            slider?.getBoundingClientRect?.()?.width ||
            0;
        return Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : 720;
    }

    function getTimelineInteractionSurface() {
        return slider.parentElement || slider;
    }

    function getTimelineRect() {
        const rect = getTimelineInteractionSurface()?.getBoundingClientRect?.() ||
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

    function renderTimeLabels() {
        if (!timeLabels) {
            syncScaleButtons();
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
    }

    function renderEventMarkersFromCache() {
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

    function getTimeAtClientX(clientX) {
        const rect = getTimelineRect();
        if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) {
            return resolveZoomAnchor();
        }
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        return viewMin + getViewSpanMs() * ratio;
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

    function isNearSliderThumb(clientX) {
        const thumbClientX = getThumbClientX();
        return Number.isFinite(thumbClientX) && Math.abs(clientX - thumbClientX) <= 18;
    }

    function isTimelinePointTarget(target) {
        const surface = getTimelineInteractionSurface();
        let node = target;
        while (node && node !== surface) {
            const className = typeof node.className === "string" ? node.className : "";
            if (
                className.split(/\s+/).some((name) => (
                    name === "timeline-dock__marker" ||
                    name === "timeline-dock__media-marker"
                ))
            ) {
                return true;
            }
            node = node.parentElement;
        }
        return false;
    }

    function seekToTime(timeMs, commit) {
        if (!Number.isFinite(timeMs)) return;
        currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
        slider.value = String(clamp(currentTimeMs, viewMin, viewMax));
        slider.dataset.currentTimeMs = String(currentTimeMs);
        updateCurrentLabel(currentTimeMs);
        syncMarkerHighlights();
        onSeekTime?.(currentTimeMs, commit === true);
    }

    function endTimelineDrag(event, cancelled = false) {
        if (!timelineDragState) return;
        const state = timelineDragState;
        timelineDragState = null;
        dockRoot?.classList?.remove?.("timeline-dock--timeline-dragging");
        const surface = getTimelineInteractionSurface();
        if (Number.isFinite(state.pointerId)) {
            surface?.releasePointerCapture?.(state.pointerId);
        }

        if (!cancelled && !state.moved && Number.isFinite(event?.clientX)) {
            seekToTime(getTimeAtClientX(event.clientX), true);
        }
    }

    function beginTimelineDrag(event) {
        if (!event || event.isPrimary === false) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (isTimelinePointTarget(event.target)) return;
        const clientX = Number(event.clientX);
        if (!Number.isFinite(clientX) || getFullSpanMs() <= 0) return;

        if (event.target === slider && isNearSliderThumb(clientX)) {
            return;
        }

        event.preventDefault?.();
        const surface = getTimelineInteractionSurface();
        surface?.setPointerCapture?.(event.pointerId);
        timelineDragState = {
            pointerId: event.pointerId,
            startX: clientX,
            lastX: clientX,
            moved: false,
        };
        dockRoot?.classList?.add?.("timeline-dock--timeline-dragging");
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
        const deltaPx = clientX - timelineDragState.lastX;
        timelineDragState.lastX = clientX;
        if (Math.abs(clientX - timelineDragState.startX) >= 3) {
            timelineDragState.moved = true;
        }

        if (!timelineDragState.moved) return;
        event.preventDefault?.();
        const rect = getTimelineRect();
        if (!isTimelineZoomed() || !rect || rect.width <= 0 || deltaPx === 0) return;
        panView((-deltaPx / rect.width) * getViewSpanMs());
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
        if (!event || isTimelinePointTarget(event.target) || getFullSpanMs() <= 0) return;
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
        updateCurrentLabel(Number(slider.value));
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
        slider.dataset.currentTimeMs = String(clamped);
        updateCurrentLabel(clamped);
        syncMarkerHighlights();
    }

    function setElementClass(element, className, enabled) {
        if (!element?.classList) return;
        if (enabled) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
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
            onMarkerHover?.(eventInfo, index);
        });
        marker.addEventListener("focus", () => {
            onMarkerHover?.(eventInfo, index);
        });
        marker.addEventListener("mouseleave", () => {
            onMarkerLeave?.(eventInfo, index);
        });
        marker.addEventListener("blur", () => {
            onMarkerLeave?.(eventInfo, index);
        });
        if (eventInfo?.clickable !== false) {
            marker.addEventListener("click", () => {
                onMarkerSelect?.(eventInfo, index);
            });
        }
        return marker;
    }

    function renderMediaMarker(markerInfo, index) {
        const markerTimeMs = markerInfo?.startTime instanceof Date
            ? markerInfo.startTime.getTime()
            : Number(markerInfo?.startTimeMs);
        if (!Number.isFinite(markerTimeMs)) return null;
        if (markerTimeMs < viewMin || markerTimeMs > viewMax) return null;

        const marker = document.createElement("button");
        marker.type = "button";
        const markerClasses = ["timeline-dock__media-marker"];
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
        marker.style.left = `${computePercent(markerTimeMs, viewMin, viewMax)}%`;
        const markerTitle = markerInfo?.hoverText || markerInfo?.label || "Media item";
        marker.title = markerTitle;
        marker.setAttribute("aria-label", markerTitle);
        if (markerInfo?.clickable !== false) {
            marker.addEventListener("click", () => {
                dispatchDocumentCustomEvent("mission-media-marker-select", {
                    marker: markerInfo,
                    index,
                });
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

        const readSliderEventTime = () => {
            const programmaticTimeMs = Number(slider.dataset.programmaticSeekTimeMs);
            delete slider.dataset.programmaticSeekTimeMs;
            if (Number.isFinite(programmaticTimeMs)) {
                return programmaticTimeMs;
            }
            return Number(slider.value);
        };

        slider.addEventListener("input", () => {
            const timeMs = readSliderEventTime();
            if (!Number.isFinite(timeMs)) return;
            currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
            slider.dataset.currentTimeMs = String(currentTimeMs);
            updateCurrentLabel(currentTimeMs);
            syncMarkerHighlights();
            onSeekTime?.(currentTimeMs, false);
        });

        slider.addEventListener("change", () => {
            const timeMs = readSliderEventTime();
            if (!Number.isFinite(timeMs)) return;
            currentTimeMs = clamp(timeMs, rangeMin, rangeMax);
            slider.dataset.currentTimeMs = String(currentTimeMs);
            updateCurrentLabel(currentTimeMs);
            syncMarkerHighlights();
            onSeekTime?.(currentTimeMs, true);
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
        interactionSurface?.addEventListener?.("wheel", handleTimelineWheel, { passive: false });
        interactionSurface?.addEventListener?.("pointerdown", beginTimelineDrag);
        interactionSurface?.addEventListener?.("pointermove", updateTimelineDrag);
        interactionSurface?.addEventListener?.("pointerup", (event) => {
            endTimelineDrag(event, false);
        });
        interactionSurface?.addEventListener?.("pointercancel", (event) => {
            endTimelineDrag(event, true);
        });
        interactionSurface?.addEventListener?.("lostpointercapture", (event) => {
            endTimelineDrag(event, true);
        });
        interactionSurface?.addEventListener?.("dblclick", handleTimelineDoubleClick);

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
