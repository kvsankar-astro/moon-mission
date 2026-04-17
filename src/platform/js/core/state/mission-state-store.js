import { resolveLandingDataOriginKeys } from "../domain/origin-compat.js";

function createStateHelpers(state) {
    const getState = (key) => state[key].get();
    const setState = (key, value) => state[key].set(value);
    const setBooleanStateIfDefined = (key, value) => {
        if (value === undefined) return;
        setState(key, Boolean(value));
    };

    return {
        getState,
        setState,
        setBooleanStateIfDefined,
    };
}

function createMissionAppStatePort(ctx, helpers) {
    const { animationScenes } = ctx;
    const { getState, setState } = helpers;

    return {
        getGlobalConfig: () => getState("globalConfig"),
        setGlobalConfig: (value) => {
            setState("globalConfig", value);
        },
        getConfig: () => getState("config"),
        setConfig: (val) => {
            setState("config", val);
        },
        getCurrentDimension: () => getState("currentDimension"),
        setCurrentDimension: (val) => {
            setState("currentDimension", val);
        },
        getPreviousDimension: () => getState("previousDimension"),
        setPreviousDimension: (val) => {
            setState("previousDimension", val);
        },
        setDimensionChanged: (val) => {
            setState("dimensionChanged", val);
        },
        getDimensionChanged: () => getState("dimensionChanged"),
        setSvgContainer: (val) => {
            setState("svgContainer", val);
        },
        getSvgContainer: () => getState("svgContainer"),
        setDataLoaded: (val) => {
            setState("dataLoaded", val);
        },
        getDataLoaded: () => getState("dataLoaded"),
        setSvgX: (val) => {
            setState("svgX", val);
        },
        setSvgY: (val) => {
            setState("svgY", val);
        },
        setSvgWidth: (val) => {
            setState("svgWidth", val);
        },
        getSvgWidth: () => getState("svgWidth"),
        setSvgHeight: (val) => {
            setState("svgHeight", val);
        },
        getSvgHeight: () => getState("svgHeight"),
        setOffsetX: (val) => {
            setState("offsetx", val);
        },
        setOffsetY: (val) => {
            setState("offsety", val);
        },
        getOffsetX: () => getState("offsetx"),
        getOffsetY: () => getState("offsety"),
        setEpochJD: (val) => {
            setState("epochJD", val);
        },
        getEpochJD: () => getState("epochJD"),
        setEpochDate: (val) => {
            setState("epochDate", val);
        },
        getEpochDate: () => getState("epochDate"),
        getStartTime: () => getState("startTime"),
        setStartTime: (value) => {
            setState("startTime", value);
        },
        setEndTime: (value) => {
            setState("endTime", value);
        },
        getEndTimeSC: () => getState("endTimeSC"),
        setEndTimeSC: (value) => {
            setState("endTimeSC", value);
        },
        setLatestEndTime: (value) => {
            setState("latestEndTime", value);
        },
        getLatestEndTime: () => getState("latestEndTime"),
        setTimelineTotalSteps: (value) => {
            setState("timelineTotalSteps", value);
        },
        setTicksPerAnimationStep: (value) => {
            setState("ticksPerAnimationStep", value);
        },
        setPixelsPerAU: (value) => {
            setState("PIXELS_PER_AU", value);
        },
        getPixelsPerAU: () => getState("PIXELS_PER_AU"),
        setDefaultCameraDistance: (value) => {
            setState("defaultCameraDistance", value);
        },
        getDefaultCameraDistance: () => getState("defaultCameraDistance"),
        setTrackWidth: (value) => {
            setState("trackWidth", value);
        },
        setEarthRadius: (value) => {
            setState("earthRadius", value);
        },
        getEarthRadius: () => getState("earthRadius"),
        setMoonRadius: (value) => {
            setState("moonRadius", value);
        },
        getMoonRadius: () => getState("moonRadius"),
        getStartLandingTime: () => getState("startLandingTime"),
        setStartLandingTime: (value) => {
            setState("startLandingTime", value);
        },
        getEndLandingTime: () => getState("endLandingTime"),
        setEndLandingTime: (value) => {
            setState("endLandingTime", value);
        },
        setTimeTransLunarInjection: (value) => {
            setState("timeTransLunarInjection", value);
        },
        getTimeTransLunarInjection: () => getState("timeTransLunarInjection"),
        setTimeLunarOrbitInsertion: (value) => {
            setState("timeLunarOrbitInsertion", value);
        },
        getTimeLunarOrbitInsertion: () => getState("timeLunarOrbitInsertion"),
        getMissionTimes: () => ({
            timeTransLunarInjection: getState("timeTransLunarInjection"),
            timeLunarOrbitInsertion: getState("timeLunarOrbitInsertion"),
        }),
        getCraftData: () => getState("craftData"),
        setCraftData: (value) => {
            setState("craftData", value);
        },
        getAnimDate: () => getState("animDate"),
        setAnimDate: (value) => {
            setState("animDate", value);
        },
        setSunLongitude: (value) => {
            setState("sunLongitude", value);
        },
        getCraftId: () => getState("craftId"),
        getAnimationScenes: () => animationScenes,
        setSvgRect: (val) => {
            setState("svgRect", val);
        },
    };
}

