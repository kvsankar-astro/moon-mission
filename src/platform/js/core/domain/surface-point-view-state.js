const SURFACE_POINT_VIEW_KEYS = Object.freeze([
    "viewSubSolarEarth",
    "viewSubSolarMoon",
    "viewSubMoonEarth",
    "viewSolarGlintEarth",
    "viewLunarGlintEarth",
    "viewSubCraftEarth",
    "viewSubCraftMoon",
]);

function createDefaultSurfacePointViewState(seed = {}) {
    const state = {};
    SURFACE_POINT_VIEW_KEYS.forEach((key) => {
        state[key] = seed?.[key] === true;
    });
    return state;
}

function normalizeSurfacePointViewState(state = {}) {
    return createDefaultSurfacePointViewState(state);
}

function patchSurfacePointViewState(state = {}, patch = {}) {
    return normalizeSurfacePointViewState({
        ...state,
        ...patch,
    });
}

function hasSurfacePointViewEnabled(state = {}) {
    return SURFACE_POINT_VIEW_KEYS.some((key) => state?.[key] === true);
}

export {
    SURFACE_POINT_VIEW_KEYS,
    createDefaultSurfacePointViewState,
    hasSurfacePointViewEnabled,
    normalizeSurfacePointViewState,
    patchSurfacePointViewState,
};
