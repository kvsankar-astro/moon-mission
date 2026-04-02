import {
    formatDateOnlyLocal,
    formatDateTimeLocal,
    formatTimeOnlyLocal,
} from "../utils/time-utils.js";

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
                eventInfo?.hoverText || "",
            ].join("|");
        })
        .join(";");
}

function createTimelineDockController({
    onSeekTime,
    onMarkerSelect,
    onMarkerHover,
    onMarkerLeave,
    onCraftSelect,
}) {
    const slider = document.getElementById("timeline-slider");
    const markers = document.getElementById("timeline-markers");
    const startLabel = document.getElementById("timeline-start-label");
    const endLabel = document.getElementById("timeline-end-label");
    const currentLabel = document.getElementById("timeline-current-label");
    const craftStrip = document.getElementById("timeline-craft-strip");

    if (!slider || !markers || !startLabel || !endLabel || !currentLabel || !craftStrip) {
        return {
            bind: () => {},
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
    let isBound = false;

    function updateCurrentLabel(timeMs) {
        currentLabel.textContent = formatDateTimeLocal(timeMs);
        slider.setAttribute("aria-valuetext", formatDateTimeLocal(timeMs));
    }

    function formatEdgeLabel(timeMs) {
        return `<span class="timeline-dock__edge-date">${formatDateOnlyLocal(timeMs)}</span><span class="timeline-dock__edge-time">${formatTimeOnlyLocal(timeMs, { includeOffset: true })}</span>`;
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
        const markerClasses = ["timeline-dock__marker"];
        if (eventInfo?.burnFlag) {
            markerClasses.push("timeline-dock__marker--burn");
        }
        if (eventInfo?.clickable === false) {
            markerClasses.push("timeline-dock__marker--inactive");
            marker.setAttribute("aria-disabled", "true");
        }
        marker.className = markerClasses.join(" ");
        marker.style.left = `${computePercent(clampedTime, rangeMin, rangeMax)}%`;
        const hoverText = eventInfo?.hoverText || eventInfo?.infoText || eventInfo?.label || "Event";
        marker.title = `${eventInfo?.label || "Event"} - ${formatDateTimeLocal(clampedTime)}\n${hoverText}`;
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
        setCrafts,
    };
}

export { createTimelineDockController };