function createMissionDataStatePort(ctx, helpers) {
    const {
        animationScenes,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        ephemerisStatuses,
        resolveBodySource,
        getActiveEphemerisSource,
    } = ctx;
    const { getState, setState } = helpers;

    return {
        getEphemerisSource: () => getState("ephemerisSource"),
        getBodiesForConfig: (cfg = getState("config")) => animationScenes[cfg]?.planetsForLocations || [],
        getBodySource: (bodyId) =>
            resolveBodySource({
                bodyId,
                bodySources: getState("bodyEphemerisSources"),
                defaultSpacecraftSource: getState("ephemerisSource"),
            }),
        getConfigsList: () => {
            const fallbackOrigins = Object.keys(animationScenes);
            return resolveLandingDataOriginKeys(getState("globalConfig"), {
                fallbackOriginKeys: fallbackOrigins,
            });
        },
        getLandingDataLoaded: () => getState("landingDataLoaded"),
        setLandingDataLoaded: (val) => {
            setState("landingDataLoaded", val);
        },
        setLandingNpzLoaded: (cfg, val) => {
            landingNpzLoaded[cfg] = val;
        },
        setLandingNpzData: (cfg, val) => {
            landingNpzData[cfg] = val;
        },
        setLandingChebyshevLoaded: (cfg, val) => {
            landingChebyshevLoaded[cfg] = val;
        },
        setLandingChebyshevData: (cfg, val) => {
            landingChebyshevData[cfg] = val;
        },
        getLandingNpzLoaded: (cfg = getState("config")) => !!landingNpzLoaded[cfg],
        getLandingNpzData: (cfg = getState("config")) => landingNpzData[cfg],
        getLandingChebyshevLoaded: (cfg = getState("config")) => !!landingChebyshevLoaded[cfg],
        getLandingChebyshevData: (cfg = getState("config")) => landingChebyshevData[cfg],
        getFrameMode: () => getState("frameMode"),
        getActiveEphemerisSource,
        resolveBodySourceFn: (bodyId) =>
            resolveBodySource({
                bodyId,
                bodySources: getState("bodyEphemerisSources"),
                defaultSpacecraftSource: getState("ephemerisSource"),
            }),
        getPlanetProperties: () => ctx.planetProperties,
        getEphemerisSourceFromData: () => getState("ephemerisSource"),
        setEphemerisSource: (value) => {
            setState("ephemerisSource", value);
        },
        setBodyEphemerisSources: (value) => {
            setState("bodyEphemerisSources", value);
        },
        setEphemerisStatusesForConfig: (cfg, status) => {
            ephemerisStatuses[cfg] = status;
        },
        getEventInfos: () => getState("eventInfos"),
        setEventInfos: (value) => {
            setState("eventInfos", value);
        },
        isOrbitDataProcessed: (cfg) => orbitDataProcessed[cfg],
        getChebyshevData: () => chebyshevData,
        getChebyshevDataLoaded: () => chebyshevDataLoaded,
        getNpzData: () => npzData,
        getNpzDataLoaded: () => npzDataLoaded,
        getLandingNpzDataByConfig: (cfg) => landingNpzData[cfg],
        getLandingNpzLoadedByConfig: (cfg) => landingNpzLoaded[cfg],
        getLandingChebyshevDataByConfig: (cfg) => landingChebyshevData[cfg],
        getLandingChebyshevLoadedByConfig: (cfg) => landingChebyshevLoaded[cfg],
        getBodySources: () => getState("bodyEphemerisSources"),
        getActiveEphemerisSourceForConfig: (cfg) => getActiveEphemerisSource(cfg),
    };
}

