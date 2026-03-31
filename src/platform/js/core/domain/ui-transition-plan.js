const DEFAULT_VIEW_SETTINGS = Object.freeze({
    viewOrbit: true,
    viewOrbitDescent: true,
    viewCraters: true,
    viewXYZAxes: true,
    viewPoles: true,
    viewPolarAxes: true,
    viewSky: true,
    viewConstellationLines: false,
    viewMoonSOI: false,
    viewEclipticPlane: false,
    viewEquatorialPlane: false,
});

const JOYRIDE_VIEW_SETTINGS = Object.freeze({
    viewOrbit: false,
    viewOrbitDescent: false,
    viewCraters: false,
    viewXYZAxes: false,
    viewPoles: false,
    viewPolarAxes: false,
    viewSky: true,
    viewConstellationLines: false,
    viewMoonSOI: false,
    viewEclipticPlane: false,
    viewEquatorialPlane: false,
});

const LANDING_VIEW_SETTINGS = Object.freeze({
    viewOrbit: false,
    viewOrbitDescent: true,
    viewCraters: false,
    viewXYZAxes: false,
    viewPoles: false,
    viewPolarAxes: false,
    viewSky: true,
    viewConstellationLines: false,
    viewMoonSOI: false,
    viewEclipticPlane: false,
    viewEquatorialPlane: false,
});

function cloneViewSettings(viewSettings) {
    return {
        ...viewSettings,
    };
}

function planOriginModeTransition({
    currentConfig,
    requestedConfig,
    currentSceneState,
    addCurveDoneState,
}) {
    if (currentConfig === requestedConfig) {
        return {
            shouldSwitch: false,
            previousConfig: currentConfig,
            nextConfig: currentConfig,
            shouldDisposeCurrentScene: false,
        };
    }

    const hasCurrentScene = currentSceneState !== undefined && currentSceneState !== null;
    return {
        shouldSwitch: true,
        previousConfig: currentConfig,
        nextConfig: requestedConfig,
        shouldDisposeCurrentScene: hasCurrentScene && currentSceneState !== addCurveDoneState,
    };
}

function planRuntimeModeToggle({
    intent,
    joyRideActive,
    landingActive,
    landingEnabled,
}) {
    if (intent === "joyride") {
        const nextJoyRide = !joyRideActive;
        return {
            allowed: true,
            nextFlags: {
                joyRide: nextJoyRide,
                landing: false,
            },
            controlStates: {
                joyRide: nextJoyRide,
                landing: false,
            },
            craftVisibility: {
                craftVisible: !nextJoyRide,
                craftEdgesVisible: !nextJoyRide,
            },
            shouldResetMotherContainer: nextJoyRide,
            viewSettings: cloneViewSettings(nextJoyRide ? JOYRIDE_VIEW_SETTINGS : DEFAULT_VIEW_SETTINGS),
        };
    }

    if (intent === "landing") {
        if (!landingEnabled) {
            return {
                allowed: false,
                reason: "landing-disabled",
            };
        }

        const nextLanding = !landingActive;
        return {
            allowed: true,
            nextFlags: {
                joyRide: false,
                landing: nextLanding,
            },
            controlStates: {
                joyRide: false,
                landing: nextLanding,
            },
            craftVisibility: {
                craftVisible: true,
                craftEdgesVisible: true,
            },
            shouldResetMotherContainer: nextLanding,
            viewSettings: cloneViewSettings(nextLanding ? LANDING_VIEW_SETTINGS : DEFAULT_VIEW_SETTINGS),
        };
    }

    return {
        allowed: false,
        reason: "unknown-intent",
    };
}

function planDimensionTransition({
    requestedDimension,
    previousDimension,
}) {
    const dimensionChanged = requestedDimension !== previousDimension;
    return {
        requestedDimension,
        nextCurrentDimension: requestedDimension,
        nextPreviousDimension: requestedDimension,
        dimensionChanged,
        is3D: requestedDimension === "3D",
    };
}

export {
    planDimensionTransition,
    planOriginModeTransition,
    planRuntimeModeToggle,
};
