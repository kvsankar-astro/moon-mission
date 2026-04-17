import {
    createMissionStatePorts,
    flattenMissionStatePorts,
} from "../core/state/mission-state-store.js";

function createMutableStateCell(get, set) {
    return { get, set };
}

function createReadonlyStateCell(get) {
    return { get, set: () => {} };
}

function createMissionLocalStateCells({
    mutableStateAccessors = {},
    readonlyStateAccessors = {},
    createMutableStateCellImpl = createMutableStateCell,
    createReadonlyStateCellImpl = createReadonlyStateCell,
} = {}) {
    return {
        ...Object.fromEntries(
            Object.entries(mutableStateAccessors).map(([key, accessors]) => {
                const [get, set] = accessors;
                return [key, createMutableStateCellImpl(get, set)];
            }),
        ),
        ...Object.fromEntries(
            Object.entries(readonlyStateAccessors).map(([key, get]) => [
                key,
                createReadonlyStateCellImpl(get),
            ]),
        ),
    };
}

function createMissionViewStateCells(runtimeViewState, getEffectiveOrbitStyle) {
    return {
        config: createMutableStateCell(
            () => runtimeViewState.getConfig(),
            (value) => { runtimeViewState.setConfig(value); },
        ),
        currentDimension: createMutableStateCell(
            () => runtimeViewState.getCurrentDimension(),
            (value) => { runtimeViewState.setCurrentDimension(value); },
        ),
        previousDimension: createMutableStateCell(
            () => runtimeViewState.getPreviousDimension(),
            (value) => { runtimeViewState.setPreviousDimension(value); },
        ),
        dimensionChanged: createMutableStateCell(
            () => runtimeViewState.getDimensionChanged(),
            (value) => { runtimeViewState.setDimensionChanged(value); },
        ),
        viewAuxiliaryPanels: createMutableStateCell(
            () => runtimeViewState.getViewAuxiliaryPanels(),
            (value) => { runtimeViewState.setViewAuxiliaryPanels(value); },
        ),
        viewOrbit: createMutableStateCell(
            () => runtimeViewState.getViewOrbit(),
            (value) => { runtimeViewState.setViewOrbit(value); },
        ),
        viewOrbitDescent: createMutableStateCell(
            () => runtimeViewState.getViewOrbitDescent(),
            (value) => { runtimeViewState.setViewOrbitDescent(value); },
        ),
        viewCraters: createMutableStateCell(
            () => runtimeViewState.getViewCraters(),
            (value) => { runtimeViewState.setViewCraters(value); },
        ),
        viewXYZAxes: createMutableStateCell(
            () => runtimeViewState.getViewXYZAxes(),
            (value) => { runtimeViewState.setViewXYZAxes(value); },
        ),
        viewPoles: createMutableStateCell(
            () => runtimeViewState.getViewPoles(),
            (value) => { runtimeViewState.setViewPoles(value); },
        ),
        viewPolarAxes: createMutableStateCell(
            () => runtimeViewState.getViewPolarAxes(),
            (value) => { runtimeViewState.setViewPolarAxes(value); },
        ),
        viewSky: createMutableStateCell(
            () => runtimeViewState.getViewSky(),
            (value) => { runtimeViewState.setViewSky(value); },
        ),
        viewConstellationLines: createMutableStateCell(
            () => runtimeViewState.getViewConstellationLines(),
            (value) => { runtimeViewState.setViewConstellationLines(value); },
        ),
        viewMoonSOI: createMutableStateCell(
            () => runtimeViewState.getViewMoonSOI(),
            (value) => { runtimeViewState.setViewMoonSOI(value); },
        ),
        viewMoonHillSphere: createMutableStateCell(
            () => runtimeViewState.getViewMoonHillSphere(),
            (value) => { runtimeViewState.setViewMoonHillSphere(value); },
        ),
        viewBodyHalos: createMutableStateCell(
            () => runtimeViewState.getViewBodyHalos(),
            (value) => { runtimeViewState.setViewBodyHalos(value); },
        ),
        viewMoonOsculatingOrbit: createMutableStateCell(
            () => runtimeViewState.getViewMoonOsculatingOrbit(),
            (value) => { runtimeViewState.setViewMoonOsculatingOrbit(value); },
        ),
        viewEclipticPlane: createMutableStateCell(
            () => runtimeViewState.getViewEclipticPlane(),
            (value) => { runtimeViewState.setViewEclipticPlane(value); },
        ),
        viewEquatorialPlane: createMutableStateCell(
            () => runtimeViewState.getViewEquatorialPlane(),
            (value) => { runtimeViewState.setViewEquatorialPlane(value); },
        ),
        viewFPS: createMutableStateCell(
            () => runtimeViewState.getViewFPS(),
            (value) => { runtimeViewState.setViewFPS(value); },
        ),
        orbitStyle: createMutableStateCell(
            () => runtimeViewState.getOrbitStyle(),
            (value) => { runtimeViewState.setOrbitStyle(value); },
        ),
        effectiveOrbitStyle: createReadonlyStateCell(() => getEffectiveOrbitStyle()),
        trailTrackBrightness2D: createMutableStateCell(
            () => runtimeViewState.getTrailTrackBrightness2D(),
            (value) => { runtimeViewState.setTrailTrackBrightness2D(value); },
        ),
        trailTrackBrightness3D: createMutableStateCell(
            () => runtimeViewState.getTrailTrackBrightness3D(),
            (value) => { runtimeViewState.setTrailTrackBrightness3D(value); },
        ),
        trailTailBrightness2D: createMutableStateCell(
            () => runtimeViewState.getTrailTailBrightness2D(),
            (value) => { runtimeViewState.setTrailTailBrightness2D(value); },
        ),
        trailTailBrightness3D: createMutableStateCell(
            () => runtimeViewState.getTrailTailBrightness3D(),
            (value) => { runtimeViewState.setTrailTailBrightness3D(value); },
        ),
    };
}