function createMissionSessionStatePort(ctx, helpers) {
    const { runtimeFlags } = ctx;
    const { getState, setState } = helpers;

    return {
        getJoyRideFlag: () => runtimeFlags.joyRide,
        setJoyRideFlag: (val) => {
            runtimeFlags.joyRide = val;
        },
        getLandingFlag: () => runtimeFlags.landing,
        setLandingFlag: (val) => {
            runtimeFlags.landing = val;
        },
        getAnimTime: () => getState("animTime"),
        setAnimTime: (val) => {
            setState("animTime", val);
        },
        getAnimationRunning: () => getState("animationRunning"),
    };
}

function createMissionSceneViewStatePort(ctx, helpers) {
    const {
        state,
        getPlaneVariablesState,
        getZoomFactorState,
        getPanXState,
        getPanYState,
        getPlaneSelectionState,
        setPlaneVariablesState,
        syncPlaneStateForConfig,
    } = ctx;
    const { getState, setState, setBooleanStateIfDefined } = helpers;

    return {
        getZoomFactor: () => getZoomFactorState(getState("config")),
        getPlaneVariables: () => {
            const vars = getPlaneVariablesState(getState("config"));
            return {
                xFactor: vars.xFactor,
                yFactor: vars.yFactor,
                xVariable: vars.xVariable,
                yVariable: vars.yVariable,
            };
        },
        getXFactor: () => getPlaneVariablesState(getState("config")).xFactor,
        getYFactor: () => getPlaneVariablesState(getState("config")).yFactor,
        getXVariable: () => getPlaneVariablesState(getState("config")).xVariable,
        getYVariable: () => getPlaneVariablesState(getState("config")).yVariable,
        getPanX: () => getPanXState(getState("config")),
        getPanY: () => getPanYState(getState("config")),
        getPlaneSelection: () => getPlaneSelectionState(getState("config")),
        setPlaneVariables: (planeConfig) => {
            setPlaneVariablesState(planeConfig, getState("config"));
        },
        setViewFlags: (view = {}) => {
            setBooleanStateIfDefined("viewAuxiliaryPanels", view.viewAuxiliaryPanels);
            setBooleanStateIfDefined("viewOrbit", view.viewOrbit);
            setBooleanStateIfDefined("viewOrbitDescent", view.viewOrbitDescent);
            setBooleanStateIfDefined("viewCraters", view.viewCraters);
            setBooleanStateIfDefined("viewXYZAxes", view.viewXYZAxes);
            setBooleanStateIfDefined("viewPoles", view.viewPoles);
            setBooleanStateIfDefined("viewPolarAxes", view.viewPolarAxes);
            setBooleanStateIfDefined("viewSky", view.viewSky);
            setBooleanStateIfDefined("viewConstellationLines", view.viewConstellationLines);
            setBooleanStateIfDefined("viewMoonSOI", view.viewMoonSOI);
            setBooleanStateIfDefined("viewMoonHillSphere", view.viewMoonHillSphere);
            setBooleanStateIfDefined("viewBodyHalos", view.viewBodyHalos);
            setBooleanStateIfDefined("viewMoonOsculatingOrbit", view.viewMoonOsculatingOrbit);
            setBooleanStateIfDefined("viewEclipticPlane", view.viewEclipticPlane);
            setBooleanStateIfDefined("viewEquatorialPlane", view.viewEquatorialPlane);
            setBooleanStateIfDefined("viewFPS", view.viewFPS);
            if (view.orbitStyle === "classic" || view.orbitStyle === "trail") {
                setState("orbitStyle", view.orbitStyle);
            }
            if (Number.isFinite(view.trailTrackBrightness2D)) {
                setState("trailTrackBrightness2D", view.trailTrackBrightness2D);
            }
            if (Number.isFinite(view.trailTrackBrightness3D)) {
                setState("trailTrackBrightness3D", view.trailTrackBrightness3D);
            }
            if (Number.isFinite(view.trailTailBrightness2D)) {
                setState("trailTailBrightness2D", view.trailTailBrightness2D);
            }
            if (Number.isFinite(view.trailTailBrightness3D)) {
                setState("trailTailBrightness3D", view.trailTailBrightness3D);
            }
        },
        onConfigChanged: (newConfig) => {
            syncPlaneStateForConfig(newConfig);
        },
        getPlaneVariablesStateForConfig: () => getPlaneVariablesState(getState("config")),
        getZoomFactorStateForConfig: () => getZoomFactorState(getState("config")),
        getPanXStateForConfig: () => getPanXState(getState("config")),
        getPanYStateForConfig: () => getPanYState(getState("config")),
        getViewSky: () => getState("viewSky"),
        getViewConstellationLines: () => getState("viewConstellationLines"),
        getOrbitStyle: () => getState("orbitStyle"),
        getEffectiveOrbitStyle: () =>
            typeof state.effectiveOrbitStyle?.get === "function"
                ? state.effectiveOrbitStyle.get()
                : getState("orbitStyle"),
        getTrailTrackBrightness2D: () => getState("trailTrackBrightness2D"),
        getTrailTrackBrightness3D: () => getState("trailTrackBrightness3D"),
        getTrailTailBrightness2D: () => getState("trailTailBrightness2D"),
        getTrailTailBrightness3D: () => getState("trailTailBrightness3D"),
    };
}

