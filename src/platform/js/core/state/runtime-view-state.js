const VIEW_FLAG_KEYS = [
    "viewPhotoMode",
    "viewAuxiliaryPanels",
    "viewOrbit",
    "viewOrbitDescent",
    "viewCraters",
    "viewXYZAxes",
    "viewPoles",
    "viewPolarAxes",
    "viewSky",
    "viewConstellationLines",
    "viewMoonSOI",
    "viewMoonHillSphere",
    "viewBodyHalos",
    "viewMoonOsculatingOrbit",
    "viewEclipticPlane",
    "viewEquatorialPlane",
    "viewFPS",
];

function buildDefaultViewFlags() {
    return {
        viewPhotoMode: false,
        viewAuxiliaryPanels: false,
        viewOrbit: true,
        viewOrbitDescent: true,
        viewCraters: true,
        viewXYZAxes: false,
        viewPoles: false,
        viewPolarAxes: false,
        viewSky: true,
        viewConstellationLines: false,
        viewMoonSOI: false,
        viewMoonHillSphere: false,
        viewBodyHalos: true,
        viewMoonOsculatingOrbit: true,
        viewEclipticPlane: false,
        viewEquatorialPlane: false,
        viewFPS: true,
        orbitStyle: "trail",
        trailTrackBrightness2D: 1,
        trailTrackBrightness3D: 1,
        trailTailBrightness2D: 1,
        trailTailBrightness3D: 1,
    };
}

function applyViewFlagPatch(target, patch) {
    if (!patch || typeof patch !== "object") return;
    for (const key of VIEW_FLAG_KEYS) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            target[key] = Boolean(patch[key]);
        }
    }
    if (patch.orbitStyle === "classic" || patch.orbitStyle === "trail") {
        target.orbitStyle = patch.orbitStyle;
    }
    if (Number.isFinite(patch.trailTrackBrightness2D)) {
        target.trailTrackBrightness2D = patch.trailTrackBrightness2D;
    }
    if (Number.isFinite(patch.trailTrackBrightness3D)) {
        target.trailTrackBrightness3D = patch.trailTrackBrightness3D;
    }
    if (Number.isFinite(patch.trailTailBrightness2D)) {
        target.trailTailBrightness2D = patch.trailTailBrightness2D;
    }
    if (Number.isFinite(patch.trailTailBrightness3D)) {
        target.trailTailBrightness3D = patch.trailTailBrightness3D;
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
        getViewPhotoMode: () => viewFlags.viewPhotoMode,
        setViewPhotoMode: (value) => {
            viewFlags.viewPhotoMode = Boolean(value);
        },
        getViewAuxiliaryPanels: () => viewFlags.viewAuxiliaryPanels,
        setViewAuxiliaryPanels: (value) => {
            viewFlags.viewAuxiliaryPanels = Boolean(value);
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
        getViewConstellationLines: () => viewFlags.viewConstellationLines,
        setViewConstellationLines: (value) => {
            viewFlags.viewConstellationLines = Boolean(value);
        },
        getViewMoonSOI: () => viewFlags.viewMoonSOI,
        setViewMoonSOI: (value) => {
            viewFlags.viewMoonSOI = Boolean(value);
        },
        getViewMoonHillSphere: () => viewFlags.viewMoonHillSphere,
        setViewMoonHillSphere: (value) => {
            viewFlags.viewMoonHillSphere = Boolean(value);
        },
        getViewBodyHalos: () => viewFlags.viewBodyHalos,
        setViewBodyHalos: (value) => {
            viewFlags.viewBodyHalos = Boolean(value);
        },
        getViewMoonOsculatingOrbit: () => viewFlags.viewMoonOsculatingOrbit,
        setViewMoonOsculatingOrbit: (value) => {
            viewFlags.viewMoonOsculatingOrbit = Boolean(value);
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
        getOrbitStyle: () => viewFlags.orbitStyle || "classic",
        setOrbitStyle: (value) => {
            viewFlags.orbitStyle = value === "trail" ? "trail" : "classic";
        },
        getTrailTrackBrightness2D: () => viewFlags.trailTrackBrightness2D ?? 1,
        setTrailTrackBrightness2D: (value) => {
            viewFlags.trailTrackBrightness2D = Number.isFinite(value) ? value : 1;
        },
        getTrailTrackBrightness3D: () => viewFlags.trailTrackBrightness3D ?? 1,
        setTrailTrackBrightness3D: (value) => {
            viewFlags.trailTrackBrightness3D = Number.isFinite(value) ? value : 1;
        },
        getTrailTailBrightness2D: () => viewFlags.trailTailBrightness2D ?? 1,
        setTrailTailBrightness2D: (value) => {
            viewFlags.trailTailBrightness2D = Number.isFinite(value) ? value : 1;
        },
        getTrailTailBrightness3D: () => viewFlags.trailTailBrightness3D ?? 1,
        setTrailTailBrightness3D: (value) => {
            viewFlags.trailTailBrightness3D = Number.isFinite(value) ? value : 1;
        },
    };
}

export { createRuntimeViewState };