function createMissionSessionStateCells(runtimeSessionState) {
    return {
        animTime: createMutableStateCell(
            () => runtimeSessionState.getAnimTime(),
            (value) => { runtimeSessionState.setAnimTime(value); },
        ),
        animationRunning: createReadonlyStateCell(
            () => runtimeSessionState.getAnimationRunning(),
        ),
    };
}

function createMissionInteractionStateCells(runtimeInteractionState) {
    return {
        startLandingFlag: createMutableStateCell(
            () => runtimeInteractionState.getStartLandingFlag(),
            (value) => { runtimeInteractionState.setStartLandingFlag(value); },
        ),
        mousedownTimeout: createMutableStateCell(
            () => runtimeInteractionState.getMouseDownTimeout(),
            (value) => { runtimeInteractionState.setMouseDownTimeout(value); },
        ),
        timeoutHandleZoom: createMutableStateCell(
            () => runtimeInteractionState.getTimeoutHandleZoom(),
            (value) => { runtimeInteractionState.setTimeoutHandleZoom(value); },
        ),
        mouseDown: createMutableStateCell(
            () => runtimeInteractionState.getMouseDown(),
            (value) => { runtimeInteractionState.setMouseDown(value); },
        ),
        missionStartCalled: createMutableStateCell(
            () => runtimeInteractionState.getMissionStartCalled(),
            (value) => { runtimeInteractionState.setMissionStartCalled(value); },
        ),
        timeoutHandle: createReadonlyStateCell(
            () => runtimeInteractionState.getLegacyTimeoutHandle(),
        ),
    };
}

function createMissionStateCells({
    localStateCells = {},
    runtimeViewState,
    runtimeSessionState,
    runtimeInteractionState,
    getEffectiveOrbitStyle,
}) {
    return {
        ...localStateCells,
        ...createMissionViewStateCells(runtimeViewState, getEffectiveOrbitStyle),
        ...createMissionSessionStateCells(runtimeSessionState),
        ...createMissionInteractionStateCells(runtimeInteractionState),
    };
}

function createMissionStateAccess(ctx) {
    return flattenMissionStatePorts(createMissionStatePorts(ctx));
}

export {
    createMissionLocalStateCells,
    createMissionStateAccess,
    createMissionStateCells,
    createMutableStateCell,
    createReadonlyStateCell,
};