function createMissionSceneRuntimePort(ctx, helpers) {
    const { animationScenes, getRuntimeBootstrapActions, getAnimationSceneInitDone } = ctx;
    const { getState, setState } = helpers;

    return {
        getSceneHandler: () => getState("theSceneHandler"),
        setSceneHandler: (value) => {
            setState("theSceneHandler", value);
        },
        getBurnButtonHandler: () => getRuntimeBootstrapActions()?.burnButtonHandler,
        setSceneState: (cfg, stateValue) => {
            if (animationScenes[cfg]) {
                animationScenes[cfg].state = stateValue;
            }
        },
        getSceneStateInitDone: () => getAnimationSceneInitDone(),
        toggleLanding: () => getRuntimeBootstrapActions().toggleLanding(),
    };
}

function createMissionInteractionStatePort(_ctx, helpers) {
    const { getState, setState } = helpers;

    return {
        getStartLandingFlag: () => getState("startLandingFlag"),
        clearStartLandingFlag: () => {
            setState("startLandingFlag", false);
        },
        getMouseDownTimeout: () => getState("mousedownTimeout"),
        setMouseDownTimeout: (val) => {
            setState("mousedownTimeout", val);
        },
        getTimeoutHandleZoom: () => getState("timeoutHandleZoom"),
        setTimeoutHandleZoom: (handle) => {
            setState("timeoutHandleZoom", handle);
        },
        setMouseDown: (value) => {
            setState("mouseDown", value);
        },
        setMissionStartCalled: (val) => {
            setState("missionStartCalled", val);
        },
        getMissionStartCalled: () => getState("missionStartCalled"),
        getLegacyTimeoutHandle: () => getState("timeoutHandle"),
    };
}

function createMissionStatePorts(ctx) {
    const helpers = createStateHelpers(ctx.state);

    return {
        app: createMissionAppStatePort(ctx, helpers),
        data: createMissionDataStatePort(ctx, helpers),
        session: createMissionSessionStatePort(ctx, helpers),
        sceneView: createMissionSceneViewStatePort(ctx, helpers),
        sceneRuntime: createMissionSceneRuntimePort(ctx, helpers),
        interaction: createMissionInteractionStatePort(ctx, helpers),
    };
}

function createMissionStateStore(ctx) {
    const ports = createMissionStatePorts(ctx);
    return {
        ...ports.app,
        ...ports.data,
        ...ports.session,
        ...ports.sceneView,
        ...ports.sceneRuntime,
        ...ports.interaction,
    };
}

export { createMissionStatePorts, createMissionStateStore };
