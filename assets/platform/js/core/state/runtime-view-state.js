const VIEW_FLAG_KEYS = [
    "viewOrbit",
    "viewOrbitDescent",
    "viewCraters",
    "viewXYZAxes",
    "viewPoles",
    "viewPolarAxes",
    "viewSky",
    "viewMoonSOI",
    "viewEclipticPlane",
    "viewEquatorialPlane",
    "viewFPS",
];

function buildDefaultViewFlags() {
    return {
        viewOrbit: true,
        viewOrbitDescent: true,
        viewCraters: true,
        viewXYZAxes: true,
        viewPoles: true,
        viewPolarAxes: true,
        viewSky: true,
        viewMoonSOI: false,
        viewEclipticPlane: false,
        viewEquatorialPlane: false,
        viewFPS: true,
    };
}

function applyViewFlagPatch(target, patch) {
    if (!patch || typeof patch !== "object") return;
    for (const key of VIEW_FLAG_KEYS) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            target[key] = Boolean(patch[key]);
        }
    }
}

function createRuntimeViewState({
    initialConfig = undefined,
    initialCurrentDimension = "3D",
    initialPreviousDimension = null,
    initialDimensionChanged = false,
    initialViewFlags = undefined,
} = {}) {
    let config = initialConfig;
    let currentDimension = initialCurrentDimension;
    let previousDimension = initialPreviousDimension;
    let dimensionChanged = Boolean(initialDimensionChanged);
    const viewFlags = buildDefaultViewFlags();
    applyViewFlagPatch(viewFlags, initialViewFlags);

    return {
        getConfig: () => config,
        setConfig: (value) => {
            config = value;
        },
        getCurrentDimension: () => currentDimension,
        setCurrentDimension: (value) => {
            currentDimension = value;
        },
        getPreviousDimension: () => previousDimension,
        setPreviousDimension: (value) => {
            previousDimension = value;
        },
        getDimensionChanged: () => dimensionChanged,
        setDimensionChanged: (value) => {
            dimensionChanged = Boolean(value);
        },
        getViewFlags: () => ({ ...viewFlags }),
        setViewFlags: (patch) => {
            applyViewFlagPatch(viewFlags, patch);
        },
        getViewOrbit: () => viewFlags.viewOrbit,
        setViewOrbit: (value) => {
            viewFlags.viewOrbit = Boolean(value);
        },
        getViewOrbitDescent: () => viewFlags.viewOrbitDescent,
        setViewOrbitDescent: (value) => {
            viewFlags.viewOrbitDescent = Boolean(value);
        },
        getViewCraters: () => viewFlags.viewCraters,
        setViewCraters: (value) => {
            viewFlags.viewCraters = Boolean(value);
        },
        getViewXYZAxes: () => viewFlags.viewXYZAxes,
        setViewXYZAxes: (value) => {
            viewFlags.viewXYZAxes = Boolean(value);
        },
        getViewPoles: () => viewFlags.viewPoles,
        setViewPoles: (value) => {
            viewFlags.viewPoles = Boolean(value);
        },
        getViewPolarAxes: () => viewFlags.viewPolarAxes,
        setViewPolarAxes: (value) => {
            viewFlags.viewPolarAxes = Boolean(value);
        },
        getViewSky: () => viewFlags.viewSky,
        setViewSky: (value) => {
            viewFlags.viewSky = Boolean(value);
        },
        getViewMoonSOI: () => viewFlags.viewMoonSOI,
        setViewMoonSOI: (value) => {
            viewFlags.viewMoonSOI = Boolean(value);
        },
        getViewEclipticPlane: () => viewFlags.viewEclipticPlane,
        setViewEclipticPlane: (value) => {
            viewFlags.viewEclipticPlane = Boolean(value);
        },
        getViewEquatorialPlane: () => viewFlags.viewEquatorialPlane,
        setViewEquatorialPlane: (value) => {
            viewFlags.viewEquatorialPlane = Boolean(value);
        },
        getViewFPS: () => viewFlags.viewFPS,
        setViewFPS: (value) => {
            viewFlags.viewFPS = Boolean(value);
        },
    };
}

export { createRuntimeViewState };
