export const LUNAR_CRATER_VIEW_IDS = Object.freeze({
    MAIN: "main",
    FRAME_AND_SHOOT: "frame_and_shoot",
});

export const LUNAR_CRATER_SUPPORTED_VIEW_IDS = Object.freeze([
    LUNAR_CRATER_VIEW_IDS.MAIN,
    LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
]);

export const LUNAR_CRATER_DISPLAY_MODE_ALWAYS = "always";
export const LUNAR_CRATER_DISPLAY_MODE_HOVER = "hover";
export const LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM = 80;
export const LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM = 600;
export const LUNAR_CRATER_RANGE_MIN_DIAMETER_KM = 0;
export const LUNAR_CRATER_RANGE_MAX_DIAMETER_KM = 600;
export const LUNAR_CRATER_DIAMETER_STEP_KM = 10;

const SUPPORTED_VIEW_ID_SET = new Set(LUNAR_CRATER_SUPPORTED_VIEW_IDS);

export function supportsLunarCraterView(viewId) {
    return SUPPORTED_VIEW_ID_SET.has(viewId);
}

export function normalizeLunarCraterDisplayMode(value) {
    return value === LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        ? LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        : LUNAR_CRATER_DISPLAY_MODE_HOVER;
}

function readDiameterValue(value, fallback) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function normalizeLunarCraterDiameterRange(value = {}, fallback = {}, bounds = {}) {
    const minBound = readDiameterValue(
        bounds.minDiameterKm,
        LUNAR_CRATER_RANGE_MIN_DIAMETER_KM,
    );
    const maxBound = Math.max(
        minBound,
        readDiameterValue(bounds.maxDiameterKm, LUNAR_CRATER_RANGE_MAX_DIAMETER_KM),
    );
    const fallbackMin = readDiameterValue(
        fallback.lunarCraterMinDiameterKm ?? fallback.minDiameterKm,
        LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
    );
    const fallbackMax = readDiameterValue(
        fallback.lunarCraterMaxDiameterKm ?? fallback.maxDiameterKm,
        LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
    );
    const rawMin = readDiameterValue(
        value.lunarCraterMinDiameterKm ?? value.minDiameterKm,
        fallbackMin,
    );
    const rawMax = readDiameterValue(
        value.lunarCraterMaxDiameterKm ?? value.maxDiameterKm,
        fallbackMax,
    );
    const clampedMin = Math.min(maxBound, Math.max(minBound, rawMin));
    const clampedMax = Math.min(maxBound, Math.max(minBound, rawMax));

    return {
        lunarCraterMinDiameterKm: Math.min(clampedMin, clampedMax),
        lunarCraterMaxDiameterKm: Math.max(clampedMin, clampedMax),
    };
}

export function createDefaultLunarCraterViewState(overrides = {}) {
    return normalizeLunarCraterViewState(overrides, {
        viewLunarCraters: false,
        lunarCraterHoverLabels: true,
        lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
        lunarCraterMinDiameterKm: LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
        lunarCraterMaxDiameterKm: LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
    });
}

export function normalizeLunarCraterViewState(value = {}, fallback = createDefaultLunarCraterViewState()) {
    const diameterRange = normalizeLunarCraterDiameterRange(value, fallback);
    return {
        viewLunarCraters: value.viewLunarCraters === true,
        lunarCraterHoverLabels: value.lunarCraterHoverLabels !== false,
        lunarCraterDisplayMode: normalizeLunarCraterDisplayMode(
            value.lunarCraterDisplayMode ?? fallback.lunarCraterDisplayMode,
        ),
        ...diameterRange,
    };
}

export function patchLunarCraterViewState(state = createDefaultLunarCraterViewState(), patch = {}) {
    const nextState = { ...state };
    if (Object.prototype.hasOwnProperty.call(patch, "viewLunarCraters")) {
        nextState.viewLunarCraters = patch.viewLunarCraters === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterHoverLabels")) {
        nextState.lunarCraterHoverLabels = patch.lunarCraterHoverLabels !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterDisplayMode")) {
        nextState.lunarCraterDisplayMode = normalizeLunarCraterDisplayMode(patch.lunarCraterDisplayMode);
    }
    if (
        Number.isFinite(Number(patch.lunarCraterMinDiameterKm)) ||
        Number.isFinite(Number(patch.lunarCraterMaxDiameterKm))
    ) {
        Object.assign(nextState, normalizeLunarCraterDiameterRange(patch, state));
    }
    return normalizeLunarCraterViewState(nextState, state);
}
