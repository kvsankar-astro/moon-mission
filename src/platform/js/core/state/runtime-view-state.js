const VIEW_FLAG_KEYS = [
    "viewPhotoMode",
    "viewEarthClouds",
    "viewAuxiliaryPanels",
    "viewOrbit",
    "viewOrbitDescent",
    "viewCraters",
    "viewLunarCraters",
    "lunarCraterHoverLabels",
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

const LUNAR_CRATER_DISPLAY_MODE_ALWAYS = "always";
const LUNAR_CRATER_DISPLAY_MODE_HOVER = "hover";
const DEFAULT_VIEW_IDENTITY = Object.freeze({
    originMode: "geo",
    cameraPositionMode: "manual",
    cameraLookMode: "manual",
    planeSelection: "DEFAULT",
    dimension: "3D",
});
const PER_VIEW_FLAG_KEYS = Object.freeze([
    "viewLunarCraters",
    "lunarCraterHoverLabels",
    "lunarCraterDisplayMode",
    "lunarCraterLimit",
]);

function normalizeLunarCraterDisplayMode(value) {
    return value === LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        ? LUNAR_CRATER_DISPLAY_MODE_ALWAYS
        : LUNAR_CRATER_DISPLAY_MODE_HOVER;
}

function normalizeString(value, fallback) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || fallback;
}

function normalizeViewIdentity(identity = {}) {
    return {
        originMode: normalizeString(identity.originMode ?? identity.config, DEFAULT_VIEW_IDENTITY.originMode),
        cameraPositionMode: normalizeString(identity.cameraPositionMode, DEFAULT_VIEW_IDENTITY.cameraPositionMode),
        cameraLookMode: normalizeString(identity.cameraLookMode, DEFAULT_VIEW_IDENTITY.cameraLookMode),
        planeSelection: normalizeString(identity.planeSelection, DEFAULT_VIEW_IDENTITY.planeSelection),
        dimension: normalizeString(identity.dimension, DEFAULT_VIEW_IDENTITY.dimension),
    };
}

function buildViewIdentityKey(identity = {}) {
    const normalized = normalizeViewIdentity(identity);
    return [
        `origin=${normalized.originMode}`,
        `camera=${normalized.cameraPositionMode}>${normalized.cameraLookMode}`,
        `plane=${normalized.planeSelection}`,
        `dimension=${normalized.dimension}`,
    ].join("|");
}

