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
export const LUNAR_CRATER_HOVER_DEFAULT_MIN_DIAMETER_KM = 0;
export const LUNAR_CRATER_HOVER_DEFAULT_MAX_DIAMETER_KM = 600;
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
        lunarCraterShowAllEnabled: false,
        lunarCraterHoverEnabled: false,
        lunarCraterHoverLabels: true,
        lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
        lunarCraterMinDiameterKm: LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
        lunarCraterMaxDiameterKm: LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
        lunarCraterHoverMinDiameterKm: LUNAR_CRATER_HOVER_DEFAULT_MIN_DIAMETER_KM,
        lunarCraterHoverMaxDiameterKm: LUNAR_CRATER_HOVER_DEFAULT_MAX_DIAMETER_KM,
    });
}

export function normalizeLunarCraterViewState(value = {}, fallback = createDefaultLunarCraterViewState()) {
    const diameterRange = normalizeLunarCraterDiameterRange(value, fallback);
    const hoverDiameterRange = normalizeLunarCraterDiameterRange({
        lunarCraterMinDiameterKm: value.lunarCraterHoverMinDiameterKm ?? value.hoverMinDiameterKm,
        lunarCraterMaxDiameterKm: value.lunarCraterHoverMaxDiameterKm ?? value.hoverMaxDiameterKm,
    }, {
        lunarCraterMinDiameterKm: fallback.lunarCraterHoverMinDiameterKm ?? LUNAR_CRATER_HOVER_DEFAULT_MIN_DIAMETER_KM,
        lunarCraterMaxDiameterKm: fallback.lunarCraterHoverMaxDiameterKm ?? LUNAR_CRATER_HOVER_DEFAULT_MAX_DIAMETER_KM,
    });
    const displayMode = normalizeLunarCraterDisplayMode(
        value.lunarCraterDisplayMode ?? fallback.lunarCraterDisplayMode,
    );
    const hasShowAllEnabled = Object.prototype.hasOwnProperty.call(value, "lunarCraterShowAllEnabled");
    const hasHoverEnabled = Object.prototype.hasOwnProperty.call(value, "lunarCraterHoverEnabled");
    const hasViewEnabled = Object.prototype.hasOwnProperty.call(value, "viewLunarCraters");
    const viewEnabled = hasViewEnabled
        ? value.viewLunarCraters === true
        : fallback.viewLunarCraters === true;
    let showAllEnabled = hasShowAllEnabled
        ? value.lunarCraterShowAllEnabled === true
        : viewEnabled && displayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS;
    let hoverEnabled = hasHoverEnabled
        ? value.lunarCraterHoverEnabled === true
        : viewEnabled && (
            displayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER ||
            (
                displayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS &&
                value.lunarCraterHoverLabels !== false
            )
        );
    if (
        viewEnabled &&
        !showAllEnabled &&
        !hoverEnabled &&
        (hasViewEnabled || Object.prototype.hasOwnProperty.call(value, "lunarCraterDisplayMode"))
    ) {
        showAllEnabled = displayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS;
        hoverEnabled = displayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER ||
            (
                displayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS &&
                value.lunarCraterHoverLabels !== false
            );
    }
    const anyEnabled = showAllEnabled || hoverEnabled;
    return {
        viewLunarCraters: anyEnabled,
        lunarCraterShowAllEnabled: showAllEnabled,
        lunarCraterHoverEnabled: hoverEnabled,
        lunarCraterHoverLabels: value.lunarCraterHoverLabels !== false,
        lunarCraterDisplayMode: showAllEnabled
            ? LUNAR_CRATER_DISPLAY_MODE_ALWAYS
            : LUNAR_CRATER_DISPLAY_MODE_HOVER,
        ...diameterRange,
        lunarCraterHoverMinDiameterKm: hoverDiameterRange.lunarCraterMinDiameterKm,
        lunarCraterHoverMaxDiameterKm: hoverDiameterRange.lunarCraterMaxDiameterKm,
    };
}

export function patchLunarCraterViewState(state = createDefaultLunarCraterViewState(), patch = {}) {
    const nextState = {
        ...state,
        ...patch,
    };
    if (
        Object.prototype.hasOwnProperty.call(patch, "viewLunarCraters") &&
        !Object.prototype.hasOwnProperty.call(patch, "lunarCraterShowAllEnabled") &&
        !Object.prototype.hasOwnProperty.call(patch, "lunarCraterHoverEnabled")
    ) {
        if (patch.viewLunarCraters === true) {
            const mode = normalizeLunarCraterDisplayMode(nextState.lunarCraterDisplayMode);
            nextState.lunarCraterShowAllEnabled = mode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS;
            nextState.lunarCraterHoverEnabled = mode === LUNAR_CRATER_DISPLAY_MODE_HOVER ||
                (
                    mode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS &&
                    nextState.lunarCraterHoverLabels !== false
                );
        } else {
            nextState.lunarCraterShowAllEnabled = false;
            nextState.lunarCraterHoverEnabled = false;
        }
    }
    return normalizeLunarCraterViewState(nextState, state);
}
