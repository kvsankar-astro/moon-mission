import {
    createDefaultLunarCraterViewState,
    normalizeLunarCraterViewState,
    patchLunarCraterViewState,
} from "./lunar-crater-view.js";

export const LUNAR_FEATURE_PRESET_IDS = Object.freeze({
    INTERESTING: "interesting",
    ALL: "all",
    CRATERS_ONLY: "craters_only",
    NON_CRATER: "non_crater",
});

const BASE_DEFAULT_LUNAR_FEATURE_TYPE_FILTERS = Object.freeze({
    "Satellite Feature": { enabled: false, minDiameterKm: null, maxDiameterKm: null },
    "Crater, craters": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Rima, rimae": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Mons, montes": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Dorsum, dorsa": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Mare, maria": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Catena, catenae": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Vallis, valles": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Promontorium, promontoria": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Palus, paludes": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Oceanus, oceani": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
    "Planitia, planitiae": { enabled: true, minDiameterKm: null, maxDiameterKm: null },
});

const BASE_DEFAULT_LUNAR_FEATURE_VIEW_STATE = Object.freeze({
    viewCraters: true,
    lunarFeatureTypeFilters: BASE_DEFAULT_LUNAR_FEATURE_TYPE_FILTERS,
    ...createDefaultLunarCraterViewState(),
});

function normalizeOptionalDiameter(value, fallback = null) {
    if (value === null || value === undefined || value === "") {
        if (fallback === null || fallback === undefined || fallback === "") {
            return null;
        }
        const fallbackNumeric = Number(fallback);
        return Number.isFinite(fallbackNumeric) ? fallbackNumeric : null;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return numeric;
    }
    if (fallback === null || fallback === undefined || fallback === "") {
        return null;
    }
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) ? fallbackNumeric : null;
}

function normalizeLunarFeatureTypeFilterEntry(entry = {}, fallback = {}) {
    const normalized = {
        enabled: entry?.enabled !== false,
        minDiameterKm: normalizeOptionalDiameter(entry?.minDiameterKm, fallback?.minDiameterKm),
        maxDiameterKm: normalizeOptionalDiameter(entry?.maxDiameterKm, fallback?.maxDiameterKm),
    };
    if (
        Number.isFinite(normalized.minDiameterKm) &&
        Number.isFinite(normalized.maxDiameterKm) &&
        normalized.minDiameterKm > normalized.maxDiameterKm
    ) {
        const swap = normalized.minDiameterKm;
        normalized.minDiameterKm = normalized.maxDiameterKm;
        normalized.maxDiameterKm = swap;
    }
    return normalized;
}

export function normalizeLunarFeatureTypeFilters(value = {}, fallback = {}) {
    const merged = {};
    const fallbackSource = fallback && typeof fallback === "object"
        ? fallback
        : {};
    const valueSource = value && typeof value === "object"
        ? value
        : {};
    const keys = new Set([
        ...Object.keys(BASE_DEFAULT_LUNAR_FEATURE_TYPE_FILTERS),
        ...Object.keys(fallbackSource),
        ...Object.keys(valueSource),
    ]);
    for (const key of keys) {
        const fallbackEntry = fallbackSource[key] || BASE_DEFAULT_LUNAR_FEATURE_TYPE_FILTERS[key] || {};
        merged[key] = normalizeLunarFeatureTypeFilterEntry(valueSource[key], fallbackEntry);
    }
    return merged;
}

export function createDefaultLunarFeatureViewState(overrides = {}) {
    return normalizeLunarFeatureViewState({
        ...BASE_DEFAULT_LUNAR_FEATURE_VIEW_STATE,
        ...overrides,
    }, BASE_DEFAULT_LUNAR_FEATURE_VIEW_STATE);
}

export function normalizeLunarFeatureViewState(
    value = {},
    fallback = null,
) {
    const resolvedFallback = fallback
        ? {
            ...BASE_DEFAULT_LUNAR_FEATURE_VIEW_STATE,
            ...fallback,
        }
        : BASE_DEFAULT_LUNAR_FEATURE_VIEW_STATE;
    const craterState = normalizeLunarCraterViewState(value, resolvedFallback);
    const normalized = {
        viewCraters: Object.prototype.hasOwnProperty.call(value, "viewCraters")
            ? value.viewCraters !== false
            : resolvedFallback.viewCraters !== false,
        lunarFeatureTypeFilters: normalizeLunarFeatureTypeFilters(
            value.lunarFeatureTypeFilters,
            resolvedFallback.lunarFeatureTypeFilters,
        ),
        ...craterState,
    };
    normalized.viewLunarFeatures = normalized.viewLunarCraters === true;
    return normalized;
}

export function patchLunarFeatureViewState(
    state = createDefaultLunarFeatureViewState(),
    patch = {},
) {
    const baseState = normalizeLunarFeatureViewState(state);
    const craterPatchState = patchLunarCraterViewState(baseState, patch);
    const nextState = {
        ...craterPatchState,
        viewCraters: Object.prototype.hasOwnProperty.call(patch, "viewCraters")
            ? patch.viewCraters !== false
            : baseState.viewCraters,
        lunarFeatureTypeFilters: Object.prototype.hasOwnProperty.call(patch, "lunarFeatureTypeFilters")
            ? normalizeLunarFeatureTypeFilters(
                patch.lunarFeatureTypeFilters,
                baseState.lunarFeatureTypeFilters,
            )
            : baseState.lunarFeatureTypeFilters,
    };
    return normalizeLunarFeatureViewState(nextState, baseState);
}
