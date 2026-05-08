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
            setCrafts: () => {},
        };
    }

    let rangeMin = 0;
    let rangeMax = 0;
    let lastRangeSignature = "";
    let lastEventSignature = "";
    let currentTimeMs = Number.NaN;
    let isBound = false;
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

    function formatEdgeLabel(timeMs, edge) {
        if (currentMode.compareMode) {
            const edgeLabel = edge === "end" ? "End" : "Start";
            const edgeElapsed = edge === "end"
                ? formatComparisonElapsedLabel(timeMs, rangeMin)
                : "T+0";
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
            startLabel.innerHTML = formatEdgeLabel(rangeMin, "start");
            endLabel.innerHTML = formatEdgeLabel(rangeMax, "end");
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
        startLabel.innerHTML = formatEdgeLabel(normalizedMin, "start");
        endLabel.innerHTML = formatEdgeLabel(normalizedMax, "end");
        slider.value = String(clamp(Number(slider.value), normalizedMin, normalizedMax));
    }

    function setCurrentTime(timeMs) {
        if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) return;
        const clamped = clamp(timeMs, rangeMin, rangeMax);
        currentTimeMs = clamped;
        slider.value = String(clamped);
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

        const clampedTime = clamp(eventTimeMs, rangeMin, rangeMax);
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
        marker.style.left = `${computePercent(clampedTime, rangeMin, rangeMax)}%`;
        const markerLabel = resolveTimelineEventLabel(eventInfo);
        const hoverText = resolveTimelineEventHoverText(eventInfo) || "Event";
        const generatedSuffix = eventInfo?.generatedLabel
            ? `\n${eventInfo.generatedLabel}`
            : "";
        marker.title = currentMode.compareMode
            ? `${markerLabel}\n${hoverText}${generatedSuffix}`
            : `${markerLabel} - ${formatDateTimeLocal(clampedTime)}\n${hoverText}${generatedSuffix}`;
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

    function setEvents(eventInfos) {
        const normalizedEvents = Array.isArray(eventInfos) ? eventInfos : [];
        const signature = buildEventSignature(normalizedEvents);
        if (signature === lastEventSignature) {
            return;
        }

        lastEventSignature = signature;
        markers.innerHTML = "";

        for (let i = 0; i < normalizedEvents.length; i += 1) {
            const marker = renderMarker(normalizedEvents[i], i);
            if (marker) markers.appendChild(marker);
        }
        syncMarkerHighlights();
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
    }

    return {
        bind,
        setMode,
        setRange,
        setCurrentTime,
        setEvents,
        setCrafts,
    };
}

export { createTimelineDockController };
