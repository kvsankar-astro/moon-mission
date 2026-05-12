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

const SUPPORTED_VIEW_ID_SET = new Set(LUNAR_CRATER_SUPPORTED_VIEW_IDS);

export function supportsLunarCraterView(viewId) {
    return SUPPORTED_VIEW_ID_SET.has(viewId);
}

export function normalizeLunarCraterDisplayMode(value) {
    return value === LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        ? LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        : LUNAR_CRATER_DISPLAY_MODE_HOVER;
}

export function createDefaultLunarCraterViewState(overrides = {}) {
    return normalizeLunarCraterViewState(overrides, {
        viewLunarCraters: false,
        lunarCraterHoverLabels: true,
        lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
        lunarCraterLimit: 120,
    });
}

export function normalizeLunarCraterViewState(value = {}, fallback = createDefaultLunarCraterViewState()) {
    const craterLimit = Number(value.lunarCraterLimit);
    const fallbackLimit = Number(fallback.lunarCraterLimit);
    return {
        viewLunarCraters: value.viewLunarCraters === true,
        lunarCraterHoverLabels: value.lunarCraterHoverLabels !== false,
        lunarCraterDisplayMode: normalizeLunarCraterDisplayMode(
            value.lunarCraterDisplayMode ?? fallback.lunarCraterDisplayMode,
        ),
        lunarCraterLimit: Number.isFinite(craterLimit)
            ? craterLimit
            : (Number.isFinite(fallbackLimit) ? fallbackLimit : 120),
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
    if (Number.isFinite(Number(patch.lunarCraterLimit))) {
        nextState.lunarCraterLimit = Number(patch.lunarCraterLimit);
    }
    return normalizeLunarCraterViewState(nextState, state);
}
