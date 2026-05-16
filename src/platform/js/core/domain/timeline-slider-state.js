function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function readFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.NaN;
}

function readTimelineSliderMissionState(slider) {
    if (
        !slider ||
        typeof slider.value === "undefined" ||
        typeof slider.min === "undefined" ||
        typeof slider.max === "undefined"
    ) {
        return null;
    }

    const visibleMinRaw = readFiniteNumber(slider.min);
    const visibleMaxRaw = readFiniteNumber(slider.max);
    if (!Number.isFinite(visibleMinRaw) || !Number.isFinite(visibleMaxRaw)) {
        return null;
    }

    const viewMin = Math.min(visibleMinRaw, visibleMaxRaw);
    const viewMax = Math.max(visibleMinRaw, visibleMaxRaw);
    const rangeMinRaw = readFiniteNumber(slider.dataset?.rangeMinMs);
    const rangeMaxRaw = readFiniteNumber(slider.dataset?.rangeMaxMs);
    const hasFullRange = Number.isFinite(rangeMinRaw) && Number.isFinite(rangeMaxRaw);
    const min = hasFullRange ? Math.min(rangeMinRaw, rangeMaxRaw) : viewMin;
    const max = hasFullRange ? Math.max(rangeMinRaw, rangeMaxRaw) : viewMax;
    const preciseValue = readFiniteNumber(slider.dataset?.currentTimeMs);
    const sliderValue = readFiniteNumber(slider.value);
    const value = Number.isFinite(preciseValue) ? preciseValue : sliderValue;
    if (!Number.isFinite(value)) {
        return null;
    }

    return {
        slider,
        min,
        max,
        viewMin,
        viewMax,
        value: clamp(value, min, max),
    };
}

function applyTimelineSliderMissionSeek(slider, timeMs, { source = "" } = {}) {
    const timelineState = readTimelineSliderMissionState(slider);
    const targetTimeMs = readFiniteNumber(timeMs);
    if (!timelineState || !Number.isFinite(targetTimeMs)) {
        return null;
    }

    const clamped = clamp(targetTimeMs, timelineState.min, timelineState.max);
    const dataset = slider.dataset || (slider.dataset = {});
    const datasetViewMin = readFiniteNumber(dataset.viewMinMs);
    const datasetViewMax = readFiniteNumber(dataset.viewMaxMs);
    const hasDatasetView = Number.isFinite(datasetViewMin) && Number.isFinite(datasetViewMax);
    const viewMin = hasDatasetView ? Math.min(datasetViewMin, datasetViewMax) : timelineState.viewMin;
    const viewMax = hasDatasetView ? Math.max(datasetViewMin, datasetViewMax) : timelineState.viewMax;
    const visibleValue = clamp(clamped, viewMin, viewMax);

    slider.value = String(visibleValue);
    dataset.currentTimeMs = String(clamped);
    dataset.programmaticSeekTimeMs = String(clamped);
    if (source) {
        dataset.programmaticSeekSource = source;
    }

    return {
        timeMs: clamped,
        visibleTimeMs: visibleValue,
    };
}

export {
    applyTimelineSliderMissionSeek,
    readTimelineSliderMissionState,
};
