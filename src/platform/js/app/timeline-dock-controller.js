import { formatDateOnly, formatDateTimeIST, formatTimeOnly } from "../utils/time-utils.js";

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
            ].join("|");
        })
        .join(";");
}

function createTimelineDockController({
    onSeekTime,
    onMarkerSelect,
}) {
    const slider = document.getElementById("timeline-slider");
    const markers = document.getElementById("timeline-markers");
    const startLabel = document.getElementById("timeline-start-label");
    const endLabel = document.getElementById("timeline-end-label");
    const currentLabel = document.getElementById("timeline-current-label");

    if (!slider || !markers || !startLabel || !endLabel || !currentLabel) {
        return {
            bind: () => {},
            setRange: () => {},
            setCurrentTime: () => {},
            setEvents: () => {},
        };
    }

    let rangeMin = 0;
    let rangeMax = 0;
    let lastRangeSignature = "";
    let lastEventSignature = "";
    let isBound = false;

    function updateCurrentLabel(timeMs) {
        currentLabel.textContent = formatDateTimeIST(timeMs);
        slider.setAttribute("aria-valuetext", formatDateTimeIST(timeMs));
    }

    function formatEdgeLabel(timeMs) {
        return `<span class="timeline-dock__edge-date">${formatDateOnly(timeMs)}</span><span class="timeline-dock__edge-time">${formatTimeOnly(timeMs)}</span>`;
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
        startLabel.innerHTML = formatEdgeLabel(normalizedMin);
        endLabel.innerHTML = formatEdgeLabel(normalizedMax);
        slider.value = String(clamp(Number(slider.value), normalizedMin, normalizedMax));
    }

    function setCurrentTime(timeMs) {
        if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) return;
        const clamped = clamp(timeMs, rangeMin, rangeMax);
        slider.value = String(clamped);
        updateCurrentLabel(clamped);
    }

    function renderMarker(eventInfo, index) {
        const eventTimeMs = eventInfo?.startTime instanceof Date
            ? eventInfo.startTime.getTime()
            : Number.NaN;
        if (!Number.isFinite(eventTimeMs)) return null;

        const clampedTime = clamp(eventTimeMs, rangeMin, rangeMax);
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = eventInfo?.burnFlag
            ? "timeline-dock__marker timeline-dock__marker--burn"
            : "timeline-dock__marker";
        marker.style.left = `${computePercent(clampedTime, rangeMin, rangeMax)}%`;
        marker.title = `${eventInfo?.label || "Event"} - ${formatDateTimeIST(clampedTime)}`;
        marker.setAttribute("aria-label", marker.title);
        marker.addEventListener("click", () => {
            onMarkerSelect?.(eventInfo, index);
        });
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
    }

    function bind() {
        if (isBound) return;
        isBound = true;

        slider.addEventListener("input", () => {
            const timeMs = Number(slider.value);
            if (!Number.isFinite(timeMs)) return;
            updateCurrentLabel(timeMs);
            onSeekTime?.(timeMs, false);
        });

        slider.addEventListener("change", () => {
            const timeMs = Number(slider.value);
            if (!Number.isFinite(timeMs)) return;
            onSeekTime?.(timeMs, true);
        });
    }

    return {
        bind,
        setRange,
        setCurrentTime,
        setEvents,
    };
}

export { createTimelineDockController };
