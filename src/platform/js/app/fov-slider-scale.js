const DEFAULT_MIN_DEGREES = 0.1;
const DEFAULT_MAX_DEGREES = 179;
const DEFAULT_FALLBACK_DEGREES = 50;
export const DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES = 35;
const RADIANS_PER_DEGREE = Math.PI / 180;
const DEGREES_PER_RADIAN = 180 / Math.PI;

export const FOV_SLIDER_SCALE_MIN = 0;
export const FOV_SLIDER_SCALE_MAX = 1000;
export const FOV_SLIDER_SCALE_STEP = 1;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeRange({
    minDegrees = DEFAULT_MIN_DEGREES,
    maxDegrees = DEFAULT_MAX_DEGREES,
    fallbackDegrees = DEFAULT_FALLBACK_DEGREES,
    midpointDegrees = DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES,
} = {}) {
    const safeMin = Number.isFinite(minDegrees) ? minDegrees : DEFAULT_MIN_DEGREES;
    const safeMax = Number.isFinite(maxDegrees) ? maxDegrees : DEFAULT_MAX_DEGREES;
    const lower = Math.max(DEFAULT_MIN_DEGREES, Math.min(safeMin, safeMax - 1e-6));
    const upper = Math.min(DEFAULT_MAX_DEGREES, Math.max(safeMax, lower + 1e-6));
    const fallback = clamp(
        Number.isFinite(fallbackDegrees) ? fallbackDegrees : DEFAULT_FALLBACK_DEGREES,
        lower,
        upper,
    );
    const midpoint = clamp(
        Number.isFinite(midpointDegrees) ? midpointDegrees : DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES,
        lower + 1e-6,
        upper - 1e-6,
    );

    return {
        minDegrees: lower,
        maxDegrees: upper,
        fallbackDegrees: fallback,
        midpointDegrees: midpoint,
    };
}

export function clampFovDegrees(value, options = {}) {
    const range = normalizeRange(options);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return range.fallbackDegrees;
    }
    return clamp(parsed, range.minDegrees, range.maxDegrees);
}

function fovDegreesToZoomMagnitude(fovDegrees) {
    const clampedRadians = clampFovDegrees(fovDegrees, {
        minDegrees: DEFAULT_MIN_DEGREES,
        maxDegrees: DEFAULT_MAX_DEGREES,
        fallbackDegrees: DEFAULT_FALLBACK_DEGREES,
    }) * RADIANS_PER_DEGREE;
    return 1 / Math.tan(clampedRadians * 0.5);
}

function zoomMagnitudeToFovDegrees(zoomMagnitude) {
    const safeZoom = Math.max(Number(zoomMagnitude) || 0, 1e-9);
    return 2 * Math.atan(1 / safeZoom) * DEGREES_PER_RADIAN;
}

export function fovDegreesToZoomSliderValue(fovDegrees, options = {}) {
    const range = normalizeRange(options);
    const currentDegrees = clampFovDegrees(fovDegrees, range);
    const narrowZoom = fovDegreesToZoomMagnitude(range.minDegrees);
    const middleZoom = fovDegreesToZoomMagnitude(range.midpointDegrees);
    const wideZoom = fovDegreesToZoomMagnitude(range.maxDegrees);
    const currentZoom = fovDegreesToZoomMagnitude(currentDegrees);
    const narrowLog = Math.log(narrowZoom);
    const middleLog = Math.log(middleZoom);
    const wideLog = Math.log(wideZoom);
    const currentLog = Math.log(currentZoom);

    let fraction = 0;
    if (currentDegrees <= range.midpointDegrees) {
        const lowSpan = middleLog - narrowLog;
        const localFraction = Math.abs(lowSpan) > 1e-9
            ? (currentLog - narrowLog) / lowSpan
            : 0;
        fraction = clamp(localFraction, 0, 1) * 0.5;
    } else {
        const highSpan = wideLog - middleLog;
        const localFraction = Math.abs(highSpan) > 1e-9
            ? (currentLog - middleLog) / highSpan
            : 0;
        fraction = 0.5 + clamp(localFraction, 0, 1) * 0.5;
    }

    return FOV_SLIDER_SCALE_MIN + fraction * (FOV_SLIDER_SCALE_MAX - FOV_SLIDER_SCALE_MIN);
}

export function zoomSliderValueToFovDegrees(sliderValue, options = {}) {
    const range = normalizeRange(options);
    const parsed = Number(sliderValue);
    const fraction = clamp(
        Number.isFinite(parsed)
            ? (parsed - FOV_SLIDER_SCALE_MIN) / Math.max(FOV_SLIDER_SCALE_MAX - FOV_SLIDER_SCALE_MIN, 1)
            : 0,
        0,
        1,
    );
    const narrowZoom = fovDegreesToZoomMagnitude(range.minDegrees);
    const middleZoom = fovDegreesToZoomMagnitude(range.midpointDegrees);
    const wideZoom = fovDegreesToZoomMagnitude(range.maxDegrees);
    const narrowLog = Math.log(narrowZoom);
    const middleLog = Math.log(middleZoom);
    const wideLog = Math.log(wideZoom);
    const logZoom = fraction <= 0.5
        ? narrowLog + (fraction / 0.5) * (middleLog - narrowLog)
        : middleLog + ((fraction - 0.5) / 0.5) * (wideLog - middleLog);
    return clampFovDegrees(zoomMagnitudeToFovDegrees(Math.exp(logZoom)), range);
}

export function formatFovDegreesLabel(fovDegrees, options = {}) {
    const digits = Number.isInteger(options.digits) ? options.digits : 1;
    const clamped = clampFovDegrees(fovDegrees, options);
    return `${clamped.toFixed(digits)}°`;
}

export function applyZoomScaleToFovSlider(slider, {
    minDegrees = DEFAULT_MIN_DEGREES,
    maxDegrees = DEFAULT_MAX_DEGREES,
    initialFovDegrees = DEFAULT_FALLBACK_DEGREES,
} = {}) {
    if (!slider) {
        return;
    }
    slider.min = String(FOV_SLIDER_SCALE_MIN);
    slider.max = String(FOV_SLIDER_SCALE_MAX);
    slider.step = String(FOV_SLIDER_SCALE_STEP);
    slider.value = String(Math.round(fovDegreesToZoomSliderValue(initialFovDegrees, {
        minDegrees,
        maxDegrees,
        fallbackDegrees: initialFovDegrees,
    })));
}