function buildDefaultViewFlags() {
    return {
        viewPhotoMode: false,
        viewEarthClouds: true,
        viewAuxiliaryPanels: false,
        viewOrbit: true,
        viewOrbitDescent: true,
        viewCraters: true,
        viewLunarCraters: false,
        lunarCraterHoverLabels: true,
        lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
        lunarCraterLimit: 120,
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

function applyViewFlagPatch(target, patch, options = {}) {
    if (!patch || typeof patch !== "object") return;
    const allowedKeys = options.allowedKeys
        ? new Set(options.allowedKeys)
        : null;
    const blockedKeys = options.blockedKeys
        ? new Set(options.blockedKeys)
        : null;
    const canApplyKey = (key) =>
        (!allowedKeys || allowedKeys.has(key)) &&
        (!blockedKeys || !blockedKeys.has(key));
    for (const key of VIEW_FLAG_KEYS) {
        if (canApplyKey(key) && Object.prototype.hasOwnProperty.call(patch, key)) {
            target[key] = Boolean(patch[key]);
        }
    }
    if (canApplyKey("orbitStyle") && (patch.orbitStyle === "classic" || patch.orbitStyle === "trail")) {
        target.orbitStyle = patch.orbitStyle;
    }
    if (canApplyKey("trailTrackBrightness2D") && Number.isFinite(patch.trailTrackBrightness2D)) {
        target.trailTrackBrightness2D = patch.trailTrackBrightness2D;
    }
    if (canApplyKey("trailTrackBrightness3D") && Number.isFinite(patch.trailTrackBrightness3D)) {
        target.trailTrackBrightness3D = patch.trailTrackBrightness3D;
    }
    if (canApplyKey("trailTailBrightness2D") && Number.isFinite(patch.trailTailBrightness2D)) {
        target.trailTailBrightness2D = patch.trailTailBrightness2D;
    }
    if (canApplyKey("trailTailBrightness3D") && Number.isFinite(patch.trailTailBrightness3D)) {
        target.trailTailBrightness3D = patch.trailTailBrightness3D;
    }
    const craterLimit = Number(patch.lunarCraterLimit);
    if (canApplyKey("lunarCraterLimit") && Number.isFinite(craterLimit)) {
        target.lunarCraterLimit = craterLimit;
    }
    if (canApplyKey("lunarCraterDisplayMode") && Object.prototype.hasOwnProperty.call(patch, "lunarCraterDisplayMode")) {
        target.lunarCraterDisplayMode = normalizeLunarCraterDisplayMode(patch.lunarCraterDisplayMode);
    }
}

function hasPerViewFlagPatch(patch) {
    return !!patch &&
        typeof patch === "object" &&
        PER_VIEW_FLAG_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

function extractPerViewFlagPatch(patch) {
    const perViewPatch = {};
    if (!patch || typeof patch !== "object") return perViewPatch;
    for (const key of PER_VIEW_FLAG_KEYS) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            perViewPatch[key] = patch[key];
        }
    }
    return perViewPatch;
}

function mergeViewFlags(globalViewFlags, perViewFlags) {
    return {
        ...globalViewFlags,
        ...perViewFlags,
    };
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
    let currentViewIdentity = normalizeViewIdentity({
        originMode: initialConfig,
        dimension: initialCurrentDimension,
    });
    let currentViewIdentityKey = buildViewIdentityKey(currentViewIdentity);
    const perViewFlagsByIdentity = new Map();

    function ensurePerViewFlags(identityKey = currentViewIdentityKey) {
        if (!perViewFlagsByIdentity.has(identityKey)) {
            perViewFlagsByIdentity.set(identityKey, extractPerViewFlagPatch(viewFlags));
        }
        return perViewFlagsByIdentity.get(identityKey);
    }

    function getEffectiveViewFlags() {
        return mergeViewFlags(viewFlags, ensurePerViewFlags());
    }

    function setPerViewFlags(patch, identityKey = currentViewIdentityKey) {
        if (!hasPerViewFlagPatch(patch)) return;
        applyViewFlagPatch(
            ensurePerViewFlags(identityKey),
            patch,
            { allowedKeys: PER_VIEW_FLAG_KEYS },
        );
    }

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
        getCurrentViewIdentity: () => ({ ...currentViewIdentity }),
        getCurrentViewIdentityKey: () => currentViewIdentityKey,
        setCurrentViewIdentity: (identity, options = {}) => {
            const nextIdentity = normalizeViewIdentity(identity);
            const nextIdentityKey = buildViewIdentityKey(nextIdentity);
            const previousIdentityKey = currentViewIdentityKey;
            if (options.previousViewFlags && previousIdentityKey) {
                setPerViewFlags(options.previousViewFlags, previousIdentityKey);
            }
            currentViewIdentity = nextIdentity;
            currentViewIdentityKey = nextIdentityKey;
            ensurePerViewFlags(nextIdentityKey);
            return {
                changed: previousIdentityKey !== nextIdentityKey,
                previousIdentityKey,
                currentIdentityKey: nextIdentityKey,
                viewFlags: getEffectiveViewFlags(),
            };
        },
        getViewFlags: () => ({ ...getEffectiveViewFlags() }),
        setViewFlags: (patch) => {
            applyViewFlagPatch(viewFlags, patch, { blockedKeys: PER_VIEW_FLAG_KEYS });
            setPerViewFlags(patch);
        },
        getViewOrbit: () => getEffectiveViewFlags().viewOrbit,
        setViewOrbit: (value) => {
            viewFlags.viewOrbit = Boolean(value);
        },
        getViewPhotoMode: () => getEffectiveViewFlags().viewPhotoMode,
        setViewPhotoMode: (value) => {
            viewFlags.viewPhotoMode = Boolean(value);
        },
        getViewEarthClouds: () => getEffectiveViewFlags().viewEarthClouds,
        setViewEarthClouds: (value) => {
            viewFlags.viewEarthClouds = Boolean(value);
        },
        getViewAuxiliaryPanels: () => getEffectiveViewFlags().viewAuxiliaryPanels,
        setViewAuxiliaryPanels: (value) => {
            viewFlags.viewAuxiliaryPanels = Boolean(value);
        },
        getViewOrbitDescent: () => getEffectiveViewFlags().viewOrbitDescent,
        setViewOrbitDescent: (value) => {
            viewFlags.viewOrbitDescent = Boolean(value);
        },
        getViewCraters: () => getEffectiveViewFlags().viewCraters,
        setViewCraters: (value) => {
            viewFlags.viewCraters = Boolean(value);
        },
        getViewLunarCraters: () => getEffectiveViewFlags().viewLunarCraters,
        setViewLunarCraters: (value) => {
            setPerViewFlags({ viewLunarCraters: value });
        },
        getLunarCraterHoverLabels: () => getEffectiveViewFlags().lunarCraterHoverLabels,
        setLunarCraterHoverLabels: (value) => {
            setPerViewFlags({ lunarCraterHoverLabels: value });
        },
        getLunarCraterDisplayMode: () => normalizeLunarCraterDisplayMode(getEffectiveViewFlags().lunarCraterDisplayMode),
        setLunarCraterDisplayMode: (value) => {
            setPerViewFlags({ lunarCraterDisplayMode: value });
        },
        getLunarCraterLimit: () => getEffectiveViewFlags().lunarCraterLimit ?? 120,
        setLunarCraterLimit: (value) => {
            setPerViewFlags({ lunarCraterLimit: value });
        },
        getViewXYZAxes: () => getEffectiveViewFlags().viewXYZAxes,
        setViewXYZAxes: (value) => {
            viewFlags.viewXYZAxes = Boolean(value);
        },
        getViewPoles: () => getEffectiveViewFlags().viewPoles,
        setViewPoles: (value) => {
            viewFlags.viewPoles = Boolean(value);
        },
        getViewPolarAxes: () => getEffectiveViewFlags().viewPolarAxes,
        setViewPolarAxes: (value) => {
            viewFlags.viewPolarAxes = Boolean(value);
        },
        getViewSky: () => getEffectiveViewFlags().viewSky,
        setViewSky: (value) => {
            viewFlags.viewSky = Boolean(value);
        },
        getViewConstellationLines: () => getEffectiveViewFlags().viewConstellationLines,
        setViewConstellationLines: (value) => {
            viewFlags.viewConstellationLines = Boolean(value);
        },
        getViewMoonSOI: () => getEffectiveViewFlags().viewMoonSOI,
        setViewMoonSOI: (value) => {
            viewFlags.viewMoonSOI = Boolean(value);
        },
        getViewMoonHillSphere: () => getEffectiveViewFlags().viewMoonHillSphere,
        setViewMoonHillSphere: (value) => {
            viewFlags.viewMoonHillSphere = Boolean(value);
        },
        getViewBodyHalos: () => getEffectiveViewFlags().viewBodyHalos,
        setViewBodyHalos: (value) => {
            viewFlags.viewBodyHalos = Boolean(value);
        },
        getViewMoonOsculatingOrbit: () => getEffectiveViewFlags().viewMoonOsculatingOrbit,
        setViewMoonOsculatingOrbit: (value) => {
            viewFlags.viewMoonOsculatingOrbit = Boolean(value);
        },
        getViewEclipticPlane: () => getEffectiveViewFlags().viewEclipticPlane,
        setViewEclipticPlane: (value) => {
            viewFlags.viewEclipticPlane = Boolean(value);
        },
        getViewEquatorialPlane: () => getEffectiveViewFlags().viewEquatorialPlane,
        setViewEquatorialPlane: (value) => {
            viewFlags.viewEquatorialPlane = Boolean(value);
        },
        getViewFPS: () => getEffectiveViewFlags().viewFPS,
        setViewFPS: (value) => {
            viewFlags.viewFPS = Boolean(value);
        },
        getOrbitStyle: () => getEffectiveViewFlags().orbitStyle || "classic",
        setOrbitStyle: (value) => {
            viewFlags.orbitStyle = value === "trail" ? "trail" : "classic";
        },
        getTrailTrackBrightness2D: () => getEffectiveViewFlags().trailTrackBrightness2D ?? 1,
        setTrailTrackBrightness2D: (value) => {
            viewFlags.trailTrackBrightness2D = Number.isFinite(value) ? value : 1;
        },
        getTrailTrackBrightness3D: () => getEffectiveViewFlags().trailTrackBrightness3D ?? 1,
        setTrailTrackBrightness3D: (value) => {
            viewFlags.trailTrackBrightness3D = Number.isFinite(value) ? value : 1;
        },
        getTrailTailBrightness2D: () => getEffectiveViewFlags().trailTailBrightness2D ?? 1,
        setTrailTailBrightness2D: (value) => {
            viewFlags.trailTailBrightness2D = Number.isFinite(value) ? value : 1;
        },
        getTrailTailBrightness3D: () => getEffectiveViewFlags().trailTailBrightness3D ?? 1,
        setTrailTailBrightness3D: (value) => {
            viewFlags.trailTailBrightness3D = Number.isFinite(value) ? value : 1;
        },
    };
}

export { buildViewIdentityKey, createRuntimeViewState, normalizeViewIdentity };


